#!/usr/bin/env node

// Lists a pull request's review threads, page by page, and refuses to report a
// partial listing as a complete one. This was a jq loop inside
// `.claude/commands/review-pr.md` until four review rounds found four ways for
// it to exit zero while unread threads remained: a failed second fetch, an
// empty `pageInfo`, a null `nodes`, and a malformed entry that `select()`
// quietly dropped. Prose cannot be tested; this can.
//
//   node scripts/list-review-threads.mjs <pr>              unresolved threads
//   node scripts/list-review-threads.mjs <pr> --outdated   unresolved and outdated
//
// Prints one thread per line as `id<TAB>path<TAB>firstCommentDatabaseId`, and
// exits non-zero with a reason if any page is missing or malformed.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

const QUERY = `
query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 1) { nodes { databaseId fullDatabaseId } }
        }
      }
    }
  }
}`;

/**
 * Validates one page and returns it. Every failure throws: a page that cannot
 * be trusted must not be mistaken for the end of the list, and an entry that
 * cannot be read must not be mistaken for a resolved thread.
 */
export function parsePage(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("response was not JSON");
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(`GraphQL error: ${payload.errors[0]?.message ?? "unknown"}`);
  }
  const threads = payload?.data?.repository?.pullRequest?.reviewThreads;
  if (!threads || typeof threads !== "object") {
    throw new Error("response carried no reviewThreads");
  }
  const { nodes, pageInfo } = threads;
  if (!Array.isArray(nodes)) {
    throw new Error("reviewThreads.nodes is not an array");
  }
  if (!pageInfo || typeof pageInfo.hasNextPage !== "boolean") {
    throw new Error("pageInfo.hasNextPage is not a boolean");
  }
  if (pageInfo.hasNextPage) {
    // A truthy non-string cursor (true, 7, {}) would be coerced into the next
    // request instead of being caught here.
    if (typeof pageInfo.endCursor !== "string" || pageInfo.endCursor === "") {
      throw new Error("another page is promised with no usable cursor to reach it");
    }
  }
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      throw new Error("a thread entry is not an object");
    }
    if (typeof node.id !== "string" || node.id === "") {
      throw new Error("a thread has no id");
    }
    if (typeof node.isResolved !== "boolean") {
      throw new Error(`thread ${node.id} has no boolean isResolved`);
    }
    // GitHub declares isOutdated as Boolean! and the query asks for it, so an
    // absent one is a broken response, not a thread that is merely current —
    // exempting it would drop the thread from the --outdated sweep in silence.
    if (typeof node.isOutdated !== "boolean") {
      throw new Error(`thread ${node.id} has no boolean isOutdated`);
    }
    if (typeof node.path !== "string" || node.path === "") {
      throw new Error(`thread ${node.id} has no path`);
    }
  }
  return { nodes, pageInfo };
}

/** Unresolved threads, optionally narrowed to the ones GitHub marks outdated. */
export function selectThreads(nodes, { outdatedOnly = false } = {}) {
  return nodes
    .filter((node) => node.isResolved === false)
    .filter((node) => (outdatedOnly ? node.isOutdated === true : true));
}

/**
 * The id the workflow replies to. `databaseId` is nullable and deprecated, so
 * prefer `fullDatabaseId`, which is a string and loses no precision. Returns
 * null when the thread carries no first comment at all.
 */
export function replyTarget(node) {
  const comment = node.comments?.nodes?.[0];
  if (!comment) return null;
  if (typeof comment.fullDatabaseId === "string" && comment.fullDatabaseId !== "") {
    return comment.fullDatabaseId;
  }
  if (typeof comment.databaseId === "number") return String(comment.databaseId);
  return null;
}

/**
 * Only a thread that will actually be replied to needs a reply target. A
 * resolved thread with no comment id must not abort the listing, and the
 * outdated sweep resolves by thread id without replying at all.
 */
export function requireReplyTargets(threads) {
  for (const node of threads) {
    if (replyTarget(node) === null) {
      throw new Error(`thread ${node.id} has no comment to reply to`);
    }
  }
  return threads;
}

export function formatThread(node) {
  return [node.id, node.path, replyTarget(node) ?? ""].join("\t");
}

function fetchPage(pr, after) {
  return execFileSync(
    "gh",
    [
      "api",
      "graphql",
      "-F",
      "owner=hyodotdev",
      "-F",
      "name=openiap",
      "-F",
      `pr=${pr}`,
      "-F",
      `after=${after ?? "null"}`,
      "-f",
      `query=${QUERY}`,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

export function listThreads(pr, { outdatedOnly = false, fetch = fetchPage } = {}) {
  const collected = [];
  const seen = new Set();
  let after = null;
  for (;;) {
    const { nodes, pageInfo } = parsePage(fetch(pr, after));
    const selected = selectThreads(nodes, { outdatedOnly });
    collected.push(...(outdatedOnly ? selected : requireReplyTargets(selected)));
    if (!pageInfo.hasNextPage) return collected;
    // A cursor that comes back a second time would page forever.
    if (seen.has(pageInfo.endCursor)) {
      throw new Error(`cursor ${pageInfo.endCursor} repeated — paging in a cycle`);
    }
    seen.add(pageInfo.endCursor);
    after = pageInfo.endCursor;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const pr = Number(process.argv[2]);
  const outdatedOnly = process.argv.includes("--outdated");
  if (!Number.isInteger(pr) || pr <= 0) {
    console.error("usage: node scripts/list-review-threads.mjs <pr> [--outdated]");
    process.exit(2);
  }
  try {
    for (const thread of listThreads(pr, { outdatedOnly })) {
      console.log(formatThread(thread));
    }
  } catch (error) {
    console.error(`thread listing incomplete: ${error.message}`);
    console.error("do not call this round clean");
    process.exit(1);
  }
}
