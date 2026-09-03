#!/usr/bin/env node

/**
 * Generate a CycloneDX SBOM for one releasable OpenIAP component.
 *
 * The component list, its version source, and its release tag are read from the
 * existing release SSOT (`release-branch-policy.mjs` and
 * `assert-release-tag.mjs`) so a component cannot be released without also
 * being describable here, and a version can never disagree with the release
 * that produced it.
 *
 * The core inventory is deterministic for a given release tag, release commit,
 * generator commit, and resolver input. Registry enrichment requested with
 * `--with-licenses` is point-in-time metadata and can vary between runs.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs <component> [--output-dir DIR]
 *                                              [--commit SHA]
 *                                              [--generator-commit SHA]
 *                                              [--resolved FILE]
 *                                              [--tag TAG]
 *                                              [--with-licenses]
 *                                              [--stdout]
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PACKAGE_CONFIG } from "./assert-release-tag.mjs";
import {
  commerceProtocolManifest,
  validateVersion,
  versionSources,
} from "./release-branch-policy.mjs";
import {
  extractDirectDependencies,
  mergeResolved,
  PublishedMetadataUnavailableError,
} from "./sbom-dependencies.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPOSITORY_URL = "https://github.com/hyodotdev/openiap";
const SUPPLIER = {
  name: "OpenIAP",
  url: ["https://openiap.dev"],
};
// The repository LICENSE. A component that publishes under different terms
// must override this, or its SBOM would assert a licence it does not ship.
const DEFAULT_LICENSE = "MIT";
const GENERATOR_NAME = "openiap-sbom-generator";
const GENERATOR_VERSION = "1.0.0";
const SPEC_VERSION = "1.6";
export const PUBLISHED_METADATA_UNAVAILABLE_EXIT_CODE = 75;

const ALL_OPENIAP_NATIVE_VARIANTS = {
  kind: "openiap-native",
  apple: true,
  google: ["openiap-google", "openiap-google-horizon", "openiap-google-amazon"],
};

const PODSPEC_DEPENDENCY_PATTERN = /^\s*s\.dependency\s+['"]([^'"]+)['"]/gmu;
const GRADLE_COORDINATE_PATTERN =
  /^\s*(?:implementation|api|runtimeOnly|compile)(?:\s+\(?\s*|\(\s*)(?:"([^"]+)"|'([^']+)')/gmu;
const GRADLE_PROJECT_PATTERN =
  /^\s*(?:implementation|api|runtimeOnly|compile)(?:\s+\(?\s*|\(\s*)project\(\s*['"]([^'"]+)['"]/gmu;

const LEGACY_SBOM_REPAIRS = new Map([
  [
    "google-3.3.0",
    {
      digest:
        "sha256:704362aa07a458ccd76b1d0e89358c8db3d4e3ad4b6d8ff0521c90634597936b",
      bomVersion: 2,
    },
  ],
  [
    "google-3.3.1",
    {
      digest:
        "sha256:f38d4c8cae6fedbbcac4790d7ee920f0880ce698aa63e27f36125297509890df",
      bomVersion: 2,
    },
  ],
  [
    "expo-iap-5.3.0",
    {
      digest:
        "sha256:a5875e9cdd861387ee0887252f9009e848d85a1e62b245ba22972e9fbe83da70",
      bomVersion: 2,
    },
  ],
  [
    "expo-iap-5.3.1",
    {
      digest:
        "sha256:ac221c082413c0a9df586028f86bed3d0d9a3915bcb1adea237064efeb5c9a6a",
      bomVersion: 2,
    },
  ],
  [
    "flutter-iap-10.3.0",
    {
      digest:
        "sha256:52b11ca531fa7a8e5250bd6a83d6400412ad4cbb0f527f0b134fa515b0659c8e",
      bomVersion: 2,
    },
  ],
  [
    "flutter-iap-10.3.1",
    {
      digest:
        "sha256:82f658347af445d497083b50c133867c87d2fd9426412aa6f7ff2ffe1b79e99e",
      bomVersion: 2,
    },
  ],
  [
    "godot-iap-3.3.0",
    {
      digest:
        "sha256:23fd3f2a48c01d5d276b43adabcec1f98630bb0615d20c4ce94b59fb26b210e5",
      bomVersion: 2,
    },
  ],
  [
    "godot-iap-3.3.1",
    {
      digest:
        "sha256:70724bcaf51c3ad79b2767f89606ab3f24f1543bfc804dcba0c8377541e0239b",
      bomVersion: 2,
    },
  ],
  [
    "kmp-iap-3.3.0",
    {
      digest:
        "sha256:533ffbcb5670d3826a508ecc74c49eea3da46d0a8a5f0672e00bb491857236dc",
      bomVersion: 2,
    },
  ],
  [
    "kmp-iap-3.3.1",
    {
      digest:
        "sha256:63ad3182a4a96690d385d701d77dd200676ee65d54d74ba6e960a796af6684e6",
      bomVersion: 2,
    },
  ],
  [
    "maui-iap-2.3.0",
    {
      digest:
        "sha256:b87c308bf9e5bf9480fca2764190098103611b4df60658f218a50c9f9851baef",
      bomVersion: 2,
    },
  ],
  [
    "maui-iap-2.3.1",
    {
      digest:
        "sha256:376b57fd4fa83bb0d67f6fe78b6b146b6e11c0952d3a56af19941814d8e06ed4",
      bomVersion: 2,
    },
  ],
  [
    "react-native-iap-16.3.0",
    {
      digest:
        "sha256:47cc1b6a63c27918df1fe15a83d6cc8aff5320a378f6f0f0454d0f542a1aa12a",
      bomVersion: 2,
    },
  ],
  [
    "react-native-iap-16.3.1",
    {
      digest:
        "sha256:807c9fb163aa18ed75bb471eed5c4eb62c7ef566c2686bd432e9da9ad01b2ef8",
      bomVersion: 2,
    },
  ],
]);

/**
 * SBOM-specific metadata per releasable component.
 *
 * `versionSources` (release SSOT) supplies the label and version; this table
 * adds only what an SBOM needs on top: how the component is distributed, and
 * which released input describes its runtime dependencies.
 */
