import assert from "node:assert/strict";
import test from "node:test";

import {
  rerunIfRunnerCapacity,
  shouldRerun,
} from "./rerun-runner-capacity.mjs";

const NO_RUNNER =
  "The job was not acquired by Runner of type hosted even after multiple attempts";
// A job GitHub never staffed: cancelled, no runner, no steps.
const unstaffed = (id) => ({
  id,
  conclusion: "cancelled",
  runner_name: "",
  steps: [],
});
const ran = (id, conclusion) => ({
  id,
  conclusion,
  runner_name: "GitHub Actions 1",
  steps: [{ name: "Run tests" }],
});

test("reruns when every failed job never got a runner", () => {
  const annotations = {
    1: [NO_RUNNER],
    2: ["Due to capacity constraints", NO_RUNNER],
  };
  assert.equal(
    shouldRerun(
      [unstaffed(1), unstaffed(2), ran(3, "success"), ran(4, "skipped")],
      (item) => annotations[item.id] ?? [],
    ),
    true,
  );
});

for (const [name, other] of [
  ["a real failure", ran(2, "failure")],
  ["a timed-out job", ran(2, "timed_out")],
  ["a job that ran and printed the same text", ran(2, "cancelled")],
]) {
  test(`leaves a run alone when it also has ${name}`, () => {
    assert.equal(
      shouldRerun([unstaffed(1), other], () => [NO_RUNNER]),
      false,
    );
  });
}

test("leaves a run alone when nothing failed", () => {
  assert.equal(
    shouldRerun([ran(1, "success")], () => [NO_RUNNER]),
    false,
  );
});

function fakeGitHub({ jobs, runAttempt = 1, status = "completed" }) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push(`${init.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("/jobs?")) return Response.json({ jobs });
    if (url.includes("/annotations"))
      return Response.json([{ message: NO_RUNNER }]);
    if (init.method === "POST") return new Response(null, { status: 201 });
    return Response.json({ run_attempt: runAttempt, status });
  };
  return { calls, fetch };
}

const rerun = (fetch) =>
  rerunIfRunnerCapacity({
    repository: "owner/repo",
    runId: "42",
    attempt: "1",
    token: "token",
    fetch,
    pause: async () => {},
  });

test("asks GitHub to rerun only the failed jobs of a capacity-cancelled run", async () => {
  const { calls, fetch } = fakeGitHub({
    jobs: [unstaffed(7), ran(8, "success")],
  });

  assert.equal(await rerun(fetch), true);
  assert.deepEqual(calls, [
    "GET /repos/owner/repo/actions/runs/42/attempts/1/jobs",
    "GET /repos/owner/repo/check-runs/7/annotations",
    "GET /repos/owner/repo/actions/runs/42",
    "POST /repos/owner/repo/actions/runs/42/rerun-failed-jobs",
  ]);
});

test("does not rerun when a failed job has a real error", async () => {
  const { calls, fetch } = fakeGitHub({ jobs: [ran(7, "failure")] });

  assert.equal(await rerun(fetch), false);
  assert.equal(
    calls.some((call) => call.startsWith("POST")),
    false,
  );
});

for (const [name, run] of [
  ["a later attempt started", { runAttempt: 2 }],
  ["the run is running again", { status: "in_progress" }],
]) {
  test(`does not rerun when ${name}`, async () => {
    const { calls, fetch } = fakeGitHub({ jobs: [unstaffed(7)], ...run });

    assert.equal(await rerun(fetch), false);
    assert.equal(
      calls.some((call) => call.startsWith("POST")),
      false,
    );
  });
}

test("leaves it there when the run moved on after a refused rerun", async () => {
  const calls = [];
  let runAttempt = 1;
  const fetch = async (url, init = {}) => {
    calls.push(`${init.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("/jobs?")) return Response.json({ jobs: [unstaffed(7)] });
    if (url.includes("/annotations"))
      return Response.json([{ message: NO_RUNNER }]);
    if (init.method === "POST") {
      // Someone else started the next attempt meanwhile.
      runAttempt = 2;
      return new Response(null, { status: 500 });
    }
    return Response.json({ run_attempt: runAttempt, status: "completed" });
  };

  assert.equal(await rerun(fetch), true);
  assert.equal(calls.filter((call) => call.startsWith("POST")).length, 1);
});

test("falls back to rerunning one job when the run-level rerun fails", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push(`${init.method ?? "GET"} ${path}`);
    if (url.includes("/jobs?"))
      return Response.json({ jobs: [unstaffed(7), unstaffed(8)] });
    if (url.includes("/annotations"))
      return Response.json([{ message: NO_RUNNER }]);
    if (path.endsWith("/rerun-failed-jobs"))
      return new Response(null, { status: 500 });
    if (init.method === "POST") return new Response(null, { status: 201 });
    return Response.json({ run_attempt: 1, status: "completed" });
  };

  assert.equal(await rerun(fetch), true);
  assert.deepEqual(
    calls.filter((call) => call.startsWith("POST")),
    [
      "POST /repos/owner/repo/actions/runs/42/rerun-failed-jobs",
      "POST /repos/owner/repo/actions/jobs/7/rerun",
    ],
  );
});

test("throws when neither rerun endpoint starts anything", async () => {
  const fetch = async (url, init = {}) => {
    if (url.includes("/jobs?")) return Response.json({ jobs: [unstaffed(7)] });
    if (url.includes("/annotations"))
      return Response.json([{ message: NO_RUNNER }]);
    if (init.method === "POST") return new Response(null, { status: 500 });
    return Response.json({ run_attempt: 1, status: "completed" });
  };
  await assert.rejects(rerun(fetch), /rerun-failed-jobs: HTTP 500/);
});
