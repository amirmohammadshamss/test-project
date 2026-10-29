import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error)
    throw new Error(
      `${command} unavailable: install Docker with Compose and start its engine.`,
    );
  if (result.status !== 0) process.exit(result.status || 1);
}
run('docker', ['compose', 'version']);
if (!existsSync('.env')) {
  const secret = () => randomBytes(32).toString('hex');
  writeFileSync(
    '.env',
    `POSTGRES_PASSWORD=${secret()}\nJWT_SECRET=${secret()}\nSEED_DEMO_PASSWORD=RestaurantOS-Demo-2026!\nWEB_ORIGIN=http://localhost:3000\nPLATFORM_ORIGIN=http://localhost:3001\nCOOKIE_SECURE=false\nPLATFORM_ADMIN_ENABLED=false\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created ignored demo environment. Demo-only credentials are documented in doc/README.md.',
  );
} else
  console.log(
    'Preserving existing .env and database volumes. Review configured targets before continuing.',
  );
run('docker', ['compose', 'config', '--quiet']);
run('docker', [
  'compose',
  'up',
  '--build',
  '--detach',
  '--wait',
  '--wait-timeout',
  '180',
]);
console.log(
  'Demo: http://localhost:3000 — manager/waiter/kitchen@demo.restaurantos.test. Password is SEED_DEMO_PASSWORD in your existing .env (new demo default: RestaurantOS-Demo-2026!).',
);
