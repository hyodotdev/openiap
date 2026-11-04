module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          resolveJsonModule: true,
          skipLibCheck: true,
          strict: true,
          target: 'es2020',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@capacitor/core$': '<rootDir>/src/__mocks__/capacitor-core.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/types.ts',
  ],
};