const COMPONENTS = {
  apple: {
    sbomName: "openiap",
    type: "library",
    purl: (version) => `pkg:cocoapods/openiap@${version}`,
    distribution: (version) => `https://cocoapods.org/pods/openiap`,
    directory: "packages/apple",
    // Package.swift declares `dependencies: []`; StoreKit is an OS framework,
    // not a distributed package, so it is not an SBOM component.
    source: { kind: "swift", manifest: "packages/apple/Package.swift" },
  },
  conformance: {
    sbomName: "openiap-conformance",
    type: "library",
    purl: (version) => `pkg:npm/openiap-conformance@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/openiap-conformance/v/${version}`,
    directory: "packages/conformance",
    source: { kind: "npm", manifest: "packages/conformance/package.json" },
  },
  "commerce-protocol": {
    sbomName: "openiap-commerce-protocol",
    type: "library",
    purl: (version) => `pkg:npm/openiap-commerce-protocol@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/openiap-commerce-protocol/v/${version}`,
    directory: "specs/commerce-protocol",
    source: {
      kind: "npm",
      manifest: commerceProtocolManifest.path,
      historicalManifests: commerceProtocolManifest.historicalPaths,
    },
  },
  docs: {
    sbomName: "openiap-spec",
    type: "data",
    purl: (version) => `pkg:generic/openiap-spec@${version}`,
    distribution: (version) => `${REPOSITORY_URL}/releases/tag/docs-${version}`,
    directory: "specs/client",
    // The spec release publishes the GraphQL contract and generated types.
    // It carries no third-party runtime code.
    source: { kind: "none" },
  },
  expo: {
    sbomName: "expo-iap",
    type: "library",
    purl: (version) => `pkg:npm/expo-iap@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/expo-iap/v/${version}`,
    directory: "libraries/expo-iap",
    source: {
      kind: "aggregate",
      sources: [
        { kind: "npm", manifest: "libraries/expo-iap/package.json" },
        ALL_OPENIAP_NATIVE_VARIANTS,
        {
          kind: "declared",
          manifest: "libraries/expo-iap/ios/ExpoIap.podspec",
          inventories: [
            {
              file: "libraries/expo-iap/ios/ExpoIap.podspec",
              pattern: PODSPEC_DEPENDENCY_PATTERN,
              expected: ["ExpoModulesCore", "OnsideKit", "openiap"],
            },
          ],
          dependencies: [
            {
              ecosystem: "cocoapods",
              name: "ExpoModulesCore",
              version: "any",
              marker: "s.dependency 'ExpoModulesCore'",
              platform: "apple",
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Expo",
            },
            {
              ecosystem: "cocoapods",
              name: "OnsideKit",
              version: "any",
              marker: "s.dependency 'OnsideKit'",
              platform: "apple",
              optional: true,
              spdxLicense: "MIT",
              supplier: "Onside",
            },
          ],
        },
        {
          kind: "declared",
          dependencies: [],
          inventories: [
            {
              file: "libraries/expo-iap/android/build.gradle",
              pattern: GRADLE_COORDINATE_PATTERN,
              expected: [
                "io.github.hyochan.openiap:openiap-google-amazon:${googleVersionString}",
                "io.github.hyochan.openiap:openiap-google-horizon:${googleVersionString}",
                "io.github.hyochan.openiap:openiap-google:${googleVersionString}",
              ],
            },
            {
              file: "libraries/expo-iap/android/build.gradle",
              pattern: GRADLE_PROJECT_PATTERN,
              expected: [":openiap-google"],
            },
          ],
        },
      ],
    },
  },
  flutter: {
    sbomName: "flutter_inapp_purchase",
    type: "library",
    purl: (version) => `pkg:pub/flutter_inapp_purchase@${version}`,
    distribution: (version) =>
      `https://pub.dev/packages/flutter_inapp_purchase/versions/${version}`,
    directory: "libraries/flutter_inapp_purchase",
    source: {
      kind: "aggregate",
      sources: [
        {
          kind: "pub",
          manifest: "libraries/flutter_inapp_purchase/pubspec.yaml",
        },
        {
          kind: "declared",
          manifest: "libraries/flutter_inapp_purchase/android/build.gradle",
          inventories: [
            {
              file: "libraries/flutter_inapp_purchase/android/build.gradle",
              pattern: GRADLE_COORDINATE_PATTERN,
              expected: [
                "androidx.annotation:annotation:${readRequiredAndroidGradleProperty(projectDir, 'openIapAndroidAnnotationVersion')}",
                "io.github.hyochan.openiap:openiap-google-amazon:${openiapGoogleVersion}",
                "io.github.hyochan.openiap:openiap-google-horizon:${openiapGoogleVersion}",
                "io.github.hyochan.openiap:openiap-google:${openiapGoogleVersion}",
                "org.jetbrains.kotlinx:kotlinx-coroutines-android:${readRequiredAndroidGradleProperty(projectDir, 'openIapKotlinxCoroutinesVersion')}",
              ],
            },
            {
              file: "libraries/flutter_inapp_purchase/android/build.gradle",
              pattern: GRADLE_PROJECT_PATTERN,
              expected: [":openiap"],
            },
          ],
          dependencies: [
            {
              ecosystem: "maven",
              group: "androidx.annotation",
              artifact: "annotation",
              version: {
                file: "libraries/flutter_inapp_purchase/android/gradle.properties",
                property: "openIapAndroidAnnotationVersion",
              },
              marker: "androidx.annotation:annotation:",
              platform: "android",
              spdxLicense: "Apache-2.0",
              supplier: "The Android Open Source Project",
            },
            {
              ecosystem: "maven",
              group: "org.jetbrains.kotlinx",
              artifact: "kotlinx-coroutines-android",
              version: {
                file: "libraries/flutter_inapp_purchase/android/gradle.properties",
                property: "openIapKotlinxCoroutinesVersion",
              },
              marker: "org.jetbrains.kotlinx:kotlinx-coroutines-android:",
              platform: "android",
              spdxLicense: "Apache-2.0",
              supplier: "JetBrains",
            },
          ],
        },
        ALL_OPENIAP_NATIVE_VARIANTS,
        {
          kind: "declared",
          manifest:
            "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec",
          inventories: [
            {
              file: "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase.podspec",
              pattern: PODSPEC_DEPENDENCY_PATTERN,
              expected: ["Flutter", "openiap"],
            },
          ],
          dependencies: [
            {
              ecosystem: "cocoapods",
              name: "Flutter",
              version: "any",
              marker: "s.dependency 'Flutter'",
              platform: "apple",
              hostProvided: true,
              spdxLicense: "BSD-3-Clause",
              supplier: "Flutter Authors",
            },
          ],
        },
      ],
    },
  },
  godot: {
    sbomName: "godot-iap",
    type: "library",
    purl: (version) => `pkg:generic/godot-iap@${version}`,
    distribution: (version) =>
      `${REPOSITORY_URL}/releases/tag/godot-iap-${version}`,
    directory: "libraries/godot-iap",
    source: {
      kind: "aggregate",
      sources: [
        {
          kind: "gradle",
          manifest: "libraries/godot-iap/android/build.gradle.kts",
          externalLocals: {
            openiapGoogleVersion: {
              file: "openiap-versions.json",
              json: "google",
            },
            googleCoroutinesVersion: {
              file: "packages/google/openiap/build.gradle.kts",
              gradleLocal: "coroutinesVersion",
            },
          },
        },
        { kind: "openiap-native", apple: true, google: [] },
        {
          kind: "embedded-binary",
          file: "libraries/godot-iap/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/SwiftGodotRuntime",
          name: "SwiftGodotRuntime",
          spdxLicense: "MIT",
          supplier: "Miguel de Icaza",
        },
        {
          kind: "embedded-binary",
          file: "libraries/godot-iap/addons/godot-iap/bin/macos/SwiftGodotRuntime.framework/SwiftGodotRuntime",
          name: "SwiftGodotRuntime-macOS",
          spdxLicense: "MIT",
          supplier: "Miguel de Icaza",
        },
      ],
    },
  },
  google: {
    sbomName: "openiap-google",
    type: "library",
    purl: (version) =>
      `pkg:maven/io.github.hyochan.openiap/openiap-google@${version}`,
    distribution: (version) =>
      `https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google/${version}`,
    directory: "packages/google",
    source: {
      kind: "aggregate",
      sources: [
        {
          kind: "maven-pom",
          coordinate: "io.github.hyochan.openiap:openiap-google",
          repositories: ["https://repo1.maven.org/maven2"],
        },
        {
          kind: "maven-artifact",
          coordinate: "io.github.hyochan.openiap:openiap-google-horizon",
          repositories: ["https://repo1.maven.org/maven2"],
          introducedVersion: "1.3.2",
          variant: "horizon",
          optional: true,
          spdxLicense: "MIT",
          supplier: "OpenIAP",
        },
        {
          kind: "maven-artifact",
          coordinate: "io.github.hyochan.openiap:openiap-google-amazon",
          repositories: ["https://repo1.maven.org/maven2"],
          introducedVersion: "2.3.0-rc.1",
          variant: "amazon",
          optional: true,
          spdxLicense: "MIT",
          supplier: "OpenIAP",
        },
      ],
    },
  },
  kmp: {
    sbomName: "kmp-iap",
    type: "library",
    // Published under Apache-2.0, unlike the rest of the repository.
    // See the POM licence block in libraries/kmp-iap/library/build.gradle.kts.
    license: "Apache-2.0",
    purl: (version) => `pkg:maven/io.github.hyochan/kmp-iap@${version}`,
    distribution: (version) =>
      `https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap/${version}`,
    directory: "libraries/kmp-iap",
    source: {
      kind: "aggregate",
      sources: [
        {
          kind: "maven-pom",
          coordinate: "io.github.hyochan:kmp-iap",
          repositories: ["https://repo1.maven.org/maven2"],
        },
        ALL_OPENIAP_NATIVE_VARIANTS,
      ],
    },
  },
  maui: {
    sbomName: "OpenIap.Maui",
    type: "library",
    purl: (version) => `pkg:nuget/OpenIap.Maui@${version}`,
    distribution: (version) =>
      `https://www.nuget.org/packages/OpenIap.Maui/${version}`,
    directory: "libraries/maui-iap",
    source: {
      kind: "aggregate",
      sources: [
        { kind: "nuget-nuspec", packageId: "OpenIap.Maui" },
        {
          kind: "openiap-native",
          apple: true,
          google: ["openiap-google"],
        },
      ],
    },
  },
  "react-native": {
    sbomName: "react-native-iap",
    type: "library",
    purl: (version) => `pkg:npm/react-native-iap@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/react-native-iap/v/${version}`,
    directory: "libraries/react-native-iap",
    source: {
      kind: "aggregate",
      sources: [
        {
          kind: "npm",
          manifest: "libraries/react-native-iap/package.json",
        },
        {
          kind: "declared",
          dependencies: [
            {
              ecosystem: "npm",
              name: "react-native-nitro-modules",
              version: {
                file: "libraries/react-native-iap/package.json",
                jsonPath: ["peerDependencies", "react-native-nitro-modules"],
              },
              assertions: [
                {
                  file: "libraries/react-native-iap/package.json",
                  marker: '"react-native-nitro-modules":',
                },
                {
                  file: "libraries/react-native-iap/NitroIap.podspec",
                  marker:
                    "load 'nitrogen/generated/ios/NitroIap+autolinking.rb'",
                },
                {
                  file: "libraries/react-native-iap/NitroIap.podspec",
                  marker: "add_nitrogen_files(s)",
                },
                {
                  file: "libraries/react-native-iap/android/build.gradle",
                  marker:
                    'implementation project(":react-native-nitro-modules")',
                },
              ],
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Margelo",
            },
          ],
        },
        {
          kind: "declared",
          manifest: "libraries/react-native-iap/android/build.gradle",
          inventories: [
            {
              file: "libraries/react-native-iap/android/build.gradle",
              pattern: GRADLE_COORDINATE_PATTERN,
              expected: [
                "com.facebook.react:react-native:+",
                "com.google.android.gms:play-services-base:$playServicesBaseVersion",
                "io.github.hyochan.openiap:openiap-google-amazon:${googleVersionString}",
                "io.github.hyochan.openiap:openiap-google-horizon:${googleVersionString}",
                "io.github.hyochan.openiap:openiap-google:${googleVersionString}",
                "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion",
              ],
            },
            {
              file: "libraries/react-native-iap/android/build.gradle",
              pattern: GRADLE_PROJECT_PATTERN,
              expected: [":openiap", ":react-native-nitro-modules"],
            },
          ],
          dependencies: [
            {
              ecosystem: "maven",
              group: "com.facebook.react",
              artifact: "react-native",
              version: "+",
              marker: "com.facebook.react:react-native:+",
              platform: "android",
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Meta Platforms, Inc.",
            },
            {
              ecosystem: "maven",
              group: "com.google.android.gms",
              artifact: "play-services-base",
              version: {
                file: "libraries/react-native-iap/android/gradle.properties",
                property: "NitroIap_playServicesBaseVersion",
              },
              marker: "com.google.android.gms:play-services-base:",
              platform: "android",
              licenseName: "Android Software Development Kit License",
              supplier: "Google LLC",
            },
            {
              ecosystem: "maven",
              group: "org.jetbrains.kotlinx",
              artifact: "kotlinx-coroutines-android",
              version: {
                file: "libraries/react-native-iap/android/gradle.properties",
                property: "NitroIap_coroutinesVersion",
              },
              marker: "org.jetbrains.kotlinx:kotlinx-coroutines-android:",
              platform: "android",
              spdxLicense: "Apache-2.0",
              supplier: "JetBrains",
            },
          ],
        },
        ALL_OPENIAP_NATIVE_VARIANTS,
        {
          kind: "declared",
          manifest: "libraries/react-native-iap/NitroIap.podspec",
          inventories: [
            {
              file: "libraries/react-native-iap/NitroIap.podspec",
              pattern: PODSPEC_DEPENDENCY_PATTERN,
              expected: [
                "React-Core",
                "React-callinvoker",
                "React-jsi",
                "openiap",
              ],
            },
          ],
          dependencies: [
            {
              ecosystem: "cocoapods",
              name: "React-Core",
              version: "any",
              marker: "s.dependency 'React-Core'",
              platform: "apple",
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Meta Platforms, Inc.",
            },
            {
              ecosystem: "cocoapods",
              name: "React-jsi",
              version: "any",
              marker: "s.dependency 'React-jsi'",
              platform: "apple",
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Meta Platforms, Inc.",
            },
            {
              ecosystem: "cocoapods",
              name: "React-callinvoker",
              version: "any",
              marker: "s.dependency 'React-callinvoker'",
              platform: "apple",
              hostProvided: true,
              spdxLicense: "MIT",
              supplier: "Meta Platforms, Inc.",
            },
          ],
        },
      ],
    },
  },
};

