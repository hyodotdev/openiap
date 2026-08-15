import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createBunManifest,
  createSnapshot,
  npmPurl,
  parsePackageIdentity,
} from "./bun-dependency-snapshot.mjs";
import { BUN_PROJECTS, OSV_LOCKFILES } from "./dependency-projects.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const lock = {
  workspaces: {
    "": {
      name: "root",
      dependencies: { runtime: "^1.0.0", shared: "^1.0.0" },
      devDependencies: { tool: "^1.0.0" },
    },
    "packages/child": {
      name: "child",
      dependencies: { duplicate: "^2.0.0", shared: "^2.0.0" },
    },
  },
  packages: {
    child: ["child@workspace:packages/child"],
    "child/shared": ["shared@2.0.0"],
    runtime: [
      "runtime@1.0.0",
      "",
      { dependencies: { duplicate: "^1", plugin: "^1" } },
    ],
    "runtime/duplicate": [
      "duplicate@1.0.0",
      "",
      { dependencies: { nested: "^1" } },
    ],
    "runtime/duplicate/nested": ["nested@1.0.0"],
    duplicate: ["duplicate@2.0.0"],
    plugin: [
      "plugin@1.0.0",
      "",
      {
        peerDependencies: {
          "optional-peer": "^1",
          "peer-only": "^1",
        },
        optionalPeers: ["optional-peer"],
      },
    ],
    "peer-only": ["peer-only@1.0.0"],
    tool: ["tool@1.0.0", "", { dependencies: { helper: "^1" } }],
    helper: ["helper@1.0.0"],
    shared: ["shared@1.0.0"],
  },
};

test("package identities and scoped purls are exact", () => {
  assert.deepEqual(parsePackageIdentity("@auth/core@0.41.3"), {
    name: "@auth/core",
    version: "0.41.3",
  });
  assert.equal(parsePackageIdentity("local@workspace:packages/local"), null);
  assert.equal(npmPurl("@auth/core", "0.41.3"), "pkg:npm/%40auth/core@0.41.3");
});

test("Bun manifest follows exact edges, scopes, and duplicate versions", () => {
  const manifest = createBunManifest(lock);
  assert.deepEqual(manifest.resolved["pkg:npm/runtime@1.0.0"], {
    package_url: "pkg:npm/runtime@1.0.0",
    relationship: "direct",
    scope: "runtime",
    dependencies: ["pkg:npm/duplicate@1.0.0", "pkg:npm/plugin@1.0.0"],
  });
  assert.deepEqual(manifest.resolved["pkg:npm/duplicate@1.0.0"], {
    package_url: "pkg:npm/duplicate@1.0.0",
    relationship: "indirect",
    scope: "runtime",
    dependencies: ["pkg:npm/nested@1.0.0"],
  });
  assert.equal(
    manifest.resolved["pkg:npm/duplicate@2.0.0"].relationship,
    "direct",
  );
  assert.equal(manifest.resolved["pkg:npm/helper@1.0.0"].scope, "development");
  assert.equal(
    manifest.resolved["pkg:npm/shared@2.0.0"].relationship,
    "direct",
  );
  assert.equal(
    manifest.resolved["pkg:npm/shared@1.0.0"].relationship,
    "direct",
  );
  assert.deepEqual(manifest.resolved["pkg:npm/plugin@1.0.0"].dependencies, [
    "pkg:npm/peer-only@1.0.0",
  ]);
  assert.equal(
    manifest.resolved["pkg:npm/peer-only@1.0.0"].relationship,
    "indirect",
  );
  assert.equal(manifest.resolved["pkg:npm/peer-only@1.0.0"].scope, "runtime");
});

test("snapshot binds every Bun project to the workflow commit", () => {
  const snapshot = createSnapshot(
    [
      { lock, lockfile: "bun.lock" },
      { lock, lockfile: "libraries/example/bun.lock" },
    ],
    {
      GITHUB_SHA: "a".repeat(40),
      GITHUB_REF: "refs/heads/main",
      GITHUB_RUN_ID: "42",
      GITHUB_WORKFLOW: "Dependency Submission",
      GITHUB_JOB: "submit",
      GITHUB_REPOSITORY: "hyodotdev/openiap",
      GITHUB_SERVER_URL: "https://github.com",
    },
    new Date("2026-08-14T00:00:00.000Z"),
  );
  assert.equal(snapshot.sha, "a".repeat(40));
  assert.equal(snapshot.job.correlator, "Dependency Submission submit");
  assert.deepEqual(Object.keys(snapshot.manifests), [
    "bun.lock",
    "libraries/example/bun.lock",
  ]);
});

