import assert from "node:assert/strict";
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

test("framework release workflows refuse stale dispatch heads", () => {
  const guardScript = readFileSync(
    resolve(repoRoot, "scripts/assert-release-head.mjs"),
    "utf8",
  );
  assert.match(guardScript, /refs\/heads/);
  assert.match(guardScript, /"ls-remote", "--exit-code", "origin", ref/);
  assert.match(guardScript, /remoteHead !== expectedHead/);
  assert.match(guardScript, /review, CI, and E2E evidence/);

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
      assert.match(workflow, /if: \$\{\{ !inputs\.publish_only \}\}/);
      assert.match(
        workflow,
        /group: \$\{\{ github\.workflow \}\}-\$\{\{ inputs\.publish_only && 'publish' \|\| 'release' \}\}/,
      );
      assert.match(
        workflow,
        /gh workflow run release-(?:expo|react-native)\.yml --ref "\$TAG" \\\n\s+-f version=current \\\n\s+-f publish_only=true \\\n\s+-f source_run_id="\$GITHUB_RUN_ID"/,
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
      assert.match(workflow, /actions\/runs\/\$SOURCE_RUN_ID/);
      assert.match(workflow, /SOURCE_CONCLUSION" != "success"/);
      assert.match(workflow, /actions\/upload-artifact@v4/);
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
  assert.match(publishWorkflow, /^    environment: pub\.dev$/m);
  assert.match(publishWorkflow, /fetch-depth: 0/);
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
    /TAG_COMMIT=\$\(git rev-parse "refs\/tags\/\$TAG_NAME\^\{commit\}"\)/,
  );
  assert.match(docsRelease, /HEAD_COMMIT=\$\(git rev-parse HEAD\)/);
  assert.match(docsRelease, /released spec tag is immutable/);
  assert.match(docsRelease, /allowing an idempotent rerun/);
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

test("native release workflows converge the spec before every push", () => {
  for (const [filename, packageId] of [
    ["release-apple.yml", "apple"],
    ["release-google.yml", "google"],
  ]) {
    const workflow = readWorkflow(filename);
    assert.equal(
      workflow.split(`update-native ${packageId} "$VERSION"`).length - 1,
      3,
      filename,
    );
    const pullIndex = workflow.indexOf(
      'git pull --rebase origin "$RELEASE_BRANCH"',
    );
    const rebaseContinueIndex = workflow.indexOf(
      "GIT_EDITOR=true git rebase --continue",
    );
    const convergenceIndex = workflow.lastIndexOf(
      `update-native ${packageId} "$VERSION"`,
    );
    const amendIndex = workflow.indexOf("git commit --amend --no-edit");
    const assertFloorIndex = workflow.lastIndexOf(
      "release-branch-policy.mjs assert-floor",
    );
    const pushIndex = workflow.indexOf(
      'git push origin "HEAD:$RELEASE_BRANCH"',
    );
    assert.ok(pullIndex < convergenceIndex, filename);
    assert.ok(rebaseContinueIndex < convergenceIndex, filename);
    assert.ok(convergenceIndex < amendIndex, filename);
    assert.ok(amendIndex < assertFloorIndex, filename);
    assert.ok(assertFloorIndex < pushIndex, filename);
    assert.match(
      workflow,
      /clean rebase can combine independent Apple and Google bumps/,
    );
    assert.doesNotMatch(
      workflow,
      new RegExp(`\\.${packageId}\\s*=\\s*\\$version`),
      filename,
    );
  }
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