export function listComponentIds() {
  return Object.keys(COMPONENTS).sort();
}

function defaultRunGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function readComponentVersion(componentId, root = repoRoot) {
  const source = versionSources[componentId];
  if (!source) {
    throw new Error(`Unknown release component: ${componentId}`);
  }
  return validateVersion(source.read(root), source.label);
}

function sourceForRoot(source, root) {
  if (!source.manifest || existsSync(resolve(root, source.manifest))) {
    return source;
  }
  const historicalManifest = source.historicalManifests?.find((manifest) =>
    existsSync(resolve(root, manifest)),
  );
  return historicalManifest
    ? { ...source, manifest: historicalManifest }
    : source;
}

export function releaseTagFor(componentId, version) {
  const tags = PACKAGE_CONFIG[componentId]?.tags(version);
  if (!tags?.length) {
    throw new Error(`No release tag pattern for component: ${componentId}`);
  }
  return tags[0];
}

export function sbomFileName(componentId, version) {
  return `${COMPONENTS[componentId].sbomName}-${version}.cdx.json`;
}

export function repairSbomDigestForTag(tag) {
  return LEGACY_SBOM_REPAIRS.get(tag)?.digest ?? "";
}

export function sbomRevisionForTag(tag) {
  return LEGACY_SBOM_REPAIRS.get(tag)?.bomVersion ?? 1;
}

