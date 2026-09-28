import assert from "node:assert/strict";
import test from "node:test";
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
    ]),
    [
      "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      "packages/google/gradle/openiap-store.gradle",
      "libraries/expo-iap/plugin/src/withIAP.ts",
      "libraries/react-native-iap/android/build.gradle",
      "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
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
    ]),
    [],
  );
});
