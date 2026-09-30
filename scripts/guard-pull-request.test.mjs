import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { opensPullRequest, reason } from "./guard-pull-request.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guard = path.join(root, "scripts/guard-pull-request.mjs");
const shell = (command) =>
  opensPullRequest({ tool_name: "Bash", tool_input: { command } });

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
    "gh pr \\\n  create --fill",
    "GH_TOKEN=$(gh auth token) gh pr create --fill",
    "timeout 120 gh pr create --fill",
    "timeout -s KILL 60 gh pr create --fill",
    'timeout "$T" gh pr create --fill',
    "timeout $TIMEOUT gh pr create",
    "xargs -I{} sh -c 'gh pr create --head {} --fill'",
    "sudo -E bash -c 'gh pr create'",
    "env -i bash -c 'gh pr create --fill'",
    "if gh pr create --fill; then echo opened; fi",
    "until gh pr create --fill; do sleep 5; done",
    "/bin/bash -c 'gh pr create --fill'",
    "bash --login -c 'gh pr create'",
    "gtimeout 60 gh pr create",
    "/usr/bin/env gh pr create --fill",
    "env -u GITHUB_TOKEN gh pr create --fill",
    "env -i gh pr create --fill",
    "sudo -u x gh pr create --fill",
    "xargs -I{} gh pr create --fill",
    "nice -n 10 gh pr create --fill",
    "hub pull-request -m x",
    'gh agent-task create "fix the flaky test"',
    "gh issue edit 12 --add-assignee @copilot",
    'gh agent create "fix the flaky test"',
    'gh agents create "fix the flaky test"',
    "gh issue new -t x -a @copilot",
    "gh issue edit 12 --add-assignee @Copilot",
    "timeout --signal=KILL 60 bash -c 'gh pr create --fill'",
    "timeout -v 60 env -i gh pr create --fill",
    "gh issue create --title x --assignee monalisa,@copilot",
    "bash -o pipefail -c 'gh pr create --fill'",
    "bash -euo pipefail -c 'gh pr create'",
    "eval gh pr create --fill",
    'eval "gh pr create --fill"',
    "fish -c 'gh pr create --fill'",
    'dash -c "gh pr create"',
    "csh -c 'gh pr create --fill'",
    'tcsh -c "gh pr create"',
    "ksh -c 'gh pr create'",
    "sudo -u kshuser gh pr create",
    "sudo -u josh gh pr create",
  ]) {
    assert.equal(shell(command), true, command);
  }
});

