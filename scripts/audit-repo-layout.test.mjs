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
    const directory = path.join(root, "specs", child);
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
      "remove legacy packages/gql/; use specs/client/ instead",
    ]);
  });
});

test("rejects legacy Commerce Protocol ownership beside the specifications", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(path.join(root, "specs", "openiap-kit"), {
      recursive: true,
    });

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove legacy specs/openiap-kit/; use specs/commerce-protocol/ instead",
      "unknown specification root specs/openiap-kit/; declare it in SPECIFICATION_ROOTS or move it",
    ]);
  });
});

test("rejects the legacy specification umbrella", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(path.join(root, "specs", "openiap"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove legacy specs/openiap/; specifications sit directly under specs/",
      "unknown specification root specs/openiap/; declare it in SPECIFICATION_ROOTS or move it",
    ]);
  });
});

test("rejects service deployment manifests under specifications", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(
      path.join(root, "specs", "client", "deploy", ".openai"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(root, "specs", "client", "Dockerfile"),
      "",
    );
    fs.writeFileSync(
      path.join(
        root,
        "specs",
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
        "client",
        "deploy",
        "fly.staging.toml",
      ),
      "",
    );
    fs.writeFileSync(
      path.join(root, "specs", "client", "convex.json"),
      "{}",
    );
    fs.writeFileSync(
      path.join(root, "specs", "client", "fly.toml"),
      "",
    );

    assert.deepEqual(auditRepositoryLayout(root), [
      "move service deployment manifest specs/client/Dockerfile to its runtime implementation",
      "move service deployment manifest specs/client/convex.json to its runtime implementation",
      "move service deployment manifest specs/client/deploy/.openai/hosting.json to its runtime implementation",
      "move service deployment manifest specs/client/deploy/Dockerfile.prod to its runtime implementation",
      "move service deployment manifest specs/client/deploy/docker-compose.yml to its runtime implementation",
      "move service deployment manifest specs/client/deploy/fly.staging.toml to its runtime implementation",
      "move service deployment manifest specs/client/fly.toml to its runtime implementation",
    ]);
  });
});

test("requires both canonical specification packages", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "specs"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), [
      "restore canonical specification package specs/client/package.json",
      "restore canonical specification package specs/commerce-protocol/package.json",
    ]);
  });
});

test("rejects unknown specification roots", () => {
  withTemporaryRepository((root) => {
    writeCanonicalSpecifications(root);
    fs.mkdirSync(path.join(root, "specs", "rogue"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), [
      "unknown specification root specs/rogue/; declare it in SPECIFICATION_ROOTS or move it",
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
