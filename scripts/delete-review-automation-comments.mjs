#!/usr/bin/env node

// Deletes top-level PR comments that only record review automation activity:
// a review trigger such as `@coderabbitai review @gitdog review`, CodeRabbit's "Action performed"
// replies to it, and CodeRabbit's terminal skipped/unavailable notices. This
// was an inline jq loop inside `.claude/commands/review-pr.md`; prose cannot
// be tested, and an untested deletion filter is a loaded footgun. This can.
// With --hide-reviews it also hides bot reviews that report nothing, which
// GitHub does not let anyone delete.
//
//   node scripts/delete-review-automation-comments.mjs <pr> [--dry-run] [--hide-reviews]
//
// Prints one `deleted <id>` (or `would delete <id>`, `hid <id>`) per match, and exits
// non-zero with a reason if any page is missing or malformed, or a deletion
// fails. A partial sweep must never pass as a complete one.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

const OWNER = "hyodotdev";
const NAME = "openiap";
const PER_PAGE = 100;
// A PR conversation past this many comments is either broken paging or a
// thread a human should look at; stop loudly instead of paging forever.
const MAX_PAGES = 50;

const BOT_LOGIN = "coderabbitai[bot]";
// The current trigger, and the CodeRabbit-only one older PRs still carry.
const TRIGGERS = new Set(["@coderabbitai review @gitdog review", "@coderabbitai review"]);
const INVOCATION_MARKER = "CodeRabbit review command invocation";
// What bot noise looks like ...
const NOISE =
  /review (was )?skipped|review unavailable|unable to review|too many files|file limit|review limit reached/i;
// ... and what must never be deleted.
const SUBSTANCE =
  /analysis chain|script executed|actionable comments posted|walkthrough|<!-- (cr-|fingerprinting)/i;

// Bot reviews that say only that nothing was found or nothing could run.
const EMPTY_REVIEWS = [
  { login: "gitdogbot", body: /^Gitdog (found no supported defects|could not review) / },
  { login: "copilot-pull-request-reviewer", body: /^Copilot was unable to review this pull request / },
];

/** True when the review is a bot's empty result with no inline comments. */
export function isEmptyBotReview(review) {
  if (review?.isMinimized || review?.comments?.totalCount !== 0) return false;
  const body = review?.body;
  if (typeof body !== "string") return false;
  return EMPTY_REVIEWS.some(
    ({ login, body: pattern }) => review.author?.login === login && pattern.test(body),
  );
}

/** True when the comment is review-automation noise with nothing worth keeping. */
export function isAutomationNoise(comment) {
  const body = comment?.body;
  if (typeof body !== "string") return false;
  if (TRIGGERS.has(body)) return true;
  if (comment?.user?.login !== BOT_LOGIN) return false;
  const noise = body.includes(INVOCATION_MARKER) || NOISE.test(body);
  return noise && !SUBSTANCE.test(body);
}

/**
 * Validates one issue-comments page. Every failure throws: a page that cannot
 * be trusted must not be mistaken for the end of the list, and an entry that
 * cannot be read must not be silently skipped.
 */
export function parsePage(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("response was not JSON");
  }
  if (!Array.isArray(payload)) {
    throw new Error(`response was not a comment array: ${payload?.message ?? "unknown"}`);
  }
  for (const comment of payload) {
    if (!comment || typeof comment !== "object") {
      throw new Error("a comment entry is not an object");
    }
    if (typeof comment.id !== "number") {
      throw new Error("a comment has no numeric id");
    }
  }
  return payload;
}

function fetchPage(pr, page) {
  return execFileSync(
    "gh",
    ["api", `repos/${OWNER}/${NAME}/issues/${pr}/comments?per_page=${PER_PAGE}&page=${page}`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

function deleteComment(id) {
  execFileSync("gh", ["api", "-X", "DELETE", `repos/${OWNER}/${NAME}/issues/comments/${id}`], {
    encoding: "utf8",
  });
}

export function listNoise(pr, { fetch = fetchPage } = {}) {
  const matched = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const comments = parsePage(fetch(pr, page));
    matched.push(...comments.filter(isAutomationNoise));
    if (comments.length < PER_PAGE) return matched;
  }
  throw new Error(`still paging after ${MAX_PAGES} pages — refusing a partial sweep`);
}

export function sweep(pr, { dryRun = false, fetch = fetchPage, remove = deleteComment } = {}) {
  const matched = listNoise(pr, { fetch });
  for (const comment of matched) {
    if (!dryRun) {
      try {
        remove(comment.id);
      } catch (error) {
        throw new Error(`deletion of comment ${comment.id} failed: ${error.message}`);
      }
    }
    console.log(`${dryRun ? "would delete" : "deleted"} ${comment.id}`);
  }
  return matched.length;
}

const REVIEWS_QUERY = `query($pr: Int!) {
  repository(owner: "${OWNER}", name: "${NAME}") {
    pullRequest(number: $pr) {
      reviews(first: 100) {
        pageInfo { hasNextPage }
        nodes { id isMinimized body author { login } comments { totalCount } }
      }
    }
  }
}`;

function fetchReviews(pr) {
  const raw = execFileSync(
    "gh",
    ["api", "graphql", "-f", `query=${REVIEWS_QUERY}`, "-F", `pr=${pr}`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const reviews = JSON.parse(raw)?.data?.repository?.pullRequest?.reviews;
  if (!Array.isArray(reviews?.nodes)) throw new Error("review list was missing");
  if (reviews.pageInfo?.hasNextPage) {
    throw new Error("more than 100 reviews — refusing a partial sweep");
  }
  return reviews.nodes;
}

function hideReview(id) {
  execFileSync(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      "query=mutation($id: ID!) { minimizeComment(input: {subjectId: $id, classifier: OUTDATED}) { minimizedComment { isMinimized } } }",
      "-f",
      `id=${id}`,
    ],
    { encoding: "utf8" },
  );
}

export function hideEmptyBotReviews(pr, { dryRun = false, fetch = fetchReviews, hide = hideReview } = {}) {
  const matched = fetch(pr).filter(isEmptyBotReview);
  for (const review of matched) {
    if (!dryRun) {
      try {
        hide(review.id);
      } catch (error) {
        throw new Error(`hiding review ${review.id} failed: ${error.message}`);
      }
    }
    console.log(`${dryRun ? "would hide" : "hid"} ${review.id}`);
  }
  return matched.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const pr = Number(process.argv[2]);
  const dryRun = process.argv.includes("--dry-run");
  if (!Number.isInteger(pr) || pr <= 0) {
    console.error(
      "usage: node scripts/delete-review-automation-comments.mjs <pr> [--dry-run] [--hide-reviews]",
    );
    process.exit(2);
  }
  try {
    sweep(pr, { dryRun });
    if (process.argv.includes("--hide-reviews")) hideEmptyBotReviews(pr, { dryRun });
  } catch (error) {
    console.error(`comment sweep incomplete: ${error.message}`);
    process.exit(1);
  }
}