/** Return newest missing releases plus every approved legacy repair. */
export function findMissingLatestSbomTags(releases) {
  const seen = new Set();
  const missing = [];
  const newestFirst = releases
    .filter(
      (release) =>
        !release?.draft && !release?.prerelease && release?.published_at,
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at) - Date.parse(left.published_at),
    );
  for (const release of newestFirst) {
    const resolvedTag = componentFromTag(release.tag_name);
    if (!resolvedTag) continue;
    const expected = sbomFileName(resolvedTag.componentId, resolvedTag.version);
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const asset = assets.find((entry) => entry?.name === expected);
    const stagedAsset = assets.find(
      (entry) => entry?.name === `${expected}.replacement`,
    );
    const repairDigest = repairSbomDigestForTag(release.tag_name);

    // Legacy repairs remain eligible even after a newer component release.
    if (
      repairDigest &&
      (stagedAsset || !asset || asset.digest === repairDigest)
    ) {
      missing.push(release.tag_name);
    }

    if (seen.has(resolvedTag.componentId)) continue;
    seen.add(resolvedTag.componentId);
    if (!asset && !repairDigest) missing.push(release.tag_name);
  }
  return missing;
}

/** Return the expected SBOM asset for the newest release of each component. */
export function latestSbomAssets(releases) {
  const seen = new Set();
  const assets = [];
  const newestFirst = releases
    .filter(
      (release) =>
        !release?.draft && !release?.prerelease && release?.published_at,
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at) - Date.parse(left.published_at),
    );

  for (const release of newestFirst) {
    const resolvedTag = componentFromTag(release.tag_name);
    if (!resolvedTag || seen.has(resolvedTag.componentId)) continue;
    seen.add(resolvedTag.componentId);
    const fileName = sbomFileName(resolvedTag.componentId, resolvedTag.version);
    const asset = (release.assets ?? []).find(
      (entry) => entry?.name === fileName,
    );
    if (!asset?.digest) {
      throw new Error(`Missing published SBOM asset for ${release.tag_name}`);
    }
    assets.push({
      componentId: resolvedTag.componentId,
      version: resolvedTag.version,
      tag: release.tag_name,
      fileName,
      digest: asset.digest,
    });
  }

  if (assets.length === 0) {
    throw new Error("No published component releases found");
  }
  return assets;
}

/** Return every published stable release that already carries an SBOM. */
export function publishedSbomAssets(releases) {
  const assets = [];
  const newestFirst = releases
    .filter(
      (release) =>
        !release?.draft && !release?.prerelease && release?.published_at,
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at) - Date.parse(left.published_at),
    );

  for (const release of newestFirst) {
    const resolvedTag = componentFromTag(release.tag_name);
    if (!resolvedTag) continue;
    const fileName = sbomFileName(resolvedTag.componentId, resolvedTag.version);
    const asset = (release.assets ?? []).find(
      (entry) => entry?.name === fileName,
    );
    if (!asset) continue;
    if (!asset.digest) {
      throw new Error(`Missing published SBOM digest for ${release.tag_name}`);
    }
    assets.push({
      componentId: resolvedTag.componentId,
      version: resolvedTag.version,
      tag: release.tag_name,
      fileName,
      digest: asset.digest,
    });
  }

  if (assets.length === 0) {
    throw new Error("No published release SBOMs found");
  }
  return assets;
}

/** Remove version ranges that exact-version vulnerability scanners misread. */
export function prepareSbomForExactVulnerabilityScan(document) {
  if (
    document?.bomFormat !== "CycloneDX" ||
    !Array.isArray(document.components)
  ) {
    throw new Error("Vulnerability scan input must be a CycloneDX document");
  }

  const constraintRefs = new Set();
  for (const component of document.components) {
    const properties = Array.isArray(component.properties)
      ? component.properties
      : [];
    const constraint = properties.find(
      (property) => property?.name === "openiap:sbom:version-constraint",
    );
    if (!constraint) continue;
    if (
      typeof component["bom-ref"] !== "string" ||
      constraint.value !== component.version
    ) {
      throw new Error(
        `Malformed version-constraint component '${component.name ?? "(unknown)"}'`,
      );
    }
    constraintRefs.add(component["bom-ref"]);
  }

  const prepared = structuredClone(document);
  prepared.components = prepared.components.filter(
    (component) => !constraintRefs.has(component["bom-ref"]),
  );
  if (Array.isArray(prepared.dependencies)) {
    prepared.dependencies = prepared.dependencies
      .filter((dependency) => !constraintRefs.has(dependency.ref))
      .map((dependency) => ({
        ...dependency,
        dependsOn: (dependency.dependsOn ?? []).filter(
          (reference) => !constraintRefs.has(reference),
        ),
      }));
  }
  if (Array.isArray(prepared.vulnerabilities)) {
    prepared.vulnerabilities = prepared.vulnerabilities
      .map((vulnerability) => ({
        ...vulnerability,
        affects: (vulnerability.affects ?? []).filter(
          (affected) => !constraintRefs.has(affected.ref),
        ),
      }))
      .filter((vulnerability) => vulnerability.affects.length > 0);
  }

  return { document: prepared, skippedConstraints: constraintRefs.size };
}

const TAG_VERSION_PLACEHOLDER = "9.8.7";

/** Tag aliases are derived from the same package config release validation uses. */
const TAG_PATTERNS = [
  ...Object.entries(PACKAGE_CONFIG).flatMap(([componentId, config]) =>
    config.tags(TAG_VERSION_PLACEHOLDER).map((tag) => {
      const index = tag.indexOf(TAG_VERSION_PLACEHOLDER);
      if (index === -1) {
        throw new Error(
          `Release tag pattern for ${componentId} has no version`,
        );
      }
      return {
        componentId,
        prefix: tag.slice(0, index),
        suffix: tag.slice(index + TAG_VERSION_PLACEHOLDER.length),
      };
    }),
  ),
].sort((left, right) => right.prefix.length - left.prefix.length);

/**
 * Map a published release tag back to the component that produced it.
 *
 * Returns null for tags this repository does not release components under, so
 * the workflow can skip them rather than fail.
 */
export function componentFromTag(tag) {
  const normalized = String(tag ?? "").trim();
  if (!normalized) return null;

  for (const { componentId, prefix, suffix } of TAG_PATTERNS) {
    if (!normalized.startsWith(prefix) || !normalized.endsWith(suffix)) {
      continue;
    }
    const version = normalized.slice(
      prefix.length,
      suffix ? -suffix.length : undefined,
    );
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) continue;
    return { componentId, version };
  }

  return null;
}

/**
 * RFC 4122 §4.3 name-based UUID (SHA-1, version 5) over the release identity,
 * so the same release always yields the same serial number.
 */
function deterministicSerialNumber(identity) {
  // DNS namespace UUID, per RFC 4122 Appendix C.
  const namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const namespaceBytes = Buffer.from(namespace.replace(/-/gu, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(identity, "utf8")]))
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * SPDX identifiers seen in this repository's dependency tree. A registry value
 * outside this set is recorded as a free-text license name rather than being
 * asserted as an SPDX id, because a wrong identifier is worse than an absent
 * one — downstream tooling treats ids as authoritative.
 */
const KNOWN_SPDX_IDS = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "EPL-1.0",
  "EPL-2.0",
  "GPL-2.0-only",
  "GPL-2.0-with-classpath-exception",
  "ISC",
  "LGPL-2.1-only",
  "MIT",
  "MPL-2.0",
  "Unlicense",
]);

/** Common registry spellings that are unambiguous but not SPDX-formatted. */
const LICENSE_ALIASES = new Map([
  ["apache license 2.0", "Apache-2.0"],
  ["apache license, version 2.0", "Apache-2.0"],
  ["apache-2.0", "Apache-2.0"],
  ["apache 2.0", "Apache-2.0"],
  ["the apache license, version 2.0", "Apache-2.0"],
  ["the apache software license, version 2.0", "Apache-2.0"],
  ["mit", "MIT"],
  ["mit license", "MIT"],
  ["the mit license", "MIT"],
  ["bsd-3-clause", "BSD-3-Clause"],
  ["eclipse public license 1.0", "EPL-1.0"],
  ["eclipse public license - v 2.0", "EPL-2.0"],
]);

