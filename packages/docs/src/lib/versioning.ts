import versionsFile from '../../openiap-versions.json?raw';
import expoPackageFile from '../../../../libraries/expo-iap/package.json?raw';
import reactNativePackageFile from '../../../../libraries/react-native-iap/package.json?raw';
import flutterPubspecFile from '../../../../libraries/flutter_inapp_purchase/pubspec.yaml?raw';
import godotPluginFile from '../../../../libraries/godot-iap/addons/godot-iap/plugin.cfg?raw';
import kmpGradlePropertiesFile from '../../../../libraries/kmp-iap/gradle.properties?raw';
import kmpVersionsCatalogFile from '../../../../libraries/kmp-iap/gradle/libs.versions.toml?raw';
import mauiProjectFile from '../../../../libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj?raw';
import googleOpenIapBuildFile from '../../../../packages/google/openiap/build.gradle.kts?raw';

type VersionKey = 'spec' | 'google' | 'apple';

type VersionRecord = Record<VersionKey, string>;

const REQUIRED_KEYS: readonly VersionKey[] = [
  'spec',
  'google',
  'apple',
] as const;

function parseJson(json: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${label} contains invalid JSON. Check the file for syntax errors.`
    );
  }
}

function parseVersions(json: string): Record<string, unknown> {
  return parseJson(json, 'openiap-versions.json');
}

function ensureVersions(data: Record<string, unknown>): VersionRecord {
  return REQUIRED_KEYS.reduce<Partial<VersionRecord>>((accumulator, key) => {
    const value = data[key];

    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`openiap-versions.json missing "${key}" version string`);
    }

    accumulator[key] = value;
    return accumulator;
  }, {}) as VersionRecord;
}

function readRequiredXmlValue(
  xml: string,
  tagName: string,
  label: string
): string {
  const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`));
  const value = match?.[1]?.trim();

  if (!value) {
    throw new Error(`${label} missing <${tagName}>`);
  }

  return value;
}

function readRequiredPackageJsonString(
  json: string,
  key: string,
  label: string
): string {
  const value = parseJson(json, label)[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} missing "${key}" string`);
  }

  return value;
}

function readRequiredMatchValue(
  source: string,
  pattern: RegExp,
  label: string
): string {
  const value = source.match(pattern)?.[1]?.trim();

  if (!value) {
    throw new Error(`${label} not found`);
  }

  return value;
}

const parsedVersions = parseVersions(versionsFile);
const EXPO_PACKAGE_VERSION = readRequiredPackageJsonString(
  expoPackageFile,
  'version',
  'expo-iap package.json'
);
const REACT_NATIVE_PACKAGE_VERSION = readRequiredPackageJsonString(
  reactNativePackageFile,
  'version',
  'react-native-iap package.json'
);
const MAUI_PACKAGE_ID = readRequiredXmlValue(
  mauiProjectFile,
  'PackageId',
  'OpenIap.Maui.csproj'
);
const MAUI_PACKAGE_VERSION = readRequiredXmlValue(
  mauiProjectFile,
  'PackageVersion',
  'OpenIap.Maui.csproj'
);
const FLUTTER_PACKAGE_VERSION = flutterPubspecFile
  .match(/^version:\s*(.+)$/m)?.[1]
  ?.trim();
const GODOT_PACKAGE_VERSION = godotPluginFile
  .match(/^version="([^"]+)"$/m)?.[1]
  ?.trim();
const KMP_PACKAGE_VERSION = kmpGradlePropertiesFile
  .match(/^libraryVersion=(.+)$/m)?.[1]
  ?.trim();
const GOOGLE_COMPILE_SDK = readRequiredMatchValue(
  googleOpenIapBuildFile,
  /compileSdk\s*=\s*(\d+)/,
  'packages/google openiap compileSdk'
);
const GOOGLE_MIN_SDK = readRequiredMatchValue(
  googleOpenIapBuildFile,
  /minSdk\s*=\s*(\d+)/,
  'packages/google openiap minSdk'
);
const GOOGLE_PLAY_BILLING_VERSION = readRequiredMatchValue(
  googleOpenIapBuildFile,
  /val\s+playBillingVersion\s*=\s*"([^"]+)"/,
  'packages/google Play Billing version'
);
const KMP_COMPILE_SDK = readRequiredMatchValue(
  kmpVersionsCatalogFile,
  /^android-compileSdk = "([^"]+)"/m,
  'kmp-iap android-compileSdk'
);
const KMP_MIN_SDK = readRequiredMatchValue(
  kmpVersionsCatalogFile,
  /^android-minSdk = "([^"]+)"/m,
  'kmp-iap android-minSdk'
);
const KMP_TARGET_SDK = readRequiredMatchValue(
  kmpVersionsCatalogFile,
  /^android-targetSdk = "([^"]+)"/m,
  'kmp-iap android-targetSdk'
);

if (!FLUTTER_PACKAGE_VERSION) {
  throw new Error('flutter_inapp_purchase pubspec.yaml missing version');
}

if (!GODOT_PACKAGE_VERSION) {
  throw new Error('godot-iap plugin.cfg missing version');
}

if (!KMP_PACKAGE_VERSION) {
  throw new Error('kmp-iap gradle.properties missing libraryVersion');
}

export const OPENIAP_VERSIONS = Object.freeze(ensureVersions(parsedVersions));

export const GQL_RELEASE = Object.freeze({
  tag: OPENIAP_VERSIONS.spec,
  pageUrl: `https://github.com/hyodotdev/openiap/releases/tag/${OPENIAP_VERSIONS.spec}`,
  downloadPrefix: `https://github.com/hyodotdev/openiap/releases/download/${OPENIAP_VERSIONS.spec}/`,
});

