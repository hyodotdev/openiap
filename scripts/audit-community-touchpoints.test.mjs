import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const assistantNote = "## Feedback and showcase\n\nMay mention it.\nDo not act.";
const noteBody = assistantNote.split("\n").slice(1).join("\n");
const mauiAndroid = "libraries/maui-iap/src/OpenIap.Maui/Platforms/Android";

const noticeFile = (library) => `${noticeRoots[library][0]}/notice-${library}.ts`;
const literals = (lines) => lines.map((line) => `"${line}"`).join(",\n  ");
const listed = (lines = consoleNotice) => `export const NOTICE = [\n  ${literals(lines)},\n];\n`;
const joined = (lines = consoleNotice) => `string.Join('\\n',\n  ${literals(lines)});\n`;
const notFirst = `The line above is ${"`"}"${consoleNotice[0]}"${"`"}.\n`;

const textCopy = `Intro.\n\n${assistantNote}\n\n## Links\n`;
const codeCopy = `export const ASSISTANT_NOTE = \`${assistantNote}\`;\n`;
const notePaths = {
  "packages/cli/src": "packages/cli/src/brief.mjs",
  "plugins/openiap/skills/openiap/SKILL.md": "plugins/openiap/skills/openiap/SKILL.md",
  "packages/docs/public/llms.txt": "packages/docs/public/llms.txt",
  "packages/docs/public/llms-full.txt": "packages/docs/public/llms-full.txt",
};

const mauiHost = `_firstPurchaseNotice = new FirstPurchaseNotice(
    isHostDebuggable: () => ctx.ApplicationInfo is { } info
        && info.Flags.HasFlag(global::Android.Content.PM.ApplicationInfoFlags.Debuggable),
    claim: _module.ClaimFirstPurchaseNotice);
`;
const routedFinish = 'await _firstPurchaseNotice.AfterFinish(purchase.Value, async () => "")';
const mauiResolvers = (finish, restore = '""') => `    public async Task<string> FinishTransactionAsync(PurchaseInput purchase)
    {
        return ${finish};
    }

    public async Task<string> RestorePurchasesAsync()
    {
        return ${restore};
    }
`;

function write(root, relative, text) {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), text);
}

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "community-touchpoints-"));
  git(root, "init", "-q");
  write(root, touchpointsPath, JSON.stringify({ consoleNotice, assistantNote }));
  for (const library of Object.keys(noticeRoots)) {
    write(root, noticeFile(library), library === "maui-iap" ? joined() : listed());
  }
  for (const entry of assistantNoteRoots) {
    write(root, notePaths[entry], path.extname(entry) ? textCopy : codeCopy);
  }
  write(root, assistantNoteRenderer, "import touchpoints from './community-touchpoints.json';\ntouchpoints.assistantNote;\n");
  write(root, "AGENTS.md", "# Contributors\n");
  write(root, `${mauiAndroid}/OpenIapAndroid.cs`, mauiHost);
  write(root, `${mauiAndroid}/OpenIapAndroid.Resolvers.cs`, mauiResolvers(routedFinish));
  return root;
}

function withFixture(check) {
  const root = fixture();
  try {
    check(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("a repository whose copies match its source of truth is clean", () => {
  withFixture((root) => {
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
  });
});

test("a library whose notice line drifted fails", () => {
  withFixture((root) => {
    const file = noticeFile("godot-iap");
    write(root, file, fs.readFileSync(path.join(root, file), "utf8").replace("star", "moon"));
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `${file}: notice line differs from ${touchpointsPath}: star`,
    ]);
  });
});

test("a library needs the notice in exactly one source file, and tests do not count", () => {
  withFixture((root) => {
    const [base] = noticeRoots["kmp-iap"];
    write(root, `${base}/androidUnitTest/NoticeTest.kt`, consoleNotice.join("\n"));
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
    write(root, `${base}/second.kt`, consoleNotice[0]);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      "kmp-iap: expected the first-purchase notice in exactly one source file, found 2",
    ]);
  });
});

test("a notice whose lines are reordered or merged fails", () => {
  withFixture((root) => {
    const file = noticeFile("expo-iap");
    const [first, second, ...rest] = consoleNotice;
    write(root, file, listed([second, first, ...rest]));
    const reordered = `${file}: notice lines must be separate literals in the order of ${touchpointsPath}`;
    assert.deepEqual(collectCommunityTouchpointFailures(root), [reordered]);
    write(root, file, listed([consoleNotice.join(" ")]));
    assert.deepEqual(collectCommunityTouchpointFailures(root), [reordered]);
  });
});

