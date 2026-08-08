const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const globals = require('globals');

module.exports = [
  {
    ignores: ['android/**', 'coverage/**', 'ios/**', 'node_modules/**'],
  },
  ...expoConfig,
  prettierConfig,
  {
    rules: {
      'eslint-comments/no-unlimited-disable': 0,
      'eslint-comments/no-unused-disable': 0,
      // This example does not enable React Compiler. Keep the runtime-oriented
      // hook rules without imposing Compiler purity constraints on callbacks.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
    settings: {
      'import/core-modules': ['@env'],
    },
  },
  {
    files: ['jest.setup.js', '**/*.test.{js,ts,tsx}'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    files: [
      'react-native.config.js',
      'metro.config.js',
      'scripts/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
];
