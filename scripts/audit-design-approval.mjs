import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { shipsInAnyPackage } from "./release-branch-policy.mjs";

const projectLeadId = 27461460; // @hyochan in MAINTAINERS.md
const publicContractPaths = [
  /^specs\/(?:client|commerce-protocol)\/compatibility\.json$/,
  /^specs\/client\/src\/(?:generated\/|(?:[^/]+\.graphql|capability-matrix\.mjs|kit-api\.ts|purchase-flow(?:-core|-confirmers)?\.ts|purchase-flow\.vectors\.json)$)/,
  /^packages\/conformance\/src\/spec\/(?:behaviors|provider-profile)\.mjs$/,
  /^specs\/commerce-protocol\/(?:schema\/|generated\/|SPEC\.md$|vectors\/|(?:src|conformance)\/index\.(?:mjs|d\.ts)$)/,
];

export function needsDesignApproval(files, body) {
  const fields = (body ?? "").match(/^Public contract:[^\r\n]*/gm) ?? [];
  const impact = fields[0]?.slice("Public contract:".length).trim();
  if (
    fields.length > 1 ||
    (fields.length && !["changed", "unchanged"].includes(impact))
  ) {
    throw new Error(
      "Use a single Public contract: changed or Public contract: unchanged line.",
    );
  }
  const authored = files.some((file) =>
    publicContractPaths.some((pattern) => pattern.test(file)),
  );
  if (authored && impact === "unchanged") {
    throw new Error(
      "This PR edits a public contract source and needs design approval.",
    );
  }
  if (!authored && !impact && files.some(shipsInAnyPackage)) {
    throw new Error(
      "Classify the shipped changes as Public contract: changed or Public contract: unchanged in the PR body.",
    );
  }
  return authored || impact === "changed";
}

export function approvalLink(body, repository) {
  const fields = (body ?? "").match(/^Design approval:[^\r\n]*/gm) ?? [];
  if (fields.length !== 1)
    throw new Error("Add one Design approval link to the PR body.");
  const url = fields[0].slice("Design approval:".length).trim();
  const prefix = `https://github.com/${repository}/issues/`;
  const reference =
    url.startsWith(prefix) &&
    /^(\d+)#issuecomment-(\d+)$/.exec(url.slice(prefix.length));
  if (!reference)
    throw new Error(
      "Design approval must link to a comment on a proposal issue in this repository.",
    );
  return { url, comment: reference[2] };
}

function approvalFields(details, field) {
  const prefix = `${field}:`;
  const values = details
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
  if (
    !values.length ||
    values.some(
      (value) => !value || /^(?:tbd|todo|pending|n\/?a)[.!]?$/i.test(value),
    )
  ) {
    throw new Error(`The approval must include concrete ${field}: evidence.`);
  }
  return values;
}

