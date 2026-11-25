#!/usr/bin/env node

// Before a push to main, runs the ci.yml steps that push triggers and this
// machine can run. Commands are read from the workflow, so there is no second
// copy; a step missing from LOCAL_STEPS runs only in CI.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import {
  ciFilterJobs,
  pushAlwaysFilters,
  selectJobs,
} from "./audit-ci-path-filters.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

// Step names per ci.yml job. Install steps stay out: they expect the CI image
// or rewrite node_modules. A step with a tool is skipped where it is missing.
export const LOCAL_STEPS = Object.freeze({
  "audit-release-state": [
    "Audit repository layout",
    "Validate package version metadata",
    "Audit plugin manifests",
    "Test the protocol compatibility check",
    "Test release automation",
    "Audit the release sync script",
    "Test Gradle network retry helper",
    "Test the native registry wait helper",
    "Test the runner-capacity rerun helper",
  ],
  "audit-lockfile": [
    "Audit npm override compatibility",
    "Audit SBOM documentation",
    "Audit Godot binary digests",
    "Test dependency and workflow guards",
    "Audit workflow security",
    { step: "Lint workflows", tool: "actionlint" },
    {
      step: "Audit dependency vulnerabilities and exception lifecycle",
      tool: "osv-scanner",
    },
    {
      step: "Audit all tracked dependency locks with OSV",
      tool: "osv-scanner",
    },
  ],
  "audit-parity": [
    "Test clean-worktree drift guard",
    "Test review-thread listing",
    "Test review-automation comment sweep",
    "Test pull request guard",
    "Sync generated version files",
    "Verify version and generated synchronization is committed",
    "Test community touchpoint audit",
    "Run non-Godot SDK parity audit",
    "Test IAPKit spec contract audit",
    "Run IAPKit spec contract audit",
    "Audit CI path filters",
    "Audit agent surfaces",
    "Audit sponsor surfaces",
    "Audit orphan release tags",
  ],
  "test-agent": [
    "Type check",
    "Run tests",
    "Compile generated agent context",
    "Verify compiled agent context is committed",
  ],
  "test-commerce-protocol": ["Run spec suite", "Verify IAPKit conformance"],
  "test-conformance": [
    "Run conformance suite tests",
    "Verify conformance spec projections",
    "Reference conformance report",
  ],
  "test-cli": ["Run CLI tests", "The executable loads"],
  "test-gql": [
    "Generate types",
    "Run tests",
    "Compare Client SDL with supported releases",
    "Verify generated types are committed (no drift)",
  ],
  "test-docs": [
    "Type check",
    "Audit docs consistency",
    "Check static discovery guards",
    "Test showcase API and metrics",
    "Lint",
    "Format check",
    "Build",
  ],
  "test-android": [
    { step: "Run tests", tool: "java" },
    { step: "Check core API compatibility", tool: "java" },
  ],
  "test-ios": [
    { step: "Build", tool: "swift" },
    { step: "Run tests", tool: "swift" },
    { step: "Verify public provider contract and conformance", tool: "swift" },
  ],
});

// Every job a push to main starts: the unconditional audit, the filters pushes
// always run, and the ones the changed files select.
export function pushJobs(files, root = repositoryRoot) {
  return [
    ...new Set([
      "ci:audit-release-state",
      ...pushAlwaysFilters.flatMap((name) => ciFilterJobs[name]),
      ...selectJobs(files, root),
    ]),
  ].sort();
}

export function localSteps(jobId, root = repositoryRoot) {
  const workflow = parseYaml(
    fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"),
  );
  const job = workflow.jobs[jobId];

  return LOCAL_STEPS[jobId].map((entry) => {
    const { step: name, tool } =
      typeof entry === "string" ? { step: entry } : entry;
    const step = job?.steps.find((one) => one.name === name);

    if (!step?.run) {
      throw new Error(`ci.yml ${jobId} has no run step named '${name}'`);
    }
    // An expression or a condition needs the Actions context to mean anything.
    if (step.if || JSON.stringify([step.run, step.env]).includes("${{")) {
      throw new Error(`ci.yml ${jobId} '${name}' needs the Actions context`);
    }

    return {
      name,
      tool,
      run: step.run,
      env: step.env ?? {},
      directory: path.join(root, step["working-directory"] ?? "."),
    };
  });
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

// Running it matters: macOS ships a java stub that exists and fails.
function hasTool(tool) {
  return spawnSync(tool, ["--version"]).status === 0;
}

function main([base, head]) {
  // The checks read the working tree, so it has to be the commit being pushed.
  if (git("rev-parse", "HEAD") !== head || git("status", "--porcelain")) {
    console.error(
      "verify-main-push: check out the pushed commit with nothing uncommitted or untracked, then push again.",
    );
    return 1;
  }

  let files;
  try {
    // A rename counts under its old path too, as the workflow's filter sees it.
    files = git("diff", "--name-only", "--no-renames", "-z", base, head)
      .split("\0")
      .filter(Boolean);
  } catch {
    console.error(
      "verify-main-push: this checkout lacks the commit main is on; fetch and rebase, then push again.",
    );
    return 1;
  }

  const jobs = pushJobs(files);
  const env = { ...process.env, GITHUB_WORKSPACE: repositoryRoot };
  // Git points hooks at this repository; tests that create their own must not inherit that.
  for (const name of git("rev-parse", "--local-env-vars").split("\n")) {
    delete env[name];
  }
  env.RUNNER_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "verify-main-push-"));

  const ciOnly = [];
  try {
    for (const job of jobs) {
      const jobId = job.replace(/^ci:/u, "");
      if (job === jobId || !LOCAL_STEPS[jobId]) {
        ciOnly.push(job);
        continue;
      }
      for (const step of localSteps(jobId)) {
        if (step.tool && !hasTool(step.tool)) {
          ciOnly.push(`${job} › ${step.name} (no ${step.tool} here)`);
          continue;
        }
        console.log(`\n▶ ${job} › ${step.name}`);
        // `bash -e` is what Actions runs a step with when it names no shell.
        const { status } = spawnSync("bash", ["-e", "-c", step.run], {
          cwd: step.directory,
          env: { ...env, ...step.env },
          stdio: "inherit",
        });
        if (status !== 0) {
          console.error(
            `\nverify-main-push: '${step.name}' failed, and ${job} would fail on main the same way. Fix it before pushing.`,
          );
          return 1;
        }
      }
    }
  } finally {
    fs.rmSync(env.RUNNER_TEMP, { recursive: true, force: true });
  }

  console.log("\nverify-main-push: every local step passed.");
  if (ciOnly.length) {
    console.log(`Only CI runs:\n${ciOnly.map((one) => `  ${one}`).join("\n")}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = main(process.argv.slice(2));
}
