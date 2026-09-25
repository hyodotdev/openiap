import assert from "node:assert/strict";
import test from "node:test";

import {
  isAutomationNoise,
  listNoise,
  parsePage,
  sweep,
} from "./delete-review-automation-comments.mjs";

const comment = (over = {}) => ({
  id: 1,
  body: "hello",
  user: { login: "hyochan" },
  ...over,
});
const bot = (over = {}) =>
  comment({ user: { login: "coderabbitai[bot]" }, ...over });
const page = (comments) => JSON.stringify(comments);

test("the exact trigger is noise", () => {
  assert.equal(isAutomationNoise(comment({ body: "@coderabbitai review" })), true);
});

for (const body of [
  "@coderabbitai review\n",
  "@coderabbitai review please",
  "please @coderabbitai review",
  "@coderabbitai",
  "@coderabbitai full review",
]) {
  test(`a near-trigger is kept: ${JSON.stringify(body)}`, () => {
    assert.equal(isAutomationNoise(comment({ body })), false);
  });
}

test("a bot command invocation reply is noise", () => {
  assert.equal(
    isAutomationNoise(
      bot({ body: "Action performed: review triggered\n<!-- CodeRabbit review command invocation -->" }),
    ),
    true,
  );
});

for (const body of [
  "Review skipped — too many files (file1.ts, file2.ts, ...)",
  "review was skipped because the diff exceeded the file limit",
  "Review unavailable: quota exhausted, unable to review this PR",
  "Review limit reached for this pull request",
]) {
  test(`a terminal bot notice is noise: ${JSON.stringify(body.slice(0, 40))}`, () => {
    assert.equal(isAutomationNoise(bot({ body })), true);
  }
  );
}

for (const [name, body] of [
  ["an invocation reply carrying findings", "CodeRabbit review command invocation\nanalysis chain: ...\nActionable comments posted: 1"],
  ["a reply that ran a script", "CodeRabbit review command invocation\nscript executed successfully"],
  ["a walkthrough", "## Walkthrough\n\n### Review skipped for docs-only files"],
  ["a fingerprinted summary", "<!-- cr-summary -->\n## Summary by CodeRabbit\nAll checks pass."],
  ["a plain bot summary", "## Summary by CodeRabbit\n\nNo actionable feedback."],
]) {
  test(`substantive bot content is kept: ${name}`, () => {
    assert.equal(isAutomationNoise(bot({ body })), false);
  });
}

test("human discussion mentioning the bot is kept", () => {
  assert.equal(
    isAutomationNoise(comment({ body: "@coderabbitai review missed this file, checking manually" })),
    false,
  );
});

test("comments without a string body are kept", () => {
  assert.equal(isAutomationNoise(comment({ body: null })), false);
  assert.equal(isAutomationNoise(comment({ body: undefined })), false);
  assert.equal(isAutomationNoise(null), false);
  assert.equal(isAutomationNoise(bot({ body: undefined })), false);
});

test("a well-formed page parses", () => {
  const comments = parsePage(page([comment()]));
  assert.equal(comments.length, 1);
});

for (const [name, body] of [
  ["a non-JSON body", "not json"],
  ["an errors-only body", JSON.stringify({ message: "Not Found" })],
  ["a null entry", page([null])],
  ["an entry with no id", page([comment({ id: undefined })])],
  ["an entry with a string id", page([comment({ id: "1" })])],
]) {
  test(`${name} is refused, not treated as the end of the list`, () => {
    assert.throws(() => parsePage(body));
  });
}

test("listing collects noise across pages and stops on a short page", () => {
  const trigger = comment({ id: 11, body: "@coderabbitai review" });
  const filler = Array.from({ length: 100 }, (_, index) =>
    comment({ id: 100 + index }),
  );
  const calls = [];
  const fetch = (pr, pageNumber) => {
    calls.push([pr, pageNumber]);
    if (pageNumber === 1) return page([trigger, ...filler.slice(0, 99)]);
    return page([comment({ id: 200, body: "@coderabbitai review" })]);
  };
  const matched = listNoise(488, { fetch });
  assert.deepEqual(
    matched.map((entry) => entry.id),
    [11, 200],
  );
  assert.deepEqual(calls, [
    [488, 1],
    [488, 2],
  ]);
});

test("listing refuses to page forever", () => {
  const full = page(Array.from({ length: 100 }, (_, index) => comment({ id: index })));
  assert.throws(() => listNoise(488, { fetch: () => full }), /partial sweep/);
});

test("a dry-run sweep lists matches without deleting", () => {
  const removed = [];
  const fetch = () => page([comment({ id: 11, body: "@coderabbitai review" }), comment({ id: 12 })]);
  const count = sweep(488, {
    dryRun: true,
    fetch,
    remove: (id) => removed.push(id),
  });
  assert.equal(count, 1);
  assert.deepEqual(removed, []);
});

test("a sweep deletes every match and reports the count", () => {
  const removed = [];
  const fetch = () =>
    page([
      comment({ id: 11, body: "@coderabbitai review" }),
      bot({ id: 12, body: "Review skipped — too many files" }),
      comment({ id: 13 }),
    ]);
  const count = sweep(488, { fetch, remove: (id) => removed.push(id) });
  assert.equal(count, 2);
  assert.deepEqual(removed, [11, 12]);
});

test("a failed deletion names the comment and aborts", () => {
  const fetch = () => page([comment({ id: 11, body: "@coderabbitai review" })]);
  assert.throws(
    () =>
      sweep(488, {
        fetch,
        remove: () => {
          throw new Error("boom");
        },
      }),
    /deletion of comment 11 failed/,
  );
});
