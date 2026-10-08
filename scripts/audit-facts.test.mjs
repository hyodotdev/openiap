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

test("Godot export floors must be revalidated when AndroidX Core changes", () => {
  const failures = auditFacts(
    overlaying("packages/google/core/build.gradle.kts", (text) =>
      text.replace("androidx.core:core:1.18.0", "androidx.core:core:1.19.0"),
    ),
  );
  assert.ok(
    failures.some((entry) =>
      /godot\.android-export: .*"1\.19\.0"/u.test(entry),
    ),
  );
});

for (const [constant, before, after] of [
  ["AGP", '"8.9.1"', '"8.6.1"'],
  ["GRADLE", '"8.11.1"', '"8.10.0"'],
  ["COMPILE_SDK", "36", "35"],
]) {
  test(`catches a stale Godot MIN_${constant} consumer floor`, () => {
    const failures = auditFacts(
      overlaying(
        "libraries/godot-iap/addons/godot-iap/android_export.gd",
        (text) =>
          text.replace(
            `MIN_${constant} := ${before}`,
            `MIN_${constant} := ${after}`,
          ),
      ),
    );
    assert.ok(
      failures.some((entry) => entry.startsWith("godot.android-export:")),
    );
  });
}

for (const file of [
  "libraries/godot-iap/README.md",
  "packages/docs/src/pages/docs/setup/godot.tsx",
]) {
  test(`catches stale Godot export requirements in ${file}`, () => {
    const failures = auditFacts(
      overlaying(file, (text) => text.replace("AGP 8.9.1", "AGP 8.6.1")),
    );
    assert.ok(
      failures.some((entry) =>
        /godot\.android-export: .*"8\.6\.1"/u.test(entry),
      ),
    );
  });
}

test("catches the current guide's wrapper-upgrade version drifting", () => {
  const failures = auditFacts(
    overlaying("packages/docs/src/pages/docs/setup/godot.tsx", (text) =>
      text.replace(/Gradle\s+8\.11\.1\+\s+before/u, "Gradle 8.10.0+ before"),
    ),
  );
  assert.ok(
    failures.some((entry) =>
      /godot\.android-export: .*"8\.10\.0"/u.test(entry),
    ),
  );
});

test("a preview cannot silently replace the stable Godot AGP floor", () => {
  const failures = auditFacts(
    overlaying(
      "libraries/godot-iap/addons/godot-iap/android_export.gd",
      (text) => text.replace('MIN_AGP := "8.9.1"', 'MIN_AGP := "8.9.1-rc01"'),
    ),
  );
  assert.ok(
    failures.some((entry) =>
      /godot\.android-export: .*"8\.9\.1-rc01"/u.test(entry),
    ),
  );
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

test("the Godot CI job for the minimum editor is read as 4.3 and must stay 4.3", () => {
  // setup-godot needs 4.3.0, which the registry reads as Godot's own 4.3.
  const failures = auditFacts(
    overlaying(".github/workflows/ci-godot-iap.yml", (text) =>
      text.replace("version: 4.3.0", "version: 4.2.0"),
    ),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /godot\.version: .*ci-godot-iap.*"4\.2"/u);
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
