#!/usr/bin/env node

// npm refuses every command in a workspace whose manifest overrides a package
// it also depends on directly, unless the override repeats the dependency's
// spec or references it as `$name`. bun does not enforce that, so the conflict
// only surfaces when someone runs npm or npx — see #429. CI installs with bun,
// so this audit is what keeps the manifests npm-usable.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

/** Manifests npm may be run from. Nested example apps install on their own. */
function manifestPaths(root) {
  const found = [];
  const push = (relative) => {
    if (fs.existsSync(path.join(root, relative))) found.push(relative);
  };

  push("package.json");
  for (const container of ["packages", "libraries", "specs", "scripts"]) {
    const directory = path.join(root, container);
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      push(path.posix.join(container, entry.name, "package.json"));
    }
  }

  return found;
}

export function auditNpmOverrides(root = repositoryRoot) {
  const violations = [];

  for (const relative of manifestPaths(root)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
    } catch {
      violations.push(`${relative} is not readable JSON`);
      continue;
    }

    const overrides = manifest.overrides;
    if (!overrides || typeof overrides !== "object") continue;

    for (const [name, override] of Object.entries(overrides)) {
      if (typeof override !== "string") continue;

      const direct = DEPENDENCY_FIELDS.map(
        (field) => manifest[field]?.[name],
      ).find((spec) => typeof spec === "string");
      if (direct === undefined) continue;

      // `$name` defers to the direct dependency, which is what keeps the two
      // from drifting; an identical literal is also accepted by npm.
      if (override === `$${name}` || override === direct) continue;

      violations.push(
        `${relative}: override "${name}": "${override}" conflicts with its direct dependency "${direct}" — use "$${name}"`,
      );
    }
  }

  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const violations = auditNpmOverrides();

  if (violations.length === 0) {
    console.log("npm override audit: clean.");
  } else {
    console.error("npm override audit failed:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  }
}
