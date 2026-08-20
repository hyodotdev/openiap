import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditGitAddBlocks,
  toLogicalLines,
} from "./audit-release-sync-script.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const HEAD = ["git add \\", "  packages/docs/public/llms.txt \\"];

function orphaned(...between) {
  return [
    ...HEAD,
    "  knowledge/_agent-context/context.md",
    ...between,
    "  knowledge/_claude-context",
  ].join("\n");
}

test("catches the dropped continuation that broke a release", () => {
  const failures = auditGitAddBlocks(orphaned());
  assert.equal(failures.length, 1);
  assert.match(failures[0], /runs as a command/u);
});

test("catches an orphaned path separated by a blank line", () => {
  assert.match(auditGitAddBlocks(orphaned(""))[0], /runs as a command/u);
});

test("catches an orphaned path separated by a comment", () => {
  assert.match(
    auditGitAddBlocks(orphaned("  # agent context symlink"))[0],
    /runs as a command/u,
  );
});

test("treats a backslash followed by a space as the end of the command", () => {
  // `\ ` is an escaped space in bash, not a continuation.
  const source = ["git add \\ ", "  knowledge/_claude-context"].join("\n");
  assert.ok(auditGitAddBlocks(source).length > 0);
});

test("accepts the list once every continuation is intact", () => {
  const source = [
    ...HEAD,
    "  knowledge/_agent-context/context.md \\",
    "  knowledge/_claude-context",
  ].join("\n");
  assert.deepEqual(auditGitAddBlocks(source), []);
});

test("allows running an executable script by path", () => {
  assert.deepEqual(
    auditGitAddBlocks(["./scripts/sync-versions.sh", "git add ."].join("\n")),
    [],
  );
});

test("reports a staged path that no longer exists", () => {
  const source = ["git add \\", "  knowledge/_removed-context/context.md"].join(
    "\n",
  );
  assert.match(auditGitAddBlocks(source)[0], /staged path does not exist/u);
});

test("joins continued lines into one logical command", () => {
  const logical = toLogicalLines(["git add \\", "  a \\", "  b"].join("\n"));
  assert.equal(logical.length, 1);
  assert.deepEqual(logical[0].text.trim().split(/\s+/u), [
    "git",
    "add",
    "a",
    "b",
  ]);
});

test("keeps a token split across a continuation adjacent, as bash does", () => {
  // bash deletes the backslash-newline pair: `llms.tx\<newline>t` is llms.txt.
  const logical = toLogicalLines(
    ["git add packages/docs/public/llms.tx\\", "t"].join("\n"),
  );
  assert.equal(logical.length, 1);
  assert.equal(logical[0].text, "git add packages/docs/public/llms.txt");
  assert.deepEqual(auditGitAddBlocks(logical[0].text), []);
});

test("the committed script passes its own audit", () => {
  const source = readFileSync(
    join(REPO_ROOT, "scripts/sync-release-generated.sh"),
    "utf8",
  );
  assert.deepEqual(auditGitAddBlocks(source), []);
});
