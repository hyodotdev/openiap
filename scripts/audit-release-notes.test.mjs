import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  RELEASE_NOTES,
  findUnnotedSourceChanges,
} from "./audit-release-notes.mjs";

test("published source changes need the release card", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      "packages/google/gradle/openiap-store.gradle",
      "libraries/expo-iap/plugin/src/withIAP.ts",
      "libraries/react-native-iap/android/build.gradle",
      "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
      "packages/google/openiap/consumer-rules.pro",
      "Package.swift",
      "specs/client/src/api.graphql",
      "specs/client/src/generated/types.gd",
    ]),
    [
      "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      "packages/google/gradle/openiap-store.gradle",
      "libraries/expo-iap/plugin/src/withIAP.ts",
      "libraries/react-native-iap/android/build.gradle",
      "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
      "packages/google/openiap/consumer-rules.pro",
      "Package.swift",
      "specs/client/src/api.graphql",
      "specs/client/src/generated/types.gd",
    ],
  );
});

test("a PR that updates the release card passes", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "libraries/expo-iap/plugin/src/withIAP.ts",
      RELEASE_NOTES,
    ]),
    [],
  );
});

test("tests, examples, docs, and manifests need no release card", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "libraries/expo-iap/src/__tests__/vega-adapter.test.ts",
      "libraries/expo-iap/example/eas.json",
      "packages/google/openiap/src/testAmazon/java/dev/hyo/openiap/AmazonSubscriptionProductMappingTest.kt",
      "packages/google/Example/build.gradle.kts",
      "libraries/flutter_inapp_purchase/pubspec.yaml",
      "libraries/react-native-iap/package.json",
      "packages/docs/src/pages/docs/setup/expo.tsx",
      "libraries/kmp-iap/library/src/androidUnitTest/kotlin/io/github/hyochan/kmpiap/PlatformStoreTest.kt",
      "specs/client/codegen/plugins/gdscript.ts",
      "specs/client/src/generated-gdscript.test.ts",
    ]),
    [],
  );
});

test("the audit reads only the branch's own changes after the base moved on", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-"));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
      cwd: root,
      stdio: "pipe",
    });
  const commit = (file, message) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), message);
    git("add", file);
    git("commit", "-q", "-m", message);
  };
  try {
    git("init", "-q", "-b", "main");
    commit("README.md", "start");
    git("checkout", "-q", "-b", "feature");
    commit("packages/docs/src/pages/docs/setup/expo.tsx", "docs only");
    git("checkout", "-q", "main");
    commit("packages/cli/src/init.mjs", "a source change on main");
    git("checkout", "-q", "feature");
    const audit = fileURLToPath(new URL("./audit-release-notes.mjs", import.meta.url));
    const output = execFileSync("node", [audit, "main"], { cwd: root, encoding: "utf8" });
    assert.match(output, /Release note audit: clean\./);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
