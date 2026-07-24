#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const collectWorktreeStatus = (root = repositoryRoot) =>
  execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  }).trim();

export const assertCleanWorktree = (root = repositoryRoot) => {
  const status = collectWorktreeStatus(root);
  if (status) {
    const error = new Error(
      "Generated synchronization changed the checked-out worktree.",
    );
    error.status = status;
    throw error;
  }
};

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    assertCleanWorktree();
  } catch (error) {
    console.error(
      "::error::Generated files differ from their checked-in copies.",
    );
    console.error(
      "Run the corresponding generator locally and commit every reported path.",
    );
    if (error && typeof error === "object" && "status" in error) {
      console.error("\nUntracked or modified paths:");
      console.error(error.status);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
