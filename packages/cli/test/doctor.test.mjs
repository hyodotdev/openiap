import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { FINDING_IDS, doctor, formatText } from "../src/doctor.mjs";
import { finding } from "../src/findings.mjs";
import { readFileSync } from "node:fs";

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), "openiap-doctor-"));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return root;
}

function ids(root) {
  return doctor(root).findings.map((one) => one.id);
}

function withProject(files, assertion) {
  const root = project(files);
  try {
    assertion(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const EXPO = {
  "package.json": JSON.stringify({ dependencies: { "expo-iap": "1" } }),
};
const RN = {
  "package.json": JSON.stringify({ dependencies: { "react-native-iap": "1" } }),
};
const SECRET_KEY = `openiap-kit_sk_${"4f2a9c1e".repeat(8)}`;

test("a Play project with nothing else set reports nothing", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "play"\n',
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a Horizon build is reported before it reaches a Play device", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
      "android/app/src/main/AndroidManifest.xml":
        '<manifest><application><meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" android:value="1"/></application></manifest>',
    },
    (root) => assert.deepEqual(ids(root), ["android-store-not-play"]),
  );
});

test("a half-regenerated project is an error, not a warning", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
    },
    (root) => {
      const result = doctor(root);
      const mismatch = result.findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(mismatch.level, "error");
      assert.equal(mismatch.expected, "play");
      assert.equal(mismatch.actual, "horizon");
    },
  );
});

test("Horizon without an app id in any manifest is reported", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
      "android/app/src/main/AndroidManifest.xml":
        "<manifest><application/></manifest>",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-horizon-app-id-missing",
      );
      // Gradle can inject the id as a placeholder, which no manifest records,
      // so this is a suspicion and must not fail the command.
      assert.equal(finding.level, "warning");
    },
  );
});

test("the app id declared in the Horizon source set counts", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
      "android/app/src/main/AndroidManifest.xml":
        "<manifest><application/></manifest>",
      "android/app/src/horizon/AndroidManifest.xml":
        '<manifest><application><meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" android:value="1"/></application></manifest>',
    },
    (root) => assert.ok(!ids(root).includes("android-horizon-app-id-missing")),
  );
});

test("the store the flags selected is the line cited as evidence", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "fireOsEnabled=true\nhorizonEnabled=false\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-not-play",
      );
      assert.equal(finding.actual, "amazon");
      assert.equal(finding.line, 1);
    },
  );
});

test("both stores enabled is a conflict", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=true\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "amazon"\n',
    },
    (root) => assert.ok(ids(root).includes("android-store-flavor-conflict")),
  );
});

test("a build-time flavor expression is left alone", () => {
  // React Native and Flutter derive the flavor from the same flags at build
  // time, so there is no stale literal to disagree with.
  withProject(
    {
      ...RN,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", flavor\n',
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a secret key in a client file is an error", () => {
  withProject(
    { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n` },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-secret-key-in-client",
      );
      assert.equal(finding.level, "error");
      assert.equal(finding.line, 1);
    },
  );
});

test("a comment naming the secret prefix is not a leak", () => {
  // The line our own example config carries, verbatim.
  withProject(
    {
      ...EXPO,
      "app.config.ts":
        "// IAPKit openiap-kit_pk_ publishable key. Never use openiap-kit_sk_ here.\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a workspace-linked project still detects its framework", () => {
  // A monorepo example resolves expo-iap through the workspace, so it never
  // appears in package.json; the Expo env rule still has to apply.
  withProject(
    {
      "package.json": JSON.stringify({ dependencies: { expo: "^57.0.0" } }),
      ".env": "IAPKIT_API_KEY=openiap-kit_pk_1\n",
    },
    (root) => {
      const result = doctor(root);
      assert.equal(result.framework, "expo");
      assert.ok(
        result.findings.some(
          (one) => one.id === "iapkit-env-missing-expo-prefix",
        ),
      );
    },
  );
});

test("react-native-iap inside an Expo app follows the Expo env rule", () => {
  withProject(
    {
      "package.json": JSON.stringify({
        dependencies: { expo: "^57.0.0", "react-native-iap": "1" },
      }),
      ".env": "EXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_pk_1\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("Expo without the public prefix cannot read the value", () => {
  withProject(
    { ...EXPO, ".env": "IAPKIT_API_KEY=openiap-kit_pk_1\n" },
    (root) => assert.ok(ids(root).includes("iapkit-env-missing-expo-prefix")),
  );
});

test("the Expo prefix in a React Native project is reported", () => {
  withProject(
    { ...RN, ".env": "EXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_pk_1\n" },
    (root) =>
      assert.ok(ids(root).includes("iapkit-env-unexpected-expo-prefix")),
  );
});

test("a base URL carrying the verification path is reported", () => {
  withProject(
    {
      ...EXPO,
      ".env":
        "EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev/v1/purchase/verify\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-base-url-has-path",
      );
      // The path can carry a bearer and the host can be private, so the
      // finding says where the value is and never what it is.
      assert.equal(finding.actual, undefined);
      assert.equal(finding.line, 1);
    },
  );
});

test("a bare origin is accepted", () => {
  withProject(
    {
      ...EXPO,
      ".env": "EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("an Info.plist naming a scene delegate the target lacks is reported", () => {
  withProject(
    {
      ...EXPO,
      "ios/ExpoIAPExample/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
    },
    (root) => assert.ok(ids(root).includes("ios-scene-delegate-missing")),
  );
});

test("the same plist with the class present is fine", () => {
  withProject(
    {
      ...EXPO,
      "ios/ExpoIAPExample/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/ExpoIAPExample/SceneDelegate.swift": "class SceneDelegate {}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("the Kotlin DSL spelling of the flavor is read too", () => {
  // Groovy writes `missingDimensionStrategy "platform", "x"`; the Kotlin DSL
  // wraps the same arguments in parentheses, and Flutter and KMP apps default
  // to build.gradle.kts.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle.kts":
        'missingDimensionStrategy("platform", "horizon")\n',
    },
    (root) => {
      const result = doctor(root);
      const mismatch = result.findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(mismatch.file, "android/app/build.gradle.kts");
      assert.equal(mismatch.actual, "horizon");
    },
  );
});

test("the iOS check reads the app's own directory name", () => {
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      assert.equal(finding.file, "ios/MyGreatApp/Info.plist");
      assert.equal(finding.actual, "SceneDelegate");
    },
  );
});

test("a scene delegate declared in another file counts", () => {
  // The class does not have to live in a file named after it.
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/MyGreatApp/AppDelegate.swift":
        "class AppDelegate {}\nclass SceneDelegate: UIResponder {}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a server-side secret in an Expo env file is a warning, not an error", () => {
  // Expo inlines only EXPO_PUBLIC_ names, so an Expo Router API route can hold
  // this key legitimately. Failing the command there would be wrong.
  withProject({ ...EXPO, ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n` }, (root) => {
    const result = doctor(root);
    const finding = result.findings.find((one) =>
      one.id.startsWith("iapkit-secret-key"),
    );
    assert.equal(finding.id, "iapkit-secret-key-in-env");
    assert.equal(finding.level, "warning");
    assert.equal(result.errors, 0);
  });
});

test("the same secret on a public name is still an error", () => {
  withProject(
    { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n` },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.id, "iapkit-secret-key-in-client");
      assert.equal(finding.level, "error");
    },
  );
});

test("a secret in app.config is an error whatever the framework", () => {
  withProject(
    { ...EXPO, "app.config.js": `export default {key: '${SECRET_KEY}'};\n` },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.id, "iapkit-secret-key-in-client");
    },
  );
});

test("the publishable-key name the docs teach is read too", () => {
  withProject(
    { ...EXPO, ".env": "IAPKIT_PUBLISHABLE_KEY=openiap-kit_pk_1\n" },
    (root) => assert.ok(ids(root).includes("iapkit-env-missing-expo-prefix")),
  );
});

test("a KMP module that names the dependency is detected", () => {
  // The dependency sits in the module that applies it, not the catalog.
  withProject(
    {
      "composeApp/build.gradle.kts":
        'implementation("io.github.hyochan:kmp-iap:1.0")\n',
    },
    (root) => assert.equal(doctor(root).framework, "kmp"),
  );
});

test("an Objective-C scene delegate counts", () => {
  // `\b` before `@` never matches, so the ObjC alternative was unreachable and
  // every ObjC project got a false error.
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/MyGreatApp/SceneDelegate.m":
        "@interface SceneDelegate : UIResponder\n@end\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a scene delegate in a subdirectory counts", () => {
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/MyGreatApp/Sources/Delegates/SceneDelegate.swift":
        "class SceneDelegate {}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a generated build directory is not searched for the class", () => {
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      "ios/MyGreatApp/Pods/Other/SceneDelegate.swift":
        "class SceneDelegate {}\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      // Module-qualified: the class must be in the app's own module.
      assert.equal(finding.level, "error");
    },
  );
});

test("an unqualified name a framework could supply is only a warning", () => {
  withProject(
    {
      ...EXPO,
      "ios/MyGreatApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
    },
    (root) => {
      const result = doctor(root);
      assert.equal(result.findings[0].id, "ios-scene-delegate-missing");
      assert.equal(result.findings[0].level, "warning");
      assert.equal(result.errors, 0);
    },
  );
});

test("a secret on the first bare line does not hide a later one", () => {
  // Only the first bare match was inspected, so a secret API key silenced the
  // prefix rule for a base URL that really does read as undefined.
  withProject(
    {
      ...EXPO,
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\nIAPKIT_BASE_URL=https://kit.openiap.dev\n`,
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-env-missing-expo-prefix",
      );
      assert.equal(finding.actual, "IAPKIT_BASE_URL");
      assert.equal(finding.line, 2);
      // Never name the secret in the rename advice.
      assert.ok(!finding.fix.includes("API_KEY"));
    },
  );
});

test("Expo inlines any EXPO_PUBLIC_ name, not only uppercase ones", () => {
  withProject(
    { ...EXPO, ".env": `EXPO_PUBLIC_iapkit=${SECRET_KEY}\n` },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.id, "iapkit-secret-key-in-client");
      assert.equal(finding.level, "error");
    },
  );
});

