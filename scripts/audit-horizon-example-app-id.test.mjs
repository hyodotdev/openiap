import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  HORIZON_APP_ID_SOURCES,
  collectHorizonExampleAppIdFailures,
  inspectHorizonAppIdSource,
} from "./audit-horizon-example-app-id.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const manifest = (body) =>
  `<manifest><application>${body}</application></manifest>`;
const HORIZON_META = (value) => `
  <meta-data
      android:name="com.meta.horizon.platform.HORIZON_APP_ID"
      android:value="${value}" />`;

test("every Horizon example in this repository declares an app id", () => {
  assert.deepEqual(collectHorizonExampleAppIdFailures(repoRoot), []);
});

test("the audit covers every target that builds the Horizon flavor", () => {
  assert.deepEqual(
    HORIZON_APP_ID_SOURCES.map((source) => source.library).sort(),
    [
      "expo-iap",
      "flutter_inapp_purchase",
      "kmp-iap",
      "maui-iap",
      "packages/google",
      "react-native-iap",
    ],
  );
});

test("every source declares a kind the audit knows how to inspect", () => {
  for (const source of HORIZON_APP_ID_SOURCES) {
    assert.equal(
      /unknown source kind/.test(
        String(inspectHorizonAppIdSource("", source.kind)),
      ),
      false,
      `${source.library} declares an uninspectable kind: ${source.kind}`,
    );
  }
});

test("a manifest that binds the id to the Horizon meta-data passes", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      manifest(HORIZON_META("31705015229097839")),
      "android-manifest",
    ),
    null,
  );
});

test("a manifest with no Horizon meta-data is rejected", () => {
  assert.equal(
    inspectHorizonAppIdSource(manifest("<activity/>"), "android-manifest"),
    "declares no Horizon app id meta-data",
  );
});

test("a numeric literal unbound from the declaration does not satisfy the audit", () => {
  const contents = manifest(`
    <meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" />
    <!-- app id is 31705015229097839 -->`);
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("an id bound to some other meta-data does not satisfy the audit", () => {
  const contents = manifest(`
    <meta-data android:name="com.example.OTHER_ID" android:value="31705015229097839" />
    <meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" android:value="" />`);
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a commented-out declaration does not satisfy the audit", () => {
  const contents = manifest(`<!-- ${HORIZON_META("31705015229097839")} -->`);
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares no Horizon app id meta-data",
  );
});

test("a spliced comment opener is rejected, not read as a declaration", () => {
  // `<!-` is not a legal declaration opener. A regex reader that stripped
  // comments in one pass spliced `<!-` and `-` into a new `<!--` and hid the
  // declaration; a parser rejects the document instead of guessing.
  const contents = manifest(
    `<!-<!-- -->- ${HORIZON_META("31705015229097839")} -->`,
  );
  assert.match(
    String(inspectHorizonAppIdSource(contents, "android-manifest")),
    /is not well-formed XML/u,
  );
});

test("meta-data nested inside an activity does not satisfy the audit", () => {
  const contents = manifest(
    `<activity android:name=".MainActivity">${HORIZON_META("31705015229097839")}</activity>`,
  );
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares the Horizon meta-data outside <application>",
  );
});

test("meta-data inside an activity-alias does not satisfy the audit", () => {
  const contents = manifest(
    `<activity-alias android:name=".Alias" android:targetActivity=".Main">${HORIZON_META("31705015229097839")}</activity-alias>`,
  );
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares the Horizon meta-data outside <application>",
  );
});

