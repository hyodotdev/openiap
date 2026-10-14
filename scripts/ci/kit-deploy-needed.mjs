#!/usr/bin/env bun
// Prints whether kit must redeploy for the commits in BASE..HEAD. Anything it
// cannot prove unchanged counts as a change, so an error prints `true`.
//
//   bun scripts/ci/kit-deploy-needed.mjs <base> [head]

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { workspaceClosure } from "../bun-dependency-snapshot.mjs";

// What the kit image builds from (packages/kit/Dockerfile) and how it deploys.
const KIT_PATHS = [
  "packages/kit/",
  "packages/mcp-server/",
  "specs/commerce-protocol/",
  "specs/client/src/kit-api.ts",
  "specs/client/package.json",
  ".github/workflows/deploy-kit.yml",
];

// Root manifest keys whose effect is already in the lock, or that no build reads.
const LOCKED_OR_UNUSED_KEYS = [
  "scripts",
  "dependencies",
  "devDependencies",
  "overrides",
];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function rootManifest(revision) {
  const manifest = JSON.parse(git("show", `${revision}:package.json`));
  for (const key of LOCKED_OR_UNUSED_KEYS) delete manifest[key];
  return JSON.stringify(manifest);
}

function kitClosure(revision) {
  const lock = Bun.JSONC.parse(git("show", `${revision}:bun.lock`));
  return workspaceClosure(lock, "packages/kit").join("\n");
}

export function kitDeployNeeded(base, head = "HEAD") {
  const changed = git("diff", "--name-only", base, head)
    .split("\n")
    .filter(Boolean);
  return (
    changed.some((file) =>
      KIT_PATHS.some((path) =>
        path.endsWith("/") ? file.startsWith(path) : file === path,
      ),
    ) ||
    (changed.includes("package.json") &&
      rootManifest(base) !== rootManifest(head)) ||
    (changed.includes("bun.lock") && kitClosure(base) !== kitClosure(head))
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head] = process.argv.slice(2);
  try {
    if (!base) throw new Error("missing base revision");
    console.log(kitDeployNeeded(base, head));
  } catch (error) {
    console.error(`::warning::Deploying kit: ${error.message}`);
    console.log(true);
  }
}
