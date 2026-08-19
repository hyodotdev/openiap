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