export function normalizeLicense(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (KNOWN_SPDX_IDS.has(value)) return { license: { id: value } };

  const alias = LICENSE_ALIASES.get(value.toLowerCase());
  if (alias) return { license: { id: alias } };

  // A compound expression such as "MIT AND Apache-2.0" is valid CycloneDX only
  // in the `expression` form, and only if every operand is a known id.
  if (/\s(AND|OR|WITH)\s/u.test(value)) {
    const operands = value.split(/\s(?:AND|OR|WITH)\s/u).map((p) => p.trim());
    if (operands.every((operand) => KNOWN_SPDX_IDS.has(operand))) {
      return { expression: value };
    }
  }

  return { license: { name: value } };
}

function dependencyComponent(entry) {
  const component = {
    "bom-ref": entry.purl,
    type: "library",
    name: entry.name,
    version: entry.version,
    purl: entry.purl,
    scope: entry.scope ?? "required",
  };
  // NTIA minimum elements name the supplier as required data.
  if (entry.supplier) {
    component.supplier = { name: entry.supplier };
  }
  if (entry.licenses?.length) {
    component.licenses = entry.licenses;
  }
  if (entry.hashes?.length) {
    component.hashes = entry.hashes;
  }
  const properties = [...(entry.properties ?? [])];
  if (entry.transitive) {
    properties.push({
      name: "openiap:sbom:relationship",
      value: "transitive",
    });
  }
  if (properties.length > 0) {
    component.properties = properties;
  }
  return component;
}

export function buildSbom({
  componentId,
  version,
  commit,
  generatorCommit,
  releaseTag,
  timestamp,
  dependencies,
  vulnerabilities = [],
}) {
  const definition = COMPONENTS[componentId];
  if (!definition) {
    throw new Error(`Unknown SBOM component: ${componentId}`);
  }

  const purl = definition.purl(version);
  const tag = releaseTag ?? releaseTagFor(componentId, version);
  const resolvedTag = componentFromTag(tag);
  if (
    resolvedTag?.componentId !== componentId ||
    resolvedTag.version !== version
  ) {
    throw new Error(
      `Release tag '${tag}' does not match ${componentId} ${version}`,
    );
  }
  const resolvedGeneratorCommit = generatorCommit ?? commit;
  const componentRef = purl;

  // A VEX statement that points at a bom-ref this SBOM does not contain says
  // nothing a consumer's scanner can act on. Catch it here rather than
  // shipping an analysis nobody can match to a component.
  const knownRefs = new Set([componentRef, ...dependencies.map((d) => d.purl)]);
  for (const statement of vulnerabilities) {
    for (const affected of statement.affects ?? []) {
      if (!knownRefs.has(affected.ref)) {
        throw new Error(
          `VEX statement ${statement.id} affects '${affected.ref}', which is not a component of ${definition.sbomName}@${version}`,
        );
      }
    }
  }

  const externalReferences = [
    { type: "vcs", url: `${REPOSITORY_URL}.git` },
    { type: "distribution", url: definition.distribution(version) },
    { type: "website", url: "https://openiap.dev" },
  ];

  return {
    $schema: `http://cyclonedx.org/schema/bom-${SPEC_VERSION}.schema.json`,
    bomFormat: "CycloneDX",
    specVersion: SPEC_VERSION,
    serialNumber: deterministicSerialNumber(`${purl}@${commit}`),
    version: sbomRevisionForTag(tag),
    metadata: {
      timestamp,
      lifecycles: [{ phase: "build" }],
      // NTIA minimum elements require an author distinct from the supplier.
      authors: [{ name: SUPPLIER.name }],
      tools: {
        components: [
          {
            type: "application",
            name: GENERATOR_NAME,
            version: GENERATOR_VERSION,
            properties: [
              {
                name: "openiap:generator:commit",
                value: resolvedGeneratorCommit,
              },
            ],
          },
        ],
      },
      component: {
        "bom-ref": componentRef,
        type: definition.type,
        name: definition.sbomName,
        version,
        purl,
        supplier: SUPPLIER,
        licenses: [{ license: { id: definition.license ?? DEFAULT_LICENSE } }],
        externalReferences,
        properties: [
          { name: "openiap:release:tag", value: tag },
          { name: "openiap:release:commit", value: commit },
          { name: "openiap:release:component", value: componentId },
          ...(definition.source.kind === "aggregate"
            ? [
                {
                  name: "openiap:sbom:aggregation",
                  value: "release-variants",
                },
              ]
            : []),
        ],
      },
      supplier: SUPPLIER,
    },
    components: dependencies.map(dependencyComponent),
    dependencies: [
      {
        // Every component is reachable from the root. A transitive entry left
        // out of `dependsOn` would appear in `components` with no inbound edge,
        // so a consumer walking the graph would never reach it. The
        // openiap:sbom:relationship property, not the graph, is what marks an
        // entry as transitive.
        ref: componentRef,
        dependsOn: dependencies.map((entry) => entry.purl),
      },
      ...dependencies.map((entry) => ({ ref: entry.purl, dependsOn: [] })),
    ],
    // Omitted entirely when there is nothing analysed, rather than emitted as
    // an empty array that reads like "we checked and found none".
    ...(vulnerabilities.length > 0 ? { vulnerabilities } : {}),
  };
}

function requiredProperty(properties, name, context) {
  const values = (properties ?? [])
    .filter((property) => property?.name === name)
    .map((property) => property.value);
  if (values.length !== 1 || !values[0]) {
    throw new Error(`${context} must contain exactly one ${name} property`);
  }
  return values[0];
}

export function verifySbomGeneratorAttestation(
  serialized,
  attestationJson,
  { repository, branch },
) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository ?? "")) {
    throw new Error(`Invalid attestation repository '${repository ?? ""}'`);
  }
  if (!branch || /[\s~^:?*\\[\]\\]/u.test(branch)) {
    throw new Error(`Invalid attestation branch '${branch ?? ""}'`);
  }

  const document = JSON.parse(
    Buffer.isBuffer(serialized) ? serialized.toString("utf8") : serialized,
  );
  const attestations = JSON.parse(
    Buffer.isBuffer(attestationJson)
      ? attestationJson.toString("utf8")
      : attestationJson,
  );
  if (!Array.isArray(attestations) || attestations.length === 0) {
    throw new Error(
      "Attestation verification result must be a non-empty array",
    );
  }

  const generators = (document.metadata?.tools?.components ?? []).filter(
    (component) => component?.name === GENERATOR_NAME,
  );
  if (generators.length !== 1) {
    throw new Error(`Published SBOM must identify one ${GENERATOR_NAME}`);
  }
  const recordedCommit = requiredProperty(
    generators[0].properties,
    "openiap:generator:commit",
    "Published SBOM generator",
  );
  const expectedUri = `git+https://github.com/${repository}@refs/heads/${branch}`;
  const attestedCommits = new Set();
  for (const result of attestations) {
    const dependencies =
      result?.verificationResult?.statement?.predicate?.buildDefinition
        ?.resolvedDependencies ?? [];
    for (const dependency of dependencies) {
      const commit = dependency?.digest?.gitCommit;
      if (dependency?.uri === expectedUri && /^[0-9a-f]{40}$/u.test(commit)) {
        attestedCommits.add(commit);
      }
    }
  }
  if (attestedCommits.size !== 1) {
    throw new Error(
      `Expected one attested generator commit for ${expectedUri}, found ${attestedCommits.size}`,
    );
  }
  const [attestedCommit] = attestedCommits;
  if (attestedCommit !== recordedCommit) {
    throw new Error(
      `SBOM generator ${recordedCommit} does not match attested source ${attestedCommit}`,
    );
  }
  return attestedCommit;
}

