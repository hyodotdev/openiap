import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const projectLeadId = 27461460; // @hyochan in MAINTAINERS.md
const publicContractPaths = [
  /^specs\/client\/src\/(?:generated\/|(?:[^/]+\.graphql|capability-matrix\.mjs|purchase-flow\.vectors\.json)$)/,
  /^packages\/conformance\/src\/spec\/(?:behaviors|provider-profile)\.mjs$/,
  /^specs\/commerce-protocol\/(?:schema\/|generated\/|SPEC\.md$|vectors\/signatures\.json$)/,
];

export function needsDesignApproval(files, body) {
  return (
    /^Public contract: changed[ \t]*$/im.test(body ?? "") ||
    files.some((file) =>
      publicContractPaths.some((pattern) => pattern.test(file)),
    )
  );
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

export function verifyDesignApproval({ pull, link, comment, commits }) {
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
  verifyDesignApproval({ pull, link, comment, commits });
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