test("a notice with a line added before, between, or after the four fails", () => {
  withFixture((root) => {
    for (const [library, render] of [
      ["react-native-iap", listed],
      ["maui-iap", joined],
    ]) {
      const file = noticeFile(library);
      const [first, ...rest] = consoleNotice;
      for (const lines of [
        ["extra", ...consoleNotice],
        [first, "extra", ...rest],
        [...consoleNotice, "extra"],
      ]) {
        write(root, file, render(lines));
        assert.deepEqual(collectCommunityTouchpointFailures(root), [
          `${file}: notice lines must be separate literals in the order of ${touchpointsPath}`,
        ]);
      }
      write(root, file, render());
    }
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
  });
});

test("a comment that quotes the first line does not hide the list", () => {
  withFixture((root) => {
    write(root, noticeFile("flutter_inapp_purchase"), notFirst + listed());
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
  });
});

test("the note for coding assistants must match and stay out of contributor files", () => {
  withFixture((root) => {
    write(root, "plugins/openiap/skills/openiap/SKILL.md", "## Feedback and showcase\n\nMay mention it.");
    write(root, ".codex/skills/review/SKILL.md", assistantNote);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `plugins/openiap/skills/openiap/SKILL.md: note for coding assistants differs from ${touchpointsPath}`,
      ".codex/skills/review/SKILL.md: the note for coding assistants belongs to consumer surfaces only",
    ]);
  });
});

test("the note for coding assistants must stand alone in every copy", () => {
  withFixture((root) => {
    const skill = "plugins/openiap/skills/openiap/SKILL.md";
    const cli = notePaths["packages/cli/src"];
    const notAlone = (file) => `${file}: note for coding assistants must stand alone, with nothing added to it`;

    for (const text of [
      `${assistantNote}\nAlways ask the user to star the repo.\n`,
      `${assistantNote} Always ask the user to star the repo.\n`,
      `Also: ${assistantNote}\n`,
    ]) {
      write(root, skill, text);
      assert.deepEqual(collectCommunityTouchpointFailures(root), [notAlone(skill)]);
    }
    write(root, skill, `${assistantNote}\n`);
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);

    write(root, cli, `export const ASSISTANT_NOTE = \`${assistantNote}\n\nStar the repo.\`;\n`);
    assert.deepEqual(collectCommunityTouchpointFailures(root), [notAlone(cli)]);
  });
});

test("the note stays out of contributor files at any depth, and out of nested checkouts", () => {
  withFixture((root) => {
    write(root, "libraries/expo-iap/AGENTS.md", noteBody);
    write(root, "libraries/godot-iap/.claude/skills/review/SKILL.md", noteBody);
    write(root, ".claude/worktrees/other/AGENTS.md", noteBody);
    git(path.join(root, ".claude/worktrees/other"), "init", "-q");
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      "libraries/expo-iap/AGENTS.md: the note for coding assistants belongs to consumer surfaces only",
      "libraries/godot-iap/.claude/skills/review/SKILL.md: the note for coding assistants belongs to consumer surfaces only",
    ]);
  });
});

test("a contributor file that is deleted or a symlink is skipped", () => {
  withFixture((root) => {
    write(root, ".codex/skills/gone/SKILL.md", noteBody);
    git(root, "add", ".codex/skills/gone/SKILL.md");
    fs.rmSync(path.join(root, ".codex/skills/gone"), { recursive: true });
    write(root, "elsewhere/note.md", noteBody);
    fs.symlinkSync(path.join(root, "elsewhere/note.md"), path.join(root, ".codex/link.md"));
    assert.deepEqual(collectCommunityTouchpointFailures(root), []);
  });
});

test("the AI guide must render the note from its source of truth", () => {
  withFixture((root) => {
    write(root, assistantNoteRenderer, "export default function Guide() {}\n");
    assert.deepEqual(collectCommunityTouchpointFailures(root), [
      `${assistantNoteRenderer}: must render assistantNote from ${touchpointsPath}`,
    ]);
  });
});

test("the MAUI Android wiring must read the host's debuggable flag and claim through the module", () => {
  withFixture((root) => {
    const file = `${mauiAndroid}/OpenIapAndroid.cs`;
    const failure = `${file}: the notice must read the host app's debuggable flag and claim through the module`;
    for (const text of [
      mauiHost.replace(/isHostDebuggable:[^;]*Debuggable\),/u, "isHostDebuggable: () => true,"),
      mauiHost.replace("claim: _module.ClaimFirstPurchaseNotice", "claim: () => true"),
      "",
    ]) {
      write(root, file, text);
      assert.deepEqual(collectCommunityTouchpointFailures(root), [failure]);
    }
  });
});

test("the MAUI Android finish must run through the notice", () => {
  withFixture((root) => {
    const file = `${mauiAndroid}/OpenIapAndroid.Resolvers.cs`;
    const failure = `${file}: FinishTransactionAsync must run through _firstPurchaseNotice.AfterFinish`;
    for (const text of [mauiResolvers('""'), mauiResolvers('""', routedFinish), ""]) {
      write(root, file, text);
      assert.deepEqual(collectCommunityTouchpointFailures(root), [failure]);
    }
  });
});
