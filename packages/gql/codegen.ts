import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: [
    'src/schema.graphql',
    'src/type.graphql',
    'src/type-ios.graphql',
    'src/type-android.graphql',
    'src/api.graphql',
    'src/api-ios.graphql',
    'src/api-android.graphql',
    'src/error.graphql',
    'src/event.graphql',
  ],
  generates: {
    'src/generated/types.ts': {
      plugins: [
        {
          add: {
            content: [
              '// ============================================================================',
              '// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY',
              '// Run `npm run generate` after updating any *.graphql schema file.',
              '// ============================================================================',
              '',
            ].join('\n'),
          },
        },
        'typescript',
      ],
      config: {
        skipTypename: true,
        maybeValue: 'T | null',
        inputMaybeValue: 'T | null',
        declarationKind: 'interface',
        scalars: {
          ID: { input: 'string', output: 'string' },
          String: { input: 'string', output: 'string' },
          Boolean: { input: 'boolean', output: 'boolean' },
          Int: { input: 'number', output: 'number' },
          Float: { input: 'number', output: 'number' },
        },
      },
    },
  },
};

export default config;
