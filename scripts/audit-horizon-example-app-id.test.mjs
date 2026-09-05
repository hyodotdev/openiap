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
    `const options={android:{horizon:{["appId"]:""}}};`,
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
    // A computed key whose expression is a literal is just that name.
    `const options={android:{horizon:{["appId"]:${id}}}};`,
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

  // The tuple must be a DIRECT element of a `plugins` array: one nested inside
  // another plugin's options is that plugin's data, not a registration.
  assert.match(
    String(
      t(
        `const good={android:{horizon:{appId:${id}}}};\nexport default {plugins:[["other-plugin",{fixture:["../app.plugin.js", good]}]]};`,
      ),
    ),
    /registers no OpenIAP config plugin entry/u,
  );

  // A computed `["plugins"]` key is still `plugins`; missing it let a stale
  // object elsewhere supply the entry instead.
  assert.match(
    String(
      t(
        `const bad={android:{}};\nexport default {["plugins"]:[["../app.plugin.js", bad]]};`,
      ),
    ),
    /declares no android.horizon block/u,
  );

  // A `plugins` array the exported config cannot reach is a fixture, whatever
  // it contains — a stale constant held a complete entry while the export
  // registered nothing.
  assert.match(
    String(
      t(
        `const good={android:{horizon:{appId:${id}}}};\nconst stale={plugins:[["../app.plugin.js", good]]};\nvoid stale;\nexport default {plugins:[]};`,
      ),
    ),
    /registers no OpenIAP config plugin entry/u,
  );

  // A write through a binding this walk followed makes the literal above not
  // what the plugin receives — `const` binds the name, not the contents.
  for (const write of [
    `options.android.horizon.appId="";`,
    `(options.android.horizon.appId)="";`,
    `options.android.horizon.appId+="x";`,
    `delete options.android.horizon.appId;`,
    `Reflect.set(options.android.horizon,"appId","");`,
    `for (options.android.horizon.appId of [""]) {}`,
  ]) {
    assert.match(
      String(
        t(
          `const options={android:{horizon:{appId:${id}}}};\n${write}\nexport default {plugins:[["../app.plugin.js", options]]};`,
        ),
      ),
      /writes through the bindings/u,
      write,
    );
  }

  // Mutating something the app id does not travel through is ordinary Expo.
  assert.equal(
    t(
      `export default ({config}: any) => {\n  config.name="Example";\n  const options={android:{horizon:{appId:${id}}}};\n  return {...config, plugins:[["../app.plugin.js", options]]};\n};`,
    ),
    null,
  );

  // A spread of a `const` array, and a `const` plugin path, resolve like any
  // other binding — refusing them was a false reject, not a boundary.
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js", options]] as const;\nexport default {plugins:[...entries]};`,
    ),
    null,
  );
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst p="../app.plugin.js";\nexport default {plugins:[[p, options]]};`,
    ),
    null,
  );

  // A named function expression binds its own name inside itself, and a `var`
  // belongs to its function however deeply it is written.
  assert.match(
    String(
      t(
        `const appId=${id};\nexport default (function appId(){\n  const options={android:{horizon:{appId}}};\n  return {plugins:[["../app.plugin.js", options]]};\n});`,
      ),
    ),
    /without a literal appId/u,
  );
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nexport default function c(){\n  for (var options of [{android:{}}]) {}\n  return {plugins:[["../app.plugin.js", options]]};\n}`,
      ),
    ),
    /passes no options object/u,
  );

  // `export default function config() {}` is a declaration, not an assignment;
  // missing it read an ordinary config as registering nothing.
  assert.equal(
    t(
      `export default function c(){\n  const options={android:{horizon:{appId:${id}}}};\n  return {plugins:[["../app.plugin.js", options]]};\n}`,
    ),
    null,
  );

  // An enum, a namespace, and a `const` in an earlier switch clause all bind
  // the name; none of them resolves to an outer constant of the same name.
  assert.match(
    String(
      t(
        `const appId=${id};\nexport default () => {\n  enum appId { X }\n  const options={android:{horizon:{appId}}};\n  return {plugins:[["../app.plugin.js", options]]};\n};`,
      ),
    ),
    /without a literal appId/u,
  );
  assert.match(
    String(
      t(
        `const appId=${id};\nexport default () => {\n  switch (0 as number) {\n    case 0:\n      const appId = "";\n    case 1:\n      const options={android:{horizon:{appId}}};\n      return {plugins:[["../app.plugin.js", options]]};\n  }\n  return {};\n};`,
      ),
    ),
    /without a literal appId/u,
  );

  // A loop binding belongs to its own body. Counting it as the enclosing
  // block's shadowed a real constant declared beside it.
  assert.equal(
    t(
      `for (const options of []) {}\nconst options={android:{horizon:{appId:${id}}}};\nexport default {plugins:[["../app.plugin.js", options]]};`,
    ),
    null,
  );

  // A write through an ALIAS of the binding counts; an unrelated parameter of
  // the same name does not. Comparing spellings got both of these wrong.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst alias=options;\nalias.android.horizon.appId="";\nexport default {plugins:[["../app.plugin.js",options]]};`,
      ),
    ),
    /writes through the bindings/u,
  );
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nfunction f(options){ options.name="x"; }\nvoid f;\nexport default {plugins:[["../app.plugin.js",options]]};`,
    ),
    null,
  );

  // Mutating the entries array removes the plugin; copying out of the options
  // object does not touch it.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options]];\nentries.pop();\nexport default {plugins:entries};`,
      ),
    ),
    /writes through the bindings/u,
  );
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nvoid Object.assign({}, options);\nexport default {plugins:[["../app.plugin.js",options]]};`,
    ),
    null,
  );

  // A spread after `plugins`, and a conditional export, both leave more than
  // one possible answer.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nexport default {plugins:[["../app.plugin.js",options]], ...config};`,
      ),
    ),
    /does not resolve to one OpenIAP plugin entry/u,
  );
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options]];\nexport default {plugins:[...entries,...entries]};`,
      ),
    ),
    /does not resolve to one OpenIAP plugin entry/u,
  );

  // Expo allows a `.ts` config to use CommonJS, and `export {x as default}` is
  // a default export like any other.
  for (const form of [
    `export {config as default};`,
    `export default config;`,
    `module.exports=config;`,
  ]) {
    assert.equal(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst config={plugins:[["../app.plugin.js",options]]};\n${form}`,
      ),
      null,
      form,
    );
  }

  // An alias reached through a property or a destructuring pattern is the same
  // object, so a write through it is a write to the id.
  for (const alias of [
    `const horizon=options.android.horizon;\nhorizon.appId="";`,
    `const {android}=options;\nandroid.horizon.appId="";`,
  ]) {
    assert.match(
      String(
        t(
          `const options={android:{horizon:{appId:${id}}}};\n${alias}\nexport default {plugins:[["../app.plugin.js",options]]};`,
        ),
      ),
      /writes through the bindings/u,
      alias,
    );
  }

  // A write that cannot reach the id is not a write to it, and appending a
  // plugin cannot remove ours.
  for (const harmless of [
    `options.ios={supportsTablet:false};`,
    `options.extra={channel:"dev"};`,
  ]) {
    assert.equal(
      t(
        `const options={android:{horizon:{appId:${id}}}};\n${harmless}\nexport default {plugins:[["../app.plugin.js",options]]};`,
      ),
      null,
      harmless,
    );
  }
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options]];\nentries.push("expo-router");\nexport default {plugins:entries};`,
    ),
    null,
  );

  // Only the exported object's OWN `plugins` is the plugins array: a discarded
  // branch, a spread that replaces it, and unrelated data named `plugins` are
  // each answered correctly.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nif (process.env.X) {\n  module.exports={plugins:[["../app.plugin.js",options]]};\n} else {\n  module.exports={plugins:[]};\n}`,
      ),
    ),
    /does not resolve to one OpenIAP plugin entry/u,
  );
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst base={plugins:[["../app.plugin.js",options]]};\nexport default {...base, plugins:[]};`,
      ),
    ),
    /registers no OpenIAP config plugin entry/u,
  );
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst extraBase={channel:"dev"};\nexport default {plugins:[["../app.plugin.js",options]], extra:{plugins:[], ...extraBase}};`,
    ),
    null,
  );
  // A guard clause returning a different object is ordinary.
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nexport default () => {\n  if (!process.env.X) return {};\n  return {plugins:[["../app.plugin.js",options]]};\n};`,
    ),
    null,
  );

  // A destructured name is reached by the SOURCE property, and bracket access
  // names a property as surely as a dot does. Two reviewers found the first of
  // these independently.
  for (const alias of [
    `const {android: target}=options;\ntarget.horizon.appId="";`,
    `const {android:{horizon}}=options;\nhorizon.appId="";`,
    `const horizon=options["android"]["horizon"];\nhorizon.appId="";`,
  ]) {
    assert.match(
      String(
        t(
          `const options={android:{horizon:{appId:${id}}}};\n${alias}\nexport default {plugins:[["../app.plugin.js",options]]};`,
        ),
      ),
      /writes through the bindings/u,
      alias,
    );
  }
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\noptions["ios"]={supportsTablet:false};\nexport default {plugins:[["../app.plugin.js",options]]};`,
    ),
    null,
  );

  // Emptying the entries array removes the plugin. The array's path is the
  // whole of it, not the path down to the app id.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options]];\nentries.length=0;\nexport default {plugins:entries};`,
      ),
    ),
    /writes through the bindings/u,
  );

  // A binding holding the exported config is one property above the plugins
  // array, so emptying or replacing that array counts and renaming the app
  // does not.
  for (const write of [`config.plugins.length=0;`, `config.plugins=[];`]) {
    assert.match(
      String(
        t(
          `const options={android:{horizon:{appId:${id}}}};\nconst config={plugins:[["../app.plugin.js",options]]};\n${write}\nexport default config;`,
        ),
      ),
      /writes through the bindings/u,
      write,
    );
  }
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst config={plugins:[["../app.plugin.js",options]]};\nconfig.name="x";\nexport default config;`,
    ),
    null,
  );

  // Object rest copies the properties, so `copy.android` is still
  // `options.android`. Array rest builds a new array, which aliases nothing.
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst {...copy}=options;\ncopy.android.horizon.appId="";\nexport default {plugins:[["../app.plugin.js",options]]};`,
      ),
    ),
    /writes through the bindings/u,
  );
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options]];\nconst [...copy]=entries;\ncopy.length=0;\nexport default {plugins:entries};`,
    ),
    null,
  );

  // Changing a DIFFERENT plugin in the array leaves ours alone.
  assert.equal(
    t(
      `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options],["expo-router",{}]];\nentries[1][1]={foo:1};\nexport default {plugins:entries};`,
    ),
    null,
  );
  assert.match(
    String(
      t(
        `const options={android:{horizon:{appId:${id}}}};\nconst entries=[["../app.plugin.js",options],["expo-router",{}]];\nentries[0][1]={};\nexport default {plugins:entries};`,
      ),
    ),
    /writes through the bindings/u,
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

test("shapes this audit refuses on purpose", () => {
  const t = (src) => inspectHorizonAppIdSource(src, "expo-plugin-config");
  const id = '"31705015229097839"';

  // Each of these is valid TypeScript that a build would accept, and each is
  // reported. Reading them means evaluating the module — running a helper,
  // choosing a branch, calling a getter — and this audit reads a fixed list of
  // files this repository owns, none of which is written this way. The failure
  // it must never have is passing when the id is absent, so it errs here.
  for (const source of [
    // The array comes back from a helper.
    `const options={android:{horizon:{appId:${id}}}};\nconst make=()=>[["../app.plugin.js", options]];\nexport default {plugins: make()};`,
    // Both branches register the same valid options.
    `const g={android:{horizon:{appId:${id}}}};\nexport default {plugins:[ flag ? ["../app.plugin.js", g] : ["../app.plugin.js", g] ]};`,
    // A getter returns the id.
    `const options={android:{horizon:{ get appId(){ return ${id}; } }}};\nexport default {plugins:[["../app.plugin.js", options]]};`,
    // The id arrives through the prototype.
    `const options={android:{horizon:{ __proto__:{appId:${id}} }}};\nexport default {plugins:[["../app.plugin.js", options]]};`,
  ]) {
    assert.notEqual(t(source), null, source);
  }
});