test("REST and GraphQL calls that create a pull request or hand work to Copilot need approval", () => {
  for (const command of [
    "gh api repos/hyodotdev/openiap/pulls -f title=x -f head=b -f base=main",
    "gh api -X POST repos/hyodotdev/openiap/pulls --input body.json",
    "curl -X POST https://api.github.com/repos/o/r/pulls -d '{}'",
    "curl -d'{}' https://api.github.com/repos/o/r/pulls",
    'curl -H "Authorization: token $(gh auth token)" -X POST https://api.github.com/repos/o/r/pulls -d @body.json',
    "curl --form title=x https://api.github.com/repos/o/r/pulls",
    "gh api repos/$REPO/pulls -f title=x -f head=b -f base=main",
    'gh api repos/hyodotdev/openiap/pulls -f "title=$T" -f "head=$H" -f "base=main"',
    "gh api repos/o/r/pulls \\\n  -f title=x \\\n  -f head=b -f base=main",
    `curl --json '{"title":"x"}' https://api.github.com/repos/o/r/pulls`,
    "gh api graphql -f query='mutation { createPullRequest(input: {}) { pullRequest { url } } }'",
    "gh api graphql -f query='\n  mutation {\n    createPullRequest(input: {}) { pullRequest { url } }\n  }'",
    "gh api agents/repos/o/r/tasks -F create_pull_request=true",
    "gh api -X POST agents/repos/$REPO/tasks --input task.json",
    "curl -X POST https://api.githubcopilot.com/agents/repos/o/r/tasks -d '{}'",
    "gh api repos/o/r/issues/12/assignees -f 'assignees[]=copilot-swe-agent[bot]'",
    'gh api -X POST repos/$REPO/issues/12/assignees -f "assignees[]=Copilot"',
    "gh api -X PATCH repos/o/r/issues/12 -f 'assignees[]=copilot-swe-agent[bot]'",
    "gh api repos/o/r/issues -f title=x -f 'assignees[]=copilot-swe-agent[bot]'",
    `gh api repos/o/r/issues/12/assignees --field assignees='["copilot-swe-agent[bot]"]'`,
    `curl -X PATCH https://api.github.com/repos/o/r/issues/12 -d '{"assignees":["copilot-swe-agent[bot]"]}'`,
    `curl --json '{"assignees": [ "Copilot" ]}' https://api.github.com/repos/o/r/issues`,
    `curl --json '{"assignees":["monalisa","copilot-swe-agent[bot]"]}' https://api.github.com/repos/o/r/issues/1`,
    `curl -X PATCH https://api.github.com/repos/o/r/issues/12 -d '{"assignees": ["a", "b", "Copilot"]}'`,
    `gh api repos/o/r/issues/12/assignees --field assignees='["monalisa","copilot-swe-agent[bot]"]'`,
    "gh api repos/o/r/issues/12/assignees -f 'assignees[]=monalisa' -f 'assignees[]=copilot-swe-agent[bot]'",
    `gh api graphql -H 'GraphQL-Features: issues_copilot_assignment_api_support,coding_agent_model_selection' -f query='mutation { replaceActorsForAssignable(input: {assignableId: "I_1", actorIds: ["BOT_1"]}) { clientMutationId } }'`,
    `curl -H "GraphQL-Features: issues_copilot_assignment_api_support" -d @mutation.json https://api.github.com/graphql`,
  ]) {
    assert.equal(shell(command), true, command);
  }
});

