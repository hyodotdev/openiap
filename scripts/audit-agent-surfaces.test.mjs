import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  auditAgentSurfaces,
  instructionSymlinks,
  listCommands,
  listSkills,
} from "./audit-agent-surfaces.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const MIRRORED = [
  ".claude/commands",
  ".claude/skills",
  ".codex/skills",
  "AGENTS.md",
];

function withMirroredRepository(mutate, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-agents-"));

  try {
    for (const entry of MIRRORED) {
      const source = path.join(repositoryRoot, entry);
      const target = path.join(root, entry);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(source, target, { recursive: true });
    }

    for (const link of instructionSymlinks) {
      fs.symlinkSync("AGENTS.md", path.join(root, link));
    }

    mutate(root);
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("the repository's agent surfaces agree", () => {
  assert.deepEqual(auditAgentSurfaces(), []);
});

test("every command is discovered and every skill exists for both agents", () => {
  const commands = listCommands();
  const { codex, claude } = listSkills();

  assert.ok(commands.includes("audit-iapkit"));
  assert.deepEqual(codex, claude);
});

test("rejects a command no router mentions", () => {
  withMirroredRepository(
    (root) => {
      fs.writeFileSync(
        path.join(root, ".claude/commands/audit-orphan.md"),
        "---\nname: audit-orphan\n---\n",
      );
    },
    (root) => {
      const findings = auditAgentSurfaces(root);
      assert.ok(
        findings.some((f) =>
          f.includes(".codex/skills/openiap-workflows/SKILL.md does not route audit-orphan"),
        ),
      );
      assert.ok(
        findings.some((f) =>
          f.includes(".claude/skills/openiap-workflows/SKILL.md does not route audit-orphan"),
        ),
      );
      assert.ok(
        findings.some((f) => f.includes("AGENTS.md skills table is missing /audit-orphan")),
      );
    },
  );
});

test("rejects a skill that exists for only one agent", () => {
  withMirroredRepository(
    (root) => {
      fs.rmSync(path.join(root, ".claude/skills/rebase-main"), {
        recursive: true,
        force: true,
      });
    },
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).some((f) =>
          f.includes(".claude/skills/rebase-main/SKILL.md is missing"),
        ),
      );
    },
  );
});

test("rejects a Claude adapter that drops its canonical pointer", () => {
  withMirroredRepository(
    (root) => {
      const file = path.join(root, ".claude/skills/rebase-main/SKILL.md");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replaceAll(".codex/skills/rebase-main/SKILL.md", "somewhere else"),
      );
    },
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).some((f) =>
          f.includes("must point at its canonical .codex/skills body"),
        ),
      );
    },
  );
});

test("rejects instruction files that stop resolving to AGENTS.md", () => {
  withMirroredRepository(
    (root) => {
      const link = path.join(root, "CLAUDE.md");
      fs.unlinkSync(link);
      fs.writeFileSync(link, "# not a symlink\n");
    },
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).some(
          (f) => f === "CLAUDE.md must be a symlink to AGENTS.md",
        ),
      );
    },
  );
});

const THIN_REVIEW = [
  "# Review",
  "",
  "Follow [/review-pr](../../../../.claude/commands/review-pr.md).",
  "",
].join("\n");

function writeLibraryCommit(root, body, review = THIN_REVIEW) {
  const library = path.join(root, "libraries/demo");
  fs.mkdirSync(path.join(library, ".claude/commands"), { recursive: true });
  fs.writeFileSync(
    path.join(library, "AGENTS.md"),
    "# Demo\n\n## Pre-Commit Checks\n\n```sh\n# Not a heading\n```\n\n## Notes\n\n## Notes\n",
  );
  fs.writeFileSync(path.join(library, ".claude/commands/commit.md"), body);
  if (review !== null) {
    fs.writeFileSync(
      path.join(library, ".claude/commands/review-pr.md"),
      review,
    );
  }
}

test("a library commit command routes to the root command", () => {
  withMirroredRepository(
    (root) =>
      writeLibraryCommit(
        root,
        "# Commit\n\nSee [checks](../../AGENTS.md#pre-commit-checks).\n",
      ),
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).includes(
          "libraries/demo/.claude/commands/commit.md must link to the root .claude/commands/commit.md",
        ),
      );
    },
  );
});

test("a library with its own .claude/ must carry every adapter command", () => {
  withMirroredRepository(
    (root) =>
      writeLibraryCommit(
        root,
        "# Commit\n\nFollow [/commit](../../../../.claude/commands/commit.md).\n",
        null,
      ),
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).includes(
          "libraries/demo/.claude/commands/review-pr.md is missing; route it to the root /review-pr",
        ),
      );
    },
  );
});

test("a library adapter cannot grow into the workflow or link to nothing", () => {
  withMirroredRepository(
    (root) =>
      writeLibraryCommit(
        root,
        [
          "# Commit",
          "",
          "Follow [/commit](../../../../.claude/commands/commit.md).",
          "Run [checks](../../AGENTS.md#checks).",
          "See [this](#nowhere).",
          ...Array.from({ length: 20 }, (_, index) => `${index + 1}. step`),
          "",
        ].join("\n"),
      ),
    (root) => {
      const findings = auditAgentSurfaces(root);
      for (const finding of [
        "libraries/demo/.claude/commands/commit.md links to missing heading ../../AGENTS.md#checks",
        "libraries/demo/.claude/commands/commit.md links to missing heading #nowhere",
        "libraries/demo/.claude/commands/commit.md has 25 lines; an adapter stays within 20 and leaves the workflow to the root command",
      ]) {
        assert.ok(findings.includes(finding), finding);
      }
    },
  );
});

test("a thin library adapter passes", () => {
  withMirroredRepository(
    (root) =>
      writeLibraryCommit(
        root,
        [
          "# Commit",
          "",
          "Follow [/commit](../../../../.claude/commands/commit.md).",
          "Run [checks](../../AGENTS.md#pre-commit-checks) first.",
          // GitHub numbers a repeated heading; code fences hold none.
          "See [notes](../../AGENTS.md#notes-1) and [spec](https://openiap.dev/docs).",
          "",
        ].join("\n"),
      ),
    (root) => {
      assert.deepEqual(auditAgentSurfaces(root), []);
    },
  );
});

test("a heading inside a code fence is not a link target", () => {
  withMirroredRepository(
    (root) =>
      writeLibraryCommit(
        root,
        [
          "# Commit",
          "",
          "Follow [/commit](../../../../.claude/commands/commit.md).",
          "Run [checks](../../AGENTS.md#not-a-heading).",
          "",
        ].join("\n"),
      ),
    (root) => {
      assert.ok(
        auditAgentSurfaces(root).includes(
          "libraries/demo/.claude/commands/commit.md links to missing heading ../../AGENTS.md#not-a-heading",
        ),
      );
    },
  );
});
