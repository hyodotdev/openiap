import { test } from "node:test";
import assert from "node:assert/strict";

import { auditFacts, expandFiles, readRepoFile } from "./audit-facts.mjs";

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
  const failures = auditFacts(
    overlaying(".github/workflows/release-godot.yml", (text) =>
      text.replace("runs-on: macos-26", "runs-on: macos-14"),
    ),
  );
  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /runner\.macos-image: .*release-godot.*"macos-14"/u,
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

test("catches a mirror that has been deleted", () => {
  // A mirror republishes a fact for readers and is excluded from the
  // "value still occurs" requirement on purpose, so nothing else notices when
  // the copy itself disappears.
  const failures = auditFacts((path) => {
    const text = readRepoFile(path);
    if (text === null) return null;
    return path === "security/README.md"
      ? text
          .split("\n")
          .filter((line) => !line.includes("`toolchain.bun` / `"))
          .join("\n")
      : text;
  });
  assert.ok(
    failures.some((entry) =>
      /toolchain\.bun: the runtimeImage mirror in security\/README\.md matches nothing/u.test(
        entry,
      ),
    ),
    `expected a mirror failure, got ${JSON.stringify(failures)}`,
  );
});

test("a mirror does not satisfy the value-still-occurs requirement", () => {
  // Adding the README mirror briefly let the Dockerfile's `FROM oven/bun:` line
  // be deleted without any audit noticing.
  const failures = auditFacts((path) => {
    const text = readRepoFile(path);
    if (text === null) return null;
    return path === "packages/kit/Dockerfile"
      ? text.replace(/^FROM\s+oven\/bun:.*$/mu, "FROM node:24-slim AS base")
      : text;
  });
  assert.ok(
    failures.some((entry) =>
      /toolchain\.bun: declared runtimeImage="[\d.]+" no longer occurs/u.test(
        entry,
      ),
    ),
    `expected a missing-value failure, got ${JSON.stringify(failures)}`,
  );
});

test("a role with no non-mirror site left is reported by role", () => {
  // Keying only by value let one occurrence satisfy two roles once their
  // versions converged, so losing a real declaration site went unnoticed. The
  // role check fires even when some other site still carries the same string.
  const failures = auditFacts((path) => {
    const text = readRepoFile(path);
    if (text === null) return null;
    return path === "packages/kit/Dockerfile"
      ? text.replace(/^FROM\s+oven\/bun:.*$/mu, "FROM node:24-slim AS base")
      : text;
  });
  assert.ok(
    failures.some((entry) =>
      /toolchain\.bun: no non-mirror site declares the runtimeImage role/u.test(
        entry,
      ),
    ),
    `expected a role failure, got ${JSON.stringify(failures)}`,
  );
});

test("the workflow glob sees .yaml files, which Actions also loads", () => {
  const files = expandFiles([".github/workflows/*.{yml,yaml}"], () => [
    "ci.yml",
    "sneaky.yaml",
    "notes.md",
  ]);
  assert.deepEqual(files, [
    ".github/workflows/ci.yml",
    ".github/workflows/sneaky.yaml",
  ]);
});