export function verifyPublishedSbom(
  serialized,
  { fileName, releaseTag, releaseCommit, generatorCommit, digest } = {},
) {
  const content = Buffer.isBuffer(serialized)
    ? serialized
    : Buffer.from(String(serialized), "utf8");
  if (digest !== undefined) {
    if (!/^sha256:[0-9a-f]{64}$/u.test(digest)) {
      throw new Error(`Invalid published SBOM digest '${digest}'`);
    }
    const actual = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    if (actual !== digest) {
      throw new Error(
        `Published SBOM digest ${actual} does not match ${digest}`,
      );
    }
  }

  const document = JSON.parse(content.toString("utf8"));
  const resolvedTag = componentFromTag(releaseTag);
  if (!resolvedTag) {
    throw new Error(`Unknown published SBOM release tag '${releaseTag}'`);
  }
  const definition = COMPONENTS[resolvedTag.componentId];
  const expectedFileName = sbomFileName(
    resolvedTag.componentId,
    resolvedTag.version,
  );
  if (fileName && basename(fileName) !== expectedFileName) {
    throw new Error(`Published SBOM file must be named ${expectedFileName}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(releaseCommit ?? "")) {
    throw new Error(`Invalid release commit '${releaseCommit ?? ""}'`);
  }
  if (
    document.bomFormat !== "CycloneDX" ||
    document.specVersion !== SPEC_VERSION
  ) {
    throw new Error(`Published SBOM must use CycloneDX ${SPEC_VERSION}`);
  }
  const timestamp = document.metadata?.timestamp;
  const authors = document.metadata?.authors ?? [];
  if (
    !Number.isFinite(Date.parse(timestamp)) ||
    !authors.some(
      (author) =>
        typeof author?.name === "string" && author.name.trim().length > 0,
    )
  ) {
    throw new Error(
      "Published SBOM must include a valid timestamp and author name",
    );
  }

  const root = document.metadata.component;
  if (
    typeof root?.supplier?.name !== "string" ||
    root.supplier.name.trim().length === 0
  ) {
    throw new Error("Published SBOM root must include a supplier name");
  }
  const expectedPurl = definition.purl(resolvedTag.version);
  if (
    root?.name !== definition.sbomName ||
    root?.version !== resolvedTag.version ||
    root?.purl !== expectedPurl ||
    root?.["bom-ref"] !== expectedPurl
  ) {
    throw new Error(`Published SBOM identity does not match ${releaseTag}`);
  }
  const rootProperties = root.properties;
  if (
    requiredProperty(
      rootProperties,
      "openiap:release:tag",
      "Published SBOM root",
    ) !== releaseTag ||
    requiredProperty(
      rootProperties,
      "openiap:release:commit",
      "Published SBOM root",
    ) !== releaseCommit ||
    requiredProperty(
      rootProperties,
      "openiap:release:component",
      "Published SBOM root",
    ) !== resolvedTag.componentId
  ) {
    throw new Error(`Published SBOM properties do not match ${releaseTag}`);
  }

  const generators = (document.metadata.tools?.components ?? []).filter(
    (component) => component?.name === GENERATOR_NAME,
  );
  if (generators.length !== 1) {
    throw new Error(`Published SBOM must identify one ${GENERATOR_NAME}`);
  }
  const recordedGeneratorCommit = requiredProperty(
    generators[0].properties,
    "openiap:generator:commit",
    "Published SBOM generator",
  );
  if (!/^[0-9a-f]{40}$/u.test(recordedGeneratorCommit)) {
    throw new Error(
      `Invalid SBOM generator commit '${recordedGeneratorCommit}'`,
    );
  }
  if (
    generatorCommit !== undefined &&
    recordedGeneratorCommit !== generatorCommit
  ) {
    throw new Error(
      `Published SBOM generator ${recordedGeneratorCommit} does not match ${generatorCommit}`,
    );
  }

  if (!Array.isArray(document.components)) {
    throw new Error("Published SBOM must contain a components array");
  }
  const componentRefs = new Set();
  for (const component of document.components) {
    if (
      !component?.name ||
      !component.version ||
      !component.purl ||
      component["bom-ref"] !== component.purl
    ) {
      throw new Error("Published SBOM contains an incomplete component");
    }
    if (componentRefs.has(component.purl)) {
      throw new Error(`Duplicate published SBOM component ${component.purl}`);
    }
    componentRefs.add(component.purl);
  }
  const dependencyRows = document.dependencies ?? [];
  const rootRows = dependencyRows.filter((row) => row?.ref === expectedPurl);
  if (rootRows.length !== 1) {
    throw new Error("Published SBOM must contain one root dependency row");
  }
  const rootDependencies = rootRows[0].dependsOn ?? [];
  const rootDependencyRefs = new Set(rootDependencies);
  if (
    rootDependencies.length !== rootDependencyRefs.size ||
    rootDependencyRefs.size !== componentRefs.size ||
    [...rootDependencyRefs].some((ref) => !componentRefs.has(ref))
  ) {
    throw new Error("Published SBOM dependency graph is incomplete");
  }
  const knownRefs = new Set([expectedPurl, ...componentRefs]);
  for (const row of dependencyRows) {
    if (!knownRefs.has(row?.ref)) {
      throw new Error(`Unknown published SBOM dependency row ${row?.ref}`);
    }
    if ((row.dependsOn ?? []).some((ref) => !knownRefs.has(ref))) {
      throw new Error(`Unknown published SBOM dependency target in ${row.ref}`);
    }
  }
  for (const ref of componentRefs) {
    if (dependencyRows.filter((row) => row?.ref === ref).length !== 1) {
      throw new Error(`Published SBOM dependency row is missing for ${ref}`);
    }
  }

  if (
    /\/Users\/|\/home\/[a-z]|\/tmp\/|ghp_|npm_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY/u.test(
      content.toString("utf8"),
    )
  ) {
    throw new Error("Published SBOM contains a local path or secret");
  }

  return {
    componentId: resolvedTag.componentId,
    version: resolvedTag.version,
    generatorCommit: recordedGeneratorCommit,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": `${GENERATOR_NAME}/${GENERATOR_VERSION}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function fetchPublishedText(
  url,
  {
    fetcher = fetchText,
    retryDelays = Array(5).fill(5_000),
    wait = (delay) =>
      new Promise((resolveDelay) => setTimeout(resolveDelay, delay)),
  } = {},
) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const result = await fetcher(url);
      if (result) return result;
    } catch {
      // Registry transport failures are retryable just like an indexing 404.
    }
    if (attempt < retryDelays.length) {
      await wait(retryDelays[attempt]);
    }
  }
  return null;
}

/**
 * Look up a dependency's declared license and supplier in its own registry.
 *
 * Supplier is an NTIA minimum element. License data is useful compliance
 * metadata; both values come from the same registry document, so they are
 * fetched together rather than in two passes.
 *
 * Registry metadata supplements reviewed local evidence. A lookup never
 * guesses from a coordinate and never replaces a reviewed value. Failure
 * leaves any missing field empty rather than blocking a release.
 *
 * Registry availability and metadata can change, so enriched output is not
 * byte-identical across runs.
 */
