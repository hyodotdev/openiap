const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier/flat');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'example/**',
      'node_modules/**',
      // Synced from specs/client and react-native-iap; lint them at the source.
      'src/types.ts',
      'src/kit-api.ts',
      'src/purchase-flow-core.ts',
      'src/purchase-flow-confirmers.ts',
      'src/utils/errorMapping.ts',
      'src/utils/purchaseFlowBinding.ts',
      'src/**/*.shared.test.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/__tests__/**/*.ts', 'src/**/__mocks__/**/*.ts'],
    languageOptions: {globals: {...globals.jest, ...globals.node}},
    rules: {'@typescript-eslint/no-explicit-any': 'off'},
  },
);
