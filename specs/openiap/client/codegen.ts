import { CodegenConfig } from '@graphql-codegen/cli';
import { generatedFileHeader } from './codegen/core/generated-header.js';
import { GRAPHQL_TO_TYPESCRIPT } from './codegen/core/utils.js';
import { GENERATED_SYNC_MANIFEST, gqlPackageRelativePath } from './generated-sync-manifest.mjs';
import { SCHEMA_FILE_NAMES } from './schema-files.mjs';

const typescriptOutputPath = gqlPackageRelativePath(GENERATED_SYNC_MANIFEST.typescript.source);

const config: CodegenConfig = {
  schema: SCHEMA_FILE_NAMES.map((fileName) => `src/${fileName}`),
  generates: {
    [typescriptOutputPath]: {
      plugins: [
        {
          add: {
            content: [...generatedFileHeader(), ''].join('\n'),
          },
        },
        'typescript',
      ],
      config: {
        skipTypename: true,
        maybeValue: 'T | null',
        inputMaybeValue: 'T | null',
        declarationKind: 'interface',
        scalars: GRAPHQL_TO_TYPESCRIPT,
      },
    },
  },
};

export default config;
