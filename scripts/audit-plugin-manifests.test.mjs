import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MANIFESTS,
  VERSIONS,
  auditPluginManifests,
  bumpPluginVersion,
  nextVersion,
} from "./audit-plugin-manifests.mjs";

describe("plugin manifest audit", () => {
  let root;
  const write = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const setup = (plugin, codex = plugin, claude = plugin) => {
    write(
      VERSIONS,
      `{\n  "clientProtocol": "1.0.3",\n  "plugin": ${JSON.stringify(plugin ?? null)}\n}\n`,
    );
    write(
      MANIFESTS[0],
      `{\n  "name": "openiap",\n  "version": "${codex}"\n}\n`,
    );
    write(
      MANIFESTS[1],
      `{\n  "name": "openiap",\n  "version": "${claude}"\n}\n`,
    );
  };
  const audit = () => auditPluginManifests({ root });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "plugin-audit-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("is clean when both manifests carry the recorded version", () => {
    setup("0.1.1");
    assert.deepEqual(audit(), []);
  });

  it("names a manifest that differs from the recorded version", () => {
    setup("0.1.1", "0.1.1", "0.1.2");
    const problems = audit();
    assert.equal(problems.length, 1);
    assert.match(problems[0], /claude-plugin.*0\.1\.2.*0\.1\.1/);
  });

  it("asks for the recorded version when it is missing", () => {
    setup(undefined, "0.1.1");
    assert.match(audit()[0], /missing the "plugin" version/);
  });

  it("bumps the recorded version and both manifests, keeping formatting", () => {
    setup("0.1.9");
    assert.equal(bumpPluginVersion({ root, bump: "patch" }), "0.1.10");
    assert.deepEqual(audit(), []);
    assert.equal(
      readFileSync(join(root, MANIFESTS[0]), "utf8"),
      '{\n  "name": "openiap",\n  "version": "0.1.10"\n}\n',
    );
    assert.match(
      readFileSync(join(root, VERSIONS), "utf8"),
      /"clientProtocol": "1\.0\.3"/,
    );
  });

  it("computes minor and major bumps and refuses others", () => {
    assert.equal(nextVersion("0.1.9", "minor"), "0.2.0");
    assert.equal(nextVersion("0.1.9", "major"), "1.0.0");
    setup("0.1.1");
    assert.throws(
      () => bumpPluginVersion({ root, bump: "current" }),
      /bump must be/,
    );
  });
});