test("an exported bare name is read too", () => {
  withProject(
    { ...EXPO, ".env": "export IAPKIT_API_KEY=openiap-kit_pk_1\n" },
    (root) => assert.ok(ids(root).includes("iapkit-env-missing-expo-prefix")),
  );
});

test("the store flags are read the way Groovy reads them", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=TRUE\nfireOsEnabled=false\n",
    },
    (root) => assert.ok(ids(root).includes("android-store-not-play")),
  );
});

test("the reported line is the platform strategy, not another dimension", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "tier", "free"\nmissingDimensionStrategy "platform", "amazon"\n',
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(finding.line, 2);
      assert.equal(finding.actual, "amazon");
    },
  );
});

test("blanking a gradle comment does not move the reported line", () => {
  // Removing comments shifted every offset after them, so the finding named a
  // row above the one it read.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        '// a\n/* b\n   c */\n// d\nmissingDimensionStrategy "platform", "amazon"\n',
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(finding.line, 5);
    },
  );
});

test("a commented-out gradle line is disabled configuration, not the flavor", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        "android {\n  // missingDimensionStrategy 'platform', 'amazon'\n  missingDimensionStrategy 'platform', 'play'\n}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("gradle.properties is read the way java.util.Properties reads it", () => {
  // Leading whitespace and `:` are both legal, and rejecting them invented a
  // mismatch on a file Gradle reads perfectly well.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "  fireOsEnabled:true\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "amazon"\n',
    },
    (root) => assert.deepEqual(ids(root), ["android-store-not-play"]),
  );
});

test("a repeated env name resolves to the one dotenv applies", () => {
  withProject(
    {
      ...EXPO,
      ".env":
        "EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev\nEXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev/v1/purchase/verify\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-base-url-has-path",
      );
      assert.equal(finding.line, 2);
    },
  );
});

test("a key in eas.json reaches the binary EAS builds", () => {
  withProject(
    {
      ...EXPO,
      "eas.json": JSON.stringify({
        build: {
          production: { env: { EXPO_PUBLIC_IAPKIT_API_KEY: SECRET_KEY } },
        },
      }),
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("a key inside an env comment is not shipped", () => {
  withProject(
    {
      ...EXPO,
      ".env": `# Never put a secret key here:\n# EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\nEXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_pk_1\n`,
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("an empty scene delegate name is reported, not treated as satisfied", () => {
  // The empty name compiled to a pattern that matched any `class`, so a plist
  // naming nothing usable passed as if the class existed.
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).</string></dict></plist>",
      "ios/App/AppDelegate.swift": "class AppDelegate {}\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      assert.equal(finding.level, "error");
    },
  );
});

test("a class renamed for UIKit with @objc counts", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/App/Delegates.swift":
        "@objc(SceneDelegate) public final class RCTReactNativeSceneDelegate {}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a plist value carrying regex syntax is data, not a pattern", () => {
  // Interpolated unescaped, `Scene(Delegate` threw out of the whole run and
  // took every finding computed before it with it.
  withProject(
    {
      ...EXPO,
      ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n`,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).Scene(Delegate</string></dict></plist>",
    },
    (root) => {
      const found = ids(root);
      assert.ok(found.includes("iapkit-secret-key-in-client"));
      assert.ok(found.includes("ios-scene-delegate-missing"));
    },
  );
});

test("a base URL finding never carries the value it read", () => {
  // A path bearer, a private hostname and a query token are all values; the
  // message names the fault and the line points at it.
  for (const value of [
    "https://kit.acme.dev/v1?access_token=ghp_secret_value",
    "https://acme-internal.corp.example/t/eyJhbGciOiJIUzI1NiJ9.c2VjcmV0",
    "ftp://user:hunter2@kit.acme.dev",
  ]) {
    withProject(
      { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_BASE_URL=${value}\n` },
      (root) => {
        const serialized = JSON.stringify(doctor(root));
        for (const secret of [
          "ghp_secret_value",
          "c2VjcmV0",
          "hunter2",
          "corp.example",
        ]) {
          assert.ok(
            !serialized.includes(secret),
            `${secret} reached the output`,
          );
        }
      },
    );
  }
});

test("a package.json that cannot be parsed is a finding, not silence", () => {
  // Framework detection reads it, so every check below it is degraded.
  withProject(
    { "package.json": '{"dependencies":{"expo":"51",},}' },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "project-manifest-unreadable"),
      );
      assert.ok(result.errors > 0);
    },
  );
});

test("a path that is not a directory cannot be reported clean", () => {
  const result = doctor("/definitely/not/here");
  assert.equal(result.findings[0].id, "project-not-a-directory");
  assert.equal(result.errors, 1);
});

test("a dotenv transform makes every bare name correct", () => {
  withProject(
    {
      "package.json": JSON.stringify({
        dependencies: { expo: "^57.0.0" },
        devDependencies: { "react-native-dotenv": "^3.4.0" },
      }),
      ".env": "IAPKIT_API_KEY=openiap-kit_pk_1\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("plain dotenv is a Node library, not a bundler transform", () => {
  // Metro never runs it, so it proves nothing about what ships. The app.config
  // lane it does serve is covered by the read itself.
  withProject(
    {
      "package.json": JSON.stringify({
        dependencies: { "react-native": "0.76.0" },
        devDependencies: { dotenv: "^16.4.5" },
      }),
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "iapkit-secret-key-in-env"),
      );
      assert.equal(result.errors, 0);
    },
  );
});

test("a flat ios/Info.plist is read, not merely counted as checked", () => {
  withProject(
    {
      ...EXPO,
      "ios/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).GhostSceneDelegate</string></dict></plist>",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      assert.equal(finding.file, "ios/Info.plist");
    },
  );
});

test("a dotted env name is a name, not a pattern", () => {
  withProject(
    {
      ...EXPO,
      ".env": `IAPKIT.API.KEY=${SECRET_KEY}\n`,
      "app.config.js": "export default {x: process.env.IAPKITxAPIyKEY};\n",
    },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.id, "iapkit-secret-key-in-env");
    },
  );
});

