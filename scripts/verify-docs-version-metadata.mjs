#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function collectDocsVersionMetadataDrift(root = repoRoot) {
  const read = (file) => readFileSync(resolve(root, file), "utf8");
  const readJson = (file) => JSON.parse(read(file));
  const metadataFile = "packages/docs/src/generated/version-metadata.json";
  const nativeFile = "packages/docs/openiap-versions.json";
  const missing = [metadataFile, nativeFile].filter(
    (file) => !existsSync(resolve(root, file)),
  );
  if (missing.length) return missing.map((file) => `${file} is missing`);
  const docsVersionMetadata = readJson(metadataFile);
  const expectedDocsVersionMetadata = {
    _generatedBy: "scripts/sync-versions.sh",
    cliPackageVersion: readJson("packages/cli/package.json").version,
    clientProtocolPackageVersion: readJson("specs/client/package.json").version,
    commerceProtocolPackageVersion: readJson(
      "specs/commerce-protocol/package.json",
    ).version,
    expoPackageVersion: readJson("libraries/expo-iap/package.json").version,
    reactNativePackageVersion: readJson(
      "libraries/react-native-iap/package.json",
    ).version,
    flutterPackageVersion: read("libraries/flutter_inapp_purchase/pubspec.yaml")
      .match(/^version:\s*(.+)$/m)?.[1]
      ?.trim(),
    godotPackageVersion: read("libraries/godot-iap/addons/godot-iap/plugin.cfg")
      .match(/^version="([^"]+)"$/m)?.[1]
      ?.trim(),
    kmpPackageVersion: read("libraries/kmp-iap/gradle.properties")
      .match(/^libraryVersion=(.+)$/m)?.[1]
      ?.trim(),
    mauiPackageId: read(
      "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    )
      .match(/<PackageId>([^<]+)<\/PackageId>/)?.[1]
      ?.trim(),
    mauiPackageVersion: read(
      "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    )
      .match(/<PackageVersion>([^<]+)<\/PackageVersion>/)?.[1]
      ?.trim(),
    googleCompileSdk: read("packages/google/openiap/build.gradle.kts").match(
      /compileSdk\s*=\s*(\d+)/,
    )?.[1],
    googleMinSdk: read("packages/google/openiap/build.gradle.kts").match(
      /minSdk\s*=\s*(\d+)/,
    )?.[1],
    googlePlayBillingVersion: read(
      "packages/google/openiap/build.gradle.kts",
    ).match(/val\s+playBillingVersion\s*=\s*"([^"]+)"/)?.[1],
    kmpCompileSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
      /^android-compileSdk = "([^"]+)"/m,
    )?.[1],
    kmpMinSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
      /^android-minSdk = "([^"]+)"/m,
    )?.[1],
    kmpTargetSdk: read("libraries/kmp-iap/gradle/libs.versions.toml").match(
      /^android-targetSdk = "([^"]+)"/m,
    )?.[1],
  };
  const failures = [];
  for (const [key, expectedValue] of Object.entries(
    expectedDocsVersionMetadata,
  )) {
    if (typeof expectedValue !== "string" || !expectedValue.length) {
      failures.push(`Missing source metadata for ${key}`);
    } else if (docsVersionMetadata[key] !== expectedValue) {
      failures.push(`${metadataFile} ${key} must be synced from SSOT metadata`);
    }
  }
  const versions = readJson("openiap-versions.json");
  const docsVersions = readJson(nativeFile);
  if (JSON.stringify(docsVersions) !== JSON.stringify(versions))
    failures.push(`${nativeFile} must match openiap-versions.json`);
  return failures;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const failures = collectDocsVersionMetadataDrift();
    if (failures.length) {
      console.error(failures.join("\n"));
      process.exitCode = 1;
    } else
      console.log("Docs version metadata: synchronized with package sources.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
