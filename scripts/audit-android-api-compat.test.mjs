import assert from "node:assert/strict";
import test from "node:test";
import { usesApi24ConcurrentKeySet } from "./audit-android-api-compat.mjs";

test("detects the API 24 concurrent set factory", () => {
  assert.equal(
    usesApi24ConcurrentKeySet(
      "private val warnings = ConcurrentHashMap.newKeySet<String>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "val listeners = java.util.concurrent.ConcurrentHashMap\n" +
        "  .newKeySet<Listener>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "import java.util.concurrent.ConcurrentHashMap as CHM\n" +
        "val listeners = CHM.newKeySet<Listener>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "import static java.util.concurrent.ConcurrentHashMap.newKeySet;\n" +
        "Set<String> warnings = newKeySet();",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "Set<String> warnings = ConcurrentHashMap.<String>newKeySet();",
      false,
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "/* ignored /* */ Set<String> warnings = ConcurrentHashMap.newKeySet();",
      false,
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      'val explanation = "${ConcurrentHashMap.newKeySet<String>()}"',
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "val warnings = ConcurrentHashMap.`newKeySet`<String>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "import java.util.concurrent.ConcurrentHashMap.newKeySet as makeSet\n" +
        "val warnings = makeSet<String>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "val warnings = ConcurrentHashMap.newKeySet<(String) -> Int>()",
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet("val factory = ConcurrentHashMap::`newKeySet`"),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet("fun newKeySet(): Set<String> = emptySet()"),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "var warnings = ConcurrentHashMap.\\u006eewKeySet();",
      false,
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "var warnings = ConcurrentHashMap.n\\u0065wKeySet();",
      false,
    ),
    true,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "// ignored\\u000aConcurrentHashMap.newKeySet();",
      false,
    ),
    true,
  );
});

test("ignores API 24 factory decoys in comments and strings", () => {
  assert.equal(
    usesApi24ConcurrentKeySet(
      "// ConcurrentHashMap.newKeySet<String>()\n" +
        'val explanation = "ConcurrentHashMap.newKeySet<String>()"',
    ),
    false,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      'String explanation = "${ConcurrentHashMap.newKeySet()}";',
      false,
    ),
    false,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      'String explanation = """\n\\\""" ConcurrentHashMap.newKeySet()\n""";',
      false,
    ),
    false,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      'String explanation = "\\\\u006eewKeySet";',
      false,
    ),
    false,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "\\u0022ConcurrentHashMap.newKeySet()\\u0022",
      false,
    ),
    false,
  );
  assert.equal(
    usesApi24ConcurrentKeySet(
      "val `// newKeySet()` = 1\nval warnings = mutableSetOf<String>()",
    ),
    false,
  );
});

test("accepts the API 23 compatible concurrent set factory", () => {
  assert.equal(
    usesApi24ConcurrentKeySet(
      "val warnings: MutableSet<String> =\n" +
        "  Collections.newSetFromMap(ConcurrentHashMap())",
    ),
    false,
  );
});
