import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  collectMissingGeneratedDeprecationReasons,
  collectMissingRequiredSourceNotices,
  evaluateSourceStructureRule,
  extractBalancedAnnotation,
  extractBraceDelimitedRegion,
  extractDeprecationBlock,
  findAttachedDeprecationBlock,
  matchesForbiddenSourcePattern,
  sourceStructureRules,
} from "./audit-deprecation-schedule.mjs";

test("generated outputs must carry canonical schema deprecation reasons", () => {
  const entries = [
    {
      kind: "FieldDefinition",
      ownerPath: "Mutation.legacy",
      reason: "Use current. Scheduled for removal in OpenIAP 3.0.",
    },
  ];
  assert.deepEqual(
    collectMissingGeneratedDeprecationReasons(
      entries,
      "Use current. Scheduled for removal in OpenIAP 3.0.",
    ),
    [],
  );
  assert.deepEqual(
    collectMissingGeneratedDeprecationReasons(entries, "stale generated text"),
    entries,
  );
});

test("TypeScript unions may omit enum-value reasons only", () => {
  const enumValue = {
    kind: "EnumValueDefinition",
    ownerPath: "LegacyMode.OLD",
    reason: "Use current. Scheduled for removal in OpenIAP 3.0.",
  };
  assert.deepEqual(
    collectMissingGeneratedDeprecationReasons(
      [enumValue],
      "",
      new Set(["EnumValueDefinition"]),
    ),
    [],
  );
});

