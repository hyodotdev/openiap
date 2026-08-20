#!/usr/bin/env node
// Read-only impact query over the fact graph: given a fact key, report every
// file that declares it, every declaration derived from it, and the CI jobs
// that run when those files change. Sources are the fact registry
// (scripts/facts.mjs) and the path-filter model that audit-ci-path-filters
// already proves against CI — this tool writes nothing and asserts nothing.
//
//   bun run graph:impact godot.version
//   bun run graph:impact --list

import { fileURLToPath } from "node:url";

import { FACTS, DERIVED } from "./facts.mjs";
import { scanFact, readRepoFile } from "./audit-facts.mjs";
import { selectJobs } from "./audit-ci-path-filters.mjs";

export function impact(key, readFile = readRepoFile) {
  const fact = FACTS.find((entry) => entry.key === key);
  if (!fact) return null;

  const { occurrences } = scanFact(fact, readFile);

  const derived = DERIVED.filter((entry) => entry.from.fact === key).map(
    (entry) => ({
      key: entry.key,
      file: entry.file,
      value: entry.derive(fact.values[entry.from.value]),
    }),
  );

  const files = [
    ...new Set([
      ...occurrences.map((entry) => entry.file),
      ...derived.map((entry) => entry.file),
    ]),
  ].sort();

  return { fact, occurrences, derived, files, jobs: selectJobs(files) };
}

function render(result) {
  const { fact, occurrences, derived, files, jobs } = result;
  const roles = Object.entries(fact.values)
    .map(([role, value]) => `${role}=${value}`)
    .join(", ");
  const lines = [`${fact.key} (${roles})`, "", "Declarations:"];

  const byFile = new Map();
  for (const entry of occurrences) {
    if (!byFile.has(entry.file)) byFile.set(entry.file, []);
    byFile.get(entry.file).push(`${entry.line}:${entry.value}`);
  }
  for (const [file, hits] of [...byFile].sort()) {
    lines.push(`  ${file}  (${hits.join(", ")})`);
  }

  if (derived.length) {
    lines.push("", "Derived:");
    for (const entry of derived) {
      lines.push(`  ${entry.file}  -> "${entry.value}" (${entry.key})`);
    }
  }

  lines.push(
    "",
    `Bump checklist: edit scripts/facts.mjs, then every file above (${files.length}), then run:`,
    "  bun run audit:facts",
    "",
    `CI jobs that run on these files (${jobs.length}):`,
  );
  for (const job of jobs) lines.push(`  ${job}`);
  return lines.join("\n");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const key = process.argv[2];

  if (!key || key === "--list") {
    console.log("Facts:");
    for (const fact of FACTS) {
      const roles = Object.entries(fact.values)
        .map(([role, value]) => `${role}=${value}`)
        .join(", ");
      console.log(`  ${fact.key}  (${roles})`);
    }
    process.exit(key ? 0 : 1);
  }

  const result = impact(key);
  if (!result) {
    console.error(`Unknown fact: ${key}`);
    console.error(`Known: ${FACTS.map((entry) => entry.key).join(", ")}`);
    process.exit(1);
  }
  console.log(render(result));
}
