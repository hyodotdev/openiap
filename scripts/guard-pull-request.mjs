#!/usr/bin/env node

// Claude Code PreToolUse hook, wired in .claude/settings.json: opening a pull
// request waits for the maintainer's approval, even in bypass-permissions mode
// (knowledge/internal/06-git-deployment.md#opening-pull-requests).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const reason =
  "Opening a pull request needs your approval. Approve only a PR you asked for (knowledge/internal/06-git-deployment.md#opening-pull-requests).";

// A new command starts after a separator or inside a command substitution.
const commandStart = /\n|;|&&|\|\|?|&|\$\(|`/u;
// Assignments, wrappers, and `sh -c "` that sit before the command word.
const commandPrefix =
  /^(?:[\s({!]+|\w+=\S*\s+|(?:command|exec|sudo|env|nohup|time|xargs|then|do|else)\s+|(?:ba|z)?sh\s+(?:-\w+\s+)*?-\w*c\s+["']?)*/u;
const flags = String.raw`(?:\s+-{1,2}[\w-]+(?:[=\s]+[^\s-]\S*)?)*`;
const ghPrCreate = new RegExp(String.raw`^(?:\S*/)?gh${flags}\s+pr${flags}\s+(?:create|new)\b`, "u");
const hubPullRequest = /^(?:\S*\/)?hub\s+pull-request\b/u;
const restClient = /^(?:\S*\/)?(?:gh\s+api|curl)\b/u;
const pullsEndpoint = /\brepos\/[^\s/"']+\/[^\s/"']+\/pulls(?=$|[\s"'?])/u;
// gh api sends POST once it has a field or body, unless -X GET says otherwise.
const writeFlag =
  /(?:-X\s*|--method[=\s]+|--request[=\s]+)POST\b|\s-[fFd]\s|--(?:raw-)?field\b|--data\b|--input\b/u;
const explicitGet = /(?:-X\s*|--method[=\s]+|--request[=\s]+)GET\b/u;
const graphqlCreate = /\bgh\s+api\s+graphql\b[\s\S]*\bcreatePullRequest\b/u;
const mcpCreate = /^mcp__.+__create_pull_request/u;

function shellOpensPullRequest(command) {
  if (graphqlCreate.test(command)) return true;
  return command.split(commandStart).some((part) => {
    const words = part.replace(commandPrefix, "");
    return (
      ghPrCreate.test(words) ||
      hubPullRequest.test(words) ||
      (restClient.test(words) &&
        pullsEndpoint.test(words) &&
        writeFlag.test(words) &&
        !explicitGet.test(words))
    );
  });
}

export function opensPullRequest({ tool_name: tool = "", tool_input: input = {} }) {
  if (tool === "Bash") return shellOpensPullRequest(String(input.command ?? ""));
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
