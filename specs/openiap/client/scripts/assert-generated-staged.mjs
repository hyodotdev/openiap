import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_DRIFT_PATHS } from "../generated-sync-manifest.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();

const unstaged = git("diff", "--name-only", "--", ...GENERATED_DRIFT_PATHS);
const untracked = git(
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  ...GENERATED_DRIFT_PATHS,
);
const drift = [...new Set([...unstaged.split("\n"), ...untracked.split("\n")])]
  .filter(Boolean)
  .sort();

if (drift.length > 0) {
  throw new Error(
    `Generated or synchronized files changed after canonical generation. Stage these paths and retry:\n${drift.map((path) => `- ${path}`).join("\n")}`,
  );
}
