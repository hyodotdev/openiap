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
const substitution = /\$\(([^()]*)\)/gu;
// Shell keywords, `eval "`, assignments, wrappers with their options, a
// timeout's duration, and `sh -c "` before the command word. An option never
// takes a PR client, a wrapper, or a shell as its value, so `env -i gh` and
// `sudo -E bash -c` still reach the command.
// A path or value never runs past a separator, so each command start is
// scanned only to the end of its own command.
const dir = String.raw`(?:[^\s;&|(]*/)?`;
const client = String.raw`${dir}(?:gh|hub|curl)\b`;
const keyword = String.raw`(?:if|elif|while|until|then|do|else)\b`;
const wrapper = String.raw`${dir}(?:command|exec|sudo|env|nice|nohup|time|xargs)\b`;
const timeout = String.raw`${dir}g?timeout\b`;
const shell = String.raw`${dir}(?:ba|da|fi|k|z|t?c)?sh\b`;
const wrapperOption = String.raw`\s+-[\w-]\S*(?:\s+(?!-|${client}|${wrapper}|${timeout}|${shell})\S+)?`;
const commandPrefix = new RegExp(
  String.raw`^(?:[\s({!]+|\w+=[^\s;&|]*\s+|${keyword}\s+|eval\s+["']?|${wrapper}(?:${wrapperOption})*\s+|${timeout}(?:${wrapperOption})*\s+(?!${client}|${wrapper}|${timeout}|${shell})\S+\s+|${shell}(?:${wrapperOption})*?\s+-\w*c\s+["']?)*`,
  "u",
);
// One way to read each option, so a long line cannot backtrack for seconds.
const flags = String.raw`(?:\s+-[\w-][^\s=]*(?:[=\s]+[^\s-]\S*)?)*`;
const ghPrCreate = new RegExp(
  String.raw`^${dir}gh${flags}\s+pr${flags}\s+(?:create|new)\b`,
  "u",
);
const hubPullRequest = /^(?:\S*\/)?hub\s+pull-request\b/u;
// Copilot opens the pull request itself once it has a task or an issue.
const copilotTask = new RegExp(
  String.raw`^${dir}gh${flags}\s+agent(?:s|-tasks?)?${flags}\s+create\b`,
  "u",
);
const issueWrite = new RegExp(
  String.raw`^${dir}gh${flags}\s+issue${flags}\s+(?:create|new|edit)\b`,
  "u",
);
// gh matches @copilot in any case, and the bot login works as well.
// pflag binds a short flag's value without a space, so `-a@copilot` is `-a @copilot`.
const copilotAssignee =
  /\s(?:(?:--add-assignee|--assignee)[=\s]+|-a[=\s]*)["']?[^\s"'=]*copilot\b/iu;
const restClient = /^(?:\S*\/)?(?:gh\s+api|curl)\b/u;
// `repos/$REPO/pulls` names owner and repository in one segment.
const pullsEndpoint = /\brepos\/(?:[^\s/"']+\/){1,2}pulls(?=$|[\s"'?])/u;
// Copilot's task endpoint: a task ends in a pull request Copilot opens.
const agentTasksEndpoint = /\bagents\/repos\/(?:[^\s/"']+\/){1,2}tasks(?=$|[\s"'?])/u;
// REST takes Copilot's bot login, `copilot-swe-agent[bot]`, as an assignee in a
// field (`assignees[]=…`) or a JSON body (`"assignees":["…"]`), after any others.
// A login never holds `[`, `=`, or `:` (a `[bot]` suffix apart), so the skipped
// logins and the opening brackets cannot overlap and the scan stays linear.
const copilotAssigneeField =
  /assignees(?:\[\])?["']?\s*[=:][\s"'\[]*(?:[^\s"',\[\]=:]+(?:\[bot\])?["']?\s*,\s*["']?)*copilot/giu;
// GraphQL assigns Copilot only with this feature header, whichever mutation it uses.
const copilotGraphqlFeature =
  /GraphQL-Features:[^\n"']{0,120}\bissues_copilot_assignment_api_support\b/giu;
// gh api sends POST once it has a field or body, unless -X GET says otherwise;
// curl's -f is --fail, so only a key= field counts.
const writeFlag =
  /(?:-X\s*|--method[=\s]+|--request[=\s]+)POST\b|\s-d\s*\S|\s-[fF]\s*["']?[\w.[\]-]+=|--(?:raw-)?field\b|--data\b|--json\b|--form\b|--input\b/u;
const explicitGet = /(?:-X\s*|--method[=\s]+|--request[=\s]+)GET\b/u;
const graphqlCommand = new RegExp(String.raw`^${dir}gh\s+api\s+graphql\b`, "u");
const createPullRequest = /\bcreatePullRequest\b/gu;
// Assigning Copilot to an issue ends in a pull request Copilot opens; a review
// of an existing pull request does not open one.
const mcpCreate =
  /^mcp__.+__(?:create_pull_request(?!_review)|assign_copilot_to_issue)/u;
// An issue write is held only when it hands the issue to Copilot.
const mcpIssueWrite = /^mcp__.+__issue_write$/u;
const namesCopilot = (assignees) =>
  [assignees ?? []].flat().some((login) => /copilot/iu.test(String(login)));

function lastMatchAt(pattern, text) {
  let last = -1;
  for (const match of text.matchAll(pattern)) last = match.index;
  return last;
}

function opensPullRequestIn(command) {
  // A query or body often spans lines, so a marker anywhere after the command counts.
  const lastCreate = lastMatchAt(createPullRequest, command);
  // Both markers name Copilot, and almost no command does.
  const namesCopilotAnywhere = /copilot/iu.test(command);
  const lastCopilotField = namesCopilotAnywhere
    ? lastMatchAt(copilotAssigneeField, command)
    : -1;
  const lastCopilotFeature = namesCopilotAnywhere
    ? lastMatchAt(copilotGraphqlFeature, command)
    : -1;
  const starts = [
    0,
    ...Array.from(command.matchAll(commandStart), (m) => m.index + m[0].length),
  ];
  return starts.some((start) => {
    const tail = command.slice(start);
    const segment = tail.split(commandStart, 1)[0];
    const words = segment.replace(commandPrefix, "");
    const wordsAt = start + segment.length - words.length;
    return (
      ghPrCreate.test(words) ||
      hubPullRequest.test(words) ||
      copilotTask.test(words) ||
      (issueWrite.test(words) && copilotAssignee.test(words)) ||
      (restClient.test(words) && lastCopilotFeature > wordsAt) ||
      (restClient.test(words) &&
        (pullsEndpoint.test(words) ||
          agentTasksEndpoint.test(words) ||
          lastCopilotField > wordsAt) &&
        writeFlag.test(words) &&
        !explicitGet.test(words)) ||
      (graphqlCommand.test(words) && lastCreate > wordsAt)
    );
  });
}

function shellOpensPullRequest(command) {
  // A backslash at the end of a line continues the command.
  let outer = command.replace(/\\\r?\n/gu, " ");
  // Each $(…) is a command of its own, and the one around it reads on past it.
  const commands = [];
  // Innermost first, one pass per nesting level; deeper ones still split at $(.
  for (let depth = 0; depth < 16; depth++) {
    const collapsed = outer.replace(substitution, (_, inner) => {
      commands.push(inner);
      return "x";
    });
    if (collapsed === outer) break;
    outer = collapsed;
  }
  return [...commands, outer].some(opensPullRequestIn);
}

export function opensPullRequest({
  tool_name: tool = "",
  tool_input: input = {},
}) {
  if (tool === "Bash" || tool === "Monitor")
    return shellOpensPullRequest(String(input.command ?? ""));
  return (
    mcpCreate.test(tool) ||
    (mcpIssueWrite.test(tool) && namesCopilot(input.assignees))
  );
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
