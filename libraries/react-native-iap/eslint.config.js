const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'build/**',
      'docs/**',
      'example/**',
      'example-expo/**',
      'node_modules/**',
      'src/types.ts',
      '**/*.d.ts',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    rules: {
      'eslint-comments/no-unlimited-disable': 0,
      'eslint-comments/no-unused-disable': 0,
      'import/no-unresolved': [
        2,
        {
          ignore: ['^react$', '^react-native$'],
        },
      ],
      // Prevent ambiguous imports that Metro may mis-resolve.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '.',
              message:
                "Avoid `import from '.'`; use './index' or an explicit path.",
            },
          ],
        },
      ],
      'no-restricted-modules': [
        'error',
        {
          paths: [
            {
              name: '.',
              message:
                "Avoid `require('.')`; use './index' or an explicit path.",
            },
          ],
        },
      ],
    },
    settings: {
      'import/ignore': ['react-native'],
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['src/**/__tests__/**/*.{js,ts,tsx}', 'src/**/*.test.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
];