test("a bare name read in app.config resolves in Node, before the bundle", () => {
  withProject(
    {
      ...EXPO,
      ".env": "IAPKIT_PUBLISHABLE_KEY=openiap-kit_pk_1\n",
      "app.config.ts":
        "export default {extra: {key: process.env.IAPKIT_PUBLISHABLE_KEY}};\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a prefixed name elsewhere is not cover for this one", () => {
  // bare/prefixed were computed across the whole file, so renaming one
  // variable and forgetting the next silenced the check written for it.
  withProject(
    {
      ...EXPO,
      ".env":
        "EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev\nIAPKIT_API_KEY=openiap-kit_pk_1\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-env-missing-expo-prefix",
      );
      assert.equal(finding.actual, "IAPKIT_API_KEY");
    },
  );
});

test("a packaging glob is a string, not the start of a comment", () => {
  // `'META-INF/*.kotlin_module'` opened a comment that swallowed the flavor.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        "android {\n  packagingOptions { exclude 'META-INF/*.kotlin_module' }\n  missingDimensionStrategy 'platform', 'amazon'\n  packagingOptions { pickFirst 'lib/*/libc++_shared.so' }\n}\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(finding.line, 3);
    },
  );
});

test("a file that exists but cannot be read is a finding", () => {
  if (process.getuid?.() === 0) return; // root can read anything
  withProject(
    { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n` },
    (root) => {
      chmodSync(path.join(root, ".env"), 0o000);
      try {
        const result = doctor(root);
        assert.ok(
          result.findings.some((one) => one.id === "project-file-unreadable"),
        );
        assert.ok(result.errors > 0);
      } finally {
        chmodSync(path.join(root, ".env"), 0o644);
      }
    },
  );
});

test("an app.config env read remains unproven without executing configuration", () => {
  withProject(
    {
      ...EXPO,
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
      "app.config.ts":
        "export default {extra: {k: process.env.IAPKIT_API_KEY}};\n",
    },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.id, "iapkit-secret-key-in-env");
    },
  );
});

test("a dotenv transform means the bare name ships too", () => {
  withProject(
    {
      "package.json": JSON.stringify({
        dependencies: { expo: "^57.0.0", "react-native-dotenv": "^3.4.0" },
      }),
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("a commented-out class declares nothing", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      "ios/App/AppDelegate.swift": "// class SceneDelegate: UIResponder {}\n",
    },
    (root) => assert.ok(ids(root).includes("ios-scene-delegate-missing")),
  );
});

test("a class in a sibling group of the same target counts", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>SceneDelegate</string></dict></plist>",
      "ios/Shared/SceneDelegate.swift": "class SceneDelegate {}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("every scene role is read, not just the first", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict>\n<key>UISceneDelegateClassName</key><string>Good</string>\n<key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).Ghost</string>\n</dict></plist>",
      "ios/App/Good.swift": "class Good {}\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      assert.equal(finding.actual, "Ghost");
    },
  );
});

test("a key named in an app.config comment is not shipped", () => {
  withProject(
    {
      ...EXPO,
      "app.config.js": `// Never use ${SECRET_KEY} here\nexport default {};\n`,
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("env values are read the way dotenv reads them", () => {
  // `#` starts a comment, backticks quote, and `:` separates.
  withProject({ ...EXPO, ".env": `IAPKIT_API_KEY=#${SECRET_KEY}\n` }, (root) =>
    assert.ok(!ids(root).some((one) => one.startsWith("iapkit-secret-key"))),
  );
  withProject(
    {
      ...EXPO,
      ".env": "EXPO_PUBLIC_IAPKIT_BASE_URL=`https://kit.openiap.dev`\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
  withProject(
    { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_API_KEY: ${SECRET_KEY}\n` },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("gradle.properties is read the way Gradle reads it", () => {
  // A whitespace separator and a trailing backslash are both legal.
  for (const properties of [
    "horizonEnabled true\n",
    "horizonEnabled=\\\n  true\n",
  ]) {
    withProject(
      {
        ...EXPO,
        "android/gradle.properties": properties,
        "android/app/build.gradle":
          'missingDimensionStrategy "platform", "horizon"\n',
      },
      (root) => assert.deepEqual(ids(root), ["android-store-not-play"]),
    );
  }
});

test("a key in the base URL path never reaches the output", () => {
  withProject(
    {
      ...EXPO,
      ".env": `EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev/${SECRET_KEY}\n`,
    },
    (root) => assert.ok(!JSON.stringify(doctor(root)).includes(SECRET_KEY)),
  );
});

test("a flag conflict does not also report an invented mismatch", () => {
  // With both flags true the "selected" store is this tool's own tiebreak.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=true\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
    },
    (root) => {
      const found = ids(root);
      assert.ok(found.includes("android-store-flavor-conflict"));
      assert.ok(!found.includes("android-store-flavor-mismatch"));
    },
  );
});

test("the unchecked list never contradicts a finding it just made", () => {
  withProject(
    { ...RN, ".env": "EXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_pk_1\n" },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some(
          (one) => one.id === "iapkit-env-unexpected-expo-prefix",
        ),
      );
      assert.ok(
        !result.notCheckedLocally.some((one) =>
          one.startsWith("Env variable names"),
        ),
      );
    },
  );
});

test("an Expo project with no ios/ says the scene check did not run", () => {
  withProject({ ...EXPO }, (root) => {
    const result = doctor(root);
    assert.ok(
      result.notCheckedLocally.some((one) =>
        one.includes("no ios/ Info.plist was found"),
      ),
    );
  });
});

test("a value on a name the project never reads cannot break anything", () => {
  withProject(
    { ...EXPO, ".env": "IAPKIT_BASE_URL=ftp://kit.openiap.dev\n" },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "iapkit-base-url-scheme"),
      );
      assert.equal(result.errors, 0);
    },
  );
});

test("a dotted name that is not the app module comes from a framework", () => {
  // `RNScreens.SceneDelegate` lives in Pods/, which this deliberately skips,
  // so there is nothing here that could prove it missing.
  withProject(
    {
      ...EXPO,
      "ios/MyApp/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>RNScreens.SceneDelegate</string></dict></plist>",
    },
    (root) => {
      assert.deepEqual(ids(root), []);
    },
  );
});

test("a test source set does not satisfy the shipped app id", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\n",
      "android/app/src/main/AndroidManifest.xml": "<manifest/>",
      "android/app/src/androidTest/AndroidManifest.xml":
        '<manifest><meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID"/></manifest>',
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-horizon-app-id-missing",
      );
      assert.equal(finding.file, "android/app/src/main/AndroidManifest.xml");
    },
  );
});

test("an app id inside an XML comment is disabled configuration", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\n",
      "android/app/src/main/AndroidManifest.xml":
        '<manifest><!-- <meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID"/> --></manifest>',
    },
    (root) => assert.ok(ids(root).includes("android-horizon-app-id-missing")),
  );
});

test("XML comment removal cannot join a split Horizon app id", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\n",
      "android/app/src/main/AndroidManifest.xml":
        '<manifest><meta-data android:name="com.meta.horizon.platform.HORIZON_<!-- gap -->APP_ID"/></manifest>',
    },
    (root) => assert.ok(ids(root).includes("android-horizon-app-id-missing")),
  );
});

test("a value read from a project file cannot forge a row of the report", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).Scene\nDelegate  INJECTED: error  /etc/passwd</string></dict></plist>",
    },
    (root) => {
      const rendered = formatText(doctor(root));
      assert.ok(!/^INJECTED/m.test(rendered));
      assert.ok(!rendered.includes("\nDelegate"));
    },
  );
});

test("an unreadable directory is not an empty one", () => {
  if (process.getuid?.() === 0) return;
  withProject({ ...EXPO }, (root) => {
    const ios = path.join(root, "ios");
    mkdirSync(ios);
    chmodSync(ios, 0o000);
    try {
      assert.ok(ids(root).includes("project-file-unreadable"));
    } finally {
      chmodSync(ios, 0o755);
    }
  });
});

test("a dangling symlink is neither absent nor checked", () => {
  withProject({ ...EXPO }, (root) => {
    symlinkSync("/nonexistent/secrets/.env", path.join(root, ".env"));
    const result = doctor(root);
    assert.ok(
      result.findings.some((one) => one.id === "project-file-unreadable"),
    );
    assert.ok(
      !result.notCheckedLocally.some((one) =>
        one.startsWith("Keys and base URL"),
      ),
    );
  });
});

for (const file of ["package.json", "ios/Info.plist", "ios/App/Info.plist"]) {
  test(`a dangling ${file} symlink fails the configuration check`, () => {
    withProject(file === "package.json" ? {} : { ...EXPO }, (root) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      symlinkSync(path.join(root, "missing-config"), path.join(root, file));
      const result = doctor(root);
      assert.ok(result.errors > 0);
      assert.ok(
        result.findings.some(
          (one) => one.id === "project-file-unreadable" && one.file === file,
        ),
      );
      assert.ok(
        !result.notCheckedLocally.some((one) =>
          one.includes("no ios/ Info.plist was found"),
        ),
      );
    });
  });
}

for (const directory of ["ios", "android", "ios/App"]) {
  test(`a dangling ${directory}/ symlink fails the configuration check`, () => {
    withProject({ ...EXPO }, (root) => {
      mkdirSync(path.dirname(path.join(root, directory)), { recursive: true });
      symlinkSync(
        path.join(root, "missing-native"),
        path.join(root, directory),
      );
      const result = doctor(root);
      assert.ok(result.errors > 0);
      assert.ok(
        result.findings.some(
          (one) =>
            one.id === "project-file-unreadable" && one.file === directory,
        ),
      );
      assert.ok(
        !result.notCheckedLocally.some((one) =>
          one.includes(`no ${directory.split("/")[0]}/`),
        ),
      );
    });
  });
}

test("unreadable iOS sources cannot prove a scene delegate is missing", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
    },
    (root) => {
      symlinkSync(
        path.join(root, "missing-sources"),
        path.join(root, "ios/Shared"),
      );
      const result = doctor(root);
      assert.ok(result.errors > 0);
      assert.ok(
        result.findings.every((one) => one.id === "project-file-unreadable"),
      );
    },
  );
});

test("broken links in ignored generated iOS directories stay ignored", () => {
  withProject({ ...EXPO, "ios/App/Info.plist": "<plist/>" }, (root) => {
    for (const directory of [
      "Pods",
      "build",
      "DerivedData",
      "node_modules",
      "App.xcodeproj",
    ]) {
      symlinkSync(
        path.join(root, "missing-generated"),
        path.join(root, "ios", directory),
      );
    }
    assert.deepEqual(doctor(root).findings, []);
  });
});

test("a broken KMP module link is unreadable during framework detection", () => {
  withProject({}, (root) => {
    symlinkSync(
      path.join(root, "missing-module"),
      path.join(root, "composeApp"),
    );
    assert.ok(
      doctor(root).findings.some(
        (one) =>
          one.id === "project-file-unreadable" && one.file === "composeApp",
      ),
    );
  });
});

test("deep iOS sources remain searchable through directory cycles", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      [`ios/App/${"Sources/".repeat(9)}SceneDelegate.swift`]:
        "class SceneDelegate: UIResponder {}",
    },
    (root) => {
      symlinkSync(path.join(root, "ios"), path.join(root, "ios/App/Loop"));
      assert.deepEqual(doctor(root).findings, []);
    },
  );
});

test("a broken ancestor of a declared Flutter env asset is unreadable", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  assets:\n    - assets/.env\n",
    },
    (root) => {
      symlinkSync(path.join(root, "missing-assets"), path.join(root, "assets"));
      assert.ok(
        doctor(root).findings.some(
          (one) =>
            one.id === "project-file-unreadable" && one.file === "assets/.env",
        ),
      );
    },
  );
});

test("a dangling declared Flutter env asset is unreadable", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  assets:\n    - assets/.env\n",
    },
    (root) => {
      mkdirSync(path.join(root, "assets"));
      symlinkSync(
        path.join(root, "missing-env"),
        path.join(root, "assets/.env"),
      );
      const result = doctor(root);
      assert.ok(result.errors > 0);
      assert.ok(
        result.findings.some(
          (one) =>
            one.id === "project-file-unreadable" && one.file === "assets/.env",
        ),
      );
    },
  );
});

test("an unreadable android/ is not an absent one", () => {
  if (process.getuid?.() === 0) return;
  withProject({ ...EXPO }, (root) => {
    const android = path.join(root, "android");
    mkdirSync(android);
    writeFileSync(
      path.join(android, "gradle.properties"),
      "horizonEnabled=true\n",
    );
    chmodSync(android, 0o000);
    try {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "project-file-unreadable"),
      );
      assert.ok(
        !result.notCheckedLocally.some((one) =>
          one.startsWith("Android store flavor"),
        ),
      );
    } finally {
      chmodSync(android, 0o755);
    }
  });
});

test("an app.config read is matched by name, not by substring", () => {
  // Reading IAPKIT_BASE_URL_STAGING says nothing about IAPKIT_BASE_URL.
  withProject(
    {
      ...EXPO,
      "app.config.js":
        "export default {x: process.env.IAPKIT_BASE_URL_STAGING};\n",
      ".env": "IAPKIT_BASE_URL=https://kit.openiap.dev/v1\n",
    },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some(
          (one) => one.id === "iapkit-env-missing-expo-prefix",
        ),
      );
      assert.equal(result.errors, 0);
    },
  );
});

test("the other ways JS reads an env var count too", () => {
  for (const body of [
    "const { IAPKIT_BASE_URL } = process.env;\nexport default {IAPKIT_BASE_URL};\n",
    'export default {x: process.env["IAPKIT_BASE_URL"]};\n',
  ]) {
    withProject(
      {
        ...EXPO,
        "app.config.js": body,
        ".env": "IAPKIT_BASE_URL=https://kit.openiap.dev\n",
      },
      (root) =>
        assert.ok(
          !ids(root).includes("iapkit-env-missing-expo-prefix"),
          "app.config resolves the bare name in Node",
        ),
    );
  }
});

test("a name read only inside a comment is read by nothing", () => {
  withProject(
    {
      ...EXPO,
      "app.config.js":
        "// TODO: wire process.env.IAPKIT_BASE_URL through\nexport default {};\n",
      ".env": "IAPKIT_BASE_URL=https://kit.openiap.dev/v1\n",
    },
    (root) => assert.ok(ids(root).includes("iapkit-env-missing-expo-prefix")),
  );
});

test("per-build-type flavors are ordinary Gradle, not a half-finished run", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'debug {\n  missingDimensionStrategy "platform", "play"\n}\nrelease {\n  missingDimensionStrategy "platform", "horizon"\n}\n',
    },
    (root) => {
      // Play billing works from the debug flavor, so nothing here is wrong.
      assert.deepEqual(ids(root), []);
    },
  );
});

test("a declaration is found however the file around it is written", () => {
  // A scanner that guesses a string wrong blanks the rest of the file and
  // reports the declaration it erased.
  for (const source of [
    'let q = #"\\""#\nclass SceneDelegate {}\n',
    'let o = #"He said "hello"#\nclass SceneDelegate {}\n',
    "#pragma mark - Don't do this\n@interface SceneDelegate : NSObject\n@end\n",
    'let bad = "oops\nclass SceneDelegate {}\n',
    'let url = "https://x.dev"; class SceneDelegate {}\n',
    "/* a /* b */ still */\nclass SceneDelegate {}\n",
    "@implementation SceneDelegate\n@end\n",
    "static char q = '\"'; @implementation SceneDelegate @end\n",
  ]) {
    withProject(
      {
        ...EXPO,
        "ios/App/Info.plist":
          "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
        "ios/App/Source.swift": source,
      },
      (root) => assert.deepEqual(ids(root), []),
    );
  }
});

test("a long class name is matched whole, not truncated first", () => {
  const name = "Scccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist": `<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).${name}</string></dict></plist>`,
      "ios/App/Source.swift": `class ${name} {}\n`,
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a self-closing string is the empty class name", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string/></dict></plist>",
      "ios/App/Source.swift": "class AppDelegate {}\n",
    },
    (root) => assert.ok(ids(root).includes("ios-scene-delegate-missing")),
  );
});

test("control characters never reach the report", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>Scene\u001b[32m\u202eDelegate</string></dict></plist>",
    },
    (root) => {
      const rendered = formatText(doctor(root));
      assert.ok(!rendered.includes("\u001b"));
      assert.ok(!rendered.includes("\u202e"));
    },
  );
});

test("every finding carries a stable id, a file, and a fix", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=true\n",
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.ok(result.findings.length >= 2);
      for (const one of result.findings) {
        assert.match(one.id, /^[a-z0-9-]+$/);
        assert.ok(one.file.length > 0);
        assert.ok(one.fix.length > 0);
        assert.ok(one.level === "error" || one.level === "warning");
      }
    },
  );
});

test("a project with no OpenIAP library still runs the framework-free checks", () => {
  withProject({ ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n` }, (root) => {
    const result = doctor(root);
    assert.equal(result.framework, "unknown");
    // A backend repo holds this key on purpose, so nothing here proves it
    // ships: say so rather than demanding a rotation and failing the command.
    assert.ok(
      result.findings.some((one) => one.id === "iapkit-secret-key-in-env"),
    );
    assert.equal(result.errors, 0);
    // Without a framework the prefix rule has no answer, so it stays quiet.
    assert.ok(
      !result.findings.some((one) => one.id.startsWith("iapkit-env-m")),
    );
  });
});

test("the id registry, the code, and the README agree", () => {
  // Agents are told to match on `id`, so a rename is a contract change. Shape
  // alone -- which is all this used to assert -- lets one pass silently.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = ["checks.mjs", "doctor.mjs"]
    .map((one) => readFileSync(path.join(here, "..", "src", one), "utf8"))
    .join("\n");
  const emitted = new Set([
    ...[...source.matchAll(/finding\(\s*["']([a-z0-9-]+)["']/g)].map(
      (one) => one[1],
    ),
    ...[...source.matchAll(/^\s+id: ["']([a-z0-9-]+)["']/gm)].map(
      (one) => one[1],
    ),
  ]);
  assert.deepEqual([...emitted].sort(), [...FINDING_IDS].sort());

  // The README's Level column is a published contract now, so pin it too and
  // reject an id the README documents that the code no longer emits.
  const readme = readFileSync(path.join(here, "..", "README.md"), "utf8");
  const rows = new Map(
    [
      ...readme.matchAll(/^\| `([a-z0-9-]+)` *\| *(error|warning|both) *\|/gm),
    ].map((one) => [one[1], one[2]]),
  );
  assert.deepEqual([...rows.keys()].sort(), [...FINDING_IDS].sort());

  const emittedLevels = new Map();
  for (const one of source.matchAll(
    /finding\(\s*["']([a-z0-9-]+)["'],\s*(?:["'](error|warning)["']|[^,]+)/g,
  )) {
    // Anything but a literal is decided at run time, and two literals that
    // disagree are the same thing, so the README must say `both` either way.
    const level = one[2] ?? "both";
    const seen = emittedLevels.get(one[1]);
    emittedLevels.set(one[1], seen && seen !== level ? "both" : level);
  }
  for (const one of source.matchAll(
    /^\s+id: ["']([a-z0-9-]+)["'],\n\s+level: ["'](error|warning)["']/gm,
  )) {
    emittedLevels.set(one[1], one[2]);
  }
  for (const [id, level] of emittedLevels) {
    assert.equal(
      rows.get(id),
      level,
      `README documents ${id} as ${rows.get(id)}`,
    );
  }
});

test("an unregistered finding id cannot be built at all", () => {
  // The source scan below sees one literal shape, so the contract is enforced
  // where every finding is constructed instead.
  for (const id of [
    "ios-bundle-id-mismatch",
    `ios-${"entitlements"}-missing`,
  ]) {
    assert.throws(
      () => finding(id, "error", "f", "m", "x"),
      /Unregistered finding id/,
    );
  }
  assert.equal(
    finding("android-store-not-play", "warning", "f", "m", "x").id,
    "android-store-not-play",
  );
});

test("a Flutter app that ships .env as an asset ships what is in it", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter_inapp_purchase: ^7.0.0\nflutter:\n  assets:\n    - .env\n",
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.equal(result.framework, "flutter");
      assert.ok(
        result.findings.some((one) => one.id === "iapkit-secret-key-in-client"),
      );
    },
  );
});

test("a Flutter app that does not ship .env has not been proven to", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter_inapp_purchase: ^7.0.0\n",
      ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "iapkit-secret-key-in-env"),
      );
      assert.equal(result.errors, 0);
    },
  );
});

test("a Flutter project says which checks did not run", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter:\n    sdk: flutter\n",
    },
    (root) => {
      const { notCheckedLocally } = doctor(root);
      assert.ok(
        notCheckedLocally.some((one) => one.includes("flutter projects")),
      );
    },
  );
});

test("a source this run could not open cannot be said to lack the class", () => {
  if (process.getuid?.() === 0) return;
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      "ios/App/Source.swift": "class SceneDelegate {}\n",
    },
    (root) => {
      chmodSync(path.join(root, "ios/App/Source.swift"), 0o000);
      try {
        const found = ids(root);
        assert.ok(!found.includes("ios-scene-delegate-missing"));
        assert.ok(found.includes("project-file-unreadable"));
      } finally {
        chmodSync(path.join(root, "ios/App/Source.swift"), 0o644);
      }
    },
  );
});

