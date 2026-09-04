#!/usr/bin/env node
// The godot-iap addon ships native frameworks that are committed to the
// repository rather than compiled by CI, so nothing in the release pipeline
// otherwise records or verifies the bytes users execute. This audit pins them.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const GODOT_ROOT = "libraries/godot-iap";
export const DIGEST_MANIFEST = `${GODOT_ROOT}/prebuilt-binaries.sha256`;
const BINARY_ROOT = `${GODOT_ROOT}/addons/godot-iap/bin`;
// Identify payloads by Mach-O magic rather than by extension, so editor
// metadata and future file types classify themselves.
const MACH_O_MAGIC = new Set([
  0xfeedface,
  0xcefaedfe, // 32-bit, both byte orders
  0xfeedfacf,
  0xcffaedfe, // 64-bit, both byte orders
  0xcafebabe,
  0xbebafeca, // universal ("fat") archives
]);

const isMachO = (absolute) => {
  const handle = fs.openSync(absolute, "r");
  try {
    const head = Buffer.alloc(4);
    if (fs.readSync(handle, head, 0, 4, 0) < 4) return false;
    return MACH_O_MAGIC.has(head.readUInt32BE(0));
  } finally {
    fs.closeSync(handle);
  }
};

export function parseDigestManifest(contents) {
  const entries = [];
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([0-9a-f]{64})\s+(\S.*)$/);
    if (!match) {
      entries.push({ malformed: trimmed });
      continue;
    }
    entries.push({ digest: match[1], file: match[2] });
  }
  return entries;
}

const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(next, acc);
    else acc.push(next);
  }
  return acc;
};

export function listTrackedBinaries(repoRoot) {
  const root = path.resolve(repoRoot, BINARY_ROOT);
  return walk(root)
    .filter((file) => isMachO(file))
    .map((file) =>
      path
        .relative(path.resolve(repoRoot, GODOT_ROOT), file)
        .split(path.sep)
        .join("/"),
    )
    .sort();
}

export function digestOf(repoRoot, relativeFile) {
  const absolute = path.resolve(repoRoot, GODOT_ROOT, relativeFile);
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(absolute))
    .digest("hex");
}

export function collectGodotBinaryDigestFailures(repoRoot) {
  const manifestPath = path.resolve(repoRoot, DIGEST_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return [`${DIGEST_MANIFEST} is missing`];
  }
  const failures = [];
  const entries = parseDigestManifest(fs.readFileSync(manifestPath, "utf8"));
  for (const entry of entries) {
    if (entry.malformed) {
      failures.push(
        `${DIGEST_MANIFEST} has a malformed line: ${entry.malformed}`,
      );
    }
  }
  const recorded = new Map(
    entries
      .filter((entry) => entry.digest)
      .map((entry) => [entry.file, entry.digest]),
  );
  const present = listTrackedBinaries(repoRoot);

  // A binary added to the addon without a digest is the case this exists for.
  for (const file of present) {
    if (!recorded.has(file)) {
      failures.push(`${file} ships in the addon but has no recorded digest`);
    }
  }
  for (const [file] of recorded) {
    if (!present.includes(file)) {
      failures.push(
        `${DIGEST_MANIFEST} records ${file}, which no longer exists`,
      );
    }
  }
  for (const file of present) {
    const expected = recorded.get(file);
    if (!expected) continue;
    const actual = digestOf(repoRoot, file);
    if (actual !== expected) {
      failures.push(`${file} changed: recorded ${expected}, found ${actual}`);
    }
  }
  return failures;
}

export function renderDigestManifest(repoRoot, header) {
  const lines = listTrackedBinaries(repoRoot).map(
    (file) => `${digestOf(repoRoot, file)}  ${file}`,
  );
  return `${header.trimEnd()}\n${lines.join("\n")}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const manifestPath = path.resolve(repoRoot, DIGEST_MANIFEST);
  if (process.argv.includes("--write")) {
    const header = fs
      .readFileSync(manifestPath, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("#") || line.trim() === "")
      .join("\n");
    fs.writeFileSync(manifestPath, renderDigestManifest(repoRoot, header));
    console.log(`rewrote ${DIGEST_MANIFEST}`);
    process.exit(0);
  }
  const failures = collectGodotBinaryDigestFailures(repoRoot);
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  if (failures.length > 0) {
    console.error(
      "\nIf the change was intentional, rebuild and run:\n" +
        "  bun run audit:godot-binaries --write",
    );
    process.exit(1);
  }
  console.log(
    `Godot prebuilt binary digests verified (${listTrackedBinaries(repoRoot).length} binaries).`,
  );
}
