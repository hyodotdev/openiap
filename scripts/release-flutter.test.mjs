import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { isolateGitEnvironment } from "./git-test-environment.mjs";

const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/release-flutter.yml", import.meta.url),
    "utf8",
  ),
);
const steps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
const selection = steps.find((step) => step.id === "previous_release");
const changelog = steps.find(
  (step) => step.name === "Generate CHANGELOG entry",
);
const notes = steps.find((step) => step.id === "release_notes");

function fixture(t) {
  isolateGitEnvironment(t);
  const directory = mkdtempSync(join(tmpdir(), "openiap-flutter-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const library = join(directory, "libraries/flutter_inapp_purchase");
  mkdirSync(library, { recursive: true });
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Release fixture");
  git("config", "user.email", "fixture@example.test");
  const commit = (subject) => {
    writeFileSync(join(library, "source.txt"), subject);
    git("add", ".");
    git("commit", "--quiet", "-m", subject);
  };
  commit("chore(release): flutter_inapp_purchase@10.7.3");
  git("tag", "flutter-iap-10.7.3");
  return { directory, library, git, commit };
}

function previousTag(fixture, version) {
  const output = join(fixture.directory, "workflow-output");
  execFileSync("bash", ["-e", "-o", "pipefail", "-c", selection.run], {
    cwd: fixture.library,
    env: { ...process.env, VERSION: version, GITHUB_OUTPUT: output },
  });
  return readFileSync(output, "utf8").trim().slice("tag=".length);
}

function generateChangelog(fixture, version, tag) {
  execFileSync("bash", ["-e", "-o", "pipefail", "-c", changelog.run], {
    cwd: fixture.library,
    env: { ...process.env, NEW_VERSION: version, PREV_TAG: tag },
  });
  return readFileSync(join(fixture.library, "CHANGELOG.md"), "utf8");
}

test("stable promotion keeps source changes from before the RC", (t) => {
  const repo = fixture(t);
  repo.commit("feat: support community providers (#504)");
  repo.git("tag", "flutter-iap-11.0.0-rc.1");
  repo.commit("fix: complete the Client Protocol migration (#513)");
  const tag = previousTag(repo, "11.0.0");
  assert.equal(tag, "flutter-iap-10.7.3");
  const text = generateChangelog(repo, "11.0.0", tag);
  assert.match(text, /## 11\.0\.0/);
  assert.match(text, /support community providers \(#504\)/);
  assert.match(text, /complete the Client Protocol migration \(#513\)/);
  assert.doesNotMatch(text, /No direct Flutter package changes|11\.0\.0-rc\.1/);
});

test("ordinary stable patch describes its source changes", (t) => {
  const repo = fixture(t);
  repo.commit("fix: preserve the returned purchase");
  const tag = previousTag(repo, "10.7.4");
  assert.equal(tag, "flutter-iap-10.7.3");
  assert.match(
    generateChangelog(repo, "10.7.4", tag),
    /preserve the returned purchase/,
  );
});

test("current retry excludes its own stable tag and reuses one baseline", (t) => {
  const repo = fixture(t);
  repo.commit("feat: support community providers");
  repo.git("tag", "flutter-iap-11.0.0-rc.1");
  repo.commit("chore(release): flutter_inapp_purchase@11.0.0");
  repo.git("tag", "flutter-iap-11.0.0");
  assert.equal(previousTag(repo, "11.0.0"), "flutter-iap-10.7.3");
  assert.equal(
    changelog.env.PREV_TAG,
    "${{ steps.previous_release.outputs.tag }}",
  );
  assert.equal(notes.env.PREV_TAG, changelog.env.PREV_TAG);
});