test("unsupported and unbound snapshots fail closed", () => {
  assert.throws(
    () => createBunManifest({ workspaces: {}, packages: {} }),
    /no resolved npm dependencies/u,
  );
  assert.throws(
    () =>
      createBunManifest({
        workspaces: { "": { dependencies: { missing: "^1" } } },
        packages: {},
      }),
    /cannot resolve missing/u,
  );
  const optionalManifest = createBunManifest({
    workspaces: {
      "": {
        dependencies: { runtime: "^1" },
        optionalDependencies: { missing: "^1" },
      },
    },
    packages: { runtime: ["runtime@1.0.0"] },
  });
  assert.deepEqual(Object.keys(optionalManifest.resolved), [
    "pkg:npm/runtime@1.0.0",
  ]);
  assert.throws(
    () =>
      createBunManifest({
        workspaces: { "": { dependencies: { runtime: "^1" } } },
        packages: {
          orphan: ["orphan@1.0.0"],
          runtime: ["runtime@1.0.0"],
        },
      }),
    /omitted resolved packages: pkg:npm\/orphan@1\.0\.0/u,
  );
  assert.throws(
    () =>
      createBunManifest({
        workspaces: { "": { dependencies: { plugin: "^1" } } },
        packages: {
          plugin: ["plugin@1.0.0", "", { peerDependencies: { missing: "^1" } }],
        },
      }),
    /cannot resolve missing/u,
  );
  assert.throws(
    () => createSnapshot([{ lock, lockfile: "bun.lock" }], {}),
    /GITHUB_SHA is required/u,
  );
});

test("CI and dependency submission cover every declared lock", () => {
  const ci = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const submission = readFileSync(
    new URL("../.github/workflows/dependency-submission.yml", import.meta.url),
    "utf8",
  );

  for (const lockfile of OSV_LOCKFILES) {
    assert.match(
      ci,
      new RegExp(`--lockfile=${lockfile.replaceAll(".", "\\.")}`),
    );
  }
  for (const { directory } of BUN_PROJECTS.filter(
    (project) => project.directory !== ".",
  )) {
    assert.match(ci, new RegExp(directory.replaceAll(".", "\\.")));
  }
  assert.match(ci, /install-security-tool\.sh osv-scanner/u);
  const installer = readFileSync(
    new URL("./install-security-tool.sh", import.meta.url),
    "utf8",
  );
  assert.match(
    installer,
    /edcfc41d257db36148f065055655fe3fcfc434b0b423ea67468a84c207524e0c/u,
  );
  assert.match(
    installer,
    /osv-scanner\/releases\/download\/v2\.5\.0\/osv-scanner_linux_amd64/u,
  );
  assert.match(
    installer,
    /2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a/u,
  );
  assert.match(
    installer,
    /trivy\/releases\/download\/v0\.74\.0\/trivy_0\.74\.0_Linux-64bit\.tar\.gz/u,
  );
  assert.match(
    installer,
    /bfc8b2538da86fe239bc53658bbb63c1c8c510a293c1e6891aa5bea5d3c58746/u,
  );
  assert.match(
    installer,
    /cyclonedx-cli\/releases\/download\/v0\.33\.1\/cyclonedx-linux-x64/u,
  );
  assert.match(installer, /--retry 3 --retry-all-errors/u);
  assert.match(installer, /--connect-timeout 15 --max-time 300/u);
  assert.doesNotMatch(ci, /osv-scanner-action/u);
  assert.match(
    submission,
    /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/u,
  );
  for (const pattern of [
    "**/bun.lock",
    "**/yarn.lock",
    "**/package-lock.json",
    "**/pnpm-lock.yaml",
    "**/npm-shrinkwrap.json",
  ]) {
    assert.match(submission, new RegExp(`"${pattern.replaceAll("*", "\\*")}"`));
  }
});

test("dependency inventory covers every supported repository lock", () => {
  const supportedNames = new Set([
    "Gemfile.lock",
    "bun.lock",
    "yarn.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "npm-shrinkwrap.json",
  ]);
  const repositoryLocks = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((path) => supportedNames.has(path.split("/").at(-1)))
    .sort();
  assert.deepEqual([...OSV_LOCKFILES].sort(), repositoryLocks);

  const repositoryBunLocks = repositoryLocks.filter(
    (path) => path === "bun.lock" || path.endsWith("/bun.lock"),
  );
  assert.deepEqual(
    BUN_PROJECTS.map(({ lockfile }) => lockfile).sort(),
    repositoryBunLocks,
  );
});

test("Vega builds install only their committed lock graphs", () => {
  for (const builder of [
    "../libraries/expo-iap/example/scripts/build-vega-example.mjs",
    "../libraries/react-native-iap/example/scripts/build-vega-example.mjs",
  ]) {
    const source = readFileSync(new URL(builder, import.meta.url), "utf8");
    assert.match(
      source,
      /copyFile\(path\.join\(vegaDependencyRoot, 'bun\.lock'\)/u,
    );
    assert.match(source, /\['install', '--frozen-lockfile'\]/u);
    assert.doesNotMatch(source, /--force/u);
  }
});
