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
    "declares no android.horizon block",
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
    "declares no android.horizon block",
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
    "declares no android.horizon block",
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
    "registers no OpenIAP config plugin entry",
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
    "declares no android.horizon block",
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
    "registers no OpenIAP config plugin entry",
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



test("the reader answers for every shape review has raised", () => {
  const t = (src) => inspectHorizonAppIdSource(src, "expo-plugin-config");
  const tail = `\nexport default {plugins:[["../app.plugin.js",options]]};`;
  const id = '"31705015229097839"';
  const quote = String.fromCharCode(39);
  const backslash = String.fromCharCode(92);

  // Each of these was, at some point, read wrongly by a reader that matched
  // keys with regexes and counted braces by hand. They are answered by the
  // parser now, not by another special case.
  const reported = [
    // A ternary arm is not a value that can be chosen between.
    `const android={};\nconst options={android: true ? android : {horizon:{appId:${id}}}};`,
    `const appId="";\nconst options={android:{horizon:{appId: true ? appId : ${id}}}};`,
    `const good={android:{horizon:{appId:${id}}}};\nexport default {plugins:[["../app.plugin.js", good ? {} : good]]};`,
    // A spread AFTER the winning assignment can replace it.
    `const d={appId:""};\nconst options={android:{horizon:{appId:${id}, ...d}}};`,
    `const options={android:{horizon:{appId:${id}, [k]:1}}};`,
    // Only `const` means the declaration's text is the value received.
    `let android={horizon:{appId:${id}}};\nandroid={};\nconst options={android};`,
    // A parameter shadows anything outside its function.
    `const android={horizon:{appId:${id}}};\nexport default function config(android){\n  const options={android};\n  return {plugins:[["../app.plugin.js",options]]};\n}`,
    // `options` is a string; the block after it is not its initialiser.
    `const options = "ignored"\n{ android: {horizon: {appId: ${id}}} }\nexport default {plugins:[["../app.plugin.js",options]]};`,
    // JavaScript decodes the later key to `appId`, so it wins and is empty.
    `const options={android:{horizon:{appId:${id}, "app${backslash}u0049d":""}}};`,
    // A template with substitutions has no definite value.
    "const options={android:{horizon:{appId:`3170501522909783${n}`}}};",
    `const options={android:{horizon:{appId: load()}}};`,
    // A binding the plugin never receives — a loop variable, a catch binding, a
    // destructured name — is not the outer constant of the same name.
    `const options={android:{horizon:{appId:${id}}}};\nexport default function config(){\n  for (const options of [{android:{}}]) {\n    return {plugins:[["../app.plugin.js", options]]};\n  }\n}`,
    `const options={android:{horizon:{appId:${id}}}};\nexport default function config(){\n  try{}catch(options){\n    return {plugins:[["../app.plugin.js", options]]};\n  }\n}`,
    `const options={android:{horizon:{appId:${id}}}};\nexport default function config(){\n  const {options}=load();\n  return {plugins:[["../app.plugin.js", options]]};\n}`,
    `const options={android:{horizon:{appId:"123"}}};`,
    // The path is direct: a horizon nested inside horizon is not it.
    `const options={android:{horizon:{horizon:{appId:${id}}}}};`,
    // The later duplicate wins, and it is empty.
    `const options={android:{horizon:{appId:${id}}, horizon:{}}};`,
    `const options=options;`,
  ];
  for (const source of reported) {
    assert.notEqual(t(source.includes("plugins") ? source : source + tail), null, source);
  }

  // And these are ordinary configs a maintainer would write, which earlier
  // readers refused: a comment holding a quote, an escaped delimiter inside an
  // unrelated string, a spread that loses to a later assignment, a same-named
  // binding in an unrelated function.
  const accepted = [
    `const options={android:{horizon:{appId:${id}}}};`,
    `const options={android:{horizon:{"appId":${id}}}};`,
    `const options={android: /* "Quest" */ {horizon:{appId:${id}}}};`,
    `const options={localPath:${quote}/tmp/user${backslash}${quote}s/openiap${quote}, android:{horizon:{appId:${id}}}};`,
    `const d={appId:""};\nconst options={android:{horizon:{...d, appId:${id}}}};`,
    `const options={android:{horizon:{}, horizon:{appId:${id}}}};`,
    `const options={k:process.env.X, xs:[1,2], android:{horizon:{appId:${id}}}};`,
    `const horizon={appId:${id}};\nconst options={android:{horizon}};`,
    `const options={android:{horizon:{appId:${id}}}} satisfies Opts;`,
    // A no-substitution template, a `const` binding, and a later explicit key
    // that wins over an earlier spread all have definite values.
    "const options={android:{horizon:{appId:`31705015229097839`}}};",
    `const appId=${id};\nconst options={android:{horizon:{appId}}};`,
    `const d={appId:""};\nconst options={android:{horizon:{appId:${id}, ...d, appId:${id}}}};`,
    `const android={horizon:{appId:${id}}};\nfunction other(android){ return android; }\nconst options={android};`,
  ];
  for (const source of accepted) {
    assert.equal(t(source + tail), null, source);
  }

  // A tuple that is not reached through a `plugins` value is a fixture, not the
  // entry the build receives. Searching the whole module for one let a stale
  // constant stand in for an entry that was never registered.
  assert.match(
    String(
      t(
        `const good={android:{horizon:{appId:${id}}}};\nconst fixture=["../app.plugin.js", good];\nvoid fixture;\nexport default {plugins:[]};`,
      ),
    ),
    /registers no OpenIAP config plugin entry/u,
  );

  // The parser recovers from a syntax error and returns a tree anyway, so a
  // truncated config would otherwise read as one that declares the id.
  assert.match(
    String(
      t(
        `export default {plugins:[["../app.plugin.js",\n  {android:{horizon:{appId:${id}}}}]]`,
      ),
    ),
    /does not parse/u,
  );

  // A non-null assertion changes the type, not the value.
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nexport default {plugins:[["../app.plugin.js", options!]]};`,
    ),
    null,
  );

  // A comment between the plugin path and its options is not markup.
  assert.equal(
    t(
      `export default {plugins:[["../app.plugin.js", /* options */ {android:{horizon:{appId:${id}}}}]]};`,
    ),
    null,
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
    "declares no android.horizon block",
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
    "declares no android.horizon block",
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
    "declares no android.horizon block",
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



test("a horizon nested inside horizon is not a direct member", () => {
  // The key walker resumed past the matched `{`, so brace depth never counted
  // the value it had just matched: everything inside `horizon: {…}` read as a
  // direct member of android, and the closing brace drove depth negative.
  assert.match(
    String(
      inspectHorizonAppIdSource(
        'const options={android:{horizon:{horizon:{appId:"31705015229097839"}}}};\nexport default {plugins:[["../app.plugin.js",options]]};',
        "expo-plugin-config",
      ),
    ),
    /without a literal appId/u,
  );
});


test("an object-shaped type annotation is read, not refused", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      [
        "const options: {android: object} = {",
        '  android: {horizon: {appId: "31705015229097839"}},',
        "};",
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
