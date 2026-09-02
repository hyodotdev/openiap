#!/usr/bin/env node

// Schema semver release guard: version labels are unreliable in practice —
// ~1/3 of releases and 20.1% of non-major upgrades ship breaking changes
// (raemaekers2017semver, ochoa2022breakingbad in
// knowledge/research/bibliography.md; backlog item R1). Classifies schema
// changes against a base git ref so a breaking change cannot ship unlabeled.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSchema,
  findBreakingChanges,
  findDangerousChanges,
} from "graphql";
import { SCHEMA_FILE_NAMES } from "../schema-files.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(
  path.dirname(scriptPath),
  "..",
  "..",
  "..",
  "..",
);
const SCHEMA_DIR = "specs/openiap/client/src";
const SCHEMA_PACKAGE_ROOTS = ["specs/openiap/client", "packages/gql"];

function runGit(args, root) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function buildSchemaOrExplain(sdl, label) {
  try {
    return buildSchema(sdl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`could not build the ${label} schema: ${message}`);
  }
}

/** findBreakingChanges walks types, not schema root bindings — compare them. */
function rootTypeChanges(baseSchema, headSchema) {
  const roots = [
    ["query", baseSchema.getQueryType(), headSchema.getQueryType()],
    ["mutation", baseSchema.getMutationType(), headSchema.getMutationType()],
    [
      "subscription",
      baseSchema.getSubscriptionType(),
      headSchema.getSubscriptionType(),
    ],
  ];
  // Adding a root where none existed is additive; only removal or
  // replacement of an existing root breaks operations.
  return roots
    .filter(([, base, head]) => base && base.name !== (head?.name ?? null))
    .map(([operation, base, head]) => ({
      type: "ROOT_TYPE_CHANGED",
      description: `${operation} root changed from ${base.name} to ${head?.name ?? "none"}.`,
    }));
}

export function classifySchemaChange(baseSdl, headSdl) {
  const baseSchema = buildSchemaOrExplain(baseSdl, "base");
  const headSchema = buildSchemaOrExplain(headSdl, "head");
  const baseTypes = new Set(Object.keys(baseSchema.getTypeMap()));

  return {
    breaking: [
      ...rootTypeChanges(baseSchema, headSchema),
      ...findBreakingChanges(baseSchema, headSchema),
    ],
    dangerous: findDangerousChanges(baseSchema, headSchema),
    addedTypes: Object.keys(headSchema.getTypeMap())
      .filter((name) => !name.startsWith("__") && !baseTypes.has(name))
      .sort(),
  };
}

export function readWorkingSdl(root = repositoryRoot) {
  return SCHEMA_FILE_NAMES.map((name) =>
    fs.readFileSync(path.join(root, SCHEMA_DIR, name), "utf8"),
  ).join("\n");
}

/** Schema inventory as it existed at `ref`; falls back to the head list. */
export function parseSchemaFileNames(source) {
  return [...source.matchAll(/'([a-z0-9-]+\.graphql)'/g)].map(
    (match) => match[1],
  );
}

export function selectSchemaSnapshot(readSource) {
  for (const packageRoot of SCHEMA_PACKAGE_ROOTS) {
    try {
      const names = parseSchemaFileNames(
        readSource(`${packageRoot}/schema-files.mjs`),
      );
      if (names.length > 0) {
        return { directory: `${packageRoot}/src`, names };
      }
    } catch {
      // Try the prior canonical location so a directory-move PR is comparable.
    }
  }
  // Refs older than the inventory file keep the SDL under the canonical
  // directory of their time, so pick the first root that still holds it.
  for (const packageRoot of SCHEMA_PACKAGE_ROOTS) {
    const directory = `${packageRoot}/src`;
    const present = SCHEMA_FILE_NAMES.some((name) => {
      try {
        readSource(`${directory}/${name}`);
        return true;
      } catch {
        return false;
      }
    });
    if (present) return { directory, names: SCHEMA_FILE_NAMES };
  }
  return { directory: SCHEMA_DIR, names: SCHEMA_FILE_NAMES };
}

export function readSdlAtRef(ref, root = repositoryRoot) {
  const snapshot = selectSchemaSnapshot((path) =>
    runGit(["show", `${ref}:${path}`], root),
  );
  const parts = snapshot.names.map((name) => {
    try {
      return runGit(["show", `${ref}:${snapshot.directory}/${name}`], root);
    } catch {
      // File absent at the base ref: every type it declares counts as added.
      return "";
    }
  });

  const sdl = parts.join("\n");
  if (sdl.trim() === "") {
    throw new Error(
      `no schema files found at ref "${ref}" — is the ref fetched and spelled correctly?`,
    );
  }
  return sdl;
}

export function resolveBaseRef(requestedRef, root = repositoryRoot) {
  if (requestedRef) {
    try {
      runGit(
        ["rev-parse", "--verify", "--quiet", `${requestedRef}^{commit}`],
        root,
      );
    } catch {
      throw new Error(
        `cannot resolve --base "${requestedRef}" — is the ref fetched and spelled correctly?`,
      );
    }
    // Prefer the merge base so commits landed on the base branch after this
    // branch diverged are not misread as local schema changes.
    try {
      return runGit(["merge-base", "HEAD", requestedRef], root).trim();
    } catch {
      return requestedRef;
    }
  }

  for (const candidate of ["origin/main", "main"]) {
    try {
      runGit(
        ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`],
        root,
      );
    } catch {
      continue;
    }
    // Prefer the merge base so commits landed on main after branching are
    // not misread as local schema changes.
    try {
      return runGit(["merge-base", "HEAD", candidate], root).trim();
    } catch {
      return candidate;
    }
  }

  throw new Error(
    "could not resolve a base ref (tried origin/main, main) — pass --base <ref>",
  );
}

export function formatReport(
  baseRefLabel,
  { breaking, dangerous, addedTypes },
) {
  const lines = [`Schema semver audit vs ${baseRefLabel}`];

  if (
    breaking.length === 0 &&
    dangerous.length === 0 &&
    addedTypes.length === 0
  ) {
    lines.push("  clean — no schema surface change.");
    return lines.join("\n");
  }

  lines.push(
    `  breaking: ${breaking.length} · dangerous: ${dangerous.length} · added types: ${addedTypes.length}`,
  );
  for (const change of breaking) {
    lines.push(`  BREAKING  ${change.type}: ${change.description}`);
  }
  for (const change of dangerous) {
    lines.push(`  dangerous ${change.type}: ${change.description}`);
  }
  if (addedTypes.length > 0) {
    lines.push(`  added     ${addedTypes.join(", ")}`);
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { base: undefined, allowBreaking: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--base requires a git ref value");
      }
      args.base = value;
      i += 1;
    } else if (argv[i] === "--allow-breaking") {
      args.allowBreaking = true;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function main() {
  const { base, allowBreaking } = parseArgs(process.argv.slice(2));
  const baseRef = resolveBaseRef(base);
  const result = classifySchemaChange(readSdlAtRef(baseRef), readWorkingSdl());

  console.log(formatReport(baseRef, result));

  if (result.breaking.length > 0 && !allowBreaking) {
    console.error(
      "\nBreaking schema changes require a major spec release. If this break " +
        "is deliberate and release-planned, re-run with --allow-breaking.",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
