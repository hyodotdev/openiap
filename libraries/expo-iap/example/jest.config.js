// Expo SDK 57 installs expo/fetch as the global fetch implementation by default.
// These component tests do not exercise expo/fetch, so retain React Native's
// Jest fetch implementation and avoid initializing native fetch response types.
process.env.EXPO_PUBLIC_USE_RN_FETCH ??= '1';

module.exports = {
  preset: 'jest-expo',
  // Remove testEnvironment override to let jest-expo handle it
  // testEnvironment: 'node',
  // Disable watchman to avoid sandbox/permission issues in CI and sandboxes
  watchman: false,
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js,jsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1',
    '^../../src$': '<rootDir>/../src',
    '^expo-iap$': '<rootDir>/../src/index',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts', '!__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