test("a short number is not accepted as a Horizon app id", () => {
  // Without this the digit-count constraint is unpinned and could be weakened
  // to \\d+ with every other test still green.
  assert.equal(
    inspectHorizonAppIdSource(manifest(HORIZON_META("0")), "android-manifest"),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a single-quoted manifest value is still recognised", () => {
  const contents = manifest(
    "<meta-data android:name=\"com.meta.horizon.platform.HORIZON_APP_ID\" android:value='31705015229097839' />",
  );
  assert.equal(inspectHorizonAppIdSource(contents, "android-manifest"), null);
});

test("a Gradle placeholder is accepted only where the build resolves it", () => {
  const templated = manifest(HORIZON_META("${HORIZON_APP_ID}"));
  // A templated manifest declares the slot; verify-horizon-merged-manifest.mjs
  // checks what the merger puts in it.
  assert.equal(
    inspectHorizonAppIdSource(templated, "templated-manifest"),
    null,
  );
  // An example that ships its id directly must not leave an unresolved slot.
  assert.equal(
    inspectHorizonAppIdSource(templated, "android-manifest"),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a templated manifest still needs the declaration itself", () => {
  assert.equal(
    inspectHorizonAppIdSource(manifest("<activity/>"), "templated-manifest"),
    "declares no Horizon app id meta-data",
  );
  assert.equal(
    inspectHorizonAppIdSource(manifest(HORIZON_META("")), "templated-manifest"),
    "declares the Horizon meta-data without a literal app id or a placeholder",
  );
});

test("the Expo plugin config must bind the id to horizon.appId", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "android: { horizon: { appId: '31705015229097839' } }",
      "expo-plugin-config",
    ),
    null,
  );
  assert.equal(
    inspectHorizonAppIdSource(
      "android: { horizon: { appId: process.env.HORIZON } }",
      "expo-plugin-config",
    ),
    "declares android.horizon without a literal appId",
  );
});

test("a commented-out Expo appId does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "android: { horizon: { // appId: '31705015229097839'\n } }",
      "expo-plugin-config",
    ),
    "declares android.horizon without a literal appId",
  );
  assert.equal(
    inspectHorizonAppIdSource(
      "android: { /* horizon: { appId: '31705015229097839' } */ }",
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );
});

test("Expo braces inside strings are not syntax", () => {
  // Both cases came from a Grok review of a revision that counted every brace.
  const braceInString = [
    "android: {",
    "  horizon: {",
    '    note: "needs a } here",',
    "    appId: '31705015229097839',",
    "  },",
    "}",
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(braceInString, "expo-plugin-config"),
    null,
  );

  const stretchedIntoDecoy = [
    "android: {",
    "  horizon: {",
    '    note: "{ {",',
    "    appId: process.env.HORIZON,",
    "  },",
    "  later: { appId: '31705015229097839' },",
    "}",
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(stretchedIntoDecoy, "expo-plugin-config"),
    "declares android.horizon without a literal appId",
  );
});

test("a meta-data name is compared exactly, not as a substring", () => {
  // com.example.<the Horizon name> contains the Horizon key but merges under a
  // key the platform never reads, so a substring test accepted a manifest that
  // supplies no app id.
  assert.match(
    String(
      inspectHorizonAppIdSource(
        manifest(
          '<meta-data android:name="com.example.com.meta.horizon.platform.HORIZON_APP_ID" android:value="31705015229097839" />',
        ),
        "android-manifest",
      ),
    ),
    /declares no Horizon app id meta-data/u,
  );
});

test("an Expo horizon block outside android supplies nothing", () => {
  // Expo reads android.horizon. A horizon block elsewhere in the module — a
  // local constant, an unrelated export — never reaches the build.
  assert.equal(
    inspectHorizonAppIdSource(
      "const decoy = {horizon: {appId: '31705015229097839'}};\nexport default {android: {}};",
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );
});

test("a self-closing application child does not swallow the declaration", () => {
  const manifest = [
    "<manifest><application>",
    '  <provider android:name="androidx.startup.InitializationProvider" android:exported="false" />',
    '  <meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID"',
    '      android:value="31705015229097839" />',
    '  <provider android:name=".FileProvider">',
    '    <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/paths" />',
    "  </provider>",
    "</application></manifest>",
  ].join("\n");
  assert.equal(inspectHorizonAppIdSource(manifest, "android-manifest"), null);
});

test("a missing source file is reported instead of silently passing", () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "horizon-audit-"));
  try {
    const failures = collectHorizonExampleAppIdFailures(emptyRoot);
    assert.equal(failures.length, HORIZON_APP_ID_SOURCES.length);
    for (const failure of failures) {
      assert.match(failure, /is missing$/);
    }
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});