test("a template literal is a string, not the start of a comment", () => {
  // `[`assets/*`]` opened a comment that ran to the end of the file, so every
  // check below it was silently disabled.
  withProject(
    {
      ...EXPO,
      "app.config.js": `const patterns = [\`assets/*\`, \`fonts/*\`];\nexport default {k: '${SECRET_KEY}'};\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("an apostrophe inside a template literal opens no string", () => {
  withProject(
    {
      ...EXPO,
      "app.config.js": `const name = \`Hyo's Store\`;\n// Never use ${SECRET_KEY} here\nexport default {};\n`,
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a Swift multi-line string is a string, not a comment", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      "ios/App/SceneDelegate.swift":
        'let paths = """\n  Assets/*\n  """\nclass SceneDelegate: UIResponder {}\n',
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a regex literal does not hide what follows it", () => {
  // `/^https?:\\/\\//` and `/[^/*]+/g` are the two shapes that broke a lexer;
  // reading one line at a time cannot be desynced by either.
  for (const body of [
    `const ok = /^https?:\\/\\//.test(x);\nexport default {k: '${SECRET_KEY}'};\n`,
    `const safe = /[^/*]+/g;\nexport default {k: '${SECRET_KEY}'};\n`,
  ]) {
    withProject({ ...EXPO, "app.config.js": body }, (root) =>
      assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
    );
  }
});

test("a name mentioned in a string is not a read", () => {
  withProject(
    {
      ...EXPO,
      "app.config.js":
        "export default {hint: 'copy process.env.IAPKIT_BASE_URL from 1Password'};\n",
      ".env": "IAPKIT_BASE_URL=https://kit.openiap.dev/v1\n",
    },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some(
          (one) => one.id === "iapkit-env-missing-expo-prefix",
        ),
      );
      assert.equal(result.errors, 0);
    },
  );
});

