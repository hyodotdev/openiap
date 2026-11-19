#!/usr/bin/env node
// Reruns a workflow run's failed jobs when GitHub cancelled every one of them
// because no hosted runner picked it up. macOS capacity does this to whole
// runs; any other failure is a real result and stays as it is.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NO_RUNNER = "was not acquired by Runner";
const API = "https://api.github.com";

export function shouldRerun(jobs, annotationsFor) {
  const failed = jobs.filter((job) =>
    ["failure", "cancelled"].includes(job.conclusion),
  );
  return (
    failed.length > 0 &&
    failed.every((job) =>
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
    if (!["failure", "cancelled"].includes(job.conclusion)) continue;
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
  await request(
    `/repos/${repository}/actions/runs/${runId}/rerun-failed-jobs`,
    {
      method: "POST",
    },
  );
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
  await rerunIfRunnerCapacity({
    repository: GITHUB_REPOSITORY,
    runId: RUN_ID,
    attempt: RUN_ATTEMPT,
    token: GH_TOKEN,
  });
}
