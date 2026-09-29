#!/usr/bin/env node

// Claude Code PreToolUse hook, wired in .claude/settings.json: opening a pull
// request waits for the maintainer's approval, even in bypass-permissions mode
// (knowledge/internal/06-git-deployment.md#opening-pull-requests).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const reason =
  "Opening a pull request needs your approval. Approve only a PR you asked for (knowledge/internal/06-git-deployment.md#opening-pull-requests).";

// A new command starts after a separator. Backticks are left alone: commit
// messages quote commands in them far more often than agents run them.
const commandStart = /\n|;|&&|\|\|?|&|\$\(/gu;
const substitution = /\$\(([^()]*)\)/u;
// Assignments, wrappers with their options, a timeout's duration, and
// `sh -c "` before the command word. An option never takes a PR client, a
// wrapper, or a shell as its value, so `env -i gh` and `sudo -E bash -c` still
// reach the command.
const client = String.raw`(?:\S*/)?(?:gh|hub|curl)\b`;
const wrapper = String.raw`(?:command|exec|sudo|env|nice|nohup|time|xargs)\b`;
const shell = String.raw`(?:ba|z)?sh\b`;
const wrapperOption = String.raw`\s+-{1,2}[\w-]+\S*(?:\s+(?!-|${client}|${wrapper}|timeout\b|${shell})\S+)?`;
const commandPrefix = new RegExp(
  String.raw`^(?:[\s({!]+|\w+=\S*\s+|(?:${wrapper}|then\b|do\b|else\b)(?:${wrapperOption})*\s+|timeout(?:${wrapperOption})*\s+(?!${client})\S+\s+|${shell}\s+(?:-\w+\s+)*?-\w*c\s+["']?)*`,
  "u",
);
const flags = String.raw`(?:\s+-{1,2}[\w-]+(?:[=\s]+[^\s-]\S*)?)*`;
const ghPrCreate = new RegExp(
  String.raw`^(?:\S*/)?gh${flags}\s+pr${flags}\s+(?:create|new)\b`,
  "u",
);
const hubPullRequest = /^(?:\S*\/)?hub\s+pull-request\b/u;
const restClient = /^(?:\S*\/)?(?:gh\s+api|curl)\b/u;
// `repos/$REPO/pulls` names owner and repository in one segment.
const pullsEndpoint = /\brepos\/(?:[^\s/"']+\/){1,2}pulls(?=$|[\s"'?])/u;
// gh api sends POST once it has a field or body, unless -X GET says otherwise;
// curl's -f is --fail, so only a key= field counts.
const writeFlag =
  /(?:-X\s*|--method[=\s]+|--request[=\s]+)POST\b|\s-d\s*\S|\s-[fF]\s*[\w.[\]-]+=|--(?:raw-)?field\b|--data\b|--json\b|--form\b|--input\b/u;
const explicitGet = /(?:-X\s*|--method[=\s]+|--request[=\s]+)GET\b/u;
const graphqlCreate =
  /^(?:\S*\/)?gh\s+api\s+graphql\b[\s\S]*\bcreatePullRequest\b/u;
// Assigning Copilot to an issue ends in a pull request Copilot opens.
const mcpCreate = /^mcp__.+__(?:create_pull_request|assign_copilot_to_issue)/u;

function opensPullRequestIn(command) {
  const starts = [
    0,
    ...Array.from(command.matchAll(commandStart), (m) => m.index + m[0].length),
  ];
  return starts.some((start) => {
    const rest = command.slice(start).replace(commandPrefix, "");
    const words = rest.split(commandStart)[0];
    return (
      ghPrCreate.test(words) ||
      hubPullRequest.test(words) ||
      (restClient.test(words) &&
        pullsEndpoint.test(words) &&
        writeFlag.test(words) &&
        !explicitGet.test(words)) ||
      // A GraphQL query often spans lines, so it is read to the end.
      graphqlCreate.test(rest)
    );
  });
}

function shellOpensPullRequest(command) {
  // A backslash at the end of a line continues the command.
  let outer = command.replace(/\\\r?\n/gu, " ");
  // Each $(…) is a command of its own, and the one around it reads on past it.
  const commands = [];
  for (
    let found = substitution.exec(outer);
    found;
    found = substitution.exec(outer)
  ) {
    commands.push(found[1]);
    outer = `${outer.slice(0, found.index)}x${outer.slice(found.index + found[0].length)}`;
  }
  return [...commands, outer].some(opensPullRequestIn);
}

export function opensPullRequest({
  tool_name: tool = "",
  tool_input: input = {},
}) {
  if (tool === "Bash")
    return shellOpensPullRequest(String(input.command ?? ""));
  return mcpCreate.test(tool);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && opensPullRequest(JSON.parse(fs.readFileSync(0, "utf8")))) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
}
