module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'eslint-comments/no-unlimited-disable': 0,
    'eslint-comments/no-unused-disable': 0,
    'import/no-unresolved': [
      2,
      {
        ignore: ['^react$', '^react-native$'],
      },
    ],
    // Prevent ambiguous imports that Metro may mis-resolve
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
            message: "Avoid `require('.')`; use './index' or an explicit path.",
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
};
