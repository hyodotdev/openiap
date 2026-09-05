import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  auditRepositoryLayout,
  findDocumentedTreePaths,
} from "./audit-repo-layout.mjs";

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

test("the structure diagram in AGENTS.md must match the tree", () => {
  const tree = (specs) =>
    [
      "```text",
      "openiap/",
      "├── packages/",
      "│   ├── docs/          # Documentation site",
      "│   └── kit/           # Purchase validation",
      ...specs,
      "```",
      "",
    ].join("\n");

  // Depth has to come from the indent: `client/` nested under `openiap/` is
  // `specs/openiap/client`, not `specs/client`. Reading the leaf name alone
  // made every nested entry look like a top-level directory.
  assert.deepEqual(
    findDocumentedTreePaths(
      tree([
        "├── specs/",
        "│   └── openiap/",
        "│       ├── client/",
        "│       └── commerce-protocol/",
      ]),
    ),
    [
      "packages",
      "packages/docs",
      "packages/kit",
      "specs",
      "specs/openiap",
      "specs/openiap/client",
      "specs/openiap/commerce-protocol",
    ],
  );

  // A sibling after a deeper branch returns to its own depth.
  assert.deepEqual(
    findDocumentedTreePaths(
      tree(["├── specs/", "│   └── client/", "└── scripts/"]),
    ).slice(-3),
    ["specs", "specs/client", "scripts"],
  );

  // CRLF is the same diagram. Matching only LF returned nothing, and the audit
  // then passed having read nothing.
  assert.deepEqual(
    findDocumentedTreePaths(
      tree(["├── specs/", "│   └── client/"]).replace(/\n/gu, "\r\n"),
    ).slice(-2),
    ["specs", "specs/client"],
  );

  // No diagram is null, not an empty list: the caller has to tell "nothing
  // documented" apart from "nothing readable".
  assert.equal(findDocumentedTreePaths("no code block here"), null);
});

test("a documented directory that does not exist is a violation", () => {
  withTemporaryRepository((root) => {
    // The real drift: AGENTS.md kept documenting specs/openiap/client long
    // after the umbrella directory was removed — a layout this same audit
    // rejects on disk, so the rule and the map disagreed.
    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      ["```text", "openiap/", "├── specs/", "│   └── openiap/", "```", ""].join(
        "\n",
      ),
    );
    assert.deepEqual(auditRepositoryLayout(root), [
      "AGENTS.md documents specs/, which does not exist",
      "AGENTS.md documents specs/openiap/, which does not exist",
    ]);
  });
});

test("an unreadable structure diagram is a violation, not a pass", () => {
  withTemporaryRepository((root) => {
    // The failure mode this guards: a diagram the parser cannot read makes the
    // check vacuous, and a vacuous check reads exactly like a clean one.
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# no diagram here\n");
    assert.deepEqual(auditRepositoryLayout(root), [
      "AGENTS.md has no readable structure diagram",
    ]);
  });
});