test("optional chaining and the bracket form are both reads", () => {
  for (const body of [
    "export default {x: process.env?.IAPKIT_BASE_URL};\n",
    'export default {x: process.env["IAPKIT_BASE_URL"]};\n',
  ]) {
    withProject(
      {
        ...EXPO,
        "app.config.js": body,
        ".env": "IAPKIT_BASE_URL=https://kit.openiap.dev\n",
      },
      (root) =>
        assert.ok(!ids(root).includes("iapkit-env-missing-expo-prefix")),
    );
  }
});

test("a half-regenerated project is caught however many stores it names", () => {
  // The flags select horizon and nothing declared links it.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'defaultConfig {\n  missingDimensionStrategy "platform", "play"\n}\namazonFlavor {\n  missingDimensionStrategy "platform", "amazon"\n}\n',
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-flavor-mismatch",
      );
      assert.equal(finding.expected, "horizon");
      assert.equal(finding.actual, "play,amazon");
    },
  );
});

test("a merge leftover is not an Android build file", () => {
  withProject(
    {
      ...EXPO,
      "android/app/build.gradle.orig":
        'missingDimensionStrategy "platform", "horizon"\n',
    },
    (root) => {
      const { notCheckedLocally } = doctor(root);
      assert.ok(
        notCheckedLocally.some((one) => one.startsWith("Android store flavor")),
      );
    },
  );
});

