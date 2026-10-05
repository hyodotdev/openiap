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
      "openiap.podspec",
      "packages/google/gradle-plugin/build.gradle.kts",
      "packages/cli/bin/openiap.mjs",
      "libraries/react-native-iap/android/consumer-rules.pro",
      "libraries/react-native-iap/android/CMakeLists.txt",
      "libraries/expo-iap/onside/index.js",
      "libraries/kmp-iap/library/consumer-rules-non-play.pro",
      "libraries/godot-iap/android/settings.gradle.kts",
      "libraries/maui-iap/android/build.gradle.kts",
      "libraries/godot-iap/scripts/fix_ios_embed.sh",
      "libraries/godot-iap/scripts/write-gdap.sh",
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
      "openiap.podspec",
      "packages/google/gradle-plugin/build.gradle.kts",
      "packages/cli/bin/openiap.mjs",
      "libraries/react-native-iap/android/consumer-rules.pro",
      "libraries/react-native-iap/android/CMakeLists.txt",
      "libraries/expo-iap/onside/index.js",
      "libraries/kmp-iap/library/consumer-rules-non-play.pro",
      "libraries/godot-iap/android/settings.gradle.kts",
      "libraries/maui-iap/android/build.gradle.kts",
      "libraries/godot-iap/scripts/fix_ios_embed.sh",
      "libraries/godot-iap/scripts/write-gdap.sh",
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
      "libraries/react-native-iap/android/gradle.properties",
      "libraries/kmp-iap/library/library.podspec",
      "packages/google/openiap/proguard-rules.pro",
      "libraries/godot-iap/ios-gdextension/Tests/GodotIapTests/GodotIapHelperTests.swift",
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cardText() {
  const source = fs.readFileSync(path.join(repoRoot, RELEASE_NOTES), "utf8");
  const start = source.indexOf("id: 'community-store-providers-2026-10-02'");
  const end = source.indexOf("id: '", start + 1);
  const card = source.slice(start, end === -1 ? undefined : end);
  return card.replaceAll("&apos;", "'").replaceAll("{' '}", " ").replaceAll(/\s+/g, " ");
}

test("the community provider card discloses the Android restore, error, Store, and subscription behaviors", () => {
  const card = cardText();
  for (const disclosure of [
    "React Native 17.0.0, Expo 6.0.0, and Flutter 11.0.0 run the provider's Android restore before querying ownership",
    "purchaseUpdated",
    "onPurchaseSuccess",
    "<code>purchaseUpdated</code> / <code>onPurchaseSuccess</code> (React Native, Expo) and Flutter's purchase-updated stream",
    "React Native 17.0.0, Expo 6.0.0, and Flutter 11.0.0 report the provider's own Android error code",
    "report the provider's own Android error code and store-aware init message",
    "activity-unavailable",
    "adds <code>UNKNOWN</code> to the public <code>Store</code> enum",
    "when (getStore())",
    "React Native 17.0.0 and Flutter 11.0.0 (every call)",
    "4.0.0 and MAUI 3.0.0 (id-filtered calls)",
    "from StoreKit's active flag, as Expo and native do",
    "billing grace reads inactive",
    "Cancelled tasks rethrow <code>CancellationError</code> with no purchase-error event; <code>purchaseErrorListener</code> and <code>OpenIapStore.onPurchaseError</code> stay silent",
  ]) {
    assert.ok(card.includes(disclosure), `card is missing: ${disclosure}`);
  }
});

test("the restore-purchases page documents the provider-first Android restore", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "packages/docs/src/pages/docs/apis/restore-purchases.tsx"),
    "utf8",
  );
  const page = source.replaceAll("&apos;", "'").replaceAll("{' '}", " ").replaceAll(/\s+/g, " ");
  assert.ok(page.includes("Runs the provider's restore first"));
  assert.ok(page.includes("Amazon: <code>PurchaseUpdates</code>"));
  assert.ok(
    page.includes("Play and Amazon restores deliver nothing by themselves"),
  );
  assert.ok(
    page.includes(
      "Horizon's restore delivers each owned purchase to the purchase listeners",
    ),
  );
  assert.ok(page.includes("Godot signals each owned purchase once on every store"));
  assert.ok(
    !page.includes("Play has no concept of an explicit"),
    "stale restore claim is still present",
  );
});

test("the get-active-subscriptions page documents the platform isActive rules", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "packages/docs/src/pages/docs/apis/get-active-subscriptions.tsx"),
    "utf8",
  );
  const page = source.replaceAll("&apos;", "'").replaceAll("{' '}", " ").replaceAll(/\s+/g, " ");
  assert.ok(page.includes("while the expiration date is in the future"));
  assert.ok(page.includes("billing grace reads inactive"));
  assert.ok(page.includes("while the purchase state is purchased"));
  assert.ok(
    !page.includes("paying or grace"),
    "stale isActive claim is still present",
  );
});
