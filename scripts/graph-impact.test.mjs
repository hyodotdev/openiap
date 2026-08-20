import { test } from "node:test";
import assert from "node:assert/strict";

import { impact } from "./graph-impact.mjs";
import { FACTS } from "./facts.mjs";

test("godot.version impact spans declarations, derivation, and CI jobs", () => {
  const result = impact("godot.version");
  assert.ok(result.files.includes("libraries/godot-iap/Makefile"));
  assert.ok(result.files.includes("libraries/godot-iap/Example/project.godot"));
  assert.deepEqual(result.derived, [
    {
      key: "godot.example-features",
      file: "libraries/godot-iap/Example/project.godot",
      value: "4.7",
    },
  ]);
  assert.ok(result.jobs.length > 0);
});

test("an unknown fact returns null instead of an empty impact", () => {
  assert.equal(impact("toolchain.unknown"), null);
});

test("every registered fact resolves to at least one declaration", () => {
  for (const fact of FACTS) {
    const result = impact(fact.key);
    assert.ok(result.occurrences.length > 0, `${fact.key} has no declarations`);
  }
});