test("a Copilot assignment whose body or query spans lines needs approval", () => {
  const body = (method, endpoint, json) =>
    String.raw`gh api \
  --method ${method} \
  -H "Accept: application/vnd.github+json" \
  ${endpoint} \
  --input - <<< '${json}'`;
  for (const command of [
    body(
      "POST",
      "/repos/OWNER/REPO/issues/ISSUE_NUMBER/assignees",
      '{\n  "assignees": ["copilot-swe-agent[bot]"],\n  "agent_assignment": {\n    "base_branch": "main"\n  }\n}',
    ),
    body(
      "POST",
      "/repos/OWNER/REPO/issues",
      '{\n  "title": "Issue title",\n  "assignees": ["copilot-swe-agent[bot]"]\n}',
    ),
    body(
      "PATCH",
      "/repos/OWNER/REPO/issues/ISSUE_NUMBER",
      '{\n  "assignees": ["copilot-swe-agent[bot]"]\n}',
    ),
    `curl -X PATCH https://api.github.com/repos/o/r/issues/1 -d @- <<'EOF'\n{\n  "assignees": ["monalisa", "copilot-swe-agent[bot]"]\n}\nEOF`,
    `curl -X PATCH https://api.github.com/repos/o/r/issues/12 -d '{\n"assignees": ["copilot-swe-agent[bot]"]\n}'`,
    `curl --json '{\n  "assignees": ["copilot-swe-agent[bot]"]\n}' https://api.github.com/repos/o/r/issues/12/assignees`,
    `gh api graphql -f query='\n  mutation {\n    replaceActorsForAssignable(input: {assignableId: "I_1", actorIds: ["BOT_1"]}) { clientMutationId }\n  }' \\\n  -H 'GraphQL-Features: issues_copilot_assignment_api_support,coding_agent_model_selection'`,
    `gh api graphql -f query='\nmutation {\n  createIssue(input: {repositoryId: "R_1", title: "x", assigneeIds: ["BOT_1"]}) { issue { id } }\n}' -H 'GraphQL-Features: issues_copilot_assignment_api_support'`,
  ]) {
    assert.equal(shell(command), true, command);
  }
  for (const command of [
    body("PATCH", "/repos/OWNER/REPO/issues/ISSUE_NUMBER", '{\n  "assignees": ["monalisa"]\n}'),
    `gh api graphql -f query='\n  mutation {\n    addReaction(input: {subjectId: "I_1", content: HEART}) { clientMutationId }\n  }'`,
    `gh api repos/o/r/issues/1 --jq '.title'\necho done`,
  ]) {
    assert.equal(shell(command), false, command);
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
    "curl -f https://api.github.com/repos/o/r/pulls",
    'curl -sf "https://api.github.com/repos/o/r/pulls?state=open"',
    "grep -rn createPullRequest src",
    "gh api graphql -f query='mutation { createPullRequestReview(input: {}) { clientMutationId } }'",
    "grep -rn -e 'gh api graphql' -e createPullRequest scripts",
    "git commit -F - <<'EOF'\ndocs: say why `gh pr create` asks first\nEOF",
    'gh pr comment 500 --body "run `gh pr create` only when asked"',
    "GH_TOKEN=$(gh auth token) gh pr view 500",
    "sudo -u x gh pr view 1",
    'git commit -m "fix\n2 gh pr create cases"',
    "env -i gh pr list",
    "if gh pr view 1; then echo open; fi",
    "gh issue edit 12 --add-assignee @me",
    "gh agent-task list",
    "gh api agents/repos/o/r/tasks --paginate",
    "gh api -X GET agents/repos/o/r/tasks/42 -F per_page=1",
    "gh api repos/o/r/issues/12/assignees -f 'assignees[]=monalisa'",
    `curl -X PATCH https://api.github.com/repos/o/r/issues/12 -d '{"assignees":["monalisa"]}'`,
    `gh api repos/o/r/issues --jq '.[] | select(.assignees[].login == "copilot-swe-agent[bot]")'`,
    "gh api repos/o/r/issues/12/comments -f body='ask copilot to look'",
    "gh api repos/o/r/issues/12/assignees -f 'assignees[]=monalisa' -f body=copilot",
    `curl -X PATCH https://api.github.com/repos/o/r/issues/12 -d '{"assignees":["monalisa"],"labels":["copilot"]}'`,
    "gh api graphql -f query='{ viewer { login } }'",
    "grep -rn issues_copilot_assignment_api_support scripts",
    'git commit -m "gh api repos/o/r/pulls -f title=x"',
    'eval "$(ssh-agent -s)"',
  ]) {
    assert.equal(shell(command), false, command);
  }
});

test("a command run through the Monitor tool is read like a Bash command", () => {
  const monitor = (command) =>
    opensPullRequest({ tool_name: "Monitor", tool_input: { command } });
  assert.equal(monitor("gh pr create --fill"), true);
  assert.equal(monitor("until gh pr view 1; do sleep 5; done; gh pr new"), true);
  assert.equal(monitor("gh pr view 500 --json title"), false);
});

