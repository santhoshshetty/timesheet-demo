/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: '<rootDir>/tests/support/jsdomEnvironment.cjs',
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // The Vite tsconfig targets ESM bundling; Jest runs CommonJS.
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node10',
          esModuleInterop: true,
          isolatedModules: true,
        },
      },
    ],
  },
};
