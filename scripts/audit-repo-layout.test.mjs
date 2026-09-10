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

/** Violations about the tree itself, not about which maps a fixture carries. */
function treeViolations(root) {
  return auditRepositoryLayout(root).filter(
    (one) => !one.includes("is registered as a documented tree"),
  );
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

test("a decoy tree ahead of the real diagram cannot hide it", () => {
  // Returning the first tree-shaped block meant a small illustrative tree
  // placed above the structure section was audited instead of it — non-empty,
  // so the "no readable diagram" guard never fired. Every repository tree in
  // the file is a claim, so every one of them is checked.
  const markdown = [
    "```text",
    "openiap/",
    "├── packages/",
    "└── specs/",
    "```",
    "",
    "```text",
    "openiap/",
    "├── packages/",
    "├── specs/",
    "│   └── openiap/",
    "└── libraries/",
    "```",
    "",
  ].join("\n");

  assert.ok(findDocumentedTreePaths(markdown).includes("specs/openiap"));
});

test("a tree that documents no canonical container is not a repository tree", () => {
  // The architecture note draws package-internal trees (`Models/`, `main/`,
  // `play/`). Auditing those as repository roots would fail on every one.
  assert.equal(
    findDocumentedTreePaths(
      ["```text", "Sources/", "├── Models/", "└── Helpers/", "```", ""].join("\n"),
    ),
    null,
  );
});


test("a quoted tree is still a claim about the repository", () => {
  // Auditing it can only fail loudly; ignoring it is how a real tree hides.
  assert.deepEqual(
    findDocumentedTreePaths(
      ["````", "```text", "openiap/", "├── packages/", "```", "````", ""].join("\n"),
    ),
    ["packages"],
  );
});

test("a row drawn with glyphs the parser cannot read fails loudly", () => {
  // Dropping it silently let `├─ ghost/` vanish from a block that otherwise
  // parsed, and the audit passed having checked less than the file claimed.
  assert.equal(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── packages/", "├─ ghost/", "```", ""].join("\n"),
    ),
    null,
  );
});

test("a package tree rooted at the repository name is not the repository", () => {
  // `packages/google/openiap` draws its own tree rooted at `openiap/`, so the
  // root name alone would audit `src/` and `Example/` against the root.
  assert.equal(
    findDocumentedTreePaths(
      [
        "```text",
        "openiap/",
        "├── src/",
        "│   └── main/",
        "└── Example/",
        "```",
        "",
      ].join("\n"),
    ),
    null,
  );
});

test("a child one column right of its parent is still a child", () => {
  assert.deepEqual(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── packages/", "│├── cli/", "```", ""].join("\n"),
    ),
    ["packages", "packages/cli"],
  );
});

test("a tree rooted somewhere else is not a claim about the repository", () => {
  for (const root of ["Sources/", "openiap/src/"]) {
    assert.equal(
      findDocumentedTreePaths(
        ["```text", root, "├── Models/", "```", ""].join("\n"),
      ),
      null,
    );
  }
});

test("an indent that skips a level has no parent to resolve against", () => {
  // Guessing one produced paths like `packages//cli` that nothing could verify.
  assert.equal(
    findDocumentedTreePaths(
      [
        "```text",
        "openiap/",
        "├── packages/",
        "│   ├── cli/",
        "│           ├── ghost/",
        "```",
        "",
      ].join("\n"),
    ),
    null,
  );
});

test("a block indented as a whole is not a block of nested entries", () => {
  assert.deepEqual(
    findDocumentedTreePaths(
      ["  ```text", "  openiap/", "  ├── packages/", "  ```", ""].join("\n"),
    ),
    ["packages"],
  );
});

test("two-space indentation is a step, not a broken tree", () => {
  assert.deepEqual(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── packages/", "  ├── cli/", "```", ""].join("\n"),
    ),
    ["packages", "packages/cli"],
  );
});

test("an elided entry claims nothing", () => {
  assert.deepEqual(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── packages/", "└── .../", "```", ""].join("\n"),
    ),
    ["packages"],
  );
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
    assert.deepEqual(treeViolations(root), [
      "AGENTS.md documents specs/, which does not exist",
      "AGENTS.md documents specs/openiap/, which does not exist",
    ]);
  });
});

test("a leading fence that carries no tree is skipped, not read as the tree", () => {
  // The real hole: the architecture note leads with a pipeline diagram, so
  // taking the first fenced block yielded zero paths and passed having
  // checked nothing — the same vacuous pass the null guard exists to stop.
  const markdown = [
    "```text",
    "schema/*.graphql",
    "        ↓ assemble-schema.mjs",
    "generated/commerce-protocol.graphql",
    "```",
    "",
    "```text",
    "openiap/",
    "├── specs/",
    "│   └── client/",
    "```",
    "",
  ].join("\n");

  assert.deepEqual(findDocumentedTreePaths(markdown), ["specs", "specs/client"]);
});

