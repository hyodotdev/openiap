import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

for (const cursor of [true, 7, {}, [], ""]) {
  test(`a ${JSON.stringify(cursor)} cursor is not a usable next page`, () => {
    assert.throws(
      () => parsePage(page({ pageInfo: { hasNextPage: true, endCursor: cursor }, nodes: [] })),
      /no usable cursor/,
    );
  });
}

test("a repeated cursor is a cycle, not an endless listing", () => {
  const stuck = page({ pageInfo: { hasNextPage: true, endCursor: "c1" }, nodes: [] });
  assert.throws(
    () => listThreads(439, { fetch: () => stuck }),
    /paging in a cycle/,
  );
});

// The CLI's own contract: a library test cannot see process.exit.
const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "list-review-threads.mjs",
);

function runCli(pages, args = ["439"]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thread-cli-"));
  fs.writeFileSync(path.join(dir, "pages.json"), JSON.stringify(pages));
  fs.writeFileSync(
    path.join(dir, "gh"),
    [
      "#!/usr/bin/env node",
      "const fs = require('fs');",
      `const dir = ${JSON.stringify(dir)};`,
      "const pages = JSON.parse(fs.readFileSync(dir + '/pages.json', 'utf8'));",
      "const at = fs.existsSync(dir + '/n') ? Number(fs.readFileSync(dir + '/n', 'utf8')) : 0;",
      "fs.writeFileSync(dir + '/n', String(at + 1));",
      "process.stdout.write(pages[at] ?? pages[pages.length - 1]);",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test("the CLI prints the threads and exits zero when every page reads", () => {
  const result = runCli([page({ pageInfo: last, nodes: [thread({ id: "open" })] })]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "open\ta.md\t11\n");
});

test("the CLI exits non-zero and prints nothing when a later page fails", () => {
  const result = runCli([
    page({ pageInfo: { hasNextPage: true, endCursor: "c1" }, nodes: [thread({ id: "p1" })] }),
    JSON.stringify({ errors: [{ message: "rate limited" }] }),
  ]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /thread listing incomplete: GraphQL error: rate limited/);
  assert.match(result.stderr, /do not call this round clean/);
});

test("the CLI rejects a missing or non-numeric PR", () => {
  const result = runCli([page({ pageInfo: last, nodes: [] })], ["not-a-number"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});
