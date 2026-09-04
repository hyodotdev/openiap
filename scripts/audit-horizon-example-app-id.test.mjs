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
      "const o = {android: {horizon: {appId: '31705015229097839'}}};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    null,
  );
  assert.equal(
    inspectHorizonAppIdSource(
      "const o = {android: {horizon: {appId: process.env.HORIZON}}};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    "declares android.horizon without a literal appId",
  );
});

test("a commented-out Expo appId does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "const o = {android: {horizon: { // appId: '31705015229097839'\n }}};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    "declares android.horizon without a literal appId",
  );
  assert.equal(
    inspectHorizonAppIdSource(
      "const o = {android: { /* horizon: { appId: '31705015229097839' } */ }};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );
});

test("Expo braces inside strings are not syntax", () => {
  // Both cases came from a Grok review of a revision that counted every brace.
  const braceInString = [
    "const o = {",
    "  android: {",
    "    horizon: {",
    '      note: "needs a } here",',
    "      appId: '31705015229097839',",
    "    },",
    "  },",
    "};",
    "export default {plugins: [['../app.plugin.js', o]]};",
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(braceInString, "expo-plugin-config"),
    null,
  );

  const stretchedIntoDecoy = [
    "const o = {",
    "  android: {",
    "    horizon: {",
    '      note: "{ {",',
    "      appId: process.env.HORIZON,",
    "    },",
    "    later: { appId: '31705015229097839' },",
    "  },",
    "};",
    "export default {plugins: [['../app.plugin.js', o]]};",
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
      [
        "const decoy = {android: {horizon: {appId: '31705015229097839'}}};",
        "const options = {android: {}};",
        "export default {plugins: [['../app.plugin.js', options]]};",
      ].join("\n"),
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

test("only the object the plugin receives counts", () => {
  // A complete android.horizon block in a constant the plugin never receives
  // supplies nothing to the build — a stale object left by a refactor looks
  // exactly like this.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "const stale = {android: {horizon: {appId: '31705015229097839'}}};",
        "const options = {android: {}};",
        "export default {plugins: [['../app.plugin.js', options]]};",
      ].join("\n"),
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );

  // An inline options object is read the same way.
  assert.equal(
    inspectHorizonAppIdSource(
      "export default {plugins: [['../app.plugin.js', {android: {horizon: {appId: '31705015229097839'}}}]]};",
      "expo-plugin-config",
    ),
    null,
  );

  // A config that never passes options is reported, not silently accepted.
  assert.equal(
    inspectHorizonAppIdSource(
      "const options = {android: {horizon: {appId: '31705015229097839'}}};\nexport default {};",
      "expo-plugin-config",
    ),
    "passes no options object to the OpenIAP config plugin",
  );
});

test("only a direct android.horizon.appId counts", () => {
  // The plugin reads the direct path. A nested `decoy` in between supplies
  // nothing, and a regex that only anchors on a property position cannot tell
  // the two apart.
  assert.equal(
    inspectHorizonAppIdSource(
      "const o = {android: {decoy: {horizon: {appId: '31705015229097839'}}}};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );
  assert.equal(
    inspectHorizonAppIdSource(
      "const o = {android: {horizon: {nested: {appId: '31705015229097839'}}}};\nexport default {plugins: [['../app.plugin.js', o]]};",
      "expo-plugin-config",
    ),
    "declares android.horizon without a literal appId",
  );
});

test("the tools namespace is recognised under any prefix", () => {
  // The merger honours tools:node="remove" whatever prefix the document binds
  // to that namespace, so searching for the literal spelling misses it.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
        '  xmlns:t="http://schemas.android.com/tools">',
        "  <application>",
        '    <meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID"',
        '        android:value="31705015229097839" t:node="remove"/>',
        "  </application>",
        "</manifest>",
      ].join("\n"),
      "android-manifest",
    ),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a commented-out plugin entry supplies no options", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      [
        'const retired = {android:{horizon:{appId:"31705015229097839"}}};',
        '// ["../app.plugin.js", retired]',
        "export default {plugins:[]};",
      ].join("\n"),
      "expo-plugin-config",
    ),
    "passes no options object to the OpenIAP config plugin",
  );
});

test("shorthand android.horizon resolves its binding", () => {
  // `{android: {horizon}}` is a legitimate config the plugin reads correctly;
  // requiring a nested literal reported it as missing the id.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        'const horizon = {appId: "31705015229097839"};',
        "const options = {android: {horizon}};",
        'export default {plugins: [["../app.plugin.js", options]]};',
      ].join("\n"),
      "expo-plugin-config",
    ),
    null,
  );
});

