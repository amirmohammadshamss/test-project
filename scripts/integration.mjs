import { spawnSync } from 'node:child_process';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('/restaurantos_test'))
  throw new Error(
    'TEST_DATABASE_URL must point to a dedicated restaurantos_test database',
  );
const env = {
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: 'test',
  JWT_SECRET:
    process.env.JWT_SECRET || 'integration-only-secret-at-least-32-characters',
  SEED_DEMO_PASSWORD:
    process.env.SEED_DEMO_PASSWORD || 'RestaurantOS-Test-2026!',
};
for (const args of [
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'packages/database/prisma/schema.prisma',
  ],
  ['--import', 'tsx', 'packages/database/prisma/seed.ts'],
  [
    'node_modules/jest/bin/jest.js',
    '--config',
    'jest.integration.config.cjs',
    '--runInBand',
  ],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
