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

test("every Horizon example in this repository resolves an app id", () => {
  assert.deepEqual(collectHorizonExampleAppIdFailures(repoRoot), []);
});

test("the audit covers every library that ships a Horizon example", () => {
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
    const issue = inspectHorizonAppIdSource("", source.kind);
    assert.equal(
      /unknown source kind/.test(String(issue)),
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

test("meta-data nested inside an activity does not satisfy the audit", () => {
  // Horizon reads the id from <application>; nested here it merges where the
  // platform never looks, so the build still fails on device.
  const contents = manifest(
    `<activity android:name=".MainActivity">${HORIZON_META("31705015229097839")}</activity>`,
  );
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares the Horizon meta-data outside <application>",
  );
});

test("only the value terminating a Gradle statement counts", () => {
  // The chain's earlier operands are property reads; the last one is what
  // actually reaches manifestPlaceholders.
  const chain = [
    "val appId = listOf(",
    '    localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),',
    '    project.findProperty("EXAMPLE_HORIZON_APP_ID") as String?,',
    ').firstOrNull { !it.isNullOrBlank() } ?: ""',
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(chain, "gradle-fallback"),
    "falls back to an empty app id",
  );
  assert.equal(
    inspectHorizonAppIdSource(
      chain.replace('?: ""', '?: "31705015229097839"'),
      "gradle-fallback",
    ),
    null,
  );
});

test("a commented-out Gradle fallback does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      '// val appId = localProperties.getProperty("HORIZON_APP_ID") ?: "31705015229097839"',
      "gradle-fallback",
    ),
    "reads no Horizon app id property",
  );
});

test("a commented-out Expo appId does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "horizon: { // appId: '31705015229097839'\n }",
      "expo-plugin-config",
    ),
    "declares horizon config without a literal appId",
  );
});

test("a manifest with no Horizon meta-data is rejected", () => {
  assert.equal(
    inspectHorizonAppIdSource(manifest("<activity/>"), "android-manifest"),
    "declares no Horizon app id meta-data",
  );
});

test("a numeric literal unbound from the declaration does not satisfy the audit", () => {
  // The declaration is present but valueless; the id only appears in a comment.
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

test("an unresolved manifest placeholder does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      manifest(HORIZON_META("${HORIZON_APP_ID}")),
      "android-manifest",
    ),
    "declares the Horizon meta-data without a literal app id",
  );
});

test("a second Horizon meta-data block can supply the id", () => {
  const contents = manifest(
    `${HORIZON_META("")}${HORIZON_META("31705015229097839")}`,
  );
  assert.equal(inspectHorizonAppIdSource(contents, "android-manifest"), null);
});

test("an empty Gradle fallback is rejected even when a literal id is nearby", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      'def id = localProperties.getProperty("HORIZON_APP_ID") ?: ""\n// 31705015229097839',
      "gradle-fallback",
    ),
    "falls back to an empty app id",
  );
});

test("a Gradle fallback to a literal id passes", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      'localProperties.getProperty("HORIZON_APP_ID")?.trim() ?: "31705015229097839"',
      "gradle-fallback",
    ),
    null,
  );
});

test("a Gradle file with the id only in an unrelated place is rejected", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      'def unrelated = "31705015229097839"\n',
      "gradle-fallback",
    ),
    "reads no Horizon app id property",
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
    "declares horizon config without a literal appId",
  );
});

test("a short number is not accepted as a Horizon app id", () => {
  // Horizon app ids are long. Without this the digit-count constraint is
  // unpinned and can be weakened to \\d+ with every other test still green.
  assert.equal(
    inspectHorizonAppIdSource(manifest(HORIZON_META("0")), "android-manifest"),
    "declares the Horizon meta-data without a literal app id",
  );
  assert.equal(
    inspectHorizonAppIdSource(
      'localProperties.getProperty("HORIZON_APP_ID")?.trim() ?: "12345"',
      "gradle-fallback",
    ),
    'falls back to "12345" instead of a literal Horizon app id',
  );
  assert.equal(
    inspectHorizonAppIdSource("horizon: { appId: '42' }", "expo-plugin-config"),
    "declares horizon config without a literal appId",
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

test("comment stripping survives an opener spliced together by removal", () => {
  // Removing the inner `<!-- -->` joins `<!-` and `-` into a new `<!--` that
  // the first pass never saw, so a single substitution leaves the
  // commented-out declaration looking active.
  const contents = manifest(
    `<!-<!-- -->- ${HORIZON_META("31705015229097839")} -->`,
  );
  assert.equal(
    inspectHorizonAppIdSource(contents, "android-manifest"),
    "declares no Horizon app id meta-data",
  );
});

test("a Gradle fallback inside a block comment does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      '/*\nval appId = localProperties.getProperty("HORIZON_APP_ID") ?: "31705015229097839"\n*/',
      "gradle-fallback",
    ),
    "reads no Horizon app id property",
  );
});

