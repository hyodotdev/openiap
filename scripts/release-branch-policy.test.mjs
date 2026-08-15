import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  allowsPrereleaseMetadata,
  assertSpecMatchesNativeFloor,
  assertReleaseBranch,
  compareSemVer,
  findPrereleaseVersions,
  isPrereleaseVersion,
  nativeSpecFloor,
  normalizeBranch,
  resolveReleaseChannel,
  updateNativeVersion,
  validateVersion,
  withUpdatedNativeVersion,
} from "./release-branch-policy.mjs";
import { assertReleaseTag } from "./assert-release-tag.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const releaseWorkflows = {
  apple: { filename: "release-apple.yml", guardedJobs: 1 },
  expo: { filename: "release-expo.yml", guardedJobs: 2 },
  flutter: { filename: "release-flutter.yml", guardedJobs: 3 },
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

test("Godot dependency download changes trigger Godot CI", () => {
  const workflow = readWorkflow("ci-godot-iap.yml");
  const triggerSection = workflow.slice(0, workflow.indexOf("permissions:"));
  assert.equal(
    (triggerSection.match(/scripts\/fetch-godot-lib\.sh/gu) ?? []).length,
    2,
  );
});

test("Gradle wrappers pin distributions and validate tracked jars", () => {
  const expectedDistributionDigests = new Map([
    [
      "gradle-9.3.0-all.zip",
      "046f36af261f2c6ed09eef06bf25b93d1f20d5220991bb8a3f08fd5fb6f6629a",
    ],
    [
      "gradle-9.3.0-bin.zip",
      "0d585f69da091fc5b2beced877feab55a3064d43b8a1d46aeb07996b0915e0e0",
    ],
    [
      "gradle-9.3.1-bin.zip",
      "b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06",
    ],
  ]);
  const wrappers = execFileSync(
    "git",
    ["ls-files", "*gradle/wrapper/gradle-wrapper.properties"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  assert.equal(wrappers.length, 7);
  for (const wrapper of wrappers) {
    const properties = readFileSync(resolve(repoRoot, wrapper), "utf8");
    const asset = properties.match(/gradle-[\d.]+-(?:all|bin)\.zip/u)?.[0];
    assert.ok(asset, wrapper);
    assert.equal(
      properties.match(/^distributionSha256Sum=(\w+)$/mu)?.[1],
      expectedDistributionDigests.get(asset),
      wrapper,
    );
  }

  const ci = readWorkflow("ci.yml");
  assert.match(
    ci,
    /gradle\/actions\/wrapper-validation@9c971963bec38e04b3d30dcc455b5382be2fdbfb # v6/u,
  );
  assert.match(ci, /min-wrapper-count: 7/u);

  const makefile = readFileSync(
    resolve(repoRoot, "libraries/godot-iap/Makefile"),
    "utf8",
  );
  assert.match(
    makefile,
    /GRADLE_WRAPPER_SHA256 := d3b261c2820e9e3d8d639ed084900f11f4a86050a8f83342ade7b6bc9b0d2bdd/u,
  );
  assert.match(makefile, /shasum -a 256 -c -/u);
  assert.doesNotMatch(
    makefile,
    /gradle-wrapper\.jar";|gradle\/v[\d.]+\/gradle\/wrapper/u,
  );
});

test("React Native Ruby dependencies are locked and installed frozen", () => {
  const gemfile = readFileSync(
    resolve(repoRoot, "libraries/react-native-iap/example/Gemfile"),
    "utf8",
  );
  const lockfile = readFileSync(
    resolve(repoRoot, "libraries/react-native-iap/example/Gemfile.lock"),
    "utf8",
  );
  assert.match(gemfile, /^ruby ">= 3\.3\.0"$/mu);
  assert.match(gemfile, /^gem 'activesupport', '>= 7\.2\.3\.1', '< 8'$/mu);
  assert.match(gemfile, /^gem 'concurrent-ruby', '>= 1\.3\.7', '< 2'$/mu);
  const activeSupport = lockfile.match(
    /^    activesupport \(([^)]+)\)$/mu,
  )?.[1];
  const concurrentRuby = lockfile.match(
    /^    concurrent-ruby \(([^)]+)\)$/mu,
  )?.[1];
  assert.ok(activeSupport);
  assert.ok(concurrentRuby);
  assert.ok(
    activeSupport.localeCompare("7.2.3.1", undefined, { numeric: true }) >= 0,
  );
  assert.ok(
    concurrentRuby.localeCompare("1.3.7", undefined, { numeric: true }) >= 0,
  );

  for (const [filename, installStep] of [
    ["ci.yml", "Verify Ruby lock"],
    ["ci-react-native-iap.yml", "Install Ruby dependencies"],
    ["release-react-native.yml", "Install Ruby dependencies"],
    ["codeql.yml", "Build React Native Swift wrapper"],
  ]) {
    const workflow = readWorkflow(filename);
    const setup = extractNamedStep(workflow, "Setup Ruby").source;
    const install = extractNamedStep(workflow, installStep).source;
    assert.match(
      setup,
      /ruby\/setup-ruby@95ef2b042f9d7a56d8268cba8559e2842e2ad01b # v1/u,
    );
    assert.match(setup, /ruby-version: "3\.3"/u);
    assert.match(
      setup,
      /working-directory: libraries\/react-native-iap\/example/u,
    );
    assert.match(install, /BUNDLE_FROZEN=true bundle install/u);
  }

  const dependabot = readFileSync(
    resolve(repoRoot, ".github/dependabot.yml"),
    "utf8",
  );
  assert.match(dependabot, /package-ecosystem: "bundler"/u);
  assert.match(
    dependabot,
    /directory: "\/libraries\/react-native-iap\/example"/u,
  );
});

test("Godot release preserves its download helper across tag checkout", () => {
  const workflow = readWorkflow("release-godot.yml");
  const stageHelper = workflow.indexOf(
    "- name: Stage Godot dependency download helper",
  );
  const checkoutTag = workflow.indexOf(
    "- name: Checkout release tag (current version)",
  );
  const download = workflow.indexOf("- name: Download godot-lib.aar");

  assert.ok(stageHelper < checkoutTag);
  assert.ok(checkoutTag < download);
  assert.match(
    workflow.slice(stageHelper, checkoutTag),
    /cp "\$GITHUB_WORKSPACE\/scripts\/fetch-godot-lib\.sh"/u,
  );
  assert.match(
    workflow.slice(download),
    /bash "\$RUNNER_TEMP\/fetch-godot-lib\.sh"/u,
  );
});

test("Godot verifies the exact SwiftGodot commit before building it", () => {
  const makefile = readFileSync(
    resolve(repoRoot, "libraries/godot-iap/Makefile"),
    "utf8",
  );
  assert.match(
    makefile,
    /^SWIFT_GODOT_COMMIT \?= 2b0e39dc1c23454408f83c0a83ddf9c2516624c0$/mu,
  );
  assert.ok(
    (makefile.match(/actual_commit.*SWIFT_GODOT_COMMIT/gu) ?? []).length >= 2,
    "new and existing SwiftGodot checkouts must verify the exact commit",
  );
});

