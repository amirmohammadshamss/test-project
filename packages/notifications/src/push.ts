import {
  ECDH,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import { lookup } from 'node:dns';
import { Agent } from 'node:https';
import type { LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import webPush from 'web-push';
export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export function validatePushSubscription(value: BrowserPushSubscription) {
  let url: URL;
  try {
    url = new URL(value.endpoint);
  } catch {
    throw new Error('INVALID_PUSH_ENDPOINT');
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443') ||
    value.endpoint.length > 2048 ||
    !(
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
      ].includes(host) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host)
    )
  )
    throw new Error('INVALID_PUSH_ENDPOINT');
  if (
    !/^[a-zA-Z0-9_-]+$/.test(value.keys.auth) ||
    !/^[a-zA-Z0-9_-]+$/.test(value.keys.p256dh) ||
    Buffer.from(value.keys.auth, 'base64url').length !== 16 ||
    Buffer.from(value.keys.p256dh, 'base64url').length !== 65 ||
    Buffer.from(value.keys.p256dh, 'base64url')[0] !== 4
  )
    throw new Error('INVALID_PUSH_KEYS');
  try {
    ECDH.convertKey(Buffer.from(value.keys.p256dh, 'base64url'), 'prime256v1');
  } catch {
    throw new Error('INVALID_PUSH_KEYS');
  }
  return {
    endpoint: url.toString(),
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}
function key() {
  const k = Buffer.from(process.env.PUSH_ENCRYPTION_KEY || '', 'base64');
  if (k.length !== 32) throw new Error('PUSH_NOT_CONFIGURED');
  return k;
}
export const endpointHash = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex');
export function encryptSubscription(value: BrowserPushSubscription) {
  value = validatePushSubscription(value);
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from('restaurantos-push-v1'));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptSubscription(value: string): BrowserPushSubscription {
  const bytes = Buffer.from(value, 'base64'),
    decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from('restaurantos-push-v1'));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return validatePushSubscription(
    JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString('utf8'),
    ),
  );
}
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  let done = false;
  const timer = setTimeout(() => {
    if (!done) {
      done = true;
      callback(new Error('PUSH_DNS_TIMEOUT'), '', 0);
    }
  }, 2000);
  timer.unref();
  lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (err) {
      callback(err, '', 0);
      return;
    }
    if (
      !addresses.length ||
      addresses.some((a) => ipaddr.process(a.address).range() !== 'unicast')
    ) {
      callback(new Error('PUSH_ADDRESS_REJECTED'), '', 0);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};
export interface PushSender {
  send(
    subscription: BrowserPushSubscription,
    notificationId: string,
    sound: boolean,
  ): Promise<void>;
}
export class WebPushSender implements PushSender {
  async send(
    subscription: BrowserPushSubscription,
    notificationId: string,
    sound: boolean,
  ) {
    validatePushSubscription(subscription);
    if (
      process.env.WEB_PUSH_ENABLED !== 'true' ||
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY ||
      !process.env.VAPID_SUBJECT
    )
      throw Object.assign(new Error('PUSH_NOT_CONFIGURED'), {
        permanent: true,
      });
    await webPush.sendNotification(
      subscription,
      JSON.stringify({ notificationId, silent: !sound }),
      {
        TTL: 60,
        timeout: 5000,
        agent: new Agent({ lookup: safeLookup }),
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT,
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        },
      },
    );
  }
}
