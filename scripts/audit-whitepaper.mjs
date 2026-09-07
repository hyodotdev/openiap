#!/usr/bin/env node

// Freshness audit for the published design-rationale PDF. The PDF is built
// locally, not in CI, so nothing else notices when the source moves ahead of
// it. `scripts/build-whitepaper.sh` records the hash of every file it read and
// of the PDF it produced; this compares those against the working tree.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

const MANIFEST = "scripts/whitepaper.sha256";
const REBUILD = "scripts/build-whitepaper.sh";

/** Everything the PDF is built from. Pinned to the builder by the test. */
export const BUILT_FROM = [
  "specs/commerce-protocol/DESIGN.md",
  "scripts/whitepaper.css",
  "scripts/mermaid.json",
  "scripts/build-whitepaper.sh",
];
export const PUBLISHED_PDF =
  "packages/docs/public/commerce-protocol-rationale.pdf";
export function publishedDiagrams(source) {
  return [
    ...source.matchAll(
      /<!-- commerce-diagram: ([a-z0-9-]+) -->\s*```mermaid\n/g,
    ),
  ].flatMap((match) =>
    ["svg", "mmd"].map(
      (extension) =>
        `packages/docs/public/commerce-diagrams/${match[1]}.${extension}`,
    ),
  );
}
export const PUBLISHED_DIAGRAMS = publishedDiagrams(
  fs.readFileSync(path.join(repositoryRoot, BUILT_FROM[0]), "utf8"),
);
const RECORDED = [...BUILT_FROM, PUBLISHED_PDF, ...PUBLISHED_DIAGRAMS];

/** `<sha256>  <repo-relative path>` per line, as `shasum -a 256` writes it. */
export function parseManifest(source) {
  return source
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = /^([0-9a-f]{64})\s\s(\S.*)$/.exec(line);
      if (!match) throw new Error(`unparsable manifest line: ${line}`);
      return { hash: match[1], file: match[2] };
    });
}

/** Paths the manifest fails to record: a short manifest checks less, silently. */
export function unrecordedFiles(entries, recorded = RECORDED) {
  const present = new Set(entries.map((entry) => entry.file));
  return recorded.filter((file) => !present.has(file));
}

/** Recorded paths the build does not produce — the manifest was hand-edited. */
export function unexpectedFiles(entries, recorded = RECORDED) {
  return entries
    .map((entry) => entry.file)
    .filter((file) => !recorded.includes(file));
}

/** Entries whose file is gone or no longer hashes to the recorded value. */
export function staleEntries(entries, actualHashes) {
  return entries.filter((entry) => actualHashes[entry.file] !== entry.hash);
}

export function auditWhitepaper() {
  const manifestPath = path.join(repositoryRoot, MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    return [`${MANIFEST} is missing — run ${REBUILD}`];
  }

  let entries;
  try {
    entries = parseManifest(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return [`${MANIFEST}: ${error.message}`];
  }

  const errors = [
    ...unrecordedFiles(entries).map(
      (file) => `${MANIFEST} does not record ${file} — run ${REBUILD}`,
    ),
    ...unexpectedFiles(entries).map(
      (file) => `${MANIFEST} records ${file}, which the build does not read`,
    ),
  ];

  const actual = {};
  for (const entry of entries) {
    const full = path.join(repositoryRoot, entry.file);
    if (!fs.existsSync(full)) continue; // absent: drifts below, since no hash
    actual[entry.file] = createHash("sha256")
      .update(fs.readFileSync(full))
      .digest("hex");
  }

  for (const entry of staleEntries(entries, actual)) {
    errors.push(
      entry.file in actual
        ? `${entry.file} changed since the PDF was built — run ${REBUILD}`
        : `${entry.file} is missing — run ${REBUILD}`,
    );
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = auditWhitepaper();
  if (errors.length === 0) {
    console.log("Whitepaper freshness audit: clean.");
  } else {
    console.error("Whitepaper freshness audit failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}