async function lookupComponentMetadata(entry, { fetcher = fetchText } = {}) {
  try {
    if (entry.purl.startsWith("pkg:maven/")) {
      const [, coordinates] = entry.purl.split("pkg:maven/");
      const [group, rest] = coordinates.split("/");
      const [artifact] = rest.split("@");
      const groupPath = group.replace(/\./gu, "/");
      const path = `${groupPath}/${artifact}/${entry.version}/${artifact}-${entry.version}.pom`;

      // androidx, com.android.*, and com.google.android.* publish to Google's
      // Maven repository, not Maven Central.
      for (const base of [
        "https://repo1.maven.org/maven2",
        "https://dl.google.com/dl/android/maven2",
      ]) {
        const pom = await fetcher(`${base}/${path}`);
        if (!pom) continue;
        const license = pom.match(
          /<licenses>[\s\S]*?<name>([^<]+)<\/name>/u,
        )?.[1];
        const supplier = pom
          .match(/<organization>[\s\S]*?<name>([^<]+)<\/name>/u)?.[1]
          ?.trim();
        if (license || supplier) {
          return { license: normalizeLicense(license), supplier };
        }
      }
      return null;
    }

    if (entry.purl.startsWith("pkg:nuget/")) {
      const id = entry.name.toLowerCase();
      const nuspec = await fetcher(
        `https://api.nuget.org/v3-flatcontainer/${id}/${entry.version}/${id}.nuspec`,
      );
      if (!nuspec) return null;
      const expression = nuspec.match(
        /<license\s+type="expression">([^<]+)<\/license>/u,
      )?.[1];
      const url = nuspec.match(/<licenseUrl>([^<]+)<\/licenseUrl>/u)?.[1];
      const fromUrl = url?.match(/licenses\.nuget\.org\/(.+)$/u)?.[1];
      const raw = expression ?? (fromUrl && decodeURIComponent(fromUrl));
      return {
        license: normalizeLicense(raw),
        supplier: nuspec.match(/<authors>([^<]+)<\/authors>/u)?.[1]?.trim(),
      };
    }

    if (entry.purl.startsWith("pkg:npm/")) {
      // A scoped name contains a slash, which would otherwise be read as a
      // path separator and 404.
      const raw = await fetcher(
        `https://registry.npmjs.org/${encodeURIComponent(entry.name)}/${entry.version}`,
      );
      if (!raw) return null;
      const metadata = JSON.parse(raw);
      const license = metadata.license;
      const author = metadata.author;
      return {
        license: normalizeLicense(
          typeof license === "string" ? license : license?.type,
        ),
        supplier: typeof author === "string" ? author : author?.name,
      };
    }
  } catch {
    // Network failure, timeout, or malformed registry response.
    return null;
  }

  // pub.dev has no standard license field in package metadata; Dart packages
  // declare licensing in a LICENSE file that the API does not expose.
  return null;
}

async function attachRegistryMetadata(
  dependencies,
  { lookup = lookupComponentMetadata } = {},
) {
  return Promise.all(
    dependencies.map(async (entry) => {
      const found = await lookup(entry);
      if (!found) return entry;
      return {
        ...entry,
        ...(found.license && !entry.licenses?.length
          ? { licenses: [found.license] }
          : {}),
        ...(found.supplier && !entry.supplier
          ? { supplier: found.supplier }
          : {}),
      };
    }),
  );
}

/** CycloneDX 1.6 analysis states, in the order a finding moves through them. */
const VEX_STATES = new Set([
  "in_triage",
  "exploitable",
  "resolved",
  "resolved_with_pedigree",
  "false_positive",
  "not_affected",
]);

/**
 * Load recorded VEX statements for a component, if any exist.
 *
 * Unlike the dependency inventory, VEX cannot be generated: whether a CVE
 * actually affects this product is a human judgement. What automation can do
 * is make sure a recorded judgement travels with the release it applies to,
 * and refuse a malformed one.
 *
 * No file means no analysed vulnerabilities, which is the normal state.
 */
export function readVexStatements(root, componentId) {
  const path = resolve(root, "security/vex", `${componentId}.json`);
  if (!existsSync(path)) return [];

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const statements = Array.isArray(parsed) ? parsed : parsed.vulnerabilities;
  if (!Array.isArray(statements)) {
    throw new Error(
      `VEX file must be an array or {"vulnerabilities": [...]}: ${path}`,
    );
  }

  for (const statement of statements) {
    if (!statement?.id) {
      throw new Error(`VEX statement without an id in ${path}`);
    }
    const state = statement.analysis?.state;
    if (!VEX_STATES.has(state)) {
      throw new Error(
        `VEX statement ${statement.id} has state '${state ?? "(missing)"}'; ` +
          `expected one of ${[...VEX_STATES].join(", ")}`,
      );
    }
    // An unaffected claim without a reason is not reviewable, and reviewers
    // are the whole point of publishing one.
    if (
      (state === "not_affected" || state === "false_positive") &&
      !statement.analysis.justification &&
      !statement.analysis.detail
    ) {
      throw new Error(
        `VEX statement ${statement.id} claims '${state}' without a justification or detail`,
      );
    }
  }

  return statements;
}

function readResolvedFile(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(parsed) ? parsed : parsed.components;
  if (!Array.isArray(entries)) {
    throw new Error(
      `Resolved dependency file must be an array or {"components": [...]}: ${path}`,
    );
  }
  return entries;
}

export async function generateSbom(
  componentId,
  {
    root = repoRoot,
    commit,
    generatorCommit,
    releaseTag,
    resolvedFile,
    withLicenses = false,
    runGit = defaultRunGit,
    fetchArtifactText = fetchPublishedText,
  } = {},
) {
  const definition = COMPONENTS[componentId];
  if (!definition) {
    throw new Error(
      `Unknown SBOM component '${componentId}'. Known: ${listComponentIds().join(", ")}`,
    );
  }

  const version = readComponentVersion(componentId, root);
  const resolvedCommit = commit || runGit(["rev-parse", "HEAD"]);
  const resolvedGeneratorCommit =
    generatorCommit || runGit(["rev-parse", "HEAD"]);
  // Commit time keeps the core inventory deterministic.
  const timestamp = new Date(
    runGit(["show", "-s", "--format=%cI", resolvedCommit]),
  ).toISOString();

  const direct = await extractDirectDependencies(
    root,
    sourceForRoot(definition.source, root),
    {
      version,
      fetchText: fetchArtifactText,
    },
  );
  const merged = resolvedFile
    ? mergeResolved(direct, readResolvedFile(resolvedFile))
    : direct;
  const dependencies = withLicenses
    ? await attachRegistryMetadata(merged)
    : merged;

  const vulnerabilities = readVexStatements(root, componentId);

  const document = buildSbom({
    componentId,
    version,
    commit: resolvedCommit,
    generatorCommit: resolvedGeneratorCommit,
    releaseTag,
    timestamp,
    dependencies,
    vulnerabilities,
  });

  return {
    document,
    version,
    fileName: sbomFileName(componentId, version),
    directCount: direct.length,
    totalCount: dependencies.length,
    licensedCount: dependencies.filter((entry) => entry.licenses?.length)
      .length,
    vexCount: vulnerabilities.length,
  };
}

