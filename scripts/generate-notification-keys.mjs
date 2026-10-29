import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import webPush from 'web-push';
const keys = webPush.generateVAPIDKeys();
writeFileSync(
  '.env.push',
  `# Keep private. Set a real VAPID_SUBJECT, then copy these values into your server environment.\nWEB_PUSH_ENABLED=false\nVAPID_SUBJECT=\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nPUSH_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Created ignored .env.push (0600). Values were not printed. Configure a real mailto: or HTTPS VAPID subject and explicit enablement before using Push. Existing key files are never overwritten.',
);
