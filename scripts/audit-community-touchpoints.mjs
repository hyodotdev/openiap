#!/usr/bin/env node

// Every copy of the first-purchase notice and of the note for coding assistants
// must match packages/docs/community-touchpoints.json
// (knowledge/internal/09-community-touchpoints.md). sync-sponsors.mjs generates
// the README section, so it is audited there.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const touchpointsPath = "packages/docs/community-touchpoints.json";

// Each library keeps the notice in one source file under these roots.
export const noticeRoots = {
  "react-native-iap": ["libraries/react-native-iap/src"],
  "expo-iap": ["libraries/expo-iap/src"],
  flutter_inapp_purchase: ["libraries/flutter_inapp_purchase/lib"],
  "godot-iap": ["libraries/godot-iap/addons/godot-iap"],
  "kmp-iap": ["libraries/kmp-iap/library/src"],
  "maui-iap": ["libraries/maui-iap/src/OpenIap.Maui"],
};

// Consumer surfaces that carry the note verbatim; the AI assistants guide
// imports the JSON instead of copying it.
export const assistantNoteRoots = [
  "packages/cli/src",
  "plugins/openiap/skills/openiap/SKILL.md",
  "packages/docs/public/llms.txt",
  "packages/docs/public/llms-full.txt",
];

// Contributor surfaces the note must stay out of.
export const contributorRoots = ["AGENTS.md", ".claude", ".codex"];

const sourceExtensions = new Set([
  ".cs",
  ".dart",
  ".gd",
  ".kt",
  ".md",
  ".mjs",
  ".swift",
  ".ts",
  ".tsx",
  ".txt",
]);

const isTestPath = (relative) =>
  /(^|\/)(__tests__|__mocks__|tests?|[A-Za-z]*UnitTest|[A-Za-z]*Test)\//u.test(
    relative,
  ) || /\.(test|spec)\.[^./]+$/u.test(relative);

function listFiles(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) return [];
  if (stat.isFile()) return [relative];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => !["node_modules", "build", ".dart_tool"].includes(entry.name))
    .flatMap((entry) => listFiles(root, path.posix.join(relative, entry.name)));
}

function filesContaining(root, roots, needle) {
  return roots
    .flatMap((entry) => listFiles(root, entry))
    .filter(
      (relative) =>
        sourceExtensions.has(path.extname(relative)) && !isTestPath(relative),
    )
    .filter((relative) =>
      fs.readFileSync(path.join(root, relative), "utf8").includes(needle),
    );
}

export function collectCommunityTouchpointFailures(root = repositoryRoot) {
  const failures = [];
  const { consoleNotice, assistantNote } = JSON.parse(
    fs.readFileSync(path.join(root, touchpointsPath), "utf8"),
  );

  for (const [library, roots] of Object.entries(noticeRoots)) {
    const files = filesContaining(root, roots, consoleNotice[0]);
    if (files.length !== 1) {
      failures.push(
        `${library}: expected the first-purchase notice in exactly one source file, found ${files.length}`,
      );
      continue;
    }
    const source = fs.readFileSync(path.join(root, files[0]), "utf8");
    for (const line of consoleNotice) {
      if (!source.includes(line)) {
        failures.push(`${files[0]}: notice line differs from ${touchpointsPath}: ${line}`);
      }
    }
  }

  const heading = assistantNote.split("\n")[0];
  for (const entry of assistantNoteRoots) {
    const files = filesContaining(root, [entry], heading);
    if (files.length !== 1) {
      failures.push(
        `${entry}: expected the note for coding assistants in exactly one file, found ${files.length}`,
      );
      continue;
    }
    if (!fs.readFileSync(path.join(root, files[0]), "utf8").includes(assistantNote)) {
      failures.push(`${files[0]}: note for coding assistants differs from ${touchpointsPath}`);
    }
  }

  const body = assistantNote.split("\n").slice(1).join("\n");
  for (const relative of contributorRoots.flatMap((entry) => listFiles(root, entry))) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    if (text.includes(body)) {
      failures.push(`${relative}: the note for coding assistants belongs to consumer surfaces only`);
    }
  }

  return failures;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const failures = collectCommunityTouchpointFailures();
  if (failures.length > 0) {
    console.error("Community touchpoint audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Community touchpoint audit: clean.");
  }
}