test("a base URL carrying a query is not an origin either", () => {
  withProject(
    {
      ...EXPO,
      ".env":
        "EXPO_PUBLIC_IAPKIT_BASE_URL=https://kit.openiap.dev?tenant=acme\n",
    },
    (root) => assert.ok(ids(root).includes("iapkit-base-url-has-path")),
  );
});

test("IAPKit accepts a bare origin and nothing else", () => {
  // Every verification lane throws a developer error otherwise: a path, a
  // userinfo pair, a query and a fragment are all rejected before the join.
  for (const value of [
    "https://api.example.com/iapkit",
    "https://kit.openiap.dev/v1/purchase/verify",
    "https://user:secret@kit.openiap.dev",
    "https://kit.openiap.dev?tenant=acme",
    // Quoted: dotenv would read a bare `#` as the start of a comment.
    '"https://kit.openiap.dev#x"',
  ]) {
    withProject(
      { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_BASE_URL=${value}\n` },
      (root) =>
        assert.ok(
          ids(root).includes("iapkit-base-url-has-path"),
          `${value} is not an origin`,
        ),
    );
  }
  // A trailing slash is trimmed before the SDK checks it.
  for (const value of ["https://kit.openiap.dev", "https://kit.openiap.dev/"]) {
    withProject(
      { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_BASE_URL=${value}\n` },
      (root) => assert.deepEqual(ids(root), []),
    );
  }
});