export const ANDROID_SDK = Object.freeze({
  minSdk: GOOGLE_MIN_SDK,
  compileSdk: GOOGLE_COMPILE_SDK,
  targetSdk: GOOGLE_COMPILE_SDK,
});

export const GOOGLE_PLAY_BILLING = Object.freeze({
  version: GOOGLE_PLAY_BILLING_VERSION,
});

export const KMP_ANDROID_SDK = Object.freeze({
  minSdk: KMP_MIN_SDK,
  compileSdk: KMP_COMPILE_SDK,
  targetSdk: KMP_TARGET_SDK,
});

export const FLUTTER_PACKAGE = Object.freeze({
  name: 'flutter_inapp_purchase',
  version: FLUTTER_PACKAGE_VERSION,
  installCommand: 'flutter pub add flutter_inapp_purchase',
  dependencyLine: `flutter_inapp_purchase: ^${FLUTTER_PACKAGE_VERSION}`,
  pubUrl: 'https://pub.dev/packages/flutter_inapp_purchase',
});

export const EXPO_PACKAGE = Object.freeze({
  name: 'expo-iap',
  version: EXPO_PACKAGE_VERSION,
  installCommand: 'npx expo install expo-iap',
  dependencyLine: `"expo-iap": "^${EXPO_PACKAGE_VERSION}"`,
  npmUrl: 'https://www.npmjs.com/package/expo-iap',
});

export const REACT_NATIVE_PACKAGE = Object.freeze({
  name: 'react-native-iap',
  version: REACT_NATIVE_PACKAGE_VERSION,
  installCommand: 'npm install react-native-iap',
  dependencyLine: `"react-native-iap": "^${REACT_NATIVE_PACKAGE_VERSION}"`,
  npmUrl: 'https://www.npmjs.com/package/react-native-iap',
});

export const GODOT_PACKAGE = Object.freeze({
  name: 'godot-iap',
  version: GODOT_PACKAGE_VERSION,
  releaseUrl: `https://github.com/hyodotdev/openiap/releases/tag/godot-iap-${GODOT_PACKAGE_VERSION}`,
  downloadUrl: `https://github.com/hyodotdev/openiap/releases/download/godot-iap-${GODOT_PACKAGE_VERSION}/godot-iap-${GODOT_PACKAGE_VERSION}.zip`,
});

export const KMP_PACKAGE = Object.freeze({
  coordinate: 'io.github.hyochan:kmp-iap',
  version: KMP_PACKAGE_VERSION,
  installCommand: `implementation("io.github.hyochan:kmp-iap:${KMP_PACKAGE_VERSION}")`,
  mavenUrl: `https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap/${KMP_PACKAGE_VERSION}`,
});

export const MAUI_PACKAGE = Object.freeze({
  id: MAUI_PACKAGE_ID,
  version: MAUI_PACKAGE_VERSION,
  installCommand: `dotnet add package ${MAUI_PACKAGE_ID}`,
  pinnedInstallCommand: `dotnet add package ${MAUI_PACKAGE_ID} --version ${MAUI_PACKAGE_VERSION}`,
  packageReference: `<PackageReference Include="${MAUI_PACKAGE_ID}" Version="${MAUI_PACKAGE_VERSION}" />`,
  nugetUrl: `https://www.nuget.org/packages/${MAUI_PACKAGE_ID}`,
  versionedNugetUrl: `https://www.nuget.org/packages/${MAUI_PACKAGE_ID}/${MAUI_PACKAGE_VERSION}`,
});
