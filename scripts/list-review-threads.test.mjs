import assert from "node:assert/strict";
import test from "node:test";

import {
  formatThread,
  listThreads,
  parsePage,
  selectThreads,
} from "./list-review-threads.mjs";

const page = (threads) => JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: threads } } } });
const thread = (over = {}) => ({
  id: "PRRT_1",
  isResolved: false,
  isOutdated: false,
  path: "a.md",
  comments: { nodes: [{ databaseId: 11 }] },
  ...over,
});
const last = { hasNextPage: false, endCursor: null };

test("a well-formed page parses", () => {
  const { nodes, pageInfo } = parsePage(
    page({ pageInfo: last, nodes: [thread()] }),
  );
  assert.equal(nodes.length, 1);
  assert.equal(pageInfo.hasNextPage, false);
});

// Each of these exited zero in the shell loop this script replaces.
for (const [name, body] of [
  ["a non-JSON body", "not json"],
  ["an errors-only body", JSON.stringify({ errors: [{ message: "boom" }] })],
  ["a missing reviewThreads", JSON.stringify({ data: { repository: { pullRequest: {} } } })],
  ["an empty pageInfo", page({ pageInfo: {}, nodes: [] })],
  ["a null nodes", page({ pageInfo: last, nodes: null })],
  ["a null entry", page({ pageInfo: last, nodes: [null] })],
  ["an entry with no id", page({ pageInfo: last, nodes: [thread({ id: undefined })] })],
  ["a missing isResolved", page({ pageInfo: last, nodes: [thread({ isResolved: undefined })] })],
  ["a string isResolved", page({ pageInfo: last, nodes: [thread({ isResolved: "false" })] })],
  ["a string isOutdated", page({ pageInfo: last, nodes: [thread({ isOutdated: "true" })] })],
  ["a next page with no cursor", page({ pageInfo: { hasNextPage: true, endCursor: null }, nodes: [] })],
]) {
  test(`${name} is refused, not treated as the end of the list`, () => {
    assert.throws(() => parsePage(body));
  });
}

test("selection keeps unresolved threads and can narrow to outdated ones", () => {
  const nodes = [
    thread({ id: "open" }),
    thread({ id: "done", isResolved: true }),
    thread({ id: "stale", isOutdated: true }),
  ];
  assert.deepEqual(
    selectThreads(nodes).map((n) => n.id),
    ["open", "stale"],
  );
  assert.deepEqual(
    selectThreads(nodes, { outdatedOnly: true }).map((n) => n.id),
    ["stale"],
  );
});

test("a thread renders as id, path and first comment id", () => {
  assert.equal(formatThread(thread()), "PRRT_1\ta.md\t11");
  assert.equal(
    formatThread(thread({ path: undefined, comments: { nodes: [] } })),
    "PRRT_1\t\t",
  );
});

test("every page is read before the listing is reported", () => {
  const pages = [
    page({ pageInfo: { hasNextPage: true, endCursor: "c1" }, nodes: [thread({ id: "p1" })] }),
    page({ pageInfo: { hasNextPage: true, endCursor: "c2" }, nodes: [thread({ id: "p2", isResolved: true })] }),
    page({ pageInfo: last, nodes: [thread({ id: "p3" })] }),
  ];
  const seen = [];
  const found = listThreads(439, {
    fetch: (_pr, after) => {
      seen.push(after);
      return pages.shift();
    },
  });
  assert.deepEqual(seen, [null, "c1", "c2"]);
  assert.deepEqual(found.map((n) => n.id), ["p1", "p3"]);
});

test("a failure on a later page fails the whole listing", () => {
  const pages = [
    page({ pageInfo: { hasNextPage: true, endCursor: "c1" }, nodes: [thread({ id: "p1" })] }),
    JSON.stringify({ errors: [{ message: "rate limited" }] }),
  ];
  assert.throws(
    () => listThreads(439, { fetch: () => pages.shift() }),
    /rate limited/,
  );
});
