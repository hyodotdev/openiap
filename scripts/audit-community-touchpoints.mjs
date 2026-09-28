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

// Consumer surfaces that carry the note verbatim.
export const assistantNoteRoots = [
  "packages/cli/src",
  "plugins/openiap/skills/openiap/SKILL.md",
  "packages/docs/public/llms.txt",
  "packages/docs/public/llms-full.txt",
];

// The AI assistants guide renders the note from the JSON instead of copying it.
export const assistantNoteRenderer = "packages/docs/src/pages/docs/guides/ai-assistants.tsx";

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

// Each line is its own string literal right after the previous one, so the
// lines cannot be reordered or merged.
function listsLinesInOrder(source, lines) {
  let end = source.indexOf(lines[0]) + lines[0].length;
  for (const line of lines.slice(1)) {
    const start = source.indexOf(line, end);
    if (start === -1 || !/^["'][\s,]*["']$/u.test(source.slice(end, start))) return false;
    end = start + line.length;
  }
  return true;
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
    const missing = consoleNotice.filter((line) => !source.includes(line));
    for (const line of missing) {
      failures.push(`${files[0]}: notice line differs from ${touchpointsPath}: ${line}`);
    }
    if (missing.length === 0 && !listsLinesInOrder(source, consoleNotice)) {
      failures.push(
        `${files[0]}: notice lines must be separate literals in the order of ${touchpointsPath}`,
      );
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

  const renderer = path.join(root, assistantNoteRenderer);
  const rendererText = fs.existsSync(renderer) ? fs.readFileSync(renderer, "utf8") : "";
  if (!rendererText.includes("community-touchpoints.json") || !rendererText.includes(".assistantNote")) {
    failures.push(`${assistantNoteRenderer}: must render assistantNote from ${touchpointsPath}`);
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
