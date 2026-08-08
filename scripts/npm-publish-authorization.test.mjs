import assert from "node:assert/strict";
import test from "node:test";

import {
  createNpmPublishAuthorization,
  verifyNpmPublishAuthorization,
} from "./npm-publish-authorization.mjs";

const authorization = createNpmPublishAuthorization({
  repository: "hyodotdev/openiap",
  workflowPath: ".github/workflows/release-expo.yml",
  sourceRunId: "123456",
  sourceRunAttempt: "1",
  sourceBranch: "main",
  sourceHeadSha: "a".repeat(40),
  tag: "expo-iap-5.1.0",
  tagSha: "b".repeat(40),
});

function verify(expectedOverrides = {}) {
  verifyNpmPublishAuthorization({
    authorization,
    expected: { ...authorization, ...expectedOverrides },
  });
}

test("accepts authorization for the exact source run and release tag", () => {
  assert.doesNotThrow(() => verify());
});

test("rejects authorization from a different source run", () => {
  assert.throws(
    () => verify({ sourceRunId: "654321" }),
    /sourceRunId mismatch/,
  );
});

test("rejects authorization for a different release tag", () => {
  assert.throws(() => verify({ tag: "expo-iap-5.2.0" }), /tag mismatch/);
});

test("rejects authorization for a different tag commit", () => {
  assert.throws(() => verify({ tagSha: "c".repeat(40) }), /tagSha mismatch/);
});

test("rejects malformed source run and Git identifiers", () => {
  assert.throws(
    () =>
      createNpmPublishAuthorization({
        ...authorization,
        sourceRunAttempt: "0",
      }),
    /positive integer/,
  );
  assert.throws(
    () =>
      createNpmPublishAuthorization({
        ...authorization,
        tagSha: "not-a-sha",
      }),
    /40-character lowercase Git SHA/,
  );
});
