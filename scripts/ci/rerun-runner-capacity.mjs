#!/usr/bin/env node
// Reruns a workflow run's failed jobs when GitHub cancelled every one of them
// because no hosted runner picked it up. macOS capacity does this to whole
// runs; any other failure is a real result and stays as it is.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NO_RUNNER = "was not acquired by Runner";
const API = "https://api.github.com";
const PASSED = ["success", "skipped", "neutral"];

const unsuccessful = (job) => !PASSED.includes(job.conclusion);

export function shouldRerun(jobs, annotationsFor) {
  const failed = jobs.filter(unsuccessful);
  return (
    failed.length > 0 &&
    failed.every(
      (job) =>
        // A step can print the same text, so also require that none ran.
        job.conclusion === "cancelled" &&
        !job.runner_name &&
        (job.steps ?? []).length === 0 &&
        annotationsFor(job).some((message) => message.includes(NO_RUNNER)),
    )
  );
}

export async function rerunIfRunnerCapacity({
  repository,
  runId,
  attempt,
  token,
  fetch = globalThis.fetch,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const request = async (path, init = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new Error(
        `${init.method ?? "GET"} ${path}: HTTP ${response.status}`,
      );
    }
    return response.status === 204 || response.status === 201
      ? null
      : response.json();
  };

  const jobs = [];
  for (let page = 1; ; page += 1) {
    const { jobs: batch } = await request(
      `/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`,
    );
    jobs.push(...batch);
    if (batch.length < 100) break;
  }

  const annotations = new Map();
  for (const job of jobs) {
    if (!unsuccessful(job)) continue;
    const found = await request(
      `/repos/${repository}/check-runs/${job.id}/annotations?per_page=100`,
    );
    annotations.set(
      job.id,
      found.map((annotation) => annotation.message ?? ""),
    );
  }

  if (!shouldRerun(jobs, (job) => annotations.get(job.id) ?? [])) {
    console.log("Not a runner-capacity failure; leaving the run as it is.");
    return false;
  }
  const movedOn = async () => {
    const run = await request(`/repos/${repository}/actions/runs/${runId}`);
    return (
      String(run.run_attempt) !== String(attempt) || run.status !== "completed"
    );
  };
  if (await movedOn()) {
    console.log("The run moved on since this attempt; leaving it.");
    return false;
  }
  try {
    await request(
      `/repos/${repository}/actions/runs/${runId}/rerun-failed-jobs`,
      { method: "POST" },
    );
  } catch (error) {
    // This endpoint has answered 500 while the per-job one still worked.
    // Rerunning one job starts the new attempt; the next pass reruns the rest.
    await pause(10_000);
    if (!(await movedOn())) {
      let started = false;
      for (const job of jobs.filter(unsuccessful)) {
        try {
          await request(`/repos/${repository}/actions/jobs/${job.id}/rerun`, {
            method: "POST",
          });
          started = true;
          break;
        } catch {
          // Try the next job.
        }
      }
      if (!started && !(await movedOn())) throw error;
    }
  }
  console.log(`Reran the jobs no hosted runner picked up in run ${runId}.`);
  return true;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const { GITHUB_REPOSITORY, RUN_ID, RUN_ATTEMPT, GH_TOKEN } = process.env;
  if (!GITHUB_REPOSITORY || !RUN_ID || !RUN_ATTEMPT || !GH_TOKEN) {
    console.error(
      "GITHUB_REPOSITORY, RUN_ID, RUN_ATTEMPT and GH_TOKEN are required",
    );
    process.exit(2);
  }
  try {
    await rerunIfRunnerCapacity({
      repository: GITHUB_REPOSITORY,
      runId: RUN_ID,
      attempt: RUN_ATTEMPT,
      token: GH_TOKEN,
    });
  } catch (error) {
    // The run it watches keeps its own result; this helper never adds a red X.
    console.log(`::warning::Could not rerun run ${RUN_ID}: ${error.message}`);
  }
}
