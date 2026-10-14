/** @type {import('jest').Config} */
const tsJest = ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }];

const base = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': tsJest },
  moduleFileExtensions: ['ts', 'js', 'json'],
};

module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      globalSetup: '<rootDir>/tests/support/globalSetup.ts',
      globalTeardown: '<rootDir>/tests/support/globalTeardown.ts',
      testTimeout: 60000,
    },
    {
      ...base,
      displayName: 'api',
      testMatch: ['<rootDir>/tests/api/**/*.test.ts'],
      globalSetup: '<rootDir>/tests/support/globalSetup.ts',
      globalTeardown: '<rootDir>/tests/support/globalTeardown.ts',
      testTimeout: 60000,
    },
  ],
};
