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
import { releasePackage } from "./release-openiap.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const entries = [
  [
    "client-protocol",
    "@hyodotdev/openiap-client-protocol",
    "specs/client",
    "openiap-client-protocol",
    "3.4.0",
  ],
  [
    "commerce-protocol",
    "@hyodotdev/openiap-commerce-protocol",
    "specs/commerce-protocol",
    "openiap-commerce-protocol",
    "0.1.1",
  ],
  ["cli", "@hyodotdev/openiap", "packages/cli", "openiap", "0.1.0"],
];

function fixture(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "openiap-release-")));
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

test("Client Protocol rejects manifest drift and native-floor drift", (t) => {
  const { directory, write } = fixture(t);
  write("specs/client/package.json", { name: entries[0][1], version: "3.4.1" });
  assert.throws(
    () => releasePackage("client-protocol", directory),
    /native-derived spec/,
  );
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

test("release branch guard keeps client versions derived and the old suite retired", (t) => {
  const { directory, write } = fixture(t);
  const script = join(directory, "scripts/release-branch-policy.mjs");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(root, "scripts/release-branch-policy.mjs"), script);
  write("packages/conformance/package.json", { version: "2.0.0" });
  for (const [id, mode, prerelease, branch, status] of [
    ["client-protocol", "current", "false", "main", 0],
    ["client-protocol", "patch", "false", "main", 1],
    ["client-protocol", "current", "false", "next", 1],
    ["commerce-protocol", "patch", "false", "main", 0],
    ["cli", "patch", "false", "main", 0],
    ["cli", "minor", "true", "next", 0],
    ["cli", "minor", "true", "main", 1],
    ["conformance", "current", "false", "main", 1],
  ]) {
    const result = spawnSync(process.execPath, [script, "guard", id, mode, prerelease, branch], {
      cwd: directory, encoding: "utf8",
    });
    assert.equal(result.status, status, `${id} ${mode} ${branch}: ${result.stderr}`);
  }
});