test("tools:node=removeAll deletes the declaration too", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      [
        '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
        '  xmlns:t="http://schemas.android.com/tools">',
        '  <application><meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID"',
        '      android:value="31705015229097839" t:node="removeAll"/></application>',
        "</manifest>",
      ].join("\n"),
      "android-manifest",
    ),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a shorthand binding must be direct and in scope", () => {
  // `{android: {experimental: {horizon}}}` is not the path the plugin reads.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        'const horizon = {appId: "31705015229097839"};',
        "const options = {android: {experimental: {horizon}}};",
        'export default {plugins: [["../app.plugin.js", options]]};',
      ].join("\n"),
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );

  // A same-named binding inside an unrelated function is a different variable.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "function fixture() {",
        '  const options = {android: {horizon: {appId: "31705015229097839"}}};',
        "  return options;",
        "}",
        "const options = {android: {}};",
        'export default {plugins: [["../app.plugin.js", options]]};',
      ].join("\n"),
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );

  // A binding declared later, in an unrelated block, is not what the plugin
  // receives — checking only the scope's end let it shadow the real one.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "const options = {android: {}};",
        'export default {plugins: [["../app.plugin.js", options]]};',
        "function later() {",
        '  const options = {android: {horizon: {appId: "31705015229097839"}}};',
        "  return options;",
        "}",
      ].join("\n"),
      "expo-plugin-config",
    ),
    "does not set a literal android.horizon.appId",
  );

  // A binding in a block that encloses the reference is visible, which is how
  // the real config declares its options inside the exported function.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "export default () => {",
        '  const options = {android: {horizon: {appId: "31705015229097839"}}};',
        '  return {plugins: [["../app.plugin.js", options]]};',
        "};",
      ].join("\n"),
      "expo-plugin-config",
    ),
    null,
  );
});

test("a spread before the key is not a problem", () => {
  // JavaScript guarantees the later explicit property wins, and that ordering
  // is decidable without evaluating the module — rejecting it would block a
  // correct config.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "const defaults = {horizon: {}};",
        'const options = {android: {...defaults, horizon: {appId: "31705015229097839"}}};',
        'export default {plugins: [["../app.plugin.js", options]]};',
      ].join("\n"),
      "expo-plugin-config",
    ),
    null,
  );
});

test("an uninitialised declaration does not adopt the next object", () => {
  // `let options;` followed by `const metadata = {` used to match as one
  // declaration, so an unrelated object stood in for the plugin's options.
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "let options;",
        'const metadata = {android: {horizon: {appId: "31705015229097839"}}};',
        "options = {android: {horizon: {}}};",
        'export default {plugins: [["../app.plugin.js", options]]};',
      ].join("\n"),
      "expo-plugin-config",
    ),
    "passes no options object to the OpenIAP config plugin",
  );
});

test("a spread into android is reported rather than read past", () => {
  // `{horizon: {appId}, ...defaults}` leaves whatever defaults.horizon holds.
  // Reading the literal and calling it settled asserts a value the build never
  // sees, so the audit says it cannot tell instead of passing.
  assert.match(
    String(
      inspectHorizonAppIdSource(
        [
          "const defaults = {horizon: {}};",
          'const options = {android: {horizon: {appId: "31705015229097839"}, ...defaults}};',
          'export default {plugins: [["../app.plugin.js", options]]};',
        ].join("\n"),
        "expo-plugin-config",
      ),
    ),
    /spreads an object into android/u,
  );
});

test("a source the audit cannot read is reported", () => {
  assert.match(
    String(
      inspectHorizonAppIdSource("<manifest></manifest>", "android-manifest"),
    ),
    /has no <application> element/u,
  );
  assert.match(
    String(
      inspectHorizonAppIdSource("<manifest><application>", "android-manifest"),
    ),
    /is not well-formed XML/u,
  );
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