test("Godot local setup uses the checksum-pinned download helper", () => {
  const makefile = readFileSync(
    resolve(repoRoot, "libraries/godot-iap/Makefile"),
    "utf8",
  );
  const helper = readFileSync(
    resolve(repoRoot, "scripts/fetch-godot-lib.sh"),
    "utf8",
  );

  assert.match(makefile, /scripts\/fetch-godot-lib\.sh/u);
  assert.match(makefile, /"\$\(GODOT_VERSION\)-stable"/u);
  assert.doesNotMatch(makefile, /GODOT_LIB_URL|curl .*godot-lib/u);
  assert.match(helper, /shasum -a 256 -c -/u);
  assert.match(helper, /Verified existing \$asset/u);
});

function readWorkflow(filename) {
  return readFileSync(resolve(repoRoot, ".github/workflows", filename), "utf8");
}

test("release version commits use package@version subjects", () => {
  for (const [filename, subject] of [
    ["release-apple.yml", "openiap-apple@$VERSION"],
    ["release-google.yml", "openiap-google@$VERSION"],
    ["release-react-native.yml", "react-native-iap@${NEW_VERSION}"],
    ["release-expo.yml", "expo-iap@${NEW_VERSION}"],
    ["release-flutter.yml", "flutter_inapp_purchase@${NEW_VERSION}"],
    ["release-godot.yml", "godot-iap@$VERSION"],
    ["release-kmp.yml", "kmp-iap@$VERSION"],
    ["release-maui.yml", "maui-iap@$VERSION"],
    ["release-conformance.yml", "openiap-conformance@$VERSION"],
  ]) {
    const expectedCommit = `git commit -m "chore(release): ${subject}"`;
    const versionCommits = readWorkflow(filename)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith('git commit -m "chore(release):'));
    assert.ok(
      versionCommits.includes(expectedCommit),
      `${filename} must use the canonical release commit subject`,
    );
    assert.equal(versionCommits.length, 1, filename);
  }
});

function extractRunBlockContaining(workflow, marker) {
  const lines = workflow.split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(marker));
  assert.notEqual(markerIndex, -1, `missing run-block marker: ${marker}`);

  let runIndex = markerIndex;
  while (runIndex >= 0 && !/^\s*run:\s*\|\s*$/.test(lines[runIndex])) {
    runIndex -= 1;
  }
  assert.notEqual(runIndex, -1, `missing run block for: ${marker}`);

  const runIndent = lines[runIndex].match(/^\s*/)[0].length;
  let endIndex = runIndex + 1;
  while (endIndex < lines.length) {
    const line = lines[endIndex];
    if (line.trim() !== "" && line.match(/^\s*/)[0].length <= runIndent) {
      break;
    }
    endIndex += 1;
  }
  return lines.slice(runIndex, endIndex).join("\n");
}

function extractNamedStep(workflow, name) {
  const lines = workflow.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim() === `- name: ${name}`,
  );
  assert.notEqual(startIndex, -1, `missing workflow step: ${name}`);

  const stepIndent = lines[startIndex].match(/^\s*/)[0].length;
  let endIndex = startIndex + 1;
  while (endIndex < lines.length) {
    const line = lines[endIndex];
    if (
      line.trim() !== "" &&
      line.match(/^\s*/)[0].length === stepIndent &&
      line.trim().startsWith("- ")
    ) {
      break;
    }
    endIndex += 1;
  }
  return {
    endIndex,
    source: lines.slice(startIndex, endIndex).join("\n"),
    startIndex,
  };
}

function findExecutableLineIndex(source, pattern, startIndex = 0) {
  return source.split("\n").findIndex((line, index) => {
    if (index < startIndex || line.trimStart().startsWith("#")) return false;
    return pattern.test(line);
  });
}

function extractAppleExistingTagBranches(source) {
  const lines = source.split("\n");
  const bareStart = lines.findIndex((line) =>
    line.includes('if git rev-parse "$VERSION"'),
  );
  const legacyStart = lines.findIndex((line) =>
    line.includes('elif git rev-parse "apple-v$VERSION"'),
  );
  assert.ok(bareStart >= 0 && legacyStart > bareStart);

  const legacyIndent = lines[legacyStart].match(/^\s*/)[0].length;
  const outerElse = lines.findIndex(
    (line, index) =>
      index > legacyStart &&
      line.match(/^\s*/)[0].length === legacyIndent &&
      line.trim() === "else",
  );
  assert.ok(outerElse > legacyStart);
  return {
    bare: lines.slice(bareStart, legacyStart).join("\n"),
    legacy: lines.slice(legacyStart, outerElse).join("\n"),
  };
}

test("workflow shell guards ignore commented command decoys", () => {
  const commented = [
    "# node scripts/assert-release-tag.mjs \\",
    '#   apple "$RELEASE_BRANCH" "$RELEASE_TAG" "$VERSION"',
    '# git checkout "$RELEASE_TAG"',
  ].join("\n");
  assert.equal(
    findExecutableLineIndex(
      commented,
      /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
    ),
    -1,
  );
  assert.equal(findExecutableLineIndex(commented, /^\s*git checkout\b/), -1);
});

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
  assert.equal(validateVersion("2.1.0-1alpha", "test"), "2.1.0-1alpha");
  assert.equal(validateVersion("2.1.0-123-foo", "test"), "2.1.0-123-foo");
  assert.throws(() => validateVersion("02.1.0", "test"), /Invalid test/);
  assert.throws(() => validateVersion("2.1.0-01", "test"), /Invalid test/);
  assert.throws(() => validateVersion("2.1.0-rc..1", "test"), /Invalid test/);
});

test("compares stable, prerelease, and build metadata with SemVer precedence", () => {
  const ascendingVersions = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.1",
    "1.1.0",
    "2.0.0",
  ];
  for (let index = 1; index < ascendingVersions.length; index += 1) {
    assert.equal(
      compareSemVer(ascendingVersions[index - 1], ascendingVersions[index]),
      -1,
    );
    assert.equal(
      compareSemVer(ascendingVersions[index], ascendingVersions[index - 1]),
      1,
    );
  }
  assert.equal(compareSemVer("2.4.2+build.1", "2.4.2+build.99"), 0);
});

test("derives the spec from the lower native version", () => {
  assert.equal(nativeSpecFloor({ apple: "2.4.2", google: "2.5.0" }), "2.4.2");
  assert.equal(nativeSpecFloor({ apple: "2.6.0", google: "2.5.3" }), "2.5.3");
  assert.equal(nativeSpecFloor({ apple: "2.5.0", google: "2.5.0" }), "2.5.0");
  assert.equal(
    nativeSpecFloor({ apple: "2.5.0-rc.2", google: "2.5.0" }),
    "2.5.0-rc.2",
  );
  assert.equal(
    nativeSpecFloor({
      apple: "2.5.0+apple.2",
      google: "2.5.0+google.1",
    }),
    "2.5.0+apple.2",
  );
});