test("an Expo appId inside a block comment does not satisfy the audit", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "/* horizon: { appId: '31705015229097839' } */",
      "expo-plugin-config",
    ),
    "does not set a literal horizon.appId",
  );
});

test("the Gradle inspector reads the statement, not one syntax", () => {
  // The two Gradle examples do not share a shape. Both must resolve, and both
  // must fail when the value the statement ends on is blank.
  const elvis =
    'val appId = localProperties.getProperty("HORIZON_APP_ID")?.trim()\n    ?: "31705015229097839"';
  const listOf = [
    "val appId = listOf(",
    '    localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),',
    '    project.findProperty("EXAMPLE_OPENIAP_APP_ID") as String?,',
    ').firstOrNull { !it.isNullOrBlank() } ?: "31705015229097839"',
  ].join("\n");
  for (const statement of [elvis, listOf]) {
    assert.equal(inspectHorizonAppIdSource(statement, "gradle-fallback"), null);
    assert.equal(
      inspectHorizonAppIdSource(
        statement.replace('"31705015229097839"', '""'),
        "gradle-fallback",
      ),
      "falls back to an empty app id",
    );
  }
});

test("every app id statement is inspected, not only the first", () => {
  // packages/google resolves the id twice — defaultConfig and the horizon
  // flavor — and the flavor's value is what that build actually uses.
  const source = [
    "val appId = listOf(",
    '    localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),',
    ').firstOrNull { !it.isNullOrBlank() } ?: "31705015229097839"',
    'create("horizon") {',
    '    val appId = localProperties.getProperty("EXAMPLE_HORIZON_APP_ID") ?: ""',
    "}",
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(source, "gradle-fallback"),
    "falls back to an empty app id",
  );
});

test("a literal fallback that a blank override defeats is rejected", () => {
  // Properties.getProperty returns "" for a key present with no value, and ""
  // is non-null, so elvis alone never reaches the literal.
  assert.equal(
    inspectHorizonAppIdSource(
      'horizonAppId = localProperties.getProperty("HORIZON_APP_ID") ?: "31705015229097839"',
      "gradle-fallback",
    ),
    "accepts a blank override, which defeats the literal fallback",
  );
});

test("a single-quoted Groovy property name is still recognised", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "horizonAppId = localProperties.getProperty('HORIZON_APP_ID')?.trim() ?: '31705015229097839'",
      "gradle-fallback",
    ),
    null,
  );
});

test("a single-quoted manifest value is still recognised", () => {
  const contents = manifest(
    "<meta-data android:name=\"com.meta.horizon.platform.HORIZON_APP_ID\" android:value='31705015229097839' />",
  );
  assert.equal(inspectHorizonAppIdSource(contents, "android-manifest"), null);
});

test("a nested object between horizon and appId does not hide the id", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      "horizon: { extra: { store: 'meta' }, appId: '31705015229097839' }",
      "expo-plugin-config",
    ),
    null,
  );
});

test("structure is read from masked text, so strings cannot forge syntax", () => {
  // Every case below came from a Grok review of an earlier revision that
  // counted parens and braces inside string literals.
  const wrappedTrim = [
    'horizonAppId = localProperties.getProperty("HORIZON_APP_ID")',
    '    ?.trim() ?: "31705015229097839"',
  ].join("\n");
  const multiLineLambda = [
    "val appId = listOf(",
    '    localProperties.getProperty("EXAMPLE_HORIZON_APP_ID"),',
    ").firstOrNull {",
    "    !it.isNullOrBlank()",
    '} ?: "31705015229097839"',
  ].join("\n");
  const parenInString = [
    'val appId = localProperties.getProperty("HORIZON_APP_ID")?.trim() ?: "31705015229097839"',
    'val other = "a ( b"',
  ].join("\n");
  const braceInString = [
    "horizon: {",
    '  note: "needs a } here",',
    "  appId: '31705015229097839',",
    "}",
  ].join("\n");

  for (const source of [wrappedTrim, multiLineLambda, parenInString]) {
    assert.equal(
      inspectHorizonAppIdSource(source, "gradle-fallback"),
      null,
      source,
    );
  }
  assert.equal(
    inspectHorizonAppIdSource(braceInString, "expo-plugin-config"),
    null,
  );

  // A brace inside a string must not stretch the block into a later decoy.
  const stretchedIntoDecoy = [
    "horizon: {",
    '  note: "{ {",',
    "  appId: process.env.HORIZON,",
    "},",
    "later: { appId: '31705015229097839' },",
  ].join("\n");
  assert.equal(
    inspectHorizonAppIdSource(stretchedIntoDecoy, "expo-plugin-config"),
    "declares horizon config without a literal appId",
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