test("a quote with no partner on its line is not a string", () => {
  // A JS regex literal, a Groovy slashy string and an apostrophe all carry a
  // lone quote; treating it as a string desynced everything after it.
  withProject(
    {
      ...EXPO,
      "app.config.js": `const re = /"/;\nexport default {k: '${SECRET_KEY}'};\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'def p = /a"b/\nmissingDimensionStrategy "platform", "amazon"\n',
    },
    (root) => assert.ok(ids(root).includes("android-store-flavor-mismatch")),
  );
});

test("a Swift raw string may carry any number of hashes", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
      "ios/App/SceneDelegate.swift":
        'let s = ##"he said "#"##\nclass SceneDelegate: UIResponder {}\n',
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("a base URL with no scheme is not a URL", () => {
  // The most common shape of this mistake, and the only id with no case.
  withProject(
    { ...EXPO, ".env": "EXPO_PUBLIC_IAPKIT_BASE_URL=kit.openiap.dev\n" },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-base-url-invalid",
      );
      assert.equal(finding.level, "error");
      assert.equal(finding.line, 1);
      assert.equal(finding.actual, undefined);
    },
  );
});

test("every placeholder form a build fills in later is skipped", () => {
  for (const value of ["", "${IAPKIT_HOST}", "$(host)", "$KIT_HOST"]) {
    withProject(
      { ...EXPO, ".env": `EXPO_PUBLIC_IAPKIT_BASE_URL=${value}\n` },
      (root) =>
        assert.ok(!ids(root).some((one) => one.startsWith("iapkit-base-url"))),
    );
  }
});

test("the same fixtures report the class missing when it is absent", () => {
  // Without this pair, "no findings" is what both a correct read and a total
  // failure to read produce, so the tests above could not tell them apart.
  for (const source of [
    'let paths = """\n  Assets/*\n  """\n',
    'let s = ##"he said "#"##\n',
    "// class SceneDelegate {}\n",
  ]) {
    withProject(
      {
        ...EXPO,
        "ios/App/Info.plist":
          "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string></dict></plist>",
        "ios/App/Source.swift": source,
      },
      (root) => assert.ok(ids(root).includes("ios-scene-delegate-missing")),
    );
  }
});

test("dynamic config reads do not prove a secret reaches the public manifest", () => {
  for (const body of [
    "if (!process.env.IAPKIT_API_KEY) throw new Error('set it'); module.exports = {name:'a',slug:'a'};",
    "const { IAPKIT_API_KEY } = process.env; if (!IAPKIT_API_KEY) throw new Error('set it'); module.exports = {name:'a',slug:'a'};",
    "const {\n IAPKIT_API_KEY,\n} = process.env; module.exports = {extra:{IAPKIT_API_KEY}};",
    "const buildEnv = {...process.env}; module.exports = {name:'a',slug:'a'};",
    "module.exports = {extra:{...process.env}};",
    "useAtBuildTime(process.env.IAPKIT_API_KEY); module.exports = {name:'a',slug:'a'};",
    "module.exports = {extra:{key: process.env.IAPKIT_API_KEY}};",
    "module.exports = {extra:{key: `${process.env.IAPKIT_API_KEY}`}};",
  ]) {
    withProject(
      {
        ...EXPO,
        ".env": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
        "app.config.js": body,
      },
      (root) => {
        const result = doctor(root);
        assert.equal(result.errors, 0, body);
        assert.ok(
          result.findings.some(
            (one) =>
              one.id === "iapkit-secret-key-in-env" && one.level === "warning",
          ),
          body,
        );
        assert.ok(!result.findings.some((one) => /Rotate/.test(one.fix)), body);
      },
    );
  }
});

test("Expo resolves app.config.json before app.json", () => {
  for (const file of ["app.config.json", "app.config.mts", "app.json"]) {
    withProject(
      { ...EXPO, [file]: `{"expo":{"extra":{"k":"${SECRET_KEY}"}}}` },
      (root) =>
        assert.ok(ids(root).includes("iapkit-secret-key-in-client"), file),
    );
  }
});

test("a Flutter asset entry decides which env file ships", () => {
  const pubspec = (asset) =>
    `name: a\ndependencies:\n  flutter_inapp_purchase: ^7.0.0\nflutter:\n  assets:\n    - ${asset}\n`;
  // Declared: it ships verbatim.
  withProject(
    {
      "pubspec.yaml": pubspec(".env.prod"),
      ".env.prod": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
  // A sibling that is not declared does not.
  withProject(
    {
      "pubspec.yaml": pubspec(".env"),
      ".env.ci": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.ok(
        result.findings.some((one) => one.id === "iapkit-secret-key-in-env"),
      );
      assert.equal(result.errors, 0);
    },
  );
  // This repository's own Flutter example names its env file `env.example`.
  withProject(
    {
      "pubspec.yaml": pubspec("env.example"),
      "env.example": `IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("the scene delegate value may be padded or brace-wrapped", () => {
  for (const value of [
    "$(PRODUCT_MODULE_NAME).SceneDelegate",
    "${PRODUCT_MODULE_NAME}.SceneDelegate",
    "\n  $(PRODUCT_MODULE_NAME).SceneDelegate\n",
  ]) {
    withProject(
      {
        ...EXPO,
        "ios/App/Info.plist": `<plist><dict><key>UISceneDelegateClassName</key><string>${value}</string></dict></plist>`,
      },
      (root) => {
        const finding = doctor(root).findings.find(
          (one) => one.id === "ios-scene-delegate-missing",
        );
        assert.equal(finding.level, "error", JSON.stringify(value));
      },
    );
  }
});

test("a block comment that opens its line is disabled configuration", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "horizonEnabled=false\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        "defaultConfig {\n  /*\n  To ship to Amazon:\n  missingDimensionStrategy 'platform', 'amazon'\n  */\n}\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("an even trailing backslash run does not continue the value", () => {
  // java.util.Properties reads `sdkDir=C:\\Android\\sdk\\\\` as one entry.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "sdkDir=C:\\\\Android\\\\sdk\\\\\\\\\nhorizonEnabled=true\n",
      "android/app/build.gradle":
        'missingDimensionStrategy "platform", "horizon"\n',
    },
    (root) => assert.deepEqual(ids(root), ["android-store-not-play"]),
  );
});

test("a properties finding points at the assignment, not a comment", () => {
  withProject(
    {
      ...EXPO,
      "android/gradle.properties":
        "# horizonEnabled documents the Horizon build\n# fireOsEnabled documents the Amazon build\n\nhorizonEnabled=true\nfireOsEnabled=true\n",
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "android-store-flavor-conflict",
      );
      assert.equal(finding.line, 4);
    },
  );
});

test("an env finding points at the assignment, not the blank line above it", () => {
  withProject(
    { ...EXPO, ".env": `\n\nEXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n` },
    (root) => {
      const finding = doctor(root).findings.find((one) =>
        one.id.startsWith("iapkit-secret-key"),
      );
      assert.equal(finding.line, 3);
    },
  );
});

test("every generated iOS directory is skipped by both halves", () => {
  // The plist loop and the source walker must agree, or a plist is read whose
  // sources were never searched.
  for (const dir of [
    "Pods",
    "build",
    "DerivedData",
    "node_modules",
    "App.xcodeproj",
  ]) {
    withProject(
      {
        ...EXPO,
        [`ios/${dir}/Info.plist`]:
          "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).Ghost</string></dict></plist>",
      },
      (root) => assert.deepEqual(ids(root), [], dir),
    );
  }
});

test("a computed flavor is not proof of a mismatch", () => {
  // `computed` was never consulted by any fixture: every one set both flags
  // false, so the branch that suppresses the claim was unpinned.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'def flavor = horizonEnabled ? "horizon" : "play"\nmissingDimensionStrategy "platform", flavor\n',
    },
    (root) => {
      const found = ids(root);
      assert.ok(!found.includes("android-store-flavor-mismatch"));
      assert.deepEqual(found, ["android-store-not-play"]);
      assert.match(
        doctor(root).findings[0].message,
        /computes its flavor from it/,
      );
    },
  );
  // A literal beside a computed one still cannot settle the question.
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=true\nfireOsEnabled=false\n",
      "android/app/build.gradle":
        'debug {\n  missingDimensionStrategy "platform", "play"\n}\nrelease {\n  missingDimensionStrategy "platform", flavor\n}\n',
    },
    (root) => assert.ok(!ids(root).includes("android-store-flavor-mismatch")),
  );
});

