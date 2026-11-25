import assert from "node:assert/strict";
import test from "node:test";

import { LOCAL_STEPS, localSteps, pushJobs } from "./verify-main-push.mjs";

test("every local step is a ci.yml run step that needs no Actions context", () => {
  for (const jobId of Object.keys(LOCAL_STEPS)) {
    assert.equal(localSteps(jobId).length, LOCAL_STEPS[jobId].length);
  }
});

test("no local step installs anything or writes an Actions file", () => {
  for (const jobId of Object.keys(LOCAL_STEPS)) {
    for (const { name, run } of localSteps(jobId)) {
      assert.doesNotMatch(
        run,
        /\binstall\b|sudo |GITHUB_(ENV|OUTPUT|PATH)\b/u,
        `${jobId} '${name}'`,
      );
    }
  }
});

test("a docs-only push still runs the jobs every push runs", () => {
  assert.deepEqual(pushJobs(["README.md"]), [
    "ci:audit-lockfile",
    "ci:audit-parity",
    "ci:audit-release-state",
    "ci:test-agent",
    "ci:test-commerce-protocol",
    "ci:test-conformance",
  ]);
});

test("changed paths add the jobs their filters select", () => {
  const jobs = pushJobs(["packages/google/openiap/build.gradle.kts"]);

  assert.ok(jobs.includes("ci:test-android"));
  assert.ok(jobs.includes("ci-react-native-iap.yml"));
});
