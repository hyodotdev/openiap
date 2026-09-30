#!/usr/bin/env node

// Every copy of the first-purchase notice and of the note for coding assistants
// must match packages/docs/community-touchpoints.json
// (knowledge/internal/09-community-touchpoints.md). sync-sponsors.mjs generates
// the README section, so it is audited there. MAUI's Android wiring is checked
// here too: no unit test can build it.

import { execFileSync } from "node:child_process";
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

// Contributor surfaces the note must stay out of: AGENTS.md files and .claude
// or .codex trees at any depth.
const contributorPathspecs = [
  ":(glob)**/AGENTS.md",
  ":(glob)**/.claude/**",
  ":(glob)**/.codex/**",
];

const mauiAndroid = "libraries/maui-iap/src/OpenIap.Maui/Platforms/Android";

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

// The notice lines are the whole list: each is its own string literal right
// after the previous one, so none can be reordered, merged, or joined by an
// extra line. `'\n',` is the separator of C#'s string.Join.
const listOpening = /(?:[[({]|'\\n',)\s*["']$/u;
// A comma is required between the literals: Dart joins adjacent ones.
const lineGap = /^["']\s*,\s*["']$/u;
const listClosing = /^["'][\s,]*[\])}]/u;

function listsLinesInOrder(source, lines) {
  for (let at = source.indexOf(lines[0]); at !== -1; at = source.indexOf(lines[0], at + 1)) {
    if (!listOpening.test(source.slice(0, at))) continue;
    let end = at + lines[0].length;
    let ordered = true;
    for (const line of lines.slice(1)) {
      const start = source.indexOf(line, end);
      if (start === -1 || !lineGap.test(source.slice(end, start))) {
        ordered = false;
        break;
      }
      end = start + line.length;
    }
    if (ordered && listClosing.test(source.slice(end))) return true;
  }
  return false;
}

// Markdown and text copies of the note are a paragraph of their own; a code
// copy is one whole string literal. Nothing may be glued onto either end.
function standsAlone(file, source, note) {
  const isText = /\.(md|txt)$/u.test(file);
  const before = isText ? /(^|\n)$/u : /["'`]$/u;
  const after = isText ? /^(\n\n|\n?$)/u : /^["'`]/u;
  for (let at = source.indexOf(note); at !== -1; at = source.indexOf(note, at + 1)) {
    if (before.test(source.slice(0, at)) && after.test(source.slice(at + note.length))) return true;
  }
  return false;
}

function contributorFiles(root) {
  return execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...contributorPathspecs],
    { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 },
  )
    .split("\0")
    .filter((relative) => fs.lstatSync(path.join(root, relative), { throwIfNoEntry: false })?.isFile());
}

function collectMauiWiringFailures(root) {
  const read = (file) => {
    const absolute = path.join(root, file);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
  };
  const failures = [];

  const host = `${mauiAndroid}/OpenIapAndroid.cs`;
  const built =
    /new FirstPurchaseNotice\(\s*isHostDebuggable:[^;]*ApplicationInfoFlags\.Debuggable[^;]*,\s*claim:\s*_module\.ClaimFirstPurchaseNotice\)/u;
  if (!built.test(read(host))) {
    failures.push(`${host}: the notice must read the host app's debuggable flag and claim through the module`);
  }

  const resolvers = `${mauiAndroid}/OpenIapAndroid.Resolvers.cs`;
  const source = read(resolvers);
  const start = source.indexOf("FinishTransactionAsync(");
  const end = source.indexOf("\n    }\n", start);
  const body = start === -1 || end === -1 ? "" : source.slice(start, end);
  if (!body.includes("_firstPurchaseNotice.AfterFinish(")) {
    failures.push(`${resolvers}: FinishTransactionAsync must run through _firstPurchaseNotice.AfterFinish`);
  }
  return failures;
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
    const source = fs.readFileSync(path.join(root, files[0]), "utf8");
    if (!source.includes(assistantNote)) {
      failures.push(`${files[0]}: note for coding assistants differs from ${touchpointsPath}`);
    } else if (!standsAlone(files[0], source, assistantNote)) {
      failures.push(`${files[0]}: note for coding assistants must stand alone, with nothing added to it`);
    }
  }

  const renderer = path.join(root, assistantNoteRenderer);
  const rendererText = fs.existsSync(renderer) ? fs.readFileSync(renderer, "utf8") : "";
  if (!rendererText.includes("community-touchpoints.json") || !rendererText.includes(".assistantNote")) {
    failures.push(`${assistantNoteRenderer}: must render assistantNote from ${touchpointsPath}`);
  }

  const body = assistantNote.split("\n").slice(1).join("\n");
  for (const relative of contributorFiles(root)) {
    if (fs.readFileSync(path.join(root, relative), "utf8").includes(body)) {
      failures.push(`${relative}: the note for coding assistants belongs to consumer surfaces only`);
    }
  }

  failures.push(...collectMauiWiringFailures(root));
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
