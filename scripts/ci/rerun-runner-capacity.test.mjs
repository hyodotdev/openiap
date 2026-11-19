import assert from "node:assert/strict";
import test from "node:test";

import {
  rerunIfRunnerCapacity,
  shouldRerun,
} from "./rerun-runner-capacity.mjs";

const NO_RUNNER =
  "The job was not acquired by Runner of type hosted even after multiple attempts";
const job = (id, conclusion) => ({ id, conclusion });

test("reruns when every failed job never got a runner", () => {
  const annotations = {
    1: [NO_RUNNER],
    2: ["Due to capacity constraints", NO_RUNNER],
  };
  assert.equal(
    shouldRerun(
      [
        job(1, "cancelled"),
        job(2, "cancelled"),
        job(3, "success"),
        job(4, "skipped"),
      ],
      (item) => annotations[item.id] ?? [],
    ),
    true,
  );
});

test("leaves a run alone when any failure is real", () => {
  const annotations = {
    1: [NO_RUNNER],
    2: ["Process completed with exit code 1."],
  };
  assert.equal(
    shouldRerun(
      [job(1, "cancelled"), job(2, "failure")],
      (item) => annotations[item.id] ?? [],
    ),
    false,
  );
});

test("leaves a run alone when nothing failed", () => {
  assert.equal(
    shouldRerun([job(1, "success")], () => [NO_RUNNER]),
    false,
  );
});

test("asks GitHub to rerun only the failed jobs of a capacity-cancelled run", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push(`${init.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("/jobs?")) {
      return Response.json({ jobs: [job(7, "cancelled"), job(8, "success")] });
    }
    if (url.includes("/annotations")) {
      return Response.json([{ message: NO_RUNNER }]);
    }
    return new Response(null, { status: 201 });
  };

  const rerun = await rerunIfRunnerCapacity({
    repository: "owner/repo",
    runId: "42",
    attempt: "1",
    token: "token",
    fetch,
  });

  assert.equal(rerun, true);
  assert.deepEqual(calls, [
    "GET /repos/owner/repo/actions/runs/42/attempts/1/jobs",
    "GET /repos/owner/repo/check-runs/7/annotations",
    "POST /repos/owner/repo/actions/runs/42/rerun-failed-jobs",
  ]);
});

test("does not rerun when a failed job has a real error", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push(init.method ?? "GET");
    if (url.includes("/jobs?"))
      return Response.json({ jobs: [job(7, "failure")] });
    return Response.json([{ message: "Process completed with exit code 1." }]);
  };

  const rerun = await rerunIfRunnerCapacity({
    repository: "owner/repo",
    runId: "42",
    attempt: "1",
    token: "token",
    fetch,
  });

  assert.equal(rerun, false);
  assert.equal(calls.includes("POST"), false);
});
