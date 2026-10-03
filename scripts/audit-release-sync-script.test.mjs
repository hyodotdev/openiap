import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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

test("rejects a staged path that escapes the repository", () => {
  const source = ["git add \\", "  ../../../etc/passwd"].join("\n");
  assert.match(auditGitAddBlocks(source)[0], /escapes the repository/u);
});

test("the committed script passes its own audit", () => {
  const source = readFileSync(
    join(REPO_ROOT, "scripts/sync-release-generated.sh"),
    "utf8",
  );
  assert.deepEqual(auditGitAddBlocks(source), []);
});

test("a Google version bump stages MAUI's regenerated core version", (t) => {
  const scratch = mkdtempSync(join(tmpdir(), "openiap-release-staging-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const stage = toLogicalLines(
    readFileSync(join(REPO_ROOT, "scripts/sync-release-generated.sh"), "utf8"),
  )
    .find((line) => line.text.trim().startsWith("git add "))
    .text.trim()
    .split(/\s+/u)
    .slice(2);
  for (const path of stage) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    writeFileSync(join(scratch, path), "");
  }
  const props =
    "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.props";
  const dependencies = "libraries/maui-iap/src/Directory.Build.props";
  mkdirSync(dirname(join(scratch, dependencies)), { recursive: true });
  for (const path of [props, dependencies, "openiap-versions.json"]) {
    copyFileSync(join(REPO_ROOT, path), join(scratch, path));
  }
  const git = (...args) =>
    execFileSync("git", args, { cwd: scratch, encoding: "utf8" });
  git("init", "-q");
  git("add", ".");
  const baseline = git("write-tree").trim();
  const versions = JSON.parse(
    readFileSync(join(scratch, "openiap-versions.json"), "utf8"),
  );
  versions.google = "4.0.0";
  writeFileSync(
    join(scratch, "openiap-versions.json"),
    JSON.stringify(versions),
  );
  const sync = readFileSync(
    join(REPO_ROOT, "scripts/sync-versions.sh"),
    "utf8",
  );
  const marker = `    python3 - "$maui_props" "$maui_store_props"`;
  const start = sync.indexOf("\n", sync.indexOf(marker)) + 1;
  const end = sync.indexOf("\nPY\n", start);
  assert.ok(start > 0 && end > start);
  execFileSync(
    "python3",
    ["-", dependencies, props, "8.3.0", "3.0.8", "8.1.2", "66.0.0", "2.14.0"],
    {
      cwd: scratch,
      input: sync.slice(start, end),
    },
  );
  git("add", ...stage);
  assert.ok(
    git("diff", "--cached", baseline, "--name-only")
      .trim()
      .split("\n")
      .includes(props),
  );
  assert.match(
    git("show", `:${props}`),
    /<MauiOpenIapCoreVersion>4\.0\.0<\/MauiOpenIapCoreVersion>/u,
  );
  assert.equal(git("diff", "--name-only", "--", props).trim(), "");
});
