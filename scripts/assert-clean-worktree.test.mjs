import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertCleanWorktree } from "./assert-clean-worktree.mjs";

const runGit = (root, args) =>
  execFileSync("git", args, { cwd: root, stdio: "ignore" });

describe("clean worktree guard", () => {
  let repository;

  beforeEach(() => {
    repository = mkdtempSync(join(tmpdir(), "openiap-clean-worktree-"));
    runGit(repository, ["init"]);
    runGit(repository, ["config", "user.email", "ci@openiap.dev"]);
    runGit(repository, ["config", "user.name", "OpenIAP CI"]);
    writeFileSync(join(repository, "tracked.txt"), "initial\n");
    runGit(repository, ["add", "tracked.txt"]);
    runGit(repository, ["commit", "-m", "test fixture"]);
  });

  afterEach(() => {
    rmSync(repository, { force: true, recursive: true });
  });

  it("accepts a clean checkout", () => {
    assert.doesNotThrow(() => assertCleanWorktree(repository));
  });

  it("rejects tracked and untracked drift", () => {
    writeFileSync(join(repository, "tracked.txt"), "changed\n");
    writeFileSync(join(repository, "untracked.txt"), "new\n");

    assert.throws(
      () => assertCleanWorktree(repository),
      (error) =>
        error instanceof Error &&
        typeof error.status === "string" &&
        error.status.includes("tracked.txt") &&
        error.status.includes("untracked.txt"),
    );
  });
});
