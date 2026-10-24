/**
 * Repository-root-relative source/target graph for canonical source sync.
 * Each target owns its copy/post-process mode here so adding a manifest edge
 * automatically makes it part of synchronization and drift verification.
 * Groups with an exportKey are published by the client spec package; the rest
 * mirror a library-owned source into a sibling library.
 */
const target = (path, label, mode = 'copy') => Object.freeze({ path, label, mode });
const group = ({ source, generated, exportKey, targets }) =>
  Object.freeze({
    source,
    generated,
    exportKey,
    targets: Object.freeze(targets),
  });

export const GQL_PACKAGE_ROOT = 'specs/client';
export const GQL_GENERATED_SOURCE_DIRECTORY = `${GQL_PACKAGE_ROOT}/src/generated`;

export const GENERATED_SYNC_MANIFEST = Object.freeze({
  kotlin: group({
    source: 'specs/client/src/generated/Types.kt',
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
    source: 'specs/client/src/generated/Types.swift',
    generated: true,
    exportKey: './swift',
    targets: {
      apple: target('packages/apple/Sources/Models/Types.swift', 'Swift → Apple (iOS)'),
    },
  }),
  dart: group({
    source: 'specs/client/src/generated/types.dart',
    generated: true,
    exportKey: './dart',
    targets: {
      flutter: target('libraries/flutter_inapp_purchase/lib/types.dart', 'Dart → flutter_inapp_purchase'),
    },
  }),
  gdscript: group({
    source: 'specs/client/src/generated/types.gd',
    generated: true,
    exportKey: './gdscript',
    targets: {
      godot: target('libraries/godot-iap/addons/godot-iap/types.gd', 'GDScript → godot-iap'),
    },
  }),
  typescript: group({
    source: 'specs/client/src/generated/types.ts',
    generated: true,
    exportKey: '.',
    targets: {
      reactNative: target('libraries/react-native-iap/src/types.ts', 'TypeScript → react-native-iap'),
      expo: target('libraries/expo-iap/src/types.ts', 'TypeScript → expo-iap'),
    },
  }),
  csharp: group({
    source: 'specs/client/src/generated/Types.cs',
    generated: true,
    exportKey: './csharp',
    targets: {
      maui: target('libraries/maui-iap/src/OpenIap.Maui/Types.cs', 'C# → maui-iap'),
    },
  }),
  kitApi: group({
    source: 'specs/client/src/kit-api.ts',
    generated: false,
    exportKey: './kit-api',
    targets: {
      reactNative: target('libraries/react-native-iap/src/kit-api.ts', 'kit-api → react-native-iap'),
      expo: target('libraries/expo-iap/src/kit-api.ts', 'kit-api → expo-iap'),
    },
  }),
  purchaseFlow: group({
    source: 'specs/client/src/purchase-flow.ts',
    generated: false,
    exportKey: './purchase-flow',
    targets: {
      reactNative: target('libraries/react-native-iap/src/purchase-flow.ts', 'purchase-flow → react-native-iap'),
      expo: target('libraries/expo-iap/src/purchase-flow.ts', 'purchase-flow → expo-iap'),
    },
  }),
  purchaseFlowConfirmers: group({
    source: 'specs/client/src/purchase-flow-confirmers.ts',
    generated: false,
    exportKey: './purchase-flow-confirmers',
    targets: {
      reactNative: target(
        'libraries/react-native-iap/src/purchase-flow-confirmers.ts',
        'purchase-flow-confirmers → react-native-iap',
      ),
      expo: target('libraries/expo-iap/src/purchase-flow-confirmers.ts', 'purchase-flow-confirmers → expo-iap'),
    },
  }),
  purchaseFlowVectors: group({
    source: 'specs/client/src/purchase-flow.vectors.json',
    generated: false,
    exportKey: './purchase-flow-vectors',
    targets: {
      flutter: target('libraries/flutter_inapp_purchase/test/fixtures/purchase-flow.vectors.json', 'purchase-flow vectors → flutter_inapp_purchase'),
      godot: target('libraries/godot-iap/Example/tests/fixtures/purchase-flow.vectors.json', 'purchase-flow vectors → godot-iap'),
      kmp: target(
        'libraries/kmp-iap/library/src/androidUnitTest/resources/purchase-flow.vectors.json',
        'purchase-flow vectors → kmp-iap',
      ),
      maui: target(
        'libraries/maui-iap/tests/OpenIap.Maui.Tests/Fixtures/purchase-flow.vectors.json',
        'purchase-flow vectors → maui-iap',
      ),
    },
  }),
  purchaseFlowBinding: group({
    source: 'libraries/react-native-iap/src/utils/purchaseFlowBinding.ts',
    generated: false,
    targets: {
      expo: target('libraries/expo-iap/src/utils/purchaseFlowBinding.ts', 'purchaseFlowBinding → expo-iap'),
    },
  }),
  errorMapping: group({
    source: 'libraries/react-native-iap/src/utils/errorMapping.ts',
    generated: false,
    targets: {
      expo: target('libraries/expo-iap/src/utils/errorMapping.ts', 'errorMapping → expo-iap'),
    },
  }),
  errorMappingTests: group({
    source: 'libraries/react-native-iap/src/utils/__tests__/errorMapping.shared.test.ts',
    generated: false,
    targets: {
      expo: target(
        'libraries/expo-iap/src/utils/__tests__/errorMapping.shared.test.ts',
        'errorMapping tests → expo-iap',
      ),
    },
  }),
});

/** Tarball artifacts for a TypeScript source: compiled by tsconfig.publish.json. */
export const gqlPublishedArtifactPaths = (source) => {
  const relative = gqlPackageRelativePath(source).replace(/^src\//u, 'dist/');
  return {
    types: `./${relative.replace(/\.ts$/u, '.d.ts')}`,
    runtime: `./${relative.replace(/\.ts$/u, '.js')}`,
  };
};

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

export const GENERATED_TEST_FIXTURE_PATHS = Object.freeze([
  'libraries/godot-iap/Example/tests/generated_nullable_enum_list_types.gd',
]);

export const GENERATED_DRIFT_PATHS = Object.freeze([
  ...new Set([
    ...Object.values(GENERATED_SYNC_MANIFEST)
      .filter((definition) => definition.generated)
      .map((definition) => definition.source),
    ...GENERATED_SYNC_EDGES.map((edge) => edge.path),
    ...GENERATED_TEST_FIXTURE_PATHS,
  ]),
]);

const generatedDriftPathSet = new Set(GENERATED_DRIFT_PATHS);
const GQL_GENERATION_EXTERNAL_INPUTS = Object.freeze(['package.json', 'bun.lock']);
export const GQL_GENERATION_INPUT_PATHS = Object.freeze([GQL_PACKAGE_ROOT, ...GQL_GENERATION_EXTERNAL_INPUTS]);
export const isGqlGenerationInputPath = (path) =>
  (path.startsWith(`${GQL_PACKAGE_ROOT}/`) && !generatedDriftPathSet.has(path)) || GQL_GENERATION_EXTERNAL_INPUTS.includes(path);
