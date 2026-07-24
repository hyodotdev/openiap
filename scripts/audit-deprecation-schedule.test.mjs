import assert from "node:assert/strict";
import test from "node:test";
import {
  collectMissingGeneratedDeprecationReasons,
  extractBalancedAnnotation,
  extractDeprecationBlock,
  findAttachedDeprecationBlock,
  matchesForbiddenSourcePattern,
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
