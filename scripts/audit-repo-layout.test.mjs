import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditRepositoryLayout } from "./audit-repo-layout.mjs";

function withTemporaryRepository(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-layout-"));

  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeCanonicalSpecifications(root) {
  for (const child of ["client", "commerce-protocol"]) {
    const directory = path.join(root, "specs", "openiap", child);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "package.json"), "{}");
  }
}

test("accepts canonical owned directories", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "packages", "docs"), { recursive: true });
    writeCanonicalSpecifications(root);
    fs.mkdirSync(path.join(root, "packages", "packages"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "libraries", "react-native-iap"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "plugins", "openiap"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs"), "not a directory");

    assert.deepEqual(auditRepositoryLayout(root), []);
  });
});

test("rejects legacy client schema ownership under packages", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "packages", "gql"), { recursive: true });
    writeCanonicalSpecifications(root);

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove legacy packages/gql/; use specs/openiap/client/ instead",
    ]);
  });
});

test("rejects legacy Commerce Protocol ownership beside openiap", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "specs", "openiap-kit"), {
      recursive: true,
    });

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove legacy specs/openiap-kit/; use specs/openiap/commerce-protocol/ instead",
    ]);
  });
});

test("rejects a package manifest on the specification umbrella", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.writeFileSync(path.join(root, "specs", "openiap", "package.json"), "{}");

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove specs/openiap/package.json; publish only the client and commerce-protocol child packages",
    ]);
  });
});

test("rejects service deployment manifests under specifications", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(
      path.join(root, "specs", "openiap", "client", "deploy", ".openai"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(root, "specs", "openiap", "client", "Dockerfile"),
      "",
    );
    fs.writeFileSync(
      path.join(
        root,
        "specs",
        "openiap",
        "client",
        "deploy",
        "Dockerfile.prod",
      ),
      "",
    );
    fs.writeFileSync(
      path.join(
        root,
        "specs",
        "openiap",
        "client",
        "deploy",
        "docker-compose.yml",
      ),
      "",
    );
    fs.writeFileSync(
      path.join(
        root,
        "specs",
        "openiap",
        "client",
        "deploy",
        ".openai",
        "hosting.json",
      ),
      "{}",
    );
    fs.writeFileSync(
      path.join(
        root,
        "specs",
        "openiap",
        "client",
        "deploy",
        "fly.staging.toml",
      ),
      "",
    );
    fs.writeFileSync(
      path.join(root, "specs", "openiap", "client", "convex.json"),
      "{}",
    );
    fs.writeFileSync(
      path.join(root, "specs", "openiap", "client", "fly.toml"),
      "",
    );

    assert.deepEqual(auditRepositoryLayout(root), [
      "move service deployment manifest specs/openiap/client/Dockerfile to its runtime implementation",
      "move service deployment manifest specs/openiap/client/convex.json to its runtime implementation",
      "move service deployment manifest specs/openiap/client/deploy/.openai/hosting.json to its runtime implementation",
      "move service deployment manifest specs/openiap/client/deploy/Dockerfile.prod to its runtime implementation",
      "move service deployment manifest specs/openiap/client/deploy/docker-compose.yml to its runtime implementation",
      "move service deployment manifest specs/openiap/client/deploy/fly.staging.toml to its runtime implementation",
      "move service deployment manifest specs/openiap/client/fly.toml to its runtime implementation",
    ]);
  });
});

test("requires both canonical specification packages", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "specs", "openiap"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), [
      "restore canonical specification package specs/openiap/client/package.json",
      "restore canonical specification package specs/openiap/commerce-protocol/package.json",
    ]);
  });
});

test("rejects specification roots beside the OpenIAP umbrella", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(path.join(root, "specs", "client"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), [
      "move specification root specs/client/ under specs/openiap/",
    ]);
  });
});

test("rejects root directories with canonical owners", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "packages", "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, "libraries", "react-native-iap"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "plugins", "openiap"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs"));
    fs.mkdirSync(path.join(root, "react-native-iap"));
    fs.mkdirSync(path.join(root, "openiap"));

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove duplicate root react-native-iap/; use libraries/react-native-iap/ instead",
      "remove duplicate root docs/; use packages/docs/ instead",
      "remove duplicate root openiap/; use plugins/openiap/ instead",
    ]);
  });
});

test("keeps lockfile workspace names aligned with package manifests", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  // bun.lock is JSON with trailing commas; parse it without a dependency so
  // the Node-only audit-release-state job can run this file.
  const lockfile = JSON.parse(
    fs
      .readFileSync(path.join(repositoryRoot, "bun.lock"), "utf8")
      .replace(/,(\s*[}\]])/gu, "$1"),
  );

  for (const [workspacePath, entry] of Object.entries(lockfile.workspaces)) {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, workspacePath, "package.json"),
        "utf8",
      ),
    );
    assert.equal(entry.name, manifest.name, workspacePath || "<root>");
  }
});
