import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DIGEST_MANIFEST,
  collectGodotBinaryDigestFailures,
  digestOf,
  listTrackedBinaries,
  parseDigestManifest,
} from "./audit-godot-binary-digests.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// The collector reads the digest manifest and the binary root, nothing else.
// Copying the whole addon pulled in build output — 8 GB in a checkout that has
// built Godot — three times per run.
const stageFixture = (scratch) => {
  const target = path.join(scratch, "libraries/godot-iap");
  fs.mkdirSync(path.join(target, "addons/godot-iap"), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, DIGEST_MANIFEST),
    path.join(scratch, DIGEST_MANIFEST),
  );
  fs.cpSync(
    path.join(repoRoot, "libraries/godot-iap/addons/godot-iap/bin"),
    path.join(target, "addons/godot-iap/bin"),
    { recursive: true },
  );
  return target;
};

test("the shipped Godot binaries match their recorded digests", () => {
  assert.deepEqual(collectGodotBinaryDigestFailures(repoRoot), []);
});

test("every binary that ships is covered", () => {
  const covered = new Set(
    parseDigestManifest(
      fs.readFileSync(path.join(repoRoot, DIGEST_MANIFEST), "utf8"),
    )
      .filter((entry) => entry.digest)
      .map((entry) => entry.file),
  );
  const shipped = listTrackedBinaries(repoRoot);
  assert.ok(shipped.length > 0, "no binaries were discovered");
  for (const file of shipped) {
    assert.ok(covered.has(file), `${file} has no recorded digest`);
  }
});

test("comments and blank lines are ignored, malformed lines are not", () => {
  const entries = parseDigestManifest(
    ["# header", "", `${"a".repeat(64)}  bin/x`, "garbage line"].join("\n"),
  );
  assert.deepEqual(entries, [
    { digest: "a".repeat(64), file: "bin/x" },
    { malformed: "garbage line" },
  ]);
});

test("a changed binary is reported with both digests", () => {
  const file = listTrackedBinaries(repoRoot)[0];
  const real = digestOf(repoRoot, file);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "godot-digests-"));
  try {
    // Copy the addon tree, then rewrite the manifest with one wrong digest.
    stageFixture(scratch);
    const manifest = path.join(scratch, DIGEST_MANIFEST);
    fs.writeFileSync(
      manifest,
      fs.readFileSync(manifest, "utf8").replace(real, "0".repeat(64)),
    );
    const failures = collectGodotBinaryDigestFailures(scratch);
    assert.equal(failures.length, 1);
    assert.match(
      failures[0],
      new RegExp(`^${file} changed: recorded 0{64}, found ${real}$`),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("corrupting a binary and deleting its line does not hide it", () => {
  // The protected set used to be derived from Mach-O magic, so replacing an
  // executable with other bytes removed it from the scan; deleting its digest
  // line then removed it from the recorded set too, and both checks agreed.
  const file = listTrackedBinaries(repoRoot).find((entry) =>
    entry.includes("macos/"),
  );
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "godot-digests-"));
  try {
    const target = stageFixture(scratch);
    fs.writeFileSync(
      path.join(scratch, "libraries/godot-iap", file),
      "not a Mach-O\n",
    );
    const manifest = path.join(scratch, DIGEST_MANIFEST);
    fs.writeFileSync(
      manifest,
      fs
        .readFileSync(manifest, "utf8")
        .split("\n")
        .filter((line) => !line.includes(file))
        .join("\n"),
    );
    const failures = collectGodotBinaryDigestFailures(scratch);
    assert.ok(
      failures.some((failure) => failure.startsWith(`${file} ships in`)),
      `expected ${file} to be reported, got ${JSON.stringify(failures)}`,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("an excused name does not excuse executable content", () => {
  // The exclusion list is by filename, so a Mach-O copied to a name it excuses
  // would slip past — the same mistake as deriving the protected set from the
  // bytes, inverted.
  const donor = listTrackedBinaries(repoRoot)[0];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "godot-digests-"));
  try {
    const target = stageFixture(scratch);
    fs.copyFileSync(
      path.join(scratch, "libraries/godot-iap", donor),
      path.join(target, "addons/godot-iap/bin/Payload.gdextension"),
    );
    const failures = collectGodotBinaryDigestFailures(scratch);
    assert.ok(
      failures.some((failure) => failure.includes("Payload.gdextension")),
      `expected the disguised binary to be reported, got ${JSON.stringify(failures)}`,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("a missing manifest is reported instead of passing", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "godot-digests-empty-"));
  try {
    assert.deepEqual(collectGodotBinaryDigestFailures(empty), [
      `${DIGEST_MANIFEST} is missing`,
    ]);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
