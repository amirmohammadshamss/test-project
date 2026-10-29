import {
  eligibleTypes,
  policies,
  preferenceAllows,
  NotificationPrincipal,
} from '../../../../../../packages/notifications/src/domain';
import {
  validatePushSubscription,
  encryptSubscription,
  decryptSubscription,
  safeLookup,
} from '../../../../../../packages/notifications/src/push';
import webPush from 'web-push';
import { randomBytes } from 'node:crypto';
import dns from 'node:dns';
import type { LookupAllOptions, LookupAddress } from 'node:dns';
const principal: NotificationPrincipal = {
  realm: 'RESTAURANT',
  userId: 'u',
  sessionId: 's',
  tenantId: 't',
  branchId: 'b',
  membershipId: 'm',
  role: 'KITCHEN',
  tenantStatus: 'ACTIVE',
};
test('routing and priorities are separate from transport and platform ownership', () => {
  expect(eligibleTypes(principal)).toEqual([
    'NEW_ORDER',
    'ORDER_CANCELLED',
    'PREPARATION_CHANGED',
  ]);
  expect(eligibleTypes({ ...principal, role: 'WAITER' })).toEqual([
    'ITEM_READY',
  ]);
  expect(eligibleTypes({ ...principal, realm: 'PLATFORM' })).toEqual([
    'PLATFORM_ISSUE',
  ]);
  expect(
    eligibleTypes({ ...principal, role: 'MANAGER', tenantStatus: 'SUSPENDED' }),
  ).toEqual(['TENANT_SUSPENDED']);
  expect(eligibleTypes({ ...principal, tenantStatus: 'SUSPENDED' })).toEqual(
    [],
  );
  expect(policies.AI_FAILED.priority).toBe('LOW');
});
test('critical history remains visible while optional categories and low-priority history can be disabled', () => {
  const preferences = { includeLow: false, categories: [] };
  expect(preferenceAllows('NEW_ORDER', preferences)).toBe(true);
  expect(preferenceAllows('AI_FAILED', preferences)).toBe(false);
  expect(preferenceAllows('ORDER_DELAYED', preferences)).toBe(false);
});
test('push validation rejects callback SSRF and encrypted subscriptions resist tampering', () => {
  const keys = {
    p256dh: webPush.generateVAPIDKeys().publicKey,
    auth: randomBytes(16).toString('base64url'),
  };
  for (const endpoint of [
    'http://fcm.googleapis.com/send',
    'https://127.0.0.1/send',
    'https://fcm.googleapis.com.attacker.test/send',
    'https://user:password@fcm.googleapis.com/send',
    'https://fcm.googleapis.com:8443/send',
  ])
    expect(() => validatePushSubscription({ endpoint, keys })).toThrow();
  const previous = process.env.PUSH_ENCRYPTION_KEY;
  process.env.PUSH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  try {
    const input = {
      endpoint:
        'https://fcm.googleapis.com/send/' + randomBytes(8).toString('hex'),
      keys,
    };
    const encrypted = encryptSubscription(input);
    expect(encrypted).not.toContain(input.endpoint);
    expect(encrypted).not.toContain(keys.auth);
    expect(decryptSubscription(encrypted)).toEqual(input);
    const bytes = Buffer.from(encrypted, 'base64');
    bytes[30] ^= 1;
    expect(() => decryptSubscription(bytes.toString('base64'))).toThrow();
  } finally {
    if (previous === undefined) delete process.env.PUSH_ENCRYPTION_KEY;
    else process.env.PUSH_ENCRYPTION_KEY = previous;
  }
});
test('DNS rebinding to a private address is rejected at the connection lookup', async () => {
  const spy = jest
    .spyOn(dns, 'lookup')
    .mockImplementation(((
      host: string,
      options: LookupAllOptions,
      callback: (
        error: NodeJS.ErrnoException | null,
        addresses: LookupAddress[],
      ) => void,
    ) =>
      callback(null, [
        { address: '127.0.0.1', family: 4 },
      ])) as typeof dns.lookup);
  try {
    const error = await new Promise<Error | null>((resolve) =>
      safeLookup('fcm.googleapis.com', {}, (error) => resolve(error)),
    );
    expect(error?.message).toBe('PUSH_ADDRESS_REJECTED');
  } finally {
    spy.mockRestore();
  }
});