test("forbidden checks catch the original product platform strike-through shape", () => {
  const source = `<code style={{ textDecoration: 'line-through' }}>
    platform
  </code>`;
  assert.equal(
    matchesForbiddenSourcePattern(
      source,
      /textDecoration\s*:\s*["']line-through["'][\s\S]{0,160}>\s*(?:Product\.)?platform\s*</,
    ),
    true,
  );
});

test("forbidden checks reset stateful regular expressions", () => {
  const pattern = /legacy/g;
  assert.equal(matchesForbiddenSourcePattern("legacy", pattern), true);
  assert.equal(matchesForbiddenSourcePattern("legacy", pattern), true);
});

test("balanced annotations ignore parentheses inside strings and comments", () => {
  const source = `@Deprecated(
  "Use replacement(value) instead. Scheduled for removal in package 2.0.0.",
  // A closing parenthesis here must not finish the annotation: )
)
fun legacy() = Unit`;
  const block = extractBalancedAnnotation(source, 0);
  assert.match(block, /package 2\.0\.0/);
  assert.doesNotMatch(block, /fun legacy/);
});

test("a neighboring annotation cannot satisfy a declaration", () => {
  const source = `@Deprecated("Scheduled for removal in package 2.0.0.")
fun first() = Unit

fun second() = Unit`;
  const block = findAttachedDeprecationBlock(
    source,
    /fun\s+second\s*\(/,
    "@Deprecated",
  );
  assert.equal(block, null);
});

test("an attached JSDoc notice is isolated from the preceding declaration", () => {
  const source = `/** @deprecated Scheduled for removal in package 2.0.0. */
export const first = 1;

/** Canonical API. */
export const second = 2;`;
  assert.equal(
    findAttachedDeprecationBlock(
      source,
      /export\s+const\s+second\b/,
      "@deprecated",
    ),
    null,
  );
});

test("an occurrence-specific requirement cannot reuse the first annotation", () => {
  const source = `@Deprecated("Scheduled for removal in package 2.0.0.")
bool? legacyFlag;

bool? legacyFlag;`;
  assert.equal(
    findAttachedDeprecationBlock(
      source,
      /bool\?\s+legacyFlag\b/g,
      "@Deprecated",
      1,
    ),
    null,
  );
});

test("removing an attached marker makes a required declaration fail", () => {
  const source = `@Deprecated("Use current. Scheduled for removal in package 2.0.0.")
fun legacy() = Unit`;
  const declaration = /fun\s+legacy\s*\(/;

  assert.match(
    findAttachedDeprecationBlock(source, declaration, "@Deprecated"),
    /Use current/,
  );
  assert.equal(
    findAttachedDeprecationBlock(
      source.replace("@Deprecated", "@MigrationNote"),
      declaration,
      "@Deprecated",
    ),
    null,
  );
});

test("attached notices expose only their own replacement guidance", () => {
  const source = `@Deprecated("Use firstReplacement. Scheduled for removal in package 2.0.0.")
fun first() = Unit

@Deprecated("Use secondReplacement. Scheduled for removal in package 2.0.0.")
fun second() = Unit`;
  const block = findAttachedDeprecationBlock(
    source,
    /fun\s+second\s*\(/,
    "@Deprecated",
  );
  assert.match(block, /secondReplacement/);
  assert.doesNotMatch(block, /firstReplacement/);
});

test("GDScript deprecation blocks contain only contiguous documentation lines", () => {
  const source = `## @deprecated Use replacement.
## Scheduled for removal in package 2.0.0.
func legacy():
  pass

## Canonical API.
func current():
  pass`;
  const index = source.indexOf("## @deprecated");
  const block = extractDeprecationBlock(source, index, "## @deprecated");
  assert.match(block, /package 2\.0\.0/);
  assert.doesNotMatch(block, /func legacy/);
});

test("GraphQL multiline directives stop at their own closing parenthesis", () => {
  const source = `legacy: Boolean
  @deprecated(
    reason: "Use current. Scheduled for removal in OpenIAP 3.0."
  )
current: Boolean`;
  const index = source.indexOf("@deprecated");
  const block = extractDeprecationBlock(source, index, "@deprecated(");
  assert.match(block, /OpenIAP 3\.0/);
  assert.doesNotMatch(block, /current: Boolean/);
});

const structureRule = (id) => {
  const rule = sourceStructureRules.find((entry) => entry.id === id);
  assert.ok(rule, `missing source structure rule ${id}`);
  return rule;
};

const ruleSource = (id) => {
  const rule = structureRule(id);
  return [rule, fs.readFileSync(rule.file, "utf8")];
};

test("brace extraction ignores fake declarations in comments, strings, and regexes", () => {
  const source = `
// function selected() { return "comment"; }
const text = "function selected() { return 'string'; }";
const pattern = /function selected\\(\\) \\{ return 'regex'; \\}/;
function selected() {
  return "real";
}`;
  const region = extractBraceDelimitedRegion(
    source,
    /\bfunction\s+selected\s*\(\s*\)/,
  );
  assert.match(region, /return "real"/);
  assert.doesNotMatch(region, /comment|string|regex/);
});

test("structure rules survive local-variable renames", () => {
  const cases = [
    [
      "flutter-selected-purchase-fields",
      (source) =>
        source
          .replaceAll("sourcePayload", "wirePayload")
          .replaceAll("hasSelectedPurchaseState", "selectedStateWasSupplied"),
    ],
    [
      "expo-android-deep-link-selector",
      (source) =>
        source
          .replaceAll("hasCanonicalSku", "skuWasSupplied")
          .replaceAll("hasCanonicalPackageName", "packageNameWasSupplied"),
    ],
    [
      "rn-android-native-platform-selector",
      (source) => source.replaceAll("androidRequest", "selectedStoreRequest"),
    ],
    [
      "rn-ios-native-platform-selector",
      (source) =>
        source
          .replaceAll("canonicalApple", "selectedStoreRequest")
          .replaceAll("unwrapped", "decodedRequest"),
    ],
    [
      "apple-store-platform-selector",
      (source) =>
        source
          .replaceAll("let platforms", "let routes")
          .replaceAll("platforms.", "routes.")
          .replaceAll("let apple =", "let selectedApple =")
          .replaceAll("return apple.sku", "return selectedApple.sku")
          .replaceAll("let ios =", "let legacyIos =")
          .replaceAll("return ios.sku", "return legacyIos.sku"),
    ],
    [
      "google-store-platform-selector",
      (source) =>
        source
          .replaceAll("val platforms", "val routes")
          .replaceAll("platforms.", "routes."),
    ],
  ];

  for (const [id, rename] of cases) {
    const [rule, source] = ruleSource(id);
    assert.equal(
      evaluateSourceStructureRule(rule, rename(source)),
      true,
      `${id} should not depend on local variable names`,
    );
  }
});

test("structure rules reject value fallbacks and in-function presence decoys", () => {
  const cases = [
    [
      "flutter-selected-purchase-fields",
      (source) =>
        source.replace(
          "sourcePayload.containsKey('purchaseState')",
          "sourcePayload['purchaseState'] != null",
        ),
    ],
    [
      "flutter-android-custom-channel-selectors",
      (source) =>
        source.replace(
          'params.containsKey("productIds")',
          'params["productIds"] != null',
        ),
    ],
    [
      "flutter-apple-transaction-selector:libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
      (source) =>
        source.replace(
          'payload.keys.contains("transactionId")',
          'payload["transactionId"] != nil',
        ),
    ],
    [
      "expo-android-deep-link-selector",
      (source) =>
        source.replace(
          'val hasCanonicalSku = params.containsKey("skuAndroid")',
          `val observedSkuKey = params.containsKey("skuAndroid")
        if (observedSkuKey) {
            println("diagnostic only")
        }
        val hasCanonicalSku = params["skuAndroid"] != null`,
        ),
    ],
    [
      "expo-plugin-module-env-selector",
      (source) =>
        source.replace(
          "const isFireOsEnabled = hasOwnKey(moduleAmazon, 'fireOS')",
          `const observedFireOS = hasOwnKey(moduleAmazon, 'fireOS');
  if (observedFireOS) console.log('diagnostic only');
  const isFireOsEnabled = moduleAmazon?.fireOS != null`,
        ),
    ],
    [
      "rn-android-native-platform-selector",
      (source) =>
        source.replace(
          "if (request.google != null)",
          "if (request.google ?: request.android != null)",
        ),
    ],
  ];

  for (const [id, corrupt] of cases) {
    const [rule, source] = ruleSource(id);
    assert.equal(
      evaluateSourceStructureRule(rule, corrupt(source)),
      false,
      `${id} should reject a value fallback or unrelated presence probe`,
    );
  }
});

test("one-time warning rules reject non-deduplicated emitters", () => {
  const [pluginRule, pluginSource] = ruleSource("expo-plugin-warning-dedup");
  assert.equal(evaluateSourceStructureRule(pluginRule, pluginSource), true);
  assert.equal(
    evaluateSourceStructureRule(
      pluginRule,
      pluginSource.replace(
        "if (emittedLegacyPluginWarnings.has(warningKey))",
        "if (false)",
      ),
    ),
    false,
  );

  const [horizonRule, horizonSource] = ruleSource(
    "horizon-manifest-warning-dedup",
  );
  assert.equal(evaluateSourceStructureRule(horizonRule, horizonSource), true);
  assert.equal(
    evaluateSourceStructureRule(
      horizonRule,
      horizonSource.replace(
        "if (!emittedLegacyHorizonAppIdWarnings.add(key)) return",
        "if (false) return",
      ),
    ),
    false,
  );

  const [iosLogRule, iosLogSource] = ruleSource("rn-ios-deprecation-dedup");
  assert.equal(evaluateSourceStructureRule(iosLogRule, iosLogSource), true);
  assert.equal(
    evaluateSourceStructureRule(
      iosLogRule,
      iosLogSource.replace("emit(.warn, message)", "warn(message)"),
    ),
    false,
    "deprecation warnings must bypass the debug-gated log wrapper",
  );
});

test("semantic-boundary SSOT pins compatibility migrations and input semantics", () => {
  const file = "knowledge/internal/07-docs-consistency.md";
  const source = fs.readFileSync(file, "utf8");
  assert.deepEqual(collectMissingRequiredSourceNotices(file, source), []);
  const contracts = [
    "`skuArr` / `productIds`",
    "finish-transaction `transactionIdentifier` with `transactionId`",
    "Android deep-link callers move `sku` /",
    "Raw map/object compatibility adapters use own-key presence semantics",
    "Generated typed platform requests use nullable value semantics",
  ];
  for (const contract of contracts) {
    assert.ok(
      collectMissingRequiredSourceNotices(
        file,
        source.replaceAll(contract, "[removed compatibility contract]"),
      ).includes(contract),
      `missing fault coverage for ${contract}`,
    );
  }
});

test("public docs, context template, and generated context pin migration wording", () => {
  const cases = [
    [
      "packages/docs/src/pages/docs/updates/deprecations.tsx",
      [
        "fetchProducts skuArr / productIds",
        "finishTransaction transactionIdentifier",
        "Android deep-link sku / packageName",
        "Raw map/object compatibility inputs",
        "Generated Swift and Kotlin request models expose nullable",
      ],
    ],
    [
      "packages/docs/src/pages/docs/updates/releases.tsx",
      [
        "fetchProducts skuArr / productIds",
        "transactionIdentifier",
        "Android deep-link sku / packageName",
        "Raw map/object compatibility inputs",
        "typed facades prefer a non-null",
      ],
    ],
    [
      "scripts/agent/compile-context.ts",
      [
        "skuArr/productIds -> skus",
        "sku/packageName -> skuAndroid/packageNameAndroid",
        "finish-transaction \\`transactionIdentifier\\` with",
        "Raw map/object compatibility inputs",
        "typed facades prefer a",
      ],
    ],
    ...[
      "packages/docs/public/llms.txt",
      "packages/docs/public/llms-full.txt",
    ].map((file) => [
      file,
      [
        "skuArr/productIds -> skus",
        "sku/packageName -> skuAndroid/packageNameAndroid",
        "finish-transaction `transactionIdentifier` with",
        "Raw map/object compatibility inputs",
        "typed facades prefer a",
      ],
    ]),
    [
      "knowledge/_claude-context/context.md",
      [
        "`skuArr` / `productIds`",
        "finish-transaction `transactionIdentifier` with `transactionId`",
        "Android deep-link callers move `sku` /",
        "Raw map/object compatibility adapters use own-key presence semantics",
        "Generated typed platform requests use nullable value semantics",
      ],
    ],
  ];

  for (const [file, contracts] of cases) {
    const source = fs.readFileSync(file, "utf8");
    assert.deepEqual(
      collectMissingRequiredSourceNotices(file, source),
      [],
      `${file} should satisfy all required notices before fault injection`,
    );
    for (const contract of contracts) {
      assert.ok(
        collectMissingRequiredSourceNotices(
          file,
          source.replaceAll(contract, "[removed compatibility contract]"),
        ).includes(contract),
        `${file} should detect removal of ${contract}`,
      );
    }
  }
});
