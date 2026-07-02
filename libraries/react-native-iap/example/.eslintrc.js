module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  settings: {
    'import/core-modules': ['@env'],
  },
  rules: {
    'eslint-comments/no-unlimited-disable': 0,
    'eslint-comments/no-unused-disable': 0,
  },
  overrides: [
    {
      files: ['jest.setup.js', '**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true,
      },
    },
    {
      files: ['react-native.config.js', 'metro.config.js', 'scripts/*.{js,mjs}'],
      env: {
        node: true,
      },
    },
  ],
};
