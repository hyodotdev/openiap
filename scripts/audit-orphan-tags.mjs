#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Tags intentionally kept without a GitHub Release. A failed publish can
// leave a tag behind that pods or archives still reference as a source;
// deleting it breaks those pins. Add an entry here instead of recreating
// the version when a publish fails after the tag is pushed.
export const KNOWN_ORPHAN_TAGS = [
  {
    tag: "3.5.0",
    reason:
      "openiap-apple 3.5.0 trunk preflight failed; the tag stays as the pod source",
  },
];

export function findMissingOrphans(remoteTags, pinned = KNOWN_ORPHAN_TAGS) {
  const present = new Set(remoteTags);
  return pinned.filter(({ tag }) => !present.has(tag));
}

function readRemoteTags() {
  const output = execFileSync("git", ["ls-remote", "--tags", "origin"], {
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.split("\t")[1] ?? "")
    .filter((ref) => ref.startsWith("refs/tags/") && !ref.endsWith("^{}"))
    .map((ref) => ref.slice("refs/tags/".length));
}

function main() {
  const missing = findMissingOrphans(readRemoteTags());
  if (missing.length > 0) {
    const details = missing
      .map(({ tag, reason }) => `${tag} (${reason})`)
      .join(", ");
    throw new Error(`Known orphan tags were deleted from origin: ${details}`);
  }
  console.log(
    `Orphan tag audit: ${KNOWN_ORPHAN_TAGS.length} pinned tag(s) present on origin.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
