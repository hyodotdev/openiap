import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MANIFESTS,
  SKILLS,
  auditPluginManifests,
} from "./audit-plugin-manifests.mjs";

// The pre-commit hook runs this with git's GIT_DIR and GIT_INDEX_FILE set.
// Inherited, they aim the scratch repositories below at the real repository,
// whose config `git init` and `git config` then rewrite.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GIT_")) delete process.env[key];
}

describe("plugin manifest audit", () => {
  let root;
  const git = (...args) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
      cwd: root,
      stdio: "ignore",
    });
  const write = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const setVersions = (codex, claude = codex) => {
    write(MANIFESTS[0], JSON.stringify({ name: "openiap", version: codex }));
    write(MANIFESTS[1], JSON.stringify({ name: "openiap", version: claude }));
  };
  const commit = (message) => {
    git("add", "-A");
    git("commit", "-m", message);
  };
  const audit = (base = "main") => auditPluginManifests({ root, base });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "openiap-plugin-manifests-"));
    git("init", "-b", "main");
    git("config", "user.email", "ci@openiap.dev");
    git("config", "user.name", "OpenIAP CI");
    setVersions("0.1.0");
    write(`${SKILLS}/openiap/SKILL.md`, "first\n");
    commit("release 0.1.0");
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("accepts skills unchanged since the base", () => {
    assert.deepEqual(audit(), []);
  });

  it("rejects manifests that disagree on the version", () => {
    setVersions("0.1.1", "0.1.0");
    assert.match(audit()[0], /must carry the same version/);
  });

  it("rejects a skills edit without a version bump, committed or not", () => {
    git("checkout", "-b", "feature");
    write(`${SKILLS}/openiap/SKILL.md`, "second\n");
    assert.match(audit()[0], /bump the version in both manifests/);
    commit("edit skill");
    assert.match(audit()[0], /SKILL\.md/);
  });

  it("counts a new untracked skill file", () => {
    write(`${SKILLS}/extra/SKILL.md`, "new\n");
    assert.match(audit()[0], /extra\/SKILL\.md/);
  });

  it("rejects a skills edit whose version is not higher than the release", () => {
    write(`${SKILLS}/openiap/SKILL.md`, "second\n");
    setVersions("0.0.9");
    assert.match(audit()[0], /bump the version in both manifests/);
  });

  it("accepts a skills edit once both manifests are bumped", () => {
    write(`${SKILLS}/openiap/SKILL.md`, "second\n");
    setVersions("0.1.1");
    assert.deepEqual(audit(), []);
  });

  it("measures from the base ref, so later branch edits need no second bump", () => {
    git("checkout", "-b", "feature");
    setVersions("0.1.1");
    commit("bump");
    write(`${SKILLS}/openiap/SKILL.md`, "second\n");
    commit("edit skill after the bump");
    assert.deepEqual(audit("main"), []);
  });

  it("fails closed when the base ref is missing", () => {
    assert.match(audit("origin/main")[0], /not available locally/);
  });
});
