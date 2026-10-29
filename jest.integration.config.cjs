module.exports = {
  preset: 'ts-jest',
  watchman: false,
  testEnvironment: 'node',
  testMatch: ['**/*.integration.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000,
  maxWorkers: 1,
};