test("a short placeholder is not a key", () => {
  // `{16,}` is what separates a real key from a template value.
  withProject(
    { ...EXPO, ".env": "EXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_sk_TODO\n" },
    (root) =>
      assert.ok(!ids(root).some((one) => one.startsWith("iapkit-secret-key"))),
  );
});

test("an env file other than .env is read", () => {
  withProject(
    {
      ...EXPO,
      ".env.production": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\n`,
    },
    (root) => assert.ok(ids(root).includes("iapkit-secret-key-in-client")),
  );
});

test("the unchecked list is part of the report, not decoration", () => {
  withProject({ ...EXPO }, (root) => {
    const result = doctor(root);
    // The three environment facts no checkout can answer, plus what was skipped.
    assert.ok(result.notCheckedLocally.length >= 4);
    assert.ok(
      result.notCheckedLocally.some((one) =>
        one.startsWith("Store account state"),
      ),
    );
    assert.ok(
      result.notCheckedLocally.some((one) => one.startsWith("Device state")),
    );
    assert.ok(
      result.notCheckedLocally.some((one) => one.startsWith("Play billing")),
    );
    assert.ok(
      result.notCheckedLocally.some((one) =>
        one.startsWith("Application source"),
      ),
    );
    const rendered = formatText(result);
    for (const item of result.notCheckedLocally)
      assert.ok(rendered.includes(item));
  });
});

test("the counts and the rendered totals agree with the findings", () => {
  withProject(
    {
      ...EXPO,
      ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\nIAPKIT_PUBLISHABLE_KEY=openiap-kit_pk_1\n`,
    },
    (root) => {
      const result = doctor(root);
      assert.equal(result.errors, 1);
      assert.equal(result.warnings, 1);
      const rendered = formatText(result);
      assert.match(rendered, /1 error\(s\), 1 warning\(s\)\./);
      assert.match(rendered, /^error {2}\.env:1$/m);
    },
  );
});

test("the iOS check runs for React Native and not for the rest", () => {
  const plist =
    "<plist><dict><key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).Ghost</string></dict></plist>";
  withProject({ ...RN, "ios/App/Info.plist": plist }, (root) =>
    assert.ok(ids(root).includes("ios-scene-delegate-missing")),
  );
  withProject(
    {
      "pubspec.yaml": "name: a\ndependencies:\n  flutter:\n    sdk: flutter\n",
      "ios/App/Info.plist": plist,
    },
    (root) => assert.ok(!ids(root).includes("ios-scene-delegate-missing")),
  );
});

test("a committed template is documentation, not configuration", () => {
  // `.env.example` shows the names a developer must set; telling them to
  // rename the documentation is wrong advice.
  withProject(
    {
      ...EXPO,
      ".env.example":
        "IAPKIT_API_KEY=your-key-here\nIAPKIT_BASE_URL=https://kit.openiap.dev\n",
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("commented scene declarations are ignored without moving active lines", () => {
  withProject(
    {
      ...EXPO,
      "ios/App/Info.plist":
        "<plist>\n<!--\n<key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).OldDelegate</string>\n-->\n<key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).NewDelegate</string>\n</plist>",
    },
    (root) => {
      const findings = doctor(root).findings.filter(
        (one) => one.id === "ios-scene-delegate-missing",
      );
      assert.equal(findings.length, 1);
      assert.equal(findings[0].actual, "NewDelegate");
      assert.equal(findings[0].line, 5);
    },
  );
});

test("nested Flutter env assets expose every assigned secret", () => {
  withProject(
    {
      "pubspec.yaml":
        "name: app\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  assets:\n    - assets/.env\n",
      "assets/.env": `IAPKIT_API_KEY=${SECRET_KEY}\nIAPKIT_API_KEY=openiap-kit_pk_example\n`,
    },
    (root) => {
      const finding = doctor(root).findings.find(
        (one) => one.id === "iapkit-secret-key-in-client",
      );
      assert.equal(finding.file, "assets/.env");
      assert.equal(finding.level, "error");
    },
  );
});

test("EAS build-only keys remain warnings with dynamic app configuration", () => {
  for (const exported of [false, true]) {
    withProject(
      {
        ...EXPO,
        "eas.json": JSON.stringify({
          build: { production: { env: { IAPKIT_API_KEY: SECRET_KEY } } },
        }),
        ...(exported
          ? {
              "app.config.js":
                "export default { extra: { key: process.env.IAPKIT_API_KEY } };",
            }
          : {}),
      },
      (root) => {
        const finding = doctor(root).findings.find(
          (one) => one.file === "eas.json",
        );
        assert.equal(finding.level, "warning");
      },
    );
  }
});

test("dotenv evaluates the final assignment before reporting a secret leak", () => {
  withProject(
    {
      ...EXPO,
      ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET_KEY}\nEXPO_PUBLIC_IAPKIT_API_KEY=openiap-kit_pk_example\n`,
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("EAS platform environments override shared values and retain exposed secrets", () => {
  for (const platform of ["ios", "android"]) {
    withProject(
      {
        ...EXPO,
        "eas.json": JSON.stringify({
          build: {
            production: {
              env: { EXPO_PUBLIC_IAPKIT_API_KEY: "openiap-kit_pk_example" },
              [platform]: { env: { EXPO_PUBLIC_IAPKIT_API_KEY: SECRET_KEY } },
            },
          },
        }),
      },
      (root) => assert.equal(doctor(root).errors, 1),
    );
  }
  withProject(
    {
      ...EXPO,
      "eas.json": JSON.stringify({
        build: {
          production: {
            env: { EXPO_PUBLIC_IAPKIT_API_KEY: SECRET_KEY },
            ios: {
              env: { EXPO_PUBLIC_IAPKIT_API_KEY: "openiap-kit_pk_example" },
            },
            android: {
              env: { EXPO_PUBLIC_IAPKIT_API_KEY: "openiap-kit_pk_example" },
            },
          },
        },
      }),
    },
    (root) => assert.deepEqual(ids(root), []),
  );
});

test("store flags use Groovy boolean values for both Android stores", () => {
  for (const [flag, store] of [
    ["horizonEnabled", "horizon"],
    ["fireOsEnabled", "amazon"],
  ]) {
    for (const value of ["true", "TRUE", "1", "y", "Y"]) {
      withProject(
        {
          ...EXPO,
          "android/gradle.properties": `${flag}=${value}\n`,
          "android/app/build.gradle": `missingDimensionStrategy "platform", "${store}"\n`,
        },
        (root) => {
          assert.ok(
            !ids(root).includes("android-store-flavor-mismatch"),
            `${flag}=${value}`,
          );
          assert.ok(
            ids(root).includes("android-store-not-play"),
            `${flag}=${value}`,
          );
        },
      );
    }
  }
  withProject(
    {
      ...EXPO,
      "android/gradle.properties": "horizonEnabled=1\nfireOsEnabled=y\n",
    },
    (root) => assert.ok(ids(root).includes("android-store-flavor-conflict")),
  );
});
