import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { releasePackage } from "./release-openiap.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const entries = [
  [
    "client-protocol",
    "@hyodotdev/openiap-client-protocol",
    "specs/client",
    "openiap-client-protocol",
    "0.1.0",
  ],
  [
    "commerce-protocol",
    "@hyodotdev/openiap-commerce-protocol",
    "specs/commerce-protocol",
    "hyodotdev-openiap-commerce-protocol",
    "0.1.0",
  ],
  ["cli", "@hyodotdev/openiap", "packages/cli", "openiap", "0.1.0"],
];

function fixture(t) {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), "openiap-release-")),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (path, value) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), JSON.stringify(value));
  };
  write("openiap-versions.json", {
    spec: "3.4.0",
    google: "3.4.1",
    apple: "3.4.0",
  });
  for (const [, name, path, , version] of entries)
    write(`${path}/package.json`, { name, version });
  return { directory, write };
}

test("each package produces its own scoped identity, directory, and tag", (t) => {
  const { directory } = fixture(t);
  for (const [id, name, path, prefix, version] of entries) {
    assert.deepEqual(releasePackage(id, directory), {
      name,
      path: `${path}/package.json`,
      directory: path,
      tagPrefix: prefix,
      version,
    });
  }
});

test("release identity rejects unknown selectors, private packages, and old names", (t) => {
  const { directory, write } = fixture(t);
  for (const id of [
    "conformance",
    "__proto__",
    "constructor",
    "../cli",
    "cli\nBAD=value",
  ]) {
    assert.throws(
      () => releasePackage(id, directory),
      /Unknown OpenIAP npm package/,
    );
  }
  for (const [id, name, path] of entries) {
    write(`${path}/package.json`, {
      name: name.replace("@hyodotdev/", ""),
      version: "0.1.0",
    });
    assert.throws(() => releasePackage(id, directory), /must publish/);
    write(`${path}/package.json`, { name, version: "0.1.0", private: true });
    assert.throws(() => releasePackage(id, directory), /must publish/);
  }
});

test("Client npm versions are independent while native-floor drift is rejected", (t) => {
  const { directory, write } = fixture(t);
  for (const version of ["0.1.0", "0.1.0-alpha.0", "0.1.0-beta.0"]) {
    write("specs/client/package.json", { name: entries[0][1], version });
    assert.equal(releasePackage("client-protocol", directory).version, version);
  }
  write("openiap-versions.json", {
    spec: "3.4.1",
    google: "3.4.1",
    apple: "3.4.0",
  });
  assert.throws(() => releasePackage("client-protocol", directory), /floor/);
});

test("GitHub environment output contains only allowlisted package metadata", (t) => {
  const { directory } = fixture(t);
  const envFile = join(directory, "github-env");
  const script = join(root, "scripts/release-openiap.mjs");
  const output = execFileSync(process.execPath, [script, "cli"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, GITHUB_ENV: envFile },
  });
  assert.equal(
    output,
    "PACKAGE_NAME=@hyodotdev/openiap\nPACKAGE_DIR=packages/cli\nPACKAGE_MANIFEST=packages/cli/package.json\nTAG_PREFIX=openiap\n",
  );
  assert.equal(readFileSync(envFile, "utf8"), output);
  const denied = spawnSync(process.execPath, [script, "cli\nBAD=value"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, GITHUB_ENV: envFile },
  });
  assert.equal(denied.status, 1);
  assert.equal(readFileSync(envFile, "utf8"), output);
});

test("release branch guard separates npm versions and keeps the old suite retired", (t) => {
  const { directory, write } = fixture(t);
  const script = join(directory, "scripts/release-branch-policy.mjs");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(root, "scripts/release-branch-policy.mjs"), script);
  write("packages/conformance/package.json", { version: "2.0.0" });
  for (const [id, mode, prerelease, branch, status] of [
    ["client-protocol", "current", "false", "main", 0],
    ["client-protocol", "patch", "false", "main", 0],
    ["client-protocol", "current", "false", "next", 1],
    ["commerce-protocol", "patch", "false", "main", 0],
    ["cli", "patch", "false", "main", 0],
    ["cli", "minor", "true", "next", 0],
    ["cli", "minor", "true", "main", 1],
    ["conformance", "current", "false", "main", 1],
  ]) {
    const result = spawnSync(
      process.execPath,
      [script, "guard", id, mode, prerelease, branch],
      {
        cwd: directory,
        encoding: "utf8",
      },
    );
    assert.equal(
      result.status,
      status,
      `${id} ${mode} ${branch}: ${result.stderr}`,
    );
  }
});

