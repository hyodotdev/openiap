#!/usr/bin/env node

// Keeps Codex, Claude, and Grok pointed at the same workflows. Every surface is
// discovered from disk, so adding a command or skill without registering it
// everywhere fails here instead of silently working for one agent only.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

const COMMANDS_DIR = ".claude/commands";
const CODEX_SKILLS_DIR = ".codex/skills";
const CLAUDE_SKILLS_DIR = ".claude/skills";
const CODEX_ROUTER = ".codex/skills/openiap-workflows/SKILL.md";
const CLAUDE_ROUTER = ".claude/skills/openiap-workflows/SKILL.md";
const INSTRUCTIONS = "AGENTS.md";

// Grok and Codex read AGENTS.md directly; these must resolve to it.
export const instructionSymlinks = Object.freeze(["CLAUDE.md", "GEMINI.md"]);

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function listDirectories(root, relative) {
  const dir = path.join(root, relative);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function listCommands(root = repositoryRoot) {
  const dir = path.join(root, COMMANDS_DIR);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/u, ""))
    .sort();
}

export function listSkills(root = repositoryRoot) {
  return {
    codex: listDirectories(root, CODEX_SKILLS_DIR),
    claude: listDirectories(root, CLAUDE_SKILLS_DIR),
  };
}

export function auditAgentSurfaces(root = repositoryRoot) {
  const findings = [];
  const commands = listCommands(root);
  const { codex, claude } = listSkills(root);

  for (const name of codex) {
    if (!claude.includes(name)) {
      findings.push(
        `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md is missing; Claude cannot use the ${name} skill`,
      );
    }
  }

  for (const name of claude) {
    if (!codex.includes(name)) {
      findings.push(
        `${CODEX_SKILLS_DIR}/${name}/SKILL.md is missing; Codex cannot use the ${name} skill`,
      );
    }
  }

  for (const name of codex.filter((entry) => claude.includes(entry))) {
    const adapter = read(root, `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`);

    if (!adapter.includes(`${CODEX_SKILLS_DIR}/${name}/SKILL.md`)) {
      findings.push(
        `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md must point at its canonical ${CODEX_SKILLS_DIR} body`,
      );
    }
  }

  // A command only reaches Codex through the router, so an unrouted command is
  // invisible to every agent that does not read .claude/commands directly.
  const routers = [
    [CODEX_ROUTER, read(root, CODEX_ROUTER)],
    [CLAUDE_ROUTER, read(root, CLAUDE_ROUTER)],
  ];

  for (const [file, text] of routers) {
    for (const command of commands) {
      if (!text.includes(`${COMMANDS_DIR}/${command}.md`)) {
        findings.push(`${file} does not route ${command}`);
      }
    }
  }

  const instructions = read(root, INSTRUCTIONS);

  for (const command of commands) {
    if (!instructions.includes(`\`/${command}\``)) {
      findings.push(`${INSTRUCTIONS} skills table is missing /${command}`);
    }
  }

  for (const skill of codex) {
    if (skill === "openiap-workflows") {
      continue;
    }

    if (!instructions.includes(`\`$${skill}\``)) {
      findings.push(`${INSTRUCTIONS} skills table is missing $${skill}`);
    }
  }

  for (const link of instructionSymlinks) {
    const target = path.join(root, link);

    if (!fs.existsSync(target)) {
      findings.push(`${link} is missing; it must symlink to ${INSTRUCTIONS}`);
      continue;
    }

    if (
      !fs.lstatSync(target).isSymbolicLink() ||
      fs.readlinkSync(target) !== INSTRUCTIONS
    ) {
      findings.push(`${link} must be a symlink to ${INSTRUCTIONS}`);
    }
  }

  return findings.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = auditAgentSurfaces();

  if (errors.length === 0) {
    console.log("Agent surface audit: clean.");
  } else {
    console.error("Agent surface audit failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
