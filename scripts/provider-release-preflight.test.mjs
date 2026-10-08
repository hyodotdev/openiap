import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/release-google.yml", import.meta.url),
  "utf8",
);
const preflight = workflow
  .split("      - name: Preflight Maven Central publication\n")[1]
  .split("        run: |\n")[1]
  .split("\n      - name:")[0]
  .replace(/^          /gm, "");
const base = {
  CORE_EXISTS: "false",
  CONFORMANCE_EXISTS: "false",
  HORIZON_EXISTS: "false",
  AMAZON_EXISTS: "false",
  PLAY_EXISTS: "false",
  PLUGIN_EXISTS: "false",
  RELEASE_TAG_EXISTS: "false",
};
const credentials = Object.fromEntries(
  [
    "MAVEN_CENTRAL_USERNAME",
    "MAVEN_CENTRAL_PASSWORD",
    "GPG_KEY_CONTENTS",
    "SIGNING_KEY_ID",
    "SIGNING_PASSWORD",
  ].map((key) => [key, "fixture"]),
);
function check(values, legacy = false) {
  const root = mkdtempSync(join(tmpdir(), "provider-preflight-"));
  if (!legacy) {
    mkdirSync(join(root, "packages/google/core"), { recursive: true });
    writeFileSync(join(root, "packages/google/core/build.gradle.kts"), "");
  }
  try {
    return spawnSync("bash", ["-e", "-c", preflight], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        ...Object.fromEntries(Object.keys(credentials).map((key) => [key, ""])),
        ...base,
        ...values,
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("new provider artifacts require credentials before a release tag exists", () => {
  assert.notEqual(check({}).status, 0);
  assert.equal(check(credentials).status, 0);
});
test("an orphan core publication cannot be attached to a fresh Google release", () => {
  assert.notEqual(check({ ...credentials, CORE_EXISTS: "true" }).status, 0);
});
test("the independent conformance version may already exist on a new Google release", () => {
  assert.equal(check({ ...credentials, CONFORMANCE_EXISTS: "true" }).status, 0);
});
test("a complete existing release needs no publishing credentials", () => {
  assert.equal(
    check(Object.fromEntries(Object.keys(base).map((key) => [key, "true"])))
      .status,
    0,
  );
});
test("legacy release tags do not require an artifact that did not exist at that tag", () => {
  assert.equal(
    check(
      Object.fromEntries(Object.keys(base).map((key) => [key, "true"])),
      true,
    ).status,
    0,
  );
});
test("provider prerequisites publish before official stores and stable conformance skips prereleases", () => {
  assert.ok(
    workflow.indexOf("name: Publish core to Maven Central") <
      workflow.indexOf("name: Publish Android conformance to Maven Central"),
  );
  assert.ok(
    workflow.indexOf("name: Publish Android conformance to Maven Central") <
      workflow.indexOf("name: Publish Horizon flavor to Maven Central"),
  );
  assert.match(
    workflow,
    /if \[ "\$IS_PRERELEASE" != "true" \]; then\n\s+CONFORMANCE_EXISTS=/,
  );
});

function artifactStep(name) {
  return workflow
    .split(`      - name: ${name}\n`)[1]
    .split("        run: |\n")[1]
    .split("\n      - name:")[0]
    .replace(/^          /gm, "");
}
function calculateGoogleVersion(current, mode, prerelease = false) {
  const root = mkdtempSync(join(tmpdir(), "google-rc-version-"));
  try {
    writeFileSync(
      join(root, "openiap-versions.json"),
      JSON.stringify({ google: current }),
    );
    const output = join(root, "output");
    const result = spawnSync(
      "bash",
      ["-e", "-c", artifactStep("Calculate new version")],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          VERSION_TYPE: mode,
          IS_PRERELEASE: String(prerelease),
          GITHUB_ENV: join(root, "env"),
          GITHUB_OUTPUT: output,
        },
      },
    );
    return {
      ...result,
      values: result.status === 0 ? readFileSync(output, "utf8") : "",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("Google RC bumps preserve the target version instead of bumping a patch", () => {
  for (const [current, expected] of [
    ["4.0.0-rc.1", "4.0.0-rc.2"],
    ["4.0.0-rc.9", "4.0.0-rc.10"],
  ]) {
    const result = calculateGoogleVersion(current, "rc-bump");
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.values,
      new RegExp(`^version=${expected.replaceAll(".", "\\.")}$`, "m"),
    );
    assert.match(result.values, /^is_prerelease=true$/m);
  }
  assert.notEqual(calculateGoogleVersion("3.6.3", "rc-bump").status, 0);
  assert.notEqual(calculateGoogleVersion("4.0.0-beta.1", "rc-bump").status, 0);
});
test("Google first RC and current retry keep their existing version behavior", () => {
  assert.match(
    calculateGoogleVersion("3.6.3", "major", true).values,
    /^version=4\.0\.0-rc\.1$/m,
  );
  assert.match(
    calculateGoogleVersion("4.0.0-rc.2", "current").values,
    /^version=4\.0\.0-rc\.2$/m,
  );
});
function collectArtifacts({ legacy = false, missingCore = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "provider-artifacts-"));
  try {
    if (!legacy) {
      mkdirSync(join(root, "core"), { recursive: true });
      writeFileSync(join(root, "core/build.gradle.kts"), "");
    }
    writeFileSync(
      join(root, "gradlew"),
      `#!/bin/bash\nfor task in "$@"; do\ncase "$task" in\n:openiap:assembleRelease) mkdir -p openiap/build/outputs/aar; touch openiap/build/outputs/aar/openiap-play-release.aar ;;\n:openiap-core:assembleRelease) ${missingCore ? ":" : "mkdir -p core/build/outputs/aar; touch core/build/outputs/aar/openiap-core-release.aar"} ;;\nesac\ndone\n`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      "bash",
      [
        "-e",
        "-c",
        artifactStep("Build release artifacts") +
          "\n" +
          artifactStep("Create release artifacts"),
      ],
      { cwd: root, encoding: "utf8" },
    );
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      listing:
        result.status === 0
          ? spawnSync("unzip", ["-l", "release-artifacts.zip"], {
              cwd: root,
              encoding: "utf8",
            }).stdout
          : "",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("release ZIP contains the explicitly assembled provider core", () => {
  const result = collectArtifacts();
  assert.equal(result.status, 0, result.output);
  assert.match(result.listing, /openiap-core-release\.aar/);
});
test("a missing provider core stops artifact collection", () => {
  const result = collectArtifacts({ missingCore: true });
  assert.notEqual(result.status, 0);
  assert.match(result.output, /provider core AAR is missing/);
});
test("legacy release tags collect artifacts without a core module", () => {
  const result = collectArtifacts({ legacy: true });
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.listing, /openiap-core/);
});
