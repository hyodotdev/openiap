#!/usr/bin/env node
// Writes (--write) or verifies the version metadata the docs site reads.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { versionSources } from "./release-branch-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metadataFile = "packages/docs/src/generated/version-metadata.json";
const nativeFile = "packages/docs/openiap-versions.json";

// The version sources live across the repo; the site reads this generated copy
// of the package and SDK versions instead.
export function docsVersionMetadata(root = repoRoot) {
  const version = (packageId) => versionSources[packageId].read(root);
  const match = (file, pattern) =>
    readFileSync(resolve(root, file), "utf8").match(pattern)?.[1]?.trim();
  const googleBuild = "packages/google/openiap/build.gradle.kts";
  const kmpCatalog = "libraries/kmp-iap/gradle/libs.versions.toml";
  return {
    _generatedBy: "scripts/sync-versions.sh",
    cliPackageVersion: version("cli"),
    clientProtocolPackageVersion: version("client-protocol"),
    commerceProtocolPackageVersion: version("commerce-protocol"),
    expoPackageVersion: version("expo"),
    reactNativePackageVersion: version("react-native"),
    flutterPackageVersion: version("flutter"),
    godotPackageVersion: version("godot"),
    kmpPackageVersion: version("kmp"),
    mauiPackageId: match(
      versionSources.maui.path,
      /<PackageId>([^<]+)<\/PackageId>/,
    ),
    mauiPackageVersion: version("maui"),
    googleCompileSdk: match(googleBuild, /compileSdk\s*=\s*(\d+)/),
    googleMinSdk: match(googleBuild, /minSdk\s*=\s*(\d+)/),
    googlePlayBillingVersion: match(
      googleBuild,
      /val\s+playBillingVersion\s*=\s*"([^"]+)"/,
    ),
    kmpCompileSdk: match(kmpCatalog, /^android-compileSdk = "([^"]+)"/m),
    kmpMinSdk: match(kmpCatalog, /^android-minSdk = "([^"]+)"/m),
    kmpTargetSdk: match(kmpCatalog, /^android-targetSdk = "([^"]+)"/m),
  };
}

function missingSources(metadata) {
  return Object.entries(metadata)
    .filter(([, value]) => !value)
    .map(([key]) => `Missing source metadata for ${key}`);
}

export function writeDocsVersionMetadata(root = repoRoot) {
  const metadata = docsVersionMetadata(root);
  const missing = missingSources(metadata);
  if (missing.length) throw new Error(missing.join("\n"));
  const target = resolve(root, metadataFile);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(metadata, null, 2)}\n`);
}

export function collectDocsVersionMetadataDrift(root = repoRoot) {
  const readJson = (file) =>
    JSON.parse(readFileSync(resolve(root, file), "utf8"));
  const missing = [metadataFile, nativeFile].filter(
    (file) => !existsSync(resolve(root, file)),
  );
  if (missing.length) return missing.map((file) => `${file} is missing`);
  let expected;
  try {
    expected = docsVersionMetadata(root);
  } catch (error) {
    return [error.message];
  }
  const actual = readJson(metadataFile);
  const failures = missingSources(expected);
  for (const [key, value] of Object.entries(expected)) {
    if (value && actual[key] !== value) {
      failures.push(`${metadataFile} ${key} must be synced from SSOT metadata`);
    }
  }
  if (
    JSON.stringify(readJson(nativeFile)) !==
    JSON.stringify(readJson("openiap-versions.json"))
  ) {
    failures.push(`${nativeFile} must match openiap-versions.json`);
  }
  return failures;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] === "--write") {
      writeDocsVersionMetadata();
    } else {
      const failures = collectDocsVersionMetadataDrift();
      if (failures.length) {
        console.error(failures.join("\n"));
        process.exitCode = 1;
      } else {
        console.log(
          "Docs version metadata: synchronized with package sources.",
        );
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