test("a fence with any language ahead of the tree does not shift the rest", () => {
  // Matching fence pairs with one regex reads a closing fence as the next
  // opening one, so a single ```bash block before the tree made the parser
  // read the gap between blocks and report no readable diagram at all.
  const markdown = [
    "```bash",
    "bun run audit:layout",
    "```",
    "",
    "```text",
    "openiap/",
    "├── specs/",
    "│   └── client/",
    "```",
    "",
  ].join("\n");

  assert.deepEqual(findDocumentedTreePaths(markdown), ["specs", "specs/client"]);
});

test("every documented tree is audited, not only the one in AGENTS.md", () => {
  withTemporaryRepository((root) => {
    // The architecture note kept documenting the removed specs/openiap/
    // umbrella because only AGENTS.md was ever read.
    const note = path.join(root, "knowledge", "internal");
    fs.mkdirSync(note, { recursive: true });
    fs.writeFileSync(
      path.join(note, "02-architecture.md"),
      ["```text", "openiap/", "├── specs/", "│   └── openiap/", "```", ""].join(
        "\n",
      ),
    );
    assert.deepEqual(treeViolations(root), [
      "knowledge/internal/02-architecture.md documents specs/, which does not exist",
      "knowledge/internal/02-architecture.md documents specs/openiap/, which does not exist",
    ]);
  });
});

test("an unreadable structure diagram is a violation, not a pass", () => {
  withTemporaryRepository((root) => {
    // The failure mode this guards: a diagram the parser cannot read makes the
    // check vacuous, and a vacuous check reads exactly like a clean one.
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# no diagram here\n");
    assert.deepEqual(treeViolations(root), [
      "AGENTS.md has no readable structure diagram",
    ]);
  });
});

test("deleting a registered map is a violation, not a quiet loss of coverage", () => {
  withTemporaryRepository((root) => {
    // A fixture carrying none of them is not this repository, so it is silent;
    // carrying some but not all is drift.
    assert.deepEqual(auditRepositoryLayout(root), []);
    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      ["```text", "openiap/", "```", ""].join("\n"),
    );
    const violations = auditRepositoryLayout(root);
    assert.ok(
      violations.includes(
        "CONTRIBUTING.md is registered as a documented tree but does not exist",
      ),
    );
  });
});

test("a package tree that holds a canonical container name is not the repository", () => {
  // `packages/docs` is a Vite site; a `plugins/` folder there is ordinary.
  assert.equal(
    findDocumentedTreePaths(
      [
        "```text",
        "docs/",
        "├── plugins/",
        "├── src/",
        "└── vite.config.ts",
        "```",
        "",
      ].join("\n"),
    ),
    null,
  );
});

test("a one-space indent slip is a typo, not another level", () => {
  assert.deepEqual(
    findDocumentedTreePaths(
      [
        "```text",
        "openiap/",
        "├── packages/",
        "│  ├── cli/",
        "│   └── docs/",
        "```",
        "",
      ].join("\n"),
    ),
    ["packages", "packages/cli", "packages/docs"],
  );
});

test("a registered map that cannot be read is a violation", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "AGENTS.md"));
    const violations = auditRepositoryLayout(root);
    assert.ok(violations.some((one) => one.startsWith("AGENTS.md could not be read")));
  });
});

test("a row that names nothing or names its way out is unreadable", () => {
  // `""` resolves to the repository root and `..` to its parent, so both would
  // be checked, found to exist, and pass having claimed nothing.
  for (const row of ["├── /", "├── ../", "├── ./"]) {
    assert.equal(
      findDocumentedTreePaths(
        ["```text", "openiap/", "├── packages/", row, "```", ""].join("\n"),
      ),
      null,
    );
  }
});

test("nothing under an elided entry can be resolved", () => {
  assert.equal(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── packages/", "├── .../", "│   └── cli/", "```", ""].join(
        "\n",
      ),
    ),
    null,
  );
  assert.deepEqual(
    findDocumentedTreePaths(
      ["```text", "openiap/", "├── .../", "└── specs/", "```", ""].join("\n"),
    ),
    ["specs"],
  );
});

test("a repository tree that cannot be read fails the file", () => {
  // The guard was unreachable: the classifier rejected an unparsed block
  // before it could fire, so a bad tree beside a good one was simply dropped.
  const good = ["```text", "openiap/", "├── packages/", "```", ""];
  const unreadable = ["```text", "openiap/", "├── packages/", "├─ ghost/", "```", ""];
  assert.equal(findDocumentedTreePaths([...good, ...unreadable].join("\n")), null);
});

test("a tree that writes expanded paths still claims them", () => {
  // Requiring a bare container name let a tree spelling `packages/cli/` be
  // skipped, and its claims never checked.
  assert.deepEqual(
    findDocumentedTreePaths(
      [
        "```text",
        "openiap/",
        "├── packages/cli/",
        "└── packages/ghost-package/",
        "```",
        "",
      ].join("\n"),
    ),
    ["packages/cli", "packages/ghost-package"],
  );
});

test("a spacer row does not de-classify a tree", () => {
  // A trunk-only row or an in-fence comment between the root and the first
  // branch became the root name, and the block was dropped in silence.
  for (const spacer of ["│", "# the repository", "   "]) {
    assert.deepEqual(
      findDocumentedTreePaths(
        ["```text", "openiap/", spacer, "├── packages/", "```", ""].join("\n"),
      ),
      ["packages"],
    );
  }
});
