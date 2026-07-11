import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  allowsPrereleaseMetadata,
  assertReleaseBranch,
  findPrereleaseVersions,
  isPrereleaseVersion,
  normalizeBranch,
  resolveReleaseChannel,
  validateVersion,
} from "./release-branch-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const releaseWorkflows = {
  apple: { filename: "release-apple.yml", guardedJobs: 1 },
  expo: { filename: "release-expo.yml", guardedJobs: 2 },
  flutter: { filename: "release-flutter.yml", guardedJobs: 2 },
  godot: { filename: "release-godot.yml", guardedJobs: 2 },
  google: { filename: "release-google.yml", guardedJobs: 1 },
  kmp: { filename: "release-kmp.yml", guardedJobs: 2 },
  maui: { filename: "release-maui.yml", guardedJobs: 2 },
  "react-native": {
    filename: "release-react-native.yml",
    guardedJobs: 2,
  },
};

const prereleaseCiWorkflows = [
  "ci-expo-iap.yml",
  "ci-flutter-inapp-purchase.yml",
  "ci-godot-iap.yml",
  "ci-kmp-iap.yml",
  "ci-maui-iap.yml",
  "ci-react-native-iap.yml",
];

function readWorkflow(filename) {
  return readFileSync(resolve(repoRoot, ".github/workflows", filename), "utf8");
}

test("normalizes Git branch refs", () => {
  assert.equal(normalizeBranch("refs/heads/next"), "next");
  assert.equal(normalizeBranch("origin/main"), "main");
});

test("build metadata does not make a stable version prerelease", () => {
  assert.equal(isPrereleaseVersion("2.1.0+build-7"), false);
  assert.equal(isPrereleaseVersion("2.1.0-rc.1+build-7"), true);
});

test("accepts strict SemVer and rejects malformed versions", () => {
  assert.equal(
    validateVersion("2.1.0-rc.1+build.7", "test"),
    "2.1.0-rc.1+build.7",
  );
  assert.throws(() => validateVersion("02.1.0", "test"), /Invalid test/);
  assert.throws(() => validateVersion("2.1.0-rc..1", "test"), /Invalid test/);
});

test("allows prerelease metadata only for next", () => {
  assert.equal(allowsPrereleaseMetadata("next"), true);
  assert.equal(allowsPrereleaseMetadata("refs/heads/next"), true);
  assert.equal(allowsPrereleaseMetadata("main"), false);
  assert.equal(allowsPrereleaseMetadata("feat/amazon-runtime"), false);
});

test("routes stable and prerelease releases to separate branches", () => {
  assert.equal(
    resolveReleaseChannel({
      currentVersion: "2.3.0",
      prerelease: "false",
      targetVersion: "",
      versionMode: "patch",
    }),
    "stable",
  );
  assert.equal(
    resolveReleaseChannel({
      currentVersion: "2.3.0",
      prerelease: "true",
      targetVersion: "",
      versionMode: "minor",
    }),
    "prerelease",
  );
  assert.equal(
    resolveReleaseChannel({
      currentVersion: "2.4.0-rc.2",
      prerelease: "false",
      targetVersion: "",
      versionMode: "current",
    }),
    "prerelease",
  );
  assert.equal(
    resolveReleaseChannel({
      currentVersion: "2.3.0",
      prerelease: "false",
      targetVersion: "2.4.0-rc.1",
      versionMode: "patch",
    }),
    "prerelease",
  );
});

test("rejects releases from the wrong branch", () => {
  assert.equal(
    assertReleaseBranch({
      branch: "main",
      channel: "stable",
      packageLabel: "test-package",
    }),
    "main",
  );
  assert.equal(
    assertReleaseBranch({
      branch: "next",
      channel: "prerelease",
      packageLabel: "test-package",
    }),
    "next",
  );
  assert.throws(
    () =>
      assertReleaseBranch({
        branch: "main",
        channel: "prerelease",
        packageLabel: "test-package",
      }),
    /must run from 'next'/,
  );
});

test("finds prerelease metadata before it reaches main", () => {
  assert.deepEqual(
    findPrereleaseVersions({
      apple: "2.2.5",
      expo: "4.5.0-rc.1",
      google: "2.3.0",
    }),
    [["expo", "4.5.0-rc.1"]],
  );
});

test("all package release workflows enforce the branch policy", () => {
  for (const [packageId, { filename, guardedJobs }] of Object.entries(
    releaseWorkflows,
  )) {
    const workflow = readWorkflow(filename);
    assert.match(
      workflow,
      new RegExp(`release-branch-policy\\.mjs guard ${packageId}`),
      filename,
    );
    assert.equal(
      (workflow.match(/needs: \[release-branch\]/g) ?? []).length,
      guardedJobs,
      `${filename} guard dependencies`,
    );
    assert.doesNotMatch(
      workflow,
      /git (?:pull --rebase origin main|push origin (?:HEAD:)?main)/,
      filename,
    );
  }
});

test("Flutter publication has a single explicit dispatch path", () => {
  const releaseWorkflow = readWorkflow("release-flutter.yml");
  const publishWorkflow = readWorkflow("publish-flutter.yml");
  assert.equal(
    (releaseWorkflow.match(/gh workflow run publish-flutter\.yml/g) ?? [])
      .length,
    1,
  );
  assert.match(publishWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(publishWorkflow, /^\s+push:/m);
  assert.match(publishWorkflow, /refs\/tags\/flutter-iap-\*/);
});

test("production docs are guarded as stable-only", () => {
  const docsRelease = readWorkflow("release.yml");
  const deployScript = readFileSync(
    resolve(repoRoot, "scripts/deploy.sh"),
    "utf8",
  );
  assert.match(docsRelease, /release-branch-policy\.mjs guard docs/);
  assert.match(deployScript, /release-branch-policy\.mjs guard docs/);
  assert.match(deployScript, /Production docs accept stable versions only/);
  assert.match(deployScript, /requires a clean worktree/);
  assert.doesNotMatch(deployScript, /continue anyway/);
  assert.ok(
    docsRelease.indexOf("release-branch-policy.mjs guard docs") <
      docsRelease.indexOf("Calculate new version"),
  );
  assert.ok(
    deployScript.indexOf("release-branch-policy.mjs guard docs") <
      deployScript.indexOf("Checking Git status"),
  );
  assert.ok(
    deployScript.indexOf("Checking Git status") <
      deployScript.indexOf("command -v vercel"),
  );
});

test("next receives the same core and framework CI coverage", () => {
  const coreCi = readWorkflow("ci.yml");
  assert.equal((coreCi.match(/^\s+- next$/gm) ?? []).length, 2);
  for (const filename of prereleaseCiWorkflows) {
    const workflow = readWorkflow(filename);
    assert.equal(
      (workflow.match(/branches: \[main, next\]/g) ?? []).length,
      2,
      filename,
    );
  }
});
