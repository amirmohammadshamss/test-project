import { defineConfig } from '@playwright/test';
const database = process.env.TEST_DATABASE_URL;
if (!database || new URL(database).pathname !== '/restaurantos_test')
  throw new Error('Browser tests require isolated restaurantos_test');
process.env.DATABASE_URL = database;
export default defineConfig({
  testDir: './scripts',
  testMatch: '*.browser.ts',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node dist/apps/api/src/main.js',
      url: 'http://127.0.0.1:4002/api/v1/health/ready',
      reuseExistingServer: false,
      env: {
        DATABASE_URL: database,
        PORT: '4002',
        NODE_ENV: 'test',
        JWT_SECRET:
          process.env.JWT_SECRET ||
          'browser-test-secret-at-least-thirty-two-characters',
        WEB_ORIGIN: 'http://127.0.0.1:3002',
        PLATFORM_ADMIN_ENABLED: 'false',
        COOKIE_SECURE: 'false',
      },
    },
    {
      command:
        'node apps/web/node_modules/next/dist/bin/next start apps/web -p 3002',
      url: 'http://127.0.0.1:3002',
      reuseExistingServer: false,
      env: {
        API_INTERNAL_URL: 'http://127.0.0.1:4002',
        NODE_ENV: 'production',
      },
    },
  ],
});
