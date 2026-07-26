/**
 * Repository-root-relative source/target graph for canonical GQL sync.
 * Each target owns its copy/post-process mode here so adding a manifest edge
 * automatically makes it part of synchronization and drift verification.
 */
const target = (path, label, mode = 'copy') => Object.freeze({ path, label, mode });
const group = ({ source, generated, exportKey, targets }) =>
  Object.freeze({
    source,
    generated,
    exportKey,
    targets: Object.freeze(targets),
  });

export const GQL_PACKAGE_ROOT = 'packages/gql';
export const GQL_GENERATED_SOURCE_DIRECTORY = `${GQL_PACKAGE_ROOT}/src/generated`;

export const GENERATED_SYNC_MANIFEST = Object.freeze({
  kotlin: group({
    source: 'packages/gql/src/generated/Types.kt',
    generated: true,
    exportKey: './kotlin',
    targets: {
      google: target('packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt', 'Kotlin → Google (Android)', 'google-kotlin'),
      kmp: target(
        'libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt',
        'Kotlin → kmp-iap',
        'kmp-kotlin',
      ),
    },
  }),
  swift: group({
    source: 'packages/gql/src/generated/Types.swift',
    generated: true,
    exportKey: './swift',
    targets: {
      apple: target('packages/apple/Sources/Models/Types.swift', 'Swift → Apple (iOS)'),
    },
  }),
  dart: group({
    source: 'packages/gql/src/generated/types.dart',
    generated: true,
    exportKey: './dart',
    targets: {
      flutter: target('libraries/flutter_inapp_purchase/lib/types.dart', 'Dart → flutter_inapp_purchase'),
    },
  }),
  gdscript: group({
    source: 'packages/gql/src/generated/types.gd',
    generated: true,
    exportKey: './gdscript',
    targets: {
      godot: target('libraries/godot-iap/addons/godot-iap/types.gd', 'GDScript → godot-iap'),
    },
  }),
  typescript: group({
    source: 'packages/gql/src/generated/types.ts',
    generated: true,
    exportKey: '.',
    targets: {
      reactNative: target('libraries/react-native-iap/src/types.ts', 'TypeScript → react-native-iap'),
      expo: target('libraries/expo-iap/src/types.ts', 'TypeScript → expo-iap'),
    },
  }),
  csharp: group({
    source: 'packages/gql/src/generated/Types.cs',
    generated: true,
    exportKey: './csharp',
    targets: {
      maui: target('libraries/maui-iap/src/OpenIap.Maui/Types.cs', 'C# → maui-iap'),
    },
  }),
  kitApi: group({
    source: 'packages/gql/src/kit-api.ts',
    generated: false,
    exportKey: './kit-api',
    targets: {
      reactNative: target('libraries/react-native-iap/src/kit-api.ts', 'kit-api → react-native-iap'),
      expo: target('libraries/expo-iap/src/kit-api.ts', 'kit-api → expo-iap'),
    },
  }),
});

export const gqlPackageRelativePath = (path) => {
  const prefix = `${GQL_PACKAGE_ROOT}/`;
  if (!path.startsWith(prefix) || path.length === prefix.length) {
    throw new Error(`Expected a path below ${GQL_PACKAGE_ROOT}: ${path}`);
  }
  return path.slice(prefix.length);
};

export const generatedSourceFileName = (groupName) => {
  const definition = GENERATED_SYNC_MANIFEST[groupName];
  if (!definition?.generated) {
    throw new Error(`Expected a generated manifest group: ${groupName}`);
  }

  const prefix = `${GQL_GENERATED_SOURCE_DIRECTORY}/`;
  if (!definition.source.startsWith(prefix)) {
    throw new Error(`Generated source must be a direct child of ${GQL_GENERATED_SOURCE_DIRECTORY}: ${definition.source}`);
  }
  const fileName = definition.source.slice(prefix.length);
  if (!fileName || fileName.includes('/')) {
    throw new Error(`Generated source must be a direct child of ${GQL_GENERATED_SOURCE_DIRECTORY}: ${definition.source}`);
  }
  return fileName;
};

export const GENERATED_SYNC_EDGES = Object.freeze(
  Object.entries(GENERATED_SYNC_MANIFEST).flatMap(([groupName, definition]) =>
    Object.entries(definition.targets).map(([targetName, definitionTarget]) =>
      Object.freeze({
        groupName,
        targetName,
        source: definition.source,
        ...definitionTarget,
      }),
    ),
  ),
);

export const GENERATED_DRIFT_PATHS = Object.freeze([
  ...new Set([
    ...Object.values(GENERATED_SYNC_MANIFEST)
      .filter((definition) => definition.generated)
      .map((definition) => definition.source),
    ...GENERATED_SYNC_EDGES.map((edge) => edge.path),
  ]),
]);

const generatedDriftPathSet = new Set(GENERATED_DRIFT_PATHS);
const GQL_GENERATION_EXTERNAL_INPUTS = Object.freeze(['package.json', 'bun.lock']);
export const GQL_GENERATION_INPUT_PATHS = Object.freeze([GQL_PACKAGE_ROOT, ...GQL_GENERATION_EXTERNAL_INPUTS]);
export const isGqlGenerationInputPath = (path) =>
  (path.startsWith(`${GQL_PACKAGE_ROOT}/`) && !generatedDriftPathSet.has(path)) || GQL_GENERATION_EXTERNAL_INPUTS.includes(path);