function parseArguments(argv) {
  const options = { componentId: "", outputDir: "sbom", toStdout: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output-dir") {
      options.outputDir = argv[++index];
    } else if (argument === "--commit") {
      options.commit = argv[++index];
    } else if (argument === "--generator-commit") {
      options.generatorCommit = argv[++index];
    } else if (argument === "--resolved") {
      options.resolvedFile = argv[++index];
    } else if (argument === "--tag") {
      options.tag = argv[++index];
    } else if (argument === "--stdout") {
      options.toStdout = true;
    } else if (argument === "--with-licenses") {
      options.withLicenses = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!options.componentId) {
      options.componentId = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (options.tag) {
    const resolved = componentFromTag(options.tag);
    if (!resolved) {
      throw new Error(
        `Release tag '${options.tag}' does not belong to a known SBOM component`,
      );
    }
    if (options.componentId && options.componentId !== resolved.componentId) {
      throw new Error(
        `Release tag '${options.tag}' belongs to ${resolved.componentId}, not ${options.componentId}`,
      );
    }
    options.componentId = resolved.componentId;
  }

  if (!options.componentId) {
    throw new Error(
      `Usage: generate-sbom.mjs <${listComponentIds().join("|")}|--tag TAG> [--output-dir DIR] [--commit SHA] [--generator-commit SHA] [--resolved FILE] [--with-licenses] [--stdout]`,
    );
  }
  return options;
}

async function main() {
  const [maybeCommand] = process.argv.slice(2);

  const readReleaseList = (path) => {
    if (!path) throw new Error(`Usage: generate-sbom.mjs ${maybeCommand} FILE`);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const releases = Array.isArray(parsed?.[0]) ? parsed.flat() : parsed;
    if (!Array.isArray(releases)) {
      throw new Error(`Release list must be a JSON array: ${path}`);
    }
    return releases;
  };

  if (maybeCommand === "missing-release-tags") {
    const path = process.argv[3];
    const releases = readReleaseList(path);
    const tags = findMissingLatestSbomTags(releases);
    process.stdout.write(tags.length > 0 ? `${tags.join("\n")}\n` : "");
    return;
  }

  if (
    maybeCommand === "latest-release-assets" ||
    maybeCommand === "published-release-assets"
  ) {
    const releases = readReleaseList(process.argv[3]);
    const assets =
      maybeCommand === "latest-release-assets"
        ? latestSbomAssets(releases)
        : publishedSbomAssets(releases);
    process.stdout.write(
      assets
        .map((asset) =>
          [
            asset.componentId,
            asset.version,
            asset.tag,
            asset.fileName,
            asset.digest,
          ].join("\t"),
        )
        .join("\n") + (assets.length > 0 ? "\n" : ""),
    );
    return;
  }

  if (maybeCommand === "scan-copy") {
    const inputPath = process.argv[3];
    const outputPath = process.argv[4];
    if (!inputPath || !outputPath || process.argv.length !== 5) {
      throw new Error(
        "Usage: generate-sbom.mjs scan-copy INPUT.cdx.json OUTPUT.cdx.json",
      );
    }
    if (resolve(inputPath) === resolve(outputPath)) {
      throw new Error("scan-copy output must not overwrite the published SBOM");
    }
    const prepared = prepareSbomForExactVulnerabilityScan(
      JSON.parse(readFileSync(inputPath, "utf8")),
    );
    writeFileSync(
      outputPath,
      `${JSON.stringify(prepared.document, null, 2)}\n`,
    );
    console.log(
      `Prepared ${basename(outputPath)}; skipped ${prepared.skippedConstraints} version constraints`,
    );
    return;
  }

  if (maybeCommand === "verify-file") {
    const path = process.argv[3];
    if (!path) {
      throw new Error(
        "Usage: generate-sbom.mjs verify-file FILE --tag TAG [--digest SHA256] [--generator-commit SHA]",
      );
    }
    const options = {};
    const args = process.argv.slice(4);
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index];
      if (!["--tag", "--digest", "--generator-commit"].includes(argument)) {
        throw new Error(`Unknown verify-file option '${argument}'`);
      }
      const value = args[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--tag") options.tag = value;
      if (argument === "--digest") options.digest = value;
      if (argument === "--generator-commit") options.generatorCommit = value;
    }
    if (!options.tag) {
      throw new Error("verify-file requires --tag");
    }
    const releaseCommit = defaultRunGit([
      "rev-parse",
      `${options.tag}^{commit}`,
    ]);
    const verified = verifyPublishedSbom(readFileSync(path), {
      fileName: path,
      releaseTag: options.tag,
      releaseCommit,
      generatorCommit: options.generatorCommit,
      digest: options.digest,
    });
    console.log(
      `Verified ${basename(path)} for ${options.tag} with generator ${verified.generatorCommit}`,
    );
    return;
  }

  if (maybeCommand === "verify-attested-generator") {
    const sbomPath = process.argv[3];
    const attestationPath = process.argv[4];
    const args = process.argv.slice(5);
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index];
      if (!["--repository", "--branch"].includes(argument)) {
        throw new Error(
          `Unknown verify-attested-generator option '${argument}'`,
        );
      }
      const value = args[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--repository") options.repository = value;
      if (argument === "--branch") options.branch = value;
    }
    if (
      !sbomPath ||
      !attestationPath ||
      !options.repository ||
      !options.branch
    ) {
      throw new Error(
        "Usage: generate-sbom.mjs verify-attested-generator SBOM ATTESTATION_JSON --repository OWNER/REPO --branch BRANCH",
      );
    }
    const commit = verifySbomGeneratorAttestation(
      readFileSync(sbomPath),
      readFileSync(attestationPath),
      options,
    );
    console.log(`Verified attested SBOM generator ${commit}`);
    return;
  }

  // `resolve-tag` lets a workflow map a published release back to its component
  // without duplicating the tag conventions in YAML.
  if (maybeCommand === "resolve-tag") {
    const tag = process.argv[3];
    const resolved = componentFromTag(tag);
    const line = resolved
      ? `component=${resolved.componentId}\nversion=${resolved.version}\nsbom-name=${sbomFileName(resolved.componentId, resolved.version)}\nrepair-digest=${repairSbomDigestForTag(tag)}\nmatched=true\n`
      : "matched=false\n";
    process.stdout.write(line);
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(process.env.GITHUB_OUTPUT, line, { flag: "a" });
    }
    return;
  }

  const options = parseArguments(process.argv.slice(2));
  const result = await generateSbom(options.componentId, {
    commit: options.commit,
    generatorCommit: options.generatorCommit,
    releaseTag: options.tag,
    resolvedFile: options.resolvedFile,
    withLicenses: options.withLicenses,
  });
  const serialized = `${JSON.stringify(result.document, null, 2)}\n`;

  if (options.toStdout) {
    process.stdout.write(serialized);
    return;
  }

  const outputDir = resolve(repoRoot, options.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, result.fileName);
  writeFileSync(outputPath, serialized);

  console.log(
    `${result.fileName}: ${result.directCount} direct` +
      (result.totalCount !== result.directCount
        ? `, ${result.totalCount - result.directCount} transitive`
        : "") +
      ` runtime dependencies` +
      (options.withLicenses
        ? `, ${result.licensedCount}/${result.totalCount} with license data`
        : "") +
      (result.vexCount > 0 ? `, ${result.vexCount} VEX statements` : ""),
  );
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `sbom-file=${outputPath}\nsbom-name=${result.fileName}\nversion=${result.version}\n`,
      { flag: "a" },
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`::error::${message}`);
    process.exitCode =
      error instanceof PublishedMetadataUnavailableError
        ? PUBLISHED_METADATA_UNAVAILABLE_EXIT_CODE
        : 1;
  });
}

export const __testing = {
  attachRegistryMetadata,
  COMPONENTS,
  deterministicSerialNumber,
  fetchPublishedText,
  GRADLE_COORDINATE_PATTERN,
  GRADLE_PROJECT_PATTERN,
  lookupComponentMetadata,
};