test("exact scoped releases route alpha and beta to next and stable to main", (t) => {
  const { directory } = fixture(t);
  const script = join(directory, "scripts/release-branch-policy.mjs");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(root, "scripts/release-branch-policy.mjs"), script);
  for (const [id] of entries) {
    for (const [mode, target, branch, expected] of [
      ["exact", "0.1.0-alpha.0", "next", 0],
      ["exact", "0.1.0-alpha.0", "main", 1],
      ["exact", "0.1.0-beta.0", "next", 0],
      ["exact", "0.1.0", "main", 0],
      ["exact", "0.1.0", "next", 1],
      ["exact", "", "next", 1],
      ["exact", "--help", "next", 1],
      ["current", "0.1.0-alpha.0", "next", 1],
      ["typo", "", "main", 1],
    ]) {
      const result = spawnSync(
        process.execPath,
        [script, "guard", id, mode, "false", branch, target],
        { cwd: directory, encoding: "utf8" },
      );
      assert.equal(
        result.status,
        expected,
        `${id} ${mode} ${target} ${branch}: ${result.stderr}`,
      );
    }
  }
});

test("native version sync preserves independent stable and prerelease npm versions", (t) => {
  const { directory, write } = fixture(t);
  const paths = [
    "scripts/sync-versions.sh",
    "scripts/release-branch-policy.mjs",
    "packages/docs/package.json",
    "packages/apple/package.json",
    "packages/google/package.json",
    "packages/google/openiap/build.gradle.kts",
    "libraries/expo-iap/package.json",
    "libraries/react-native-iap/package.json",
    "libraries/flutter_inapp_purchase/pubspec.yaml",
    "libraries/godot-iap/addons/godot-iap/plugin.cfg",
    "libraries/kmp-iap/gradle.properties",
    "libraries/kmp-iap/gradle/libs.versions.toml",
    "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
  ];
  for (const path of paths) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    copyFileSync(join(root, path), join(directory, path));
  }
  mkdirSync(join(directory, "packages/apple/Sources"), { recursive: true });
  mkdirSync(join(directory, "libraries/godot-iap/scripts"), {
    recursive: true,
  });
  mkdirSync(join(directory, "specs/client/scripts"), { recursive: true });
  // Source distribution is independent of package version propagation.
  writeFileSync(
    join(directory, "libraries/godot-iap/scripts/sync-versions.sh"),
    "#!/bin/sh\nexit 0\n",
    { mode: 0o755 },
  );
  writeFileSync(
    join(directory, "specs/client/scripts/sync-to-platforms.mjs"),
    "",
  );
  const nativeBefore = readFileSync(
    join(directory, "openiap-versions.json"),
    "utf8",
  );
  for (const version of ["0.1.0", "0.1.0-alpha.0", "0.1.0-beta.0"]) {
    for (const [, name, path] of entries)
      write(`${path}/package.json`, { name, version });
    execFileSync("bash", ["scripts/sync-versions.sh"], { cwd: directory });
    for (const [, , path] of entries) {
      assert.equal(
        JSON.parse(readFileSync(join(directory, path, "package.json"), "utf8"))
          .version,
        version,
      );
    }
    assert.equal(
      readFileSync(join(directory, "openiap-versions.json"), "utf8"),
      nativeBefore,
    );
    assert.equal(
      JSON.parse(
        readFileSync(join(directory, "packages/docs/package.json"), "utf8"),
      ).version,
      "3.4.0",
    );
  }
});

test("Commerce release commits have browser smoke prerequisites", () => {
  const workflow = parse(
    readFileSync(join(root, ".github/workflows/release-openiap.yml"), "utf8"),
  );
  const steps = workflow.jobs.deploy.steps;
  const dependencies = steps.findIndex((step) =>
    step.run?.includes("bun install --frozen-lockfile"),
  );
  const browser = steps.findIndex((step) =>
    step.run?.includes("playwright install --with-deps chromium"),
  );
  const commit = steps.findIndex((step) => step.run?.includes("git commit -m"));
  assert.ok(dependencies >= 0 && dependencies < browser && browser < commit);
  assert.equal(steps[browser].if, "${{ env.PACKAGE_ID == 'commerce-protocol' }}");
});

test("workflow exact bumps write alpha, beta, and stable versions to the selected manifest", (t) => {
  const { directory } = fixture(t);
  const workflow = parse(
    readFileSync(join(root, ".github/workflows/release-openiap.yml"), "utf8"),
  );
  const bump = workflow.jobs.deploy.steps.find(
    (step) => step.name === "Bump version",
  );
  const output = join(directory, "bump-output");
  for (const [, , path] of entries) {
    for (const target of ["0.1.0-alpha.0", "0.1.0-beta.0", "0.1.0"]) {
      writeFileSync(output, "");
      execFileSync("bash", ["-e", "-c", bump.run], {
        cwd: join(directory, path),
        env: {
          ...process.env,
          VERSION_TYPE: "exact",
          TARGET_VERSION: target,
          IS_PRERELEASE: "false",
          GITHUB_OUTPUT: output,
        },
      });
      assert.equal(
        JSON.parse(readFileSync(join(directory, path, "package.json"), "utf8"))
          .version,
        target,
      );
      assert.equal(
        readFileSync(output, "utf8"),
        `version=${target}\nis_prerelease=${target.includes("-")}\n`,
      );
    }
  }
});
