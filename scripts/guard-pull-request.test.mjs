import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { opensPullRequest, reason } from "./guard-pull-request.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guard = path.join(root, "scripts/guard-pull-request.mjs");
const shell = (command) => opensPullRequest({ tool_name: "Bash", tool_input: { command } });

test("gh pr create and gh pr new need approval wherever the command starts", () => {
  for (const command of [
    "gh pr create --title x --body y",
    "gh pr new --fill",
    "cd libraries/expo-iap && gh pr create --base main",
    "PR_URL=$(gh pr create --fill)",
    "gh -R hyodotdev/openiap pr create --fill",
    "gh pr --repo=hyodotdev/openiap create",
    "/opt/homebrew/bin/gh pr create",
    "GH_TOKEN=x gh pr create",
    'bash -lc "gh pr create --fill"',
    "if true; then gh pr create --fill; fi",
    "git push -u origin HEAD\ngh pr create --fill",
    "hub pull-request -m x",
  ]) {
    assert.equal(shell(command), true, command);
  }
});

test("REST and GraphQL calls that create a pull request need approval", () => {
  for (const command of [
    "gh api repos/hyodotdev/openiap/pulls -f title=x -f head=b -f base=main",
    "gh api -X POST repos/hyodotdev/openiap/pulls --input body.json",
    "curl -X POST https://api.github.com/repos/o/r/pulls -d '{}'",
    "gh api graphql -f query='mutation { createPullRequest(input: {}) { pullRequest { url } } }'",
  ]) {
    assert.equal(shell(command), true, command);
  }
});

test("reading, editing, or mentioning pull requests does not", () => {
  for (const command of [
    "gh pr view 500 --json title",
    "gh pr list --search create",
    "gh pr edit 500 --body-file body.md",
    "gh pr checks 500",
    'git grep -n "gh pr create" .claude',
    'git commit -m "document gh pr create"',
    "echo gh pr create",
    "gh api repos/o/r/pulls --paginate",
    "gh api -X GET repos/o/r/pulls -F per_page=100",
    "gh api repos/o/r/pulls/500/comments -f body=x",
    "grep -rn createPullRequest src",
    'git commit -m "gh api repos/o/r/pulls -f title=x"',
  ]) {
    assert.equal(shell(command), false, command);
  }
});

test("GitHub MCP tools that create a pull request need approval", () => {
  assert.equal(opensPullRequest({ tool_name: "mcp__github__create_pull_request" }), true);
  assert.equal(
    opensPullRequest({ tool_name: "mcp__37f72c69__create_pull_request_with_copilot" }),
    true,
  );
  assert.equal(opensPullRequest({ tool_name: "mcp__github__list_pull_requests" }), false);
  assert.equal(
    opensPullRequest({ tool_name: "Read", tool_input: { file_path: "gh pr create" } }),
    false,
  );
});

test("the hook asks for approval and stays silent otherwise", () => {
  const run = (command) =>
    execFileSync("node", [guard], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
      encoding: "utf8",
    });
  assert.deepEqual(JSON.parse(run("gh pr create --fill")), {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    },
  });
  assert.equal(run("gh pr view 500"), "");
});

test("Claude Code runs the guard before shell commands and GitHub MCP tools", () => {
  const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"));
  const entries = settings.hooks.PreToolUse.filter((entry) =>
    entry.hooks.some((hook) => hook.command.includes("scripts/guard-pull-request.mjs")),
  );
  assert.equal(entries.length, 1);
  const matcher = new RegExp(`^(?:${entries[0].matcher})$`, "u");
  assert.equal(matcher.test("Bash"), true);
  assert.equal(matcher.test("mcp__github__create_pull_request"), true);
});
