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
});

test("ignores API 24 factory decoys in comments and strings", () => {
  assert.equal(
    usesApi24ConcurrentKeySet(
      "// ConcurrentHashMap.newKeySet<String>()\n" +
        'val explanation = "ConcurrentHashMap.newKeySet<String>()"',
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