function verifyApprovedScope(details, files, readTest) {
  approvalFields(details, "Design");
  approvalFields(details, "Acceptance");
  const approvedPaths = approvalFields(details, "Contract");
  const authored = files.filter((file) =>
    publicContractPaths.some((pattern) => pattern.test(file)),
  );
  const source = authored.filter((file) => !/\/generated\//.test(file));
  const required = source.length ? source : authored;
  if (
    approvedPaths.some((path) => !files.includes(path)) ||
    required.some((path) => !approvedPaths.includes(path))
  ) {
    throw new Error(
      "The approved Contract: paths must cover the changed public sources.",
    );
  }

  for (const value of approvalFields(details, "Verification")) {
    const [, path, test] = /^([\w./-]+)#(.+)$/.exec(value) ?? [];
    if (
      !path ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      !/(?:^|\/)(?:__tests__|[Tt]ests?)\/|\.(?:test|spec)\.[^/]+$|Tests?\.(?:swift|kt|cs)$/.test(
        path,
      )
    ) {
      throw new Error(
        "Verification: must use a repository test path followed by # and its test name.",
      );
    }
    const source = readTest(path);
    const quoted = test.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const testCall = `(?:it|test)\\(\\s*(["'])${quoted}\\1\\s*,`;
    const modifier =
      "(?:@[\\w.]+(?:\\([^\\r\\n)]*\\))?|\\[[^\\]\\r\\n]+\\]|public|private|internal|protected|fileprivate|final|open|override|virtual|sealed|static|async|unsafe)";
    const nativeMethod = `(?:${modifier}[ \\t]+)*(?:func|fun|void|Task|ValueTask)[ \\t]+(?:${quoted}|\\x60${quoted}\\x60)[ \\t]*\\(`;
    const declaration = new RegExp(
      `^[ \\t]*(?:${testCall}|${nativeMethod})`,
      "m",
    );
    if (!source || !declaration.test(source)) {
      throw new Error(`Approved verification test was not found: ${value}`);
    }
  }
}

export function verifyDesignApproval({
  pull,
  link,
  comment,
  commits,
  files,
  readTest,
}) {
  if (comment.html_url !== link.url || comment.user?.id !== projectLeadId) {
    throw new Error(
      "The linked issue comment must be written by the project lead.",
    );
  }
  const [decision, ...details] = (comment.body ?? "").trim().split(/\r?\n/);
  const branch = `${pull.head.repo.full_name}:${pull.head.ref}`;
  const target = `${pull.base.repo.full_name}:${pull.base.ref}`;
  const scope = `${branch} into ${target}`;
  if (
    decision !== `Approved public contract design for ${scope}` ||
    !details.join("\n").trim()
  ) {
    throw new Error(
      `Approval must name ${scope} and record the concrete design decision.`,
    );
  }
  verifyApprovedScope(details, files, readTest);
  const approvedAt = Date.parse(comment.created_at);
  if (
    !Number.isFinite(approvedAt) ||
    approvedAt !== Date.parse(comment.updated_at)
  ) {
    throw new Error(
      "Link an unedited approval comment so its original timestamp is verifiable.",
    );
  }
  if (
    !commits.length ||
    commits.length !== pull.commits ||
    !commits.some(({ sha }) => sha === pull.head.sha)
  ) {
    throw new Error(
      "Could not verify the complete commit list for this PR head.",
    );
  }
  const dates = [
    pull.created_at,
    ...commits.flatMap(({ commit }) => [
      commit?.author?.date,
      commit?.committer?.date,
    ]),
  ];
  if (!dates.every((date) => Date.parse(date) > approvedAt)) {
    throw new Error(
      "The design approval must predate the PR and every implementation commit (author and committer dates).",
    );
  }
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repo = event.repository.full_name;
  const number = event.pull_request.number;
  const api = (...args) =>
    JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
  const pullPath = `repos/${repo}/pulls/${number}`;
  const pull = api(pullPath);
  const { base, head } = event.pull_request;
  const parents = execFileSync("git", ["show", "-s", "--format=%P", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (parents !== `${base.sha} ${head.sha}` || pull.head.sha !== head.sha) {
    throw new Error("The checkout must be the merge of this PR head and base.");
  }
  const files = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", base.sha, "HEAD"],
    { encoding: "utf8" },
  ).split("\0");
  if (!needsDesignApproval(files, pull.body)) {
    console.log(
      "No authored contract changes or declared public contract change.",
    );
    return;
  }

  const link = approvalLink(pull.body, repo);
  const comment = api(`repos/${repo}/issues/comments/${link.comment}`);
  const commits = api(
    `${pullPath}/commits?per_page=100`,
    "--paginate",
    "--slurp",
  ).flat();
  const readTest = (path) => {
    try {
      return execFileSync("git", ["show", `HEAD:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return undefined;
    }
  };
  verifyDesignApproval({ pull, link, comment, commits, files, readTest });
  console.log(`Design approval verified for PR #${number}: ${link.url}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
