#!/usr/bin/env node
// Enforce the declared-fact registry in scripts/facts.mjs: every occurrence a
// scanner finds must be one of the fact's declared values, and every declared
// value must still occur — a bumped fact with stale occurrences fails, and so
// does a dead declaration. See knowledge/internal/08-fact-graph.md.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FACTS, DERIVED } from "./facts.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const WORKFLOW_GLOB = "/*.{yml,yaml}";

function listRepoDir(dir) {
  return readdirSync(join(REPO_ROOT, dir));
}

export function expandFiles(specs, listDir = listRepoDir) {
  const files = [];
  for (const spec of specs) {
    if (!spec.endsWith(WORKFLOW_GLOB)) {
      files.push(spec);
      continue;
    }
    const dir = spec.slice(0, -WORKFLOW_GLOB.length);
    for (const entry of listDir(dir)) {
      if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
        files.push(`${dir}/${entry}`);
      }
    }
  }
  return files;
}

// Every occurrence of a fact's shape, as {file, line, value} — shared by the
// audit and the impact query so they can never disagree about what exists.
export function scanFact(fact, readFile) {
  const occurrences = [];
  const missing = [];
  for (const scanner of fact.scanners) {
    for (const file of expandFiles(scanner.files)) {
      const text = readFile(file);
      if (text === null) {
        missing.push(file);
        continue;
      }
      for (const match of text.matchAll(scanner.pattern)) {
        occurrences.push({
          file,
          line: text.slice(0, match.index).split("\n").length,
          value: match[1],
          // A scanner may claim one role, so an occurrence can be checked
          // against that role rather than against the whole allowed set.
          role: scanner.role,
        });
      }
    }
  }
  return { occurrences, missing };
}

export function auditFacts(readFile) {
  const failures = [];

  for (const fact of FACTS) {
    const allowed = new Map(
      Object.entries(fact.values).map(([role, value]) => [value, role]),
    );
    const seen = new Set();

    const { occurrences, missing } = scanFact(fact, readFile);
    for (const file of missing) {
      failures.push(`${fact.key}: scanned file is missing: ${file}`);
    }
    for (const { file, line, value, role } of occurrences) {
      if (!allowed.has(value)) {
        failures.push(
          `${fact.key}: ${file}:${line} declares "${value}" but the ` +
            `registry allows ${JSON.stringify(fact.values)}`,
        );
      } else if (role !== undefined && fact.values[role] !== value) {
        // Without this, two roles could swap files and still pass: both
        // values are allowed and both are still seen somewhere.
        failures.push(
          `${fact.key}: ${file}:${line} declares "${value}" but that site ` +
            `carries the ${role} role, which is "${fact.values[role]}"`,
        );
      }
      seen.add(value);
    }

    for (const [value, role] of allowed) {
      if (!seen.has(value)) {
        failures.push(
          `${fact.key}: declared ${role}="${value}" no longer occurs anywhere — ` +
            `update or remove it from scripts/facts.mjs`,
        );
      }
    }
  }

  for (const relation of DERIVED) {
    const fact = FACTS.find((entry) => entry.key === relation.from.fact);
    const expected = relation.derive(fact.values[relation.from.value]);
    const text = readFile(relation.file);
    if (text === null) {
      failures.push(`${relation.key}: file is missing: ${relation.file}`);
      continue;
    }
    const match = relation.pattern.exec(text);
    if (!match) {
      failures.push(
        `${relation.key}: ${relation.file} does not match ${relation.pattern}`,
      );
    } else if (match[1] !== expected) {
      failures.push(
        `${relation.key}: ${relation.file} declares "${match[1]}" but ` +
          `${relation.from.fact}.${relation.from.value} derives "${expected}"`,
      );
    }
  }

  return failures;
}

export function readRepoFile(file) {
  try {
    return readFileSync(join(REPO_ROOT, file), "utf8");
  } catch {
    return null;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = auditFacts(readRepoFile);
  if (failures.length) {
    console.error("Declared-fact audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Declared-fact audit passed (${FACTS.length} facts, ${DERIVED.length} derived).`,
  );
}
