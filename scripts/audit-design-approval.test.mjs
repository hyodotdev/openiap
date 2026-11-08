import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approvalLink,
  needsDesignApproval,
  verifyDesignApproval,
} from "./audit-design-approval.mjs";

const repository = "hyodotdev/openiap";
const url = `https://github.com/${repository}/issues/123#issuecomment-456`;
const link = approvalLink(`Design approval: ${url}`, repository);
const before = "2026-10-01T08:00:00Z";
const after = "2026-10-01T09:00:00Z";

function fixture() {
  return {
    pull: {
      head: {
        sha: "head",
        repo: { full_name: "contributor/openiap" },
        ref: "feature",
      },
      base: { repo: { full_name: repository }, ref: "main" },
      created_at: after,
      commits: 1,
    },
    link,
    comment: {
      html_url: url,
      user: { id: 27461460 },
      body: "Approved public contract design for contributor/openiap:feature into hyodotdev/openiap:main\n\nDocument the changed error and migration.",
      created_at: before,
      updated_at: before,
    },
    commits: [
      {
        sha: "head",
        commit: { author: { date: after }, committer: { date: after } },
      },
    ],
  };
}

test("authored contract paths and declared runtime changes require approval", () => {
  for (const file of [
    "specs/client/src/type.graphql",
    "specs/client/src/capability-matrix.mjs",
    "specs/client/src/generated/types.ts",
    "packages/conformance/src/spec/provider-profile.mjs",
    "specs/commerce-protocol/generated/bindings/http-binding.json",
    "specs/client/src/purchase-flow.vectors.json",
    "packages/conformance/src/spec/behaviors.mjs",
    "specs/commerce-protocol/SPEC.md",
    "specs/commerce-protocol/schema/02-commerce-event.graphql",
    "specs/commerce-protocol/vectors/signatures.json",
  ])
    assert.equal(needsDesignApproval([file], ""), true, file);
  assert.equal(
    needsDesignApproval(
      ["packages/kit/server/handler.ts"],
      "Public contract: changed",
    ),
    true,
  );
  assert.equal(
    needsDesignApproval(["specs/commerce-protocol/test/vectors.test.mjs"], ""),
    false,
  );
});

test("requires a single same-repository issue comment URL", () => {
  assert.deepEqual(link, { url, comment: "456" });
  for (const body of [
    "",
    `Design approval: ${url}\nDesign approval: ${url}`,
    `Design approval: ${url.replace("/issues/", "/pull/")}`,
    `Design approval: ${url.replace("hyodotdev", "someone-else")}`,
  ]) {
    assert.throws(() => approvalLink(body, repository));
  }
});

test("accepts an explicit unedited approval for this branch before implementation", () => {
  assert.doesNotThrow(() => verifyDesignApproval(fixture()));
});

test("rejects an unrelated, edited, or unauthorized approval", () => {
  const value = fixture();
  value.comment.user.id = 1;
  assert.throws(() => verifyDesignApproval(value), /project lead/);
  value.comment.user.id = 27461460;
  value.comment.html_url = url.replace("/123", "/999");
  assert.throws(() => verifyDesignApproval(value), /linked issue comment/);
  value.comment.html_url = url;
  value.comment.body = value.comment.body.replace(":feature", ":other");
  assert.throws(() => verifyDesignApproval(value), /must name/);
  value.comment.body = fixture().comment.body;
  value.comment.updated_at = after;
  assert.throws(() => verifyDesignApproval(value), /unedited/);
});

test("rejects approval after an original commit even if it was committed again later", () => {
  const value = fixture();
  value.commits[0].commit.author.date = before;
  assert.throws(() => verifyDesignApproval(value), /predate/);
  value.commits[0].commit.author.date = after;
  value.pull.created_at = before;
  assert.throws(() => verifyDesignApproval(value), /predate/);
});

test("rejects incomplete or stale commit responses", () => {
  const value = fixture();
  value.pull.commits = 2;
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
  value.pull.commits = 1;
  value.commits[0].sha = "stale";
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
});

test("approval names the target repository and branch", () => {
  const value = fixture();
  value.pull.base.ref = "different-base";
  assert.throws(() => verifyDesignApproval(value), /must name/);
});

test("verifies all commits in a PR that spans multiple API pages", () => {
  const value = fixture();
  value.commits = [
    ...Array.from({ length: 100 }, (_, index) => ({
      ...value.commits[0],
      sha: `commit-${index}`,
    })),
    ...value.commits,
  ];
  value.pull.commits = value.commits.length;
  assert.doesNotThrow(() => verifyDesignApproval(value));
  value.commits.shift();
  assert.throws(() => verifyDesignApproval(value), /complete commit list/);
});
