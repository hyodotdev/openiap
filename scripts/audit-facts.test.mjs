import { test } from "node:test";
import assert from "node:assert/strict";

import { auditFacts, readRepoFile } from "./audit-facts.mjs";

// Overlay one edited file on top of the real tree, so every planted violation
// is exercised against the actual registry and scanners.
function overlaying(file, edit) {
  return (path) => {
    const text = readRepoFile(path);
    return path === file && text !== null ? edit(text) : text;
  };
}

test("the committed tree passes", () => {
  assert.deepEqual(auditFacts(readRepoFile), []);
});

test("catches a runner image left behind on a bump", () => {
  // The exact drift shipped in release-godot.yml until 2026-08-20.
  const failures = auditFacts(
    overlaying(".github/workflows/release-godot.yml", (text) =>
      text.replace("runs-on: macos-26", "runs-on: macos-15"),
    ),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /runner\.macos-image: .*release-godot.*"macos-15"/u,
  );
});

test("catches a stale Xcode pin", () => {
  const failures = auditFacts(
    overlaying(".github/workflows/codeql.yml", (text) =>
      text.replace("XCODE_VERSION: 26.6", "XCODE_VERSION: 16.4"),
    ),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /toolchain\.xcode: .*"16\.4"/u);
});

test("catches a partial Godot bump as a third value", () => {
  const failures = auditFacts(
    overlaying("libraries/godot-iap/Makefile", (text) =>
      text.replace("GODOT_VERSION ?= 4.7.1", "GODOT_VERSION ?= 4.8.0"),
    ),
  );
  assert.ok(
    failures.some((entry) => /godot\.version: .*"4\.8\.0"/u.test(entry)),
  );
});

test("catches the example project lagging the current editor", () => {
  // The exact drift shipped in Example/project.godot until 2026-08-20.
  const failures = auditFacts(
    overlaying("libraries/godot-iap/Example/project.godot", (text) =>
      text.replace('PackedStringArray("4.7"', 'PackedStringArray("4.5"'),
    ),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /godot\.example-features: .*"4\.5".*derives "4\.7"/u,
  );
});

test("catches a declared value that no longer occurs", () => {
  // Erase every JDK declaration; the registry entry is then dead.
  const failures = auditFacts((path) => {
    const text = readRepoFile(path);
    return text === null
      ? null
      : text.replace(/java-version:\s*["']?17["']?/g, "");
  });
  assert.ok(
    failures.some((entry) =>
      /toolchain\.jdk: declared pinned="17" no longer occurs/u.test(entry),
    ),
  );
});

test("the minimum and current Godot versions coexist without a finding", () => {
  // 4.3-stable and 4.7.1-stable live in the same workflows by design.
  const failures = auditFacts(readRepoFile).filter((entry) =>
    entry.startsWith("godot.version"),
  );
  assert.deepEqual(failures, []);
});
