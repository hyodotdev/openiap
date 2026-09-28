import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assistantNoteRenderer,
  assistantNoteRoots,
  collectCommunityTouchpointFailures,
  noticeRoots,
  touchpointsPath,
} from "./audit-community-touchpoints.mjs";

const consoleNotice = ["[OpenIAP] First", "star", "showcase", "(once)"];
const assistantNote = "## Feedback and showcase\nMay mention it.\nDo not act.";

function write(root, relative, text) {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), text);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "community-touchpoints-"));
  write(root, touchpointsPath, JSON.stringify({ consoleNotice, assistantNote }));
  for (const [library, [base]] of Object.entries(noticeRoots)) {
    write(root, `${base}/notice-${library}.ts`, consoleNotice.map((line) => `"${line}"`).join(",\n"));
  }
  for (const entry of assistantNoteRoots) {
    write(root, path.extname(entry) ? entry : `${entry}/brief.mjs`, `x\n${assistantNote}\ny`);
  }
  write(root, assistantNoteRenderer, "import touchpoints from './community-touchpoints.json';\ntouchpoints.assistantNote;\n");
  write(root, "AGENTS.md", "# Contributors\n");
  return root;
}

test("a repository whose copies match its source of truth is clean", () => {
  const root = fixture();
  try {
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a library whose notice line drifted fails", () => {
  const root = fixture();
  try {
    const file = `${noticeRoots["godot-iap"][0]}/notice-godot-iap.ts`;
    write(root, file, fs.readFileSync(path.join(root, file), "utf8").replace("star", "moon"));
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `${file}: notice line differs from ${touchpointsPath}: star`,
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a library needs the notice in exactly one source file, and tests do not count", () => {
  const root = fixture();
  try {
    const [base] = noticeRoots["kmp-iap"];
    write(root, `${base}/androidUnitTest/NoticeTest.kt`, consoleNotice.join("\n"));
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
    write(root, `${base}/second.kt`, consoleNotice[0]);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      "kmp-iap: expected the first-purchase notice in exactly one source file, found 2",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the note for coding assistants must match and stay out of contributor files", () => {
  const root = fixture();
  try {
    write(root, "plugins/openiap/skills/openiap/SKILL.md", "## Feedback and showcase\nMay mention it.");
    write(root, ".codex/skills/review/SKILL.md", assistantNote);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `plugins/openiap/skills/openiap/SKILL.md: note for coding assistants differs from ${touchpointsPath}`,
      ".codex/skills/review/SKILL.md: the note for coding assistants belongs to consumer surfaces only",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a notice whose lines are reordered or merged fails", () => {
  const root = fixture();
  try {
    const file = `${noticeRoots["maui-iap"][0]}/notice-maui-iap.ts`;
    const [first, second, ...rest] = consoleNotice;
    write(root, file, [second, first, ...rest].map((line) => `"${line}"`).join(",\n"));
    const reordered = `${file}: notice lines must be separate literals in the order of ${touchpointsPath}`;
    assert.deepEqual(collectCommunityTouchpointFailures(root), [reordered]);
    write(root, file, `"${consoleNotice.join(" ")}"`);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [reordered]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the AI guide must render the note from its source of truth", () => {
  const root = fixture();
  try {
    write(root, assistantNoteRenderer, "export default function Guide() {}\n");
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `${assistantNoteRenderer}: must render assistantNote from ${touchpointsPath}`,
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