test("rejects specs both above and below the native version floor", () => {
  assert.equal(
    assertSpecMatchesNativeFloor({
      apple: "2.4.2",
      google: "2.5.0",
      spec: "2.4.2",
    }),
    "2.4.2",
  );
  assert.throws(
    () =>
      assertSpecMatchesNativeFloor({
        apple: "2.4.2",
        google: "2.5.0",
        spec: "2.5.1",
      }),
    /must equal the native version floor.*= 2\.4\.2/,
  );
  assert.throws(
    () =>
      assertSpecMatchesNativeFloor({
        apple: "2.4.2",
        google: "2.5.0",
        spec: "2.4.1",
      }),
    /must equal the native version floor.*= 2\.4\.2/,
  );
});

test("native updates atomically rederive the spec and preserve other fields", () => {
  assert.deepEqual(
    withUpdatedNativeVersion(
      {
        apple: "2.4.2",
        google: "2.5.0",
        internal: "preserved",
        spec: "9.9.9",
      },
      "apple",
      "2.4.3",
    ),
    {
      apple: "2.4.3",
      google: "2.5.0",
      internal: "preserved",
      spec: "2.4.3",
    },
  );
  assert.deepEqual(
    withUpdatedNativeVersion(
      { apple: "2.4.3", google: "2.5.0", spec: "2.4.3" },
      "google",
      "2.5.1",
    ),
    { apple: "2.4.3", google: "2.5.1", spec: "2.4.3" },
  );
  assert.deepEqual(
    withUpdatedNativeVersion(
      { apple: "2.4.3", google: "2.5.0", spec: "2.4.3" },
      "apple",
      "2.4.3",
    ),
    { apple: "2.4.3", google: "2.5.0", spec: "2.4.3" },
  );
  assert.throws(
    () =>
      withUpdatedNativeVersion(
        { apple: "2.4.3", google: "2.5.0", spec: "2.4.3" },
        "apple",
        "2.4.2",
      ),
    /target 2\.4\.2 must not be lower than current version 2\.4\.3/,
  );
  assert.throws(
    () =>
      withUpdatedNativeVersion(
        { apple: "2.4.3", google: "2.5.0", spec: "2.4.3" },
        "docs",
        "2.4.4",
      ),
    /Only native versions can derive the spec/,
  );
});

