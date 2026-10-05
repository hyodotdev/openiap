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
    "React Native 17.0.0, Expo 6.0.0, Flutter 11.0.0, and Godot 4.0.0 run the provider's Android restore before querying ownership.",
    "purchaseUpdatedListener",
    "onPurchaseSuccess",
    "On Horizon, each owned purchase then reaches <code>purchaseUpdatedListener</code> / <code>onPurchaseSuccess</code> (React Native, Expo) and Flutter's purchase-updated stream.",
    "React Native 17.0.0, Expo 6.0.0, Flutter 11.0.0, and Godot 4.0.0 report the provider's own Android error code instead of fixed codes",
    "React Native, Expo, and Flutter also report a store-aware init message",
    "activity-unavailable",
    "adds <code>UNKNOWN</code> to the public <code>Store</code> enum",
    "when (getStore())",
    "React Native 17.0.0 and Flutter 11.0.0 (every call)",
    "4.0.0 and MAUI 3.0.0 (id-filtered calls)",
    "now answer <code>hasActiveSubscriptions</code> from OpenIAP's active flag (expiration in the future).",
    "On iOS, a subscriber in billing grace reads inactive, as in Expo and native.",
    "Cancelling a <code>requestPurchase</code> task throws <code>CancellationError</code> without a purchase-error event (the same holds for the other operations that rethrow it); <code>purchaseErrorListener</code> and <code>OpenIapStore.onPurchaseError</code> stay silent",
  ]) {
    assert.ok(card.includes(disclosure), `card is missing: ${disclosure}`);
  }
  assert.ok(
    !card.includes("still signals each owned purchase once"),
    "stale Godot restore claim is still present",
  );
  assert.ok(
    !card.includes("StoreKit's active flag"),
    "stale StoreKit flag claim is still present",
  );
});

test("the restore-purchases page documents the provider-first Android restore", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "packages/docs/src/pages/docs/apis/restore-purchases.tsx"),
    "utf8",
  );
  const page = source.replaceAll("&apos;", "'").replaceAll("{' '}", " ").replaceAll(/\s+/g, " ");
  assert.ok(page.includes("Reads owned purchases from the store"));
  assert.ok(page.includes("with no system-level UI prompt"));
  assert.ok(
    page.includes(
      "React Native, Expo, Flutter, MAUI, Godot, and KMP (Amazon, Horizon, and community-provider builds) call the provider's restore",
    ),
  );
  assert.ok(page.includes("KMP's Play build queries ownership directly"));
  assert.ok(page.includes("<code>PurchasingService.getPurchaseUpdates</code>"));
  assert.ok(
    page.includes("Play and Amazon restores deliver nothing by themselves"),
  );
  assert.ok(
    page.includes(
      "Horizon's restore delivers each owned purchase to the purchase listeners (React Native, Expo, Flutter, MAUI, and KMP)",
    ),
  );
  assert.ok(
    page.includes(
      "Godot emits no <code>purchase_updated</code> signal; read owned purchases with <code>get_available_purchases_result</code>",
    ),
  );
  assert.ok(
    !page.includes("signals each owned purchase once"),
    "stale Godot restore claim is still present",
  );
  assert.ok(
    !page.includes("Runs the provider's restore first"),
    "unqualified restore claim is still present",
  );
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
  assert.ok(page.includes("<code>purchaseState == PURCHASED</code> as active"));
  assert.ok(
    !page.includes("paying or grace"),
    "stale isActive claim is still present",
  );
  assert.ok(
    !page.includes("autoRenewing</code> as active"),
    "stale autoRenewing claim is still present",
  );
});

test("the registry note keeps a major's profile while any entry cites it", () => {
  const guide = fs.readFileSync(
    path.join(repoRoot, "knowledge/internal/04-platform-packages.md"),
    "utf8",
  );
  assert.ok(guide.includes("for as long as any registry entry cites it"));
  assert.ok(
    !guide.includes("until the registry maintenance window ends"),
    "stale registry window claim is still present",
  );
  const profile = fs.readFileSync(
    path.join(repoRoot, "packages/conformance/src/spec/provider-profile.mjs"),
    "utf8",
  );
  assert.ok(profile.includes("while any registry entry cites it"));
  assert.ok(
    !profile.includes("until the registry window ends"),
    "stale registry window claim is still present",
  );
});

test("the Expo restore JSDoc names the provider restore first", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "libraries/expo-iap/src/index.ts"),
    "utf8",
  );
  assert.ok(
    source.includes(
      "Android: run the provider's restore, then fetch available purchases",
    ),
  );
  assert.ok(
    !source.includes("the query itself restores them"),
    "stale restore JSDoc is still present",
  );
});
