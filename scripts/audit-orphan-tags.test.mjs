import test from "node:test";
import assert from "node:assert/strict";

import { KNOWN_ORPHAN_TAGS, findMissingOrphans } from "./audit-orphan-tags.mjs";

test("reports nothing when every pinned tag exists", () => {
  const remote = [...KNOWN_ORPHAN_TAGS.map(({ tag }) => tag), "3.6.0"];
  assert.deepEqual(findMissingOrphans(remote), []);
});

test("reports a deleted pinned tag with its reason", () => {
  const missing = findMissingOrphans(["3.6.0"]);
  assert.deepEqual(
    missing.map(({ tag }) => tag),
    KNOWN_ORPHAN_TAGS.map(({ tag }) => tag),
  );
  for (const entry of missing) {
    assert.ok(entry.reason.length > 0);
  }
});

test("reports every pin when the remote has no tags", () => {
  assert.deepEqual(findMissingOrphans([]), KNOWN_ORPHAN_TAGS);
});