test("native version file updates write one consistent manifest", () => {
  const temporaryRoot = mkdtempSync(
    resolve(tmpdir(), "openiap-version-policy-"),
  );
  try {
    const manifestPath = resolve(temporaryRoot, "openiap-versions.json");
    const originalManifest = `${JSON.stringify({
      apple: "2.4.2",
      google: "2.5.0",
      retained: true,
      spec: "2.5.1",
    })}\n`;
    writeFileSync(manifestPath, originalManifest);
    assert.throws(
      () => updateNativeVersion("apple", "2.4.1", temporaryRoot),
      /must not be lower than current version 2\.4\.2/,
    );
    assert.equal(readFileSync(manifestPath, "utf8"), originalManifest);
    updateNativeVersion("apple", "2.4.3", temporaryRoot);
    assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), {
      apple: "2.4.3",
      google: "2.5.0",
      retained: true,
      spec: "2.4.3",
    });
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test("equal native updates repair a stale floor after clean rebase convergence", () => {
  const independentlyCombined = {
    apple: "2.4.3",
    google: "2.4.3",
    spec: "2.4.2",
  };
  assert.throws(
    () => assertSpecMatchesNativeFloor(independentlyCombined),
    /must equal the native version floor/,
  );
  assert.deepEqual(
    withUpdatedNativeVersion(independentlyCombined, "apple", "2.4.3"),
    {
      apple: "2.4.3",
      google: "2.4.3",
      spec: "2.4.3",
    },
  );
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

test("existing release tags must match metadata, origin, and release-branch ancestry", () => {
  const tagCommit = "b".repeat(40);
  const remoteHead = "c".repeat(40);
  const cases = [
    ["apple", "3.1.0", '{"apple":"3.1.0"}'],
    ["google", "google-3.1.0", '{"google":"3.1.0"}'],
    ["conformance", "openiap-conformance-3.1.0", '{"version":"3.1.0"}'],
    ["docs", "docs-3.1.0", '{"spec":"3.1.0"}'],
    ["expo", "expo-iap-3.1.0", '{"version":"3.1.0"}'],
    ["react-native", "react-native-iap-3.1.0", '{"version":"3.1.0"}'],
    ["flutter", "flutter-iap-3.1.0", "version: 3.1.0\n"],
    ["godot", "godot-iap-3.1.0", 'version="3.1.0"\n'],
    ["kmp", "kmp-iap-3.1.0", "libraryVersion=3.1.0\n"],
    [
      "maui",
      "maui-iap-3.1.0",
      "<PropertyGroup><PackageVersion>3.1.0</PackageVersion></PropertyGroup>",
    ],
  ];

  function gitMock(tag, metadata, overrides = {}) {
    return (args) => {
      switch (args[0]) {
        case "show":
          return overrides.metadata ?? metadata;
        case "rev-parse":
          return args[1].startsWith("refs/remotes/") ? remoteHead : tagCommit;
        case "ls-remote":
          return `${"a".repeat(40)}\trefs/tags/${tag}\n${overrides.remoteTagCommit ?? tagCommit}\trefs/tags/${tag}^{}`;
        case "fetch":
          return "";
        case "merge-base":
          if (overrides.offBranch) throw new Error("not an ancestor");
          return "";
        default:
          throw new Error(`Unexpected git command: ${args.join(" ")}`);
      }
    };
  }

  for (const [packageId, tag, metadata] of cases) {
    assert.doesNotThrow(() =>
      assertReleaseTag(
        { packageId, branch: "main", tag, expectedVersion: "3.1.0" },
        gitMock(tag, metadata),
      ),
    );
  }

  const [packageId, tag, metadata] = cases.find(
    ([candidate]) => candidate === "kmp",
  );
  assert.throws(
    () =>
      assertReleaseTag(
        { packageId, branch: "main", tag, expectedVersion: "3.1.0" },
        gitMock(tag, metadata, { metadata: "libraryVersion=9.9.9\n" }),
      ),
    /metadata version is 9\.9\.9, expected 3\.1\.0/,
  );
  assert.throws(
    () =>
      assertReleaseTag(
        { packageId, branch: "main", tag, expectedVersion: "3.1.0" },
        gitMock(tag, metadata, { remoteTagCommit: "d".repeat(40) }),
      ),
    /does not match its origin tag commit at verification time/,
  );
  assert.throws(
    () =>
      assertReleaseTag(
        { packageId, branch: "main", tag, expectedVersion: "3.1.0" },
        gitMock(tag, metadata, { offBranch: true }),
      ),
    /is not reachable from origin\/main/,
  );
});

test("framework release workflows refuse stale dispatch heads", () => {
  const guardScript = readFileSync(
    resolve(repoRoot, "scripts/assert-release-head.mjs"),
    "utf8",
  );
  assert.match(guardScript, /refs\/heads/);
  assert.match(guardScript, /"ls-remote", "--exit-code", "origin", ref/);
  assert.match(guardScript, /remoteHead !== expectedHead/);
  assert.match(guardScript, /review, CI, and E2E evidence/);

  const tagGuardScript = readFileSync(
    resolve(repoRoot, "scripts/assert-release-tag.mjs"),
    "utf8",
  );
  assert.match(tagGuardScript, /git.*show/s);
  assert.match(tagGuardScript, /ls-remote/);
  assert.match(tagGuardScript, /refs\/tags/);
  assert.match(tagGuardScript, /merge-base/);
  assert.match(tagGuardScript, /--is-ancestor/);
  assert.match(tagGuardScript, /metadata version is/);

  const appleExistingTagCheck = extractRunBlockContaining(
    readWorkflow("release-apple.yml"),
    "Use 'current' to retry with existing version.",
  );
  const appleTagBranches = extractAppleExistingTagBranches(
    appleExistingTagCheck,
  );
  for (const [name, branch] of Object.entries(appleTagBranches)) {
    assert.match(
      branch,
      /if \[ "\$SKIP_VERSION_COMMIT" = "true" \]; then/,
      name,
    );
    assert.match(
      branch,
      new RegExp(
        `${name === "legacy" ? "Legacy tag apple-v" : "Tag "}\\$VERSION already exists\\. Use 'current' to retry with existing version\\.`,
      ),
      name,
    );
    assert.notEqual(
      findExecutableLineIndex(branch, /^\s*exit 1\s*$/),
      -1,
      `${name} existing-tag rejection must execute exit 1`,
    );
  }

  for (const [filename, packageId] of [
    ["release-apple.yml", "apple"],
    ["release-google.yml", "google"],
    ["release-expo.yml", "expo"],
    ["release-react-native.yml", "react-native"],
    ["release-flutter.yml", "flutter"],
  ]) {
    const workflow = readWorkflow(filename);
    const existingTagRunBlock = extractRunBlockContaining(
      workflow,
      "assert-release-tag.mjs",
    );
    const guardIndex = findExecutableLineIndex(
      existingTagRunBlock,
      /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
    );
    const packageArgumentIndex = findExecutableLineIndex(
      existingTagRunBlock,
      new RegExp(`^\\s*${packageId} "\\$RELEASE_BRANCH"`),
      guardIndex + 1,
    );
    const checkoutIndex = findExecutableLineIndex(
      existingTagRunBlock,
      /^\s*git checkout\b/,
      packageArgumentIndex + 1,
    );
    assert.ok(
      guardIndex >= 0 &&
        packageArgumentIndex === guardIndex + 1 &&
        checkoutIndex > packageArgumentIndex,
      `${filename} must verify and check out the tag in one shell block`,
    );
  }

  for (const [filename, expectedIf] of [
    [
      "release-apple.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
    [
      "release-google.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
    ["release-expo.yml", "if: ${{ inputs.version == 'current' }}"],
    ["release-react-native.yml", "if: ${{ inputs.version == 'current' }}"],
    ["release-flutter.yml", "if: ${{ inputs.version == 'current' }}"],
  ]) {
    const tagStep = extractNamedStep(
      readWorkflow(filename),
      "Checkout release tag (current version)",
    );
    const tagStepIf = tagStep.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"));
    assert.equal(tagStepIf?.trim(), expectedIf, filename);
    const guardIndex = findExecutableLineIndex(
      tagStep.source,
      /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
    );
    const checkoutIndex = findExecutableLineIndex(
      tagStep.source,
      /^\s*git checkout\b/,
      guardIndex + 1,
    );
    assert.ok(
      guardIndex >= 0 && checkoutIndex > guardIndex,
      `${filename} must execute the guard before checkout in the conditioned step`,
    );
  }

  for (const [filename, expectedIf] of [
    [
      "release-godot.yml",
      "if: ${{ inputs.version == 'current' && steps.check_tag.outputs.exists == 'true' }}",
    ],
    [
      "release-kmp.yml",
      "if: ${{ inputs.version == 'current' && steps.check_tag.outputs.exists == 'true' }}",
    ],
    [
      "release-maui.yml",
      "if: steps.version.outputs.skip_version_commit == 'true' && steps.check_tag.outputs.exists == 'true'",
    ],
  ]) {
    const workflow = readWorkflow(filename);
    const guardStep = extractNamedStep(
      workflow,
      "Verify current release tag provenance",
    );
    const checkoutStep = extractNamedStep(
      workflow,
      "Checkout release tag (current version)",
    );
    const guardIf = guardStep.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"));
    const checkoutIf = checkoutStep.source
      .split("\n")
      .find((line) => line.trim().startsWith("if:"));
    assert.equal(
      guardIf?.trim(),
      expectedIf,
      `${filename} guard step must use the existing-tag condition`,
    );
    assert.equal(
      checkoutIf?.trim(),
      expectedIf,
      `${filename} checkout step must use the same condition`,
    );
    assert.notEqual(
      findExecutableLineIndex(
        guardStep.source,
        /^\s*node\b.*assert-release-tag\.mjs"?\s*\\\s*$/,
      ),
      -1,
    );
    assert.notEqual(
      findExecutableLineIndex(checkoutStep.source, /^\s*git checkout\b/),
      -1,
    );
    assert.equal(
      guardStep.endIndex,
      checkoutStep.startIndex,
      `${filename} guard step must be immediately before checkout`,
    );
  }

  for (const filename of [
    "release-expo.yml",
    "release-flutter.yml",
    "release-godot.yml",
    "release-kmp.yml",
    "release-maui.yml",
    "release-react-native.yml",
  ]) {
    const workflow = readWorkflow(filename);
    assert.match(
      workflow,
      /assert-release-head\.mjs" "\$RELEASE_BRANCH" "\$GITHUB_SHA"/,
      filename,
    );
    assert.doesNotMatch(
      workflow,
      /git pull --rebase origin "\$RELEASE_BRANCH"/,
      filename,
    );
    if (
      [
        "release-expo.yml",
        "release-flutter.yml",
        "release-godot.yml",
        "release-react-native.yml",
      ].includes(filename)
    ) {
      assert.match(
        workflow,
        /git push --atomic origin "HEAD:\$RELEASE_BRANCH" --follow-tags/,
        filename,
      );
      assert.doesNotMatch(
        workflow,
        /git push origin "HEAD:\$RELEASE_BRANCH" --follow-tags/,
        filename,
      );
      assert.match(
        workflow,
        /git push --atomic origin \\\n\s+"HEAD:refs\/heads\/\$RELEASE_BRANCH" \\\n\s+"refs\/tags\/\$RELEASE_TAG:refs\/tags\/\$RELEASE_TAG"/,
        `${filename} current-version push`,
      );
      assert.match(
        workflow,
        /git commit --allow-empty -m "chore: recover release ref"/,
        `${filename} current-version compare-and-swap commit`,
      );
      assert.match(
        workflow,
        /git tag -a "\$RELEASE_TAG" "\$GITHUB_SHA" -m "Release \$RELEASE_TAG"/,
        `${filename} current-version tag target`,
      );
      const recoveryIndex = workflow.indexOf("git commit --allow-empty");
      const currentTagIndex = workflow.indexOf(
        'git tag -a "$RELEASE_TAG" "$GITHUB_SHA"',
      );
      const guardedPushIndex = workflow.indexOf(
        '"HEAD:refs/heads/$RELEASE_BRANCH"',
      );
      assert.ok(recoveryIndex < currentTagIndex, filename);
      assert.ok(currentTagIndex < guardedPushIndex, filename);
    }
  }

  for (const [filename, registryStep] of [
    ["release-expo.yml", "- name: Check if npm package already published"],
    [
      "release-react-native.yml",
      "- name: Check if npm package already published",
    ],
    [
      "release-flutter.yml",
      "- name: Check if pub.dev package already published",
    ],
  ]) {
    const workflow = readWorkflow(filename);
    assert.match(
      workflow,
      /- name: Assert verified release head is unchanged\n\s+if: \$\{\{ inputs\.version != 'current' \|\| steps\.check_tag\.outputs\.exists != 'true' \}\}/,
      `${filename} must not load a branch-only guard script after checking out an existing release tag`,
    );
    assert.match(workflow, /Refuse an untagged published version/);
    assert.match(workflow, /published without a provenance tag/);
    assert.ok(
      workflow.indexOf(registryStep) < workflow.indexOf("git tag -a"),
      `${filename} must verify its registry before creating a missing tag`,
    );
    assert.doesNotMatch(workflow, /gitHead 2>\/dev\/null \|\| true/);
    if (["release-expo.yml", "release-react-native.yml"].includes(filename)) {
      const recoveryPushIndex = workflow.indexOf(
        '"refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
      );
      const legacyGuardIndex = workflow.indexOf(
        "- name: Require tag-ref npm publisher capability",
      );
      const authorizationWriteIndex = workflow.indexOf(
        "- name: Write npm publish authorization",
      );
      const authorizationUploadIndex = workflow.indexOf(
        "- name: Upload npm publish authorization",
      );
      const dispatchIndex = workflow.indexOf(
        "- name: Dispatch npm publish on tag ref",
      );
      const workflowDispatchCommandIndex = workflow.indexOf(
        "gh workflow run release-",
      );
      const publishJobIndex = workflow.indexOf("\n  publish-npm:\n");
      const tagGuardIndex = workflow.indexOf(
        'if [ "$GITHUB_REF" != "$EXPECTED_REF" ]; then',
      );
      const sourceRunGuardIndex = workflow.indexOf(
        "- name: Require successful source release run",
      );
      const sourceAuthorizationIndex = workflow.indexOf(
        "- name: Verify source run authorized this release tag",
      );
      const finalSourceGuardIndex = workflow.indexOf(
        "- name: Assert npm publish source is unchanged",
      );
      const publishIndex = workflow.indexOf("- name: Publish to npm");
      const publishedProvenanceIndex = workflow.indexOf(
        "- name: Verify published npm release provenance",
      );
      assert.match(workflow, /publish_only:/);
      assert.match(workflow, /source_run_id:/);
      assert.match(workflow, /source_run_attempt:/);
      assert.match(workflow, /if: \$\{\{ !inputs\.publish_only \}\}/);
      assert.match(
        workflow,
        /group: \$\{\{ github\.workflow \}\}-\$\{\{ inputs\.publish_only && 'publish' \|\| 'release' \}\}/,
      );
      assert.match(
        workflow,
        /gh workflow run release-(?:expo|react-native)\.yml --ref "\$TAG" \\\n\s+-f version=current \\\n\s+-f publish_only=true \\\n\s+-f source_run_id="\$GITHUB_RUN_ID" \\\n\s+-f source_run_attempt="\$GITHUB_RUN_ATTEMPT"/,
      );
      assert.match(workflow, /if: \$\{\{ inputs\.publish_only \}\}/);
      assert.match(workflow, /actions: read/);
      assert.match(workflow, /fetch-depth: 0/);
      assert.match(
        workflow,
        /EXPECTED_REF="refs\/tags\/(?:expo|react-native)-iap-\$VERSION"/,
      );
      assert.match(
        workflow,
        /if \[ "\$\(git rev-parse HEAD\)" != "\$GITHUB_SHA" \]; then/,
      );
      assert.match(
        workflow,
        /git merge-base --is-ancestor "\$GITHUB_SHA" "origin\/\$SOURCE_BRANCH"/,
      );
      assert.match(
        workflow,
        /actions\/runs\/\$SOURCE_RUN_ID\/attempts\/\$SOURCE_RUN_ATTEMPT/,
      );
      assert.match(
        workflow,
        /SOURCE_RESPONSE_ATTEMPT" != "\$SOURCE_RUN_ATTEMPT"/,
      );
      assert.match(workflow, /SOURCE_CONCLUSION" != "success"/);
      assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}\s+# v4/);
      assert.ok(
        workflow.includes(
          `git -C "$GITHUB_WORKSPACE" grep -q '^  publish-npm:' "$TAG" -- .github/workflows/${filename}`,
        ),
        `${filename} must inspect its root workflow file from the library working directory`,
      );
      assert.ok(
        workflow.includes(
          'git -C "$GITHUB_WORKSPACE" cat-file -e "$TAG:scripts/npm-publish-authorization.mjs"',
        ),
        `${filename} must inspect its tag authorization script from the repository root`,
      );
      assert.match(
        workflow,
        /name: npm-publish-authorization-\$\{\{ github\.run_attempt \}\}/,
      );
      assert.match(workflow, /gh run download "\$SOURCE_RUN_ID"/);
      assert.match(workflow, /npm-publish-authorization\.mjs" verify/);
      assert.match(workflow, /verify-npm-release-provenance\.mjs/);
      assert.match(workflow, /npm install -g npm@11\.19\.0/);
      assert.equal(
        (workflow.match(/id-token: write/g) ?? []).length,
        1,
        `${filename} OIDC permission must be isolated to the tag publisher`,
      );
      assert.doesNotMatch(workflow, /git checkout --detach "\$GITHUB_SHA"/);
      assert.ok(recoveryPushIndex < legacyGuardIndex, filename);
      assert.ok(legacyGuardIndex < authorizationWriteIndex, filename);
      assert.ok(authorizationWriteIndex < authorizationUploadIndex, filename);
      assert.ok(authorizationUploadIndex < dispatchIndex, filename);
      assert.ok(dispatchIndex < workflowDispatchCommandIndex, filename);
      assert.ok(workflowDispatchCommandIndex < publishJobIndex, filename);
      assert.ok(publishJobIndex < tagGuardIndex, filename);
      assert.ok(tagGuardIndex < sourceRunGuardIndex, filename);
      assert.ok(sourceRunGuardIndex < sourceAuthorizationIndex, filename);
      assert.ok(sourceAuthorizationIndex < finalSourceGuardIndex, filename);
      assert.ok(finalSourceGuardIndex < publishIndex, filename);
      assert.ok(publishIndex < publishedProvenanceIndex, filename);
      const publishedProvenanceStep = extractNamedStep(
        workflow,
        "Verify published npm release provenance",
      ).source;
      assert.match(
        publishedProvenanceStep,
        /Allow five minutes for the immutable provenance to propagate/,
      );
      assert.match(
        publishedProvenanceStep,
        /^\s*for attempt in \{1\.\.30\}; do\s*$/mu,
      );
      assert.match(publishedProvenanceStep, /^\s*sleep 10\s*$/mu);
    }
  }

  const kmpWorkflow = readWorkflow("release-kmp.yml");
  const mauiWorkflow = readWorkflow("release-maui.yml");
  assert.match(
    kmpWorkflow,
    /if: \$\{\{ inputs\.version != 'current' \|\| steps\.check_tag\.outputs\.exists != 'true' \}\}/,
  );
  assert.match(
    mauiWorkflow,
    /if: \$\{\{ steps\.version\.outputs\.skip_version_commit != 'true' \|\| steps\.check_tag\.outputs\.exists != 'true' \}\}/,
  );
  for (const [filename, workflow, publishStep] of [
    ["release-kmp.yml", kmpWorkflow, "Publish to Maven Central"],
    ["release-maui.yml", mauiWorkflow, "Publish to NuGet.org"],
  ]) {
    assert.match(
      workflow,
      /git push --atomic origin \\\n\s+"HEAD:\$RELEASE_BRANCH" \\\n\s+"refs\/tags\/\$RELEASE_TAG:refs\/tags\/\$RELEASE_TAG"/,
      filename,
    );
    assert.doesNotMatch(
      workflow,
      /git push origin "(?:HEAD:\$RELEASE_BRANCH|\$RELEASE_TAG|(?:kmp|maui)-iap-\$VERSION)"/,
      filename,
    );
    assert.match(workflow, /published without a provenance tag/);
    assert.match(
      workflow,
      /git commit --allow-empty -m "chore: recover release ref"/,
      filename,
    );
    assert.match(workflow, /TAG_TARGET="\$GITHUB_SHA"/, filename);
    assert.ok(
      workflow.indexOf("git commit --allow-empty") <
        workflow.indexOf('git tag -a "$RELEASE_TAG" "$TAG_TARGET"'),
      filename,
    );
    assert.ok(
      workflow.indexOf('git tag -a "$RELEASE_TAG" "$TAG_TARGET"') <
        workflow.indexOf('"HEAD:$RELEASE_BRANCH"'),
      filename,
    );
    assert.ok(
      workflow.indexOf(
        filename === "release-kmp.yml"
          ? "- name: Preflight Maven Central publication"
          : "- name: Preflight NuGet publication",
      ) < workflow.indexOf("- name: Create and push tag"),
      `${filename} must validate publication credentials before pushing the release tag`,
    );
    assert.ok(
      workflow.indexOf("- name: Create and push tag") <
        workflow.indexOf(`- name: ${publishStep}`),
      `${filename} must push immutable provenance before registry publication`,
    );
  }
  assert.match(mauiWorkflow, /Check if NuGet package already published/);
  assert.match(
    mauiWorkflow,
    /if: steps\.check_nuget\.outputs\.exists == 'false'/,
  );
});

test("Flutter publication is triggered by the immutable tag push", () => {
  const releaseWorkflow = readWorkflow("release-flutter.yml");
  const publishWorkflow = readWorkflow("publish-flutter.yml");
  const createTagIndex = releaseWorkflow.indexOf("- name: Create release tag");
  const writeAuthorizationIndex = releaseWorkflow.indexOf(
    "- name: Write Flutter publish authorization",
  );
  const uploadAuthorizationIndex = releaseWorkflow.indexOf(
    "- name: Upload Flutter publish authorization",
  );
  const pushTagIndex = releaseWorkflow.indexOf("- name: Push commit and tag");
  assert.doesNotMatch(releaseWorkflow, /gh workflow run publish-flutter\.yml/);
  assert.doesNotMatch(publishWorkflow, /workflow_dispatch:/);
  assert.match(
    publishWorkflow,
    /^  push:\n    tags:\n      - "flutter-iap-\*"/m,
  );
  assert.match(publishWorkflow, /group: publish-flutter/);
  assert.match(publishWorkflow, /actions: read/);
  assert.doesNotMatch(publishWorkflow, /^    environment: pub\.dev$/m);
  assert.match(publishWorkflow, /fetch-depth: 0/);
  assert.match(
    releaseWorkflow,
    /git -C "\$GITHUB_WORKSPACE" grep -q "Verify release workflow authorization" "\$TAG" -- \\\n+\s+\.github\/workflows\/publish-flutter\.yml \|\| \\\n+\s+! git -C "\$GITHUB_WORKSPACE" cat-file -e "\$TAG:scripts\/npm-publish-authorization\.mjs"/,
    "Flutter release must inspect the root publish workflow and tag authorization script from its library working directory",
  );
  assert.match(
    publishWorkflow,
    /EXPECTED_REF="refs\/tags\/flutter-iap-\$\{VERSION\}"/,
  );
  assert.match(publishWorkflow, /GITHUB_EVENT_NAME.*push/);
  assert.match(publishWorkflow, /GITHUB_REF_TYPE.*tag/);
  assert.match(publishWorkflow, /HEAD_COMMIT.*GITHUB_SHA/);
  assert.match(
    publishWorkflow,
    /git merge-base --is-ancestor "\$GITHUB_SHA" "origin\/\$RELEASE_BRANCH"/,
  );
  assert.match(
    publishWorkflow,
    /AUTHORIZATION_NAME="flutter-publish-authorization-\$GITHUB_SHA"/,
  );
  assert.match(
    publishWorkflow,
    /actions\/artifacts\?name=\$AUTHORIZATION_NAME/,
  );
  assert.match(
    publishWorkflow,
    /SOURCE_WORKFLOW_PATH" != "\.github\/workflows\/release-flutter\.yml"/,
  );
  assert.match(publishWorkflow, /gh run download "\$SOURCE_RUN_ID"/);
  assert.match(
    publishWorkflow,
    /SOURCE_RUN_ATTEMPT=\$\(jq -r '\.sourceRunAttempt \/\/ ""'/,
  );
  assert.match(
    publishWorkflow,
    /actions\/runs\/\$SOURCE_RUN_ID\/attempts\/\$SOURCE_RUN_ATTEMPT/,
  );
  assert.match(
    publishWorkflow,
    /SOURCE_RUN_ATTEMPT_ACTUAL" != "\$SOURCE_RUN_ATTEMPT"/,
  );
  assert.doesNotMatch(publishWorkflow, /actions\/runs\/\$SOURCE_RUN_ID"\)/);
  assert.match(publishWorkflow, /npm-publish-authorization\.mjs" verify/);
  assert.match(
    releaseWorkflow,
    /name: flutter-publish-authorization-\$\{\{ steps\.flutter_auth\.outputs\.tag_sha \}\}/,
  );
  assert.match(releaseWorkflow, /overwrite: true/);
  assert.ok(createTagIndex < writeAuthorizationIndex);
  assert.ok(writeAuthorizationIndex < uploadAuthorizationIndex);
  assert.ok(uploadAuthorizationIndex < pushTagIndex);
  assert.match(releaseWorkflow, /Wait for tag-push pub\.dev publisher/);
  assert.match(
    releaseWorkflow,
    /predates the authorized tag-push publisher and cannot be retried safely/,
  );
  assert.match(
    releaseWorkflow,
    /AUTHORIZATION_NAME="flutter-publish-authorization-\$TAG_COMMIT"/,
  );
  assert.match(releaseWorkflow, /AUTHORIZATION_COUNT[\s\S]*?expired == false/);
  assert.match(releaseWorkflow, /event=push&head_sha=\$TAG_COMMIT/);
  assert.match(releaseWorkflow, /gh run rerun "\$RUN_ID"/);
  const checkout = extractNamedStep(releaseWorkflow, "Checkout").source;
  assert.doesNotMatch(checkout, /DEPENDENCY_UPDATE_PAT/);
  const wait = extractNamedStep(
    releaseWorkflow,
    "Wait for tag-push pub.dev publisher",
  ).source;
  assert.match(wait, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(wait, /DEPENDENCY_UPDATE_PAT/);
});

test("production docs are guarded as stable-only", () => {
  const docsRelease = readWorkflow("release.yml");
  const deployScript = readFileSync(
    resolve(repoRoot, "scripts/deploy.sh"),
    "utf8",
  );
  const syncScript = readFileSync(
    resolve(repoRoot, "scripts/sync-versions.sh"),
    "utf8",
  );
  assert.match(docsRelease, /release-branch-policy\.mjs guard docs/);
  assert.match(docsRelease, /release-branch-policy\.mjs assert-floor/);
  assert.match(docsRelease, /Release the native-derived current spec version/);
  assert.match(
    docsRelease,
    /assert-release-tag\.mjs docs main "\$TAG_NAME" "\$VERSION"/,
  );
  assert.match(docsRelease, /git checkout --detach "\$TAG_NAME"/);
  assert.match(docsRelease, /continuing the idempotent release rerun/);
  assert.match(docsRelease, /persist-credentials: false/);
  assert.match(docsRelease, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(docsRelease, /gh auth setup-git/);
  assert.doesNotMatch(docsRelease, /^\s+- (?:patch|minor|major)$/m);
  assert.doesNotMatch(
    docsRelease,
    /(?:\.spec\s*=\s*\$version|git commit|git pull --rebase|git push origin main)/,
  );
  assert.match(deployScript, /release-branch-policy\.mjs guard docs/);
  assert.match(deployScript, /release-branch-policy\.mjs assert-floor/);
  assert.match(deployScript, /Production docs accept stable versions only/);
  assert.match(deployScript, /requires a clean worktree/);
  assert.match(deployScript, /OpenIAP Spec cannot be bumped independently/);
  assert.match(deployScript, /DOCS_TAG="docs-\$VERSION"/);
  assert.match(deployScript, /git ls-remote --exit-code --tags origin/);
  assert.match(deployScript, /DOCS_TAG_STATUS=\$\?/);
  assert.match(deployScript, /\[ "\$DOCS_TAG_STATUS" -eq 2 \]/);
  assert.match(
    deployScript,
    /already exists, so no new Docs GitHub Release is needed/,
  );
  assert.match(deployScript, /has no Docs GitHub Release yet/);
  assert.match(deployScript, /Unable to determine whether \$DOCS_TAG exists/);
  assert.match(
    deployScript,
    /Check the remote tag state before creating a Docs GitHub Release/,
  );
  assert.doesNotMatch(
    deployScript,
    /(?:\.spec\s*=\s*\$version|git commit|git push origin HEAD:main)/,
  );
  assert.doesNotMatch(deployScript, /continue anyway/);
  assert.ok(
    docsRelease.indexOf("release-branch-policy.mjs guard docs") <
      docsRelease.indexOf("Read derived spec version"),
  );
  assert.ok(
    deployScript.indexOf("release-branch-policy.mjs assert-floor") <
      deployScript.indexOf("Checking Git status"),
  );
  assert.ok(
    deployScript.indexOf("Checking Git status") <
      deployScript.indexOf("command -v vercel"),
  );
  assert.ok(
    syncScript.indexOf("release-branch-policy.mjs assert-floor") <
      syncScript.indexOf('echo "📦 Syncing version files..."'),
  );
});

test("native releases refuse branch drift after the verified head", () => {
  for (const [filename, packageId] of [
    ["release-apple.yml", "apple"],
    ["release-google.yml", "google"],
  ]) {
    const workflow = readWorkflow(filename);
    assert.equal(
      workflow.split(`update-native ${packageId} "$VERSION"`).length - 1,
      1,
      filename,
    );
    const headGuardIndex = workflow.indexOf(
      'assert-release-head.mjs "$RELEASE_BRANCH" "$GITHUB_SHA"',
    );
    const commitIndex = workflow.indexOf(`openiap-${packageId}@$VERSION`);
    const assertFloorIndex = workflow.lastIndexOf(
      "release-branch-policy.mjs assert-floor",
    );
    const pushIndex = workflow.indexOf(
      'git push origin "HEAD:$RELEASE_BRANCH"',
    );
    assert.ok(headGuardIndex < commitIndex, filename);
    assert.ok(commitIndex < assertFloorIndex, filename);
    assert.ok(assertFloorIndex < pushIndex, filename);
    assert.match(workflow, /Release branch moved after verification/u);
    assert.doesNotMatch(workflow, /git pull --rebase|git rebase --continue/u);
    assert.doesNotMatch(
      workflow,
      new RegExp(`\\.${packageId}\\s*=\\s*\\$version`),
      filename,
    );
  }
});

test("conformance npm publication binds the exact source run attempt", () => {
  const workflow = readWorkflow("release-conformance.yml");
  assert.match(workflow, /source_run_attempt:/u);
  assert.match(
    workflow,
    /-f source_run_id="\$GITHUB_RUN_ID" \\\n\s+-f source_run_attempt="\$GITHUB_RUN_ATTEMPT"/u,
  );
  assert.match(
    workflow,
    /actions\/runs\/\$SOURCE_RUN_ID\/attempts\/\$SOURCE_RUN_ATTEMPT/u,
  );
  assert.match(workflow, /SOURCE_RESPONSE_ATTEMPT" != "\$SOURCE_RUN_ATTEMPT"/u);
  assert.match(
    workflow,
    /name: npm-publish-authorization-\$\{\{ github\.run_attempt \}\}/u,
  );
  assert.match(
    workflow,
    /--name "npm-publish-authorization-\$SOURCE_RUN_ATTEMPT"/u,
  );
  const attemptGuard = workflow.indexOf(
    "Require successful source release run",
  );
  const authorizationGuard = workflow.indexOf(
    "Verify source run authorized this release tag",
  );
  const publish = workflow.indexOf(
    "- name: Publish to npm",
    authorizationGuard,
  );
  const publishedProvenanceStep = extractNamedStep(
    workflow,
    "Verify published provenance",
  ).source;
  assert.ok(attemptGuard < authorizationGuard);
  assert.ok(authorizationGuard < publish);
  assert.match(
    publishedProvenanceStep,
    /Allow five minutes for the immutable provenance to propagate/u,
  );
  assert.match(
    publishedProvenanceStep,
    /^\s*for _attempt in \{1\.\.30\}; do\s*$/mu,
  );
  assert.match(
    publishedProvenanceStep,
    /if node scripts\/verify-npm-release-provenance\.mjs \\\n\s+openiap-conformance "\$VERSION" "\$GITHUB_SHA"/u,
  );
  assert.match(publishedProvenanceStep, /^\s*sleep 10\s*$/mu);
  assert.match(
    publishedProvenanceStep,
    /if \[ "\$VERIFIED" != "true" \]; then[\s\S]*?exit 1[\s\S]*?fi/u,
  );
});

test("conformance releases cannot under-version breaking suite changes", () => {
  const workflow = readWorkflow("release-conformance.yml");
  const checkoutTag = workflow.indexOf(
    "- name: Checkout release tag (current version)",
  );
  const suiteMajor = workflow.indexOf(
    "- name: Enforce npm major covers suite major",
  );
  const registryCheck = workflow.indexOf(
    "- name: Check npm for an existing version",
  );

  assert.ok(checkoutTag < suiteMajor);
  assert.ok(suiteMajor < registryCheck);
  assert.match(
    workflow.slice(suiteMajor, registryCheck),
    /PACKAGE_MAJOR.*-lt.*SUITE_MAJOR/u,
  );
  assert.match(
    workflow.slice(suiteMajor, registryCheck),
    /Release with version=major/u,
  );
});

test("npm trusted publishers use a supported Node runtime", () => {
  for (const filename of [
    "release-conformance.yml",
    "release-expo.yml",
    "release-react-native.yml",
  ]) {
    const workflow = readWorkflow(filename);
    const publishJob = workflow.slice(workflow.indexOf("\n  publish-npm:\n"));
    assert.match(publishJob, /node-version: 24/u, filename);
    assert.match(publishJob, /npm install -g npm@11\.19\.0/u, filename);
    const sourceJob = workflow.slice(0, workflow.indexOf("\n  publish-npm:\n"));
    const dispatchStep = sourceJob.slice(
      sourceJob.indexOf("- name: Dispatch npm publish on tag ref"),
    );
    assert.match(
      dispatchStep,
      /GH_TOKEN: \$\{\{ github\.token \}\}/u,
      filename,
    );
    assert.doesNotMatch(dispatchStep, /DEPENDENCY_UPDATE_PAT/u, filename);
  }
});

test("release pushes expose credentials only in their owning step", () => {
  for (const filename of [
    "release.yml",
    "release-apple.yml",
    "release-conformance.yml",
    "release-expo.yml",
    "release-flutter.yml",
    "release-godot.yml",
    "release-google.yml",
    "release-kmp.yml",
    "release-maui.yml",
    "release-react-native.yml",
  ]) {
    const workflow = readWorkflow(filename);
    const lines = workflow.split("\n");
    const pushLines = lines
      .map((line, index) => ({ index, line: line.trim() }))
      .filter(({ line }) => /^(?:if ! )?git push\b/u.test(line));
    assert.ok(pushLines.length > 0, filename);
    for (const { index } of pushLines) {
      let start = index;
      while (start >= 0 && !/^\s+- name:/u.test(lines[start])) start -= 1;
      let end = index + 1;
      while (end < lines.length && !/^\s+- name:/u.test(lines[end])) end += 1;
      const step = lines.slice(start, end).join("\n");
      assert.match(step, /GH_TOKEN:/u, `${filename}:${index + 1}`);
      assert.match(step, /gh auth setup-git/u, `${filename}:${index + 1}`);
    }
  }
});

test("Apple release preflights CocoaPods before repository mutation", () => {
  const workflow = readWorkflow("release-apple.yml");
  const registry = workflow.indexOf(
    "- name: Check CocoaPods publication state",
  );
  const credentials = workflow.indexOf("- name: Require CocoaPods credentials");
  const versionUpdate = workflow.indexOf(
    "- name: Update version in openiap-versions.json",
  );
  const validation = workflow.indexOf("- name: Validate Podspec");
  const commit = workflow.indexOf("- name: Commit version update");
  const tag = workflow.indexOf("- name: Create and push tag");
  assert.ok(registry < credentials);
  assert.ok(credentials < versionUpdate);
  assert.ok(validation < commit);
  assert.ok(commit < tag);
  assert.match(
    workflow.slice(credentials, versionUpdate),
    /if: steps\.check_cocoapods\.outputs\.exists == 'false'/u,
  );
  assert.match(
    workflow.slice(registry, credentials),
    /if ! POD_INFO=\$\(pod trunk info openiap\); then/u,
  );
});

test("Godot imports and removes signing credentials around codesigning", () => {
  const workflow = readWorkflow("release-godot.yml");
  const androidBuild = workflow.indexOf("- name: Build Android AAR");
  const certificate = workflow.indexOf(
    "- name: Import Developer ID certificate",
  );
  const signing = workflow.indexOf("- name: Prepare addon directory");
  const verify = workflow.indexOf("- name: Verify release zip");
  const cleanup = workflow.indexOf("- name: Remove Apple signing credentials");
  const mutation = workflow.indexOf("- name: Commit version update and tag");
  assert.ok(androidBuild < certificate);
  assert.ok(certificate < signing);
  assert.ok(signing < verify);
  assert.ok(verify < cleanup);
  assert.ok(cleanup < mutation);
  assert.match(
    workflow.slice(cleanup, mutation),
    /if: \$\{\{ always\(\) && inputs\.notarize_macos \}\}/u,
  );
  assert.match(workflow.slice(cleanup, mutation), /security delete-keychain/u);
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
