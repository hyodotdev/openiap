import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { collectDocsVersionMetadataDrift } from "./verify-docs-version-metadata.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "openiap-docs-versions-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of [
    "openiap-versions.json",
    "packages/docs/openiap-versions.json",
    "packages/docs/src/generated/version-metadata.json",
    "packages/cli/package.json",
    "specs/client/package.json",
    "specs/commerce-protocol/package.json",
    "libraries/expo-iap/package.json",
    "libraries/react-native-iap/package.json",
    "libraries/flutter_inapp_purchase/pubspec.yaml",
    "libraries/godot-iap/addons/godot-iap/plugin.cfg",
    "libraries/kmp-iap/gradle.properties",
    "libraries/kmp-iap/gradle/libs.versions.toml",
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    "packages/google/openiap/build.gradle.kts",
  ]) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    cpSync(resolve(source, file), resolve(root, file));
  }
  return root;
}

test("accepts synchronized RC metadata without requiring stable versions", (t) => {
  const root = fixture(t);
  const metadataFile = resolve(
    root,
    "packages/docs/src/generated/version-metadata.json",
  );
  const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
  metadata.expoPackageVersion = "6.0.0-rc.0";
  writeFileSync(metadataFile, JSON.stringify(metadata));
  writeFileSync(
    resolve(root, "libraries/expo-iap/package.json"),
    JSON.stringify({ version: "6.0.0-rc.0" }),
  );
  assert.deepEqual(collectDocsVersionMetadataDrift(root), []);
});

test("rejects stale generated versions and native copies", (t) => {
  const root = fixture(t);
  writeFileSync(
    resolve(root, "libraries/expo-iap/package.json"),
    JSON.stringify({ version: "999.0.0-rc.0" }),
  );
  writeFileSync(
    resolve(root, "packages/docs/openiap-versions.json"),
    JSON.stringify({
      clientProtocol: "999.0.0",
      apple: "999.0.0",
      google: "999.0.0",
    }),
  );
  const failures = collectDocsVersionMetadataDrift(root);
  assert(failures.some((message) => message.includes("expoPackageVersion")));
  assert(
    failures.includes(
      "packages/docs/openiap-versions.json must match openiap-versions.json",
    ),
  );
});

test("rejects a missing generated metadata snapshot", (t) => {
  const root = fixture(t);
  rmSync(resolve(root, "packages/docs/src/generated/version-metadata.json"));
  assert.deepEqual(collectDocsVersionMetadataDrift(root), [
    "packages/docs/src/generated/version-metadata.json is missing",
  ]);
});