test("GitHub MCP tools that create a pull request need approval", () => {
  assert.equal(
    opensPullRequest({ tool_name: "mcp__github__create_pull_request" }),
    true,
  );
  assert.equal(
    opensPullRequest({
      tool_name: "mcp__37f72c69__create_pull_request_with_copilot",
    }),
    true,
  );
  assert.equal(
    opensPullRequest({ tool_name: "mcp__github__assign_copilot_to_issue" }),
    true,
  );
  const issueWrite = (assignees) =>
    opensPullRequest({
      tool_name: "mcp__github__issue_write",
      tool_input: { method: "update", issue_number: 12, assignees },
    });
  assert.equal(issueWrite(["copilot-swe-agent[bot]"]), true);
  assert.equal(
    opensPullRequest({
      tool_name: "mcp__37f72c69__issue_write",
      tool_input: { method: "create", assignees: ["copilot-swe-agent[bot]"] },
    }),
    true,
  );
  assert.equal(issueWrite(["monalisa", "Copilot"]), true);
  assert.equal(issueWrite(["monalisa"]), false);
  assert.equal(issueWrite(undefined), false);
  assert.equal(
    opensPullRequest({ tool_name: "mcp__github__list_pull_requests" }),
    false,
  );
  assert.equal(
    opensPullRequest({ tool_name: "mcp__github__create_pull_request_review" }),
    false,
  );
  assert.equal(
    opensPullRequest({
      tool_name: "Read",
      tool_input: { file_path: "gh pr create" },
    }),
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

// Claude Code reads .claude/settings.json only in the folder a session starts in.
test("every folder with its own .claude/ or CLAUDE.md runs the guard before shell and GitHub MCP tools", () => {
  const tracked = (pathspec) =>
    execFileSync("git", ["ls-files", "--", pathspec], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  const folders = [
    ...new Set([
      ...tracked(":(glob)**/.claude/**").map((file) =>
        file.slice(0, file.indexOf(".claude/")),
      ),
      ...tracked(":(glob)**/CLAUDE.md").map((file) =>
        file.slice(0, file.lastIndexOf("CLAUDE.md")),
      ),
    ]),
  ];
  assert.ok(folders.includes("") && folders.length > 1, folders.join(", "));
  for (const folder of folders) {
    const settingsPath = path.join(root, folder, ".claude/settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const entries = (settings.hooks?.PreToolUse ?? []).filter((entry) =>
      entry.hooks.some((hook) =>
        hook.command.includes("guard-pull-request.mjs"),
      ),
    );
    assert.equal(entries.length, 1, settingsPath);
    const [command] = entries[0].hooks.map((hook) => hook.command);
    const script = /"\$CLAUDE_PROJECT_DIR\/([^"]+)"/u.exec(command)?.[1];
    assert.equal(path.resolve(root, folder, script ?? ""), guard, settingsPath);
    const matcher = new RegExp(`^(?:${entries[0].matcher})$`, "u");
    for (const tool of [
      "Bash",
      "Monitor",
      "mcp__github__create_pull_request",
      "mcp__github__assign_copilot_to_issue",
      "mcp__github__issue_write",
    ]) {
      assert.equal(matcher.test(tool), true, `${settingsPath} ${tool}`);
    }
  }
});

test("long commands are read in linear time", () => {
  const options =
    "--noprofile --norc --verbose --login --posix --restricted --debugger";
  const started = performance.now();
  assert.equal(shell(`bash ${options} x.sh`), false);
  assert.equal(shell(`bash ${options} x.sh; gh pr create --fill`), true);
  assert.ok(
    performance.now() - started < 500,
    "the guard must not backtrack for seconds",
  );
  const heredoc = `git commit -F - <<'EOF'\n${"a line of release notes\n".repeat(20000)}EOF`;
  const heredocStarted = performance.now();
  assert.equal(shell(heredoc), false);
  assert.ok(
    performance.now() - heredocStarted < 500,
    "a long heredoc must not be rescanned per line",
  );
  for (const unit of [
    "$(",
    "\n",
    "sh -a;",
    "a;",
    "$(a)",
    "gh api graphql;",
    "eval '",
  ]) {
    const input = unit.repeat(Math.ceil(40000 / unit.length));
    const unitStarted = performance.now();
    assert.equal(shell(input), false);
    assert.ok(
      performance.now() - unitStarted < 500,
      `${JSON.stringify(unit)} repeated must stay fast`,
    );
  }
  const separators = "a;".repeat(20000);
  const separatorsStarted = performance.now();
  assert.equal(shell(separators), false);
  assert.ok(
    performance.now() - separatorsStarted < 500,
    "each command is scanned only to its end",
  );
  const assignees = `gh${" -a issue -a edit".repeat(400)}`;
  const assigneesStarted = performance.now();
  assert.equal(shell(assignees), false);
  assert.ok(
    performance.now() - assigneesStarted < 500,
    "a long flag list must be read once",
  );
});
