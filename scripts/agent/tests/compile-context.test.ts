import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  alignGeneratedOutputTimestamps,
  writeGeneratedFileIfChanged,
} from "../compile-context.js";
import {
  CONTEXT_DIRECT_INPUTS,
  CONTEXT_INPUT_PATHS,
  CONTEXT_KNOWLEDGE_INPUT_ROOTS,
  CONTEXT_OUTPUT_PATHS,
  CONTEXT_SOURCES,
} from "../context-files.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("writeGeneratedFileIfChanged", () => {
  test("preserves timestamps when generated content is otherwise unchanged", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "openiap-context-"),
    );
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "llms.txt");
    const first =
      "# Reference\n\n> Generated: 2026-07-11T00:00:00.000Z\n\nBody";
    const timestampOnlyChange =
      "# Reference\n\n> Generated: 2026-07-11T01:00:00.000Z\n\nBody";

    expect(writeGeneratedFileIfChanged(outputPath, first)).toBe(true);
    expect(writeGeneratedFileIfChanged(outputPath, timestampOnlyChange)).toBe(
      false,
    );
    expect(fs.readFileSync(outputPath, "utf-8")).toContain(
      "2026-07-11T00:00:00.000Z",
    );
  });

  test("writes a new timestamp when substantive content changes", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "openiap-context-"),
    );
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "context.md");
    const first =
      "# Context\n\n> Last updated: 2026-07-11T00:00:00.000Z\n\nOld";
    const changed =
      "# Context\n\n> Last updated: 2026-07-11T01:00:00.000Z\n\nNew";

    expect(writeGeneratedFileIfChanged(outputPath, first)).toBe(true);
    expect(writeGeneratedFileIfChanged(outputPath, changed)).toBe(true);
    const written = fs.readFileSync(outputPath, "utf-8");
    expect(written).toContain("2026-07-11T01:00:00.000Z");
    expect(written).toContain("New");
  });

  test("aligns unchanged output sets to their latest timestamp", () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "openiap-context-"),
    );
    temporaryDirectories.push(directory);
    const quickPath = path.join(directory, "llms.txt");
    const fullPath = path.join(directory, "llms-full.txt");
    fs.writeFileSync(
      quickPath,
      "# Quick\n\n> Generated: 2026-07-11T00:00:00.000Z\n\nBody\n",
    );
    fs.writeFileSync(
      fullPath,
      "# Full\n\n> Generated: 2026-07-11T01:00:00.000Z\n\nBody\n",
    );

    const aligned = alignGeneratedOutputTimestamps([
      {
        content: "# Quick\n\n> Generated: 2026-07-11T02:00:00.000Z\n\nBody",
        filePath: quickPath,
      },
      {
        content: "# Full\n\n> Generated: 2026-07-11T02:00:00.000Z\n\nBody",
        filePath: fullPath,
      },
    ]);

    expect(aligned.map(({ content }) => content)).toEqual([
      "# Quick\n\n> Generated: 2026-07-11T01:00:00.000Z\n\nBody",
      "# Full\n\n> Generated: 2026-07-11T01:00:00.000Z\n\nBody",
    ]);
  });
});

describe("generated context path contract", () => {
  test("keeps compiler inputs and generated outputs disjoint", () => {
    expect(new Set(CONTEXT_INPUT_PATHS).size).toBe(CONTEXT_INPUT_PATHS.length);
    expect(new Set(CONTEXT_OUTPUT_PATHS).size).toBe(
      CONTEXT_OUTPUT_PATHS.length,
    );
    const inputPaths: readonly string[] = CONTEXT_INPUT_PATHS;
    for (const output of CONTEXT_OUTPUT_PATHS) {
      expect(
        inputPaths.some(
          (input) => output === input || output.startsWith(`${input}/`),
        ),
      ).toBe(false);
    }
  });

  test("derives knowledge inputs from the compiler source contract", () => {
    expect(CONTEXT_SOURCES.internalKnowledgeGlob).toBe(
      `${CONTEXT_SOURCES.knowledgeRoot}/internal/**/*.md`,
    );
    expect(CONTEXT_SOURCES.externalKnowledgeGlob).toBe(
      `${CONTEXT_SOURCES.knowledgeRoot}/external/**/*.md`,
    );
    expect(new Set(CONTEXT_INPUT_PATHS)).toEqual(
      new Set([
        ...Object.values(CONTEXT_DIRECT_INPUTS),
        ...Object.values(CONTEXT_KNOWLEDGE_INPUT_ROOTS),
      ]),
    );
  });

  test("keeps hooks and CI on the shared input/output helper", () => {
    const repositoryRoot = path.resolve(import.meta.dir, "../../..");
    const preCommit = fs.readFileSync(
      path.join(repositoryRoot, ".husky/pre-commit"),
      "utf8",
    );
    const workflow = fs.readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(preCommit).toContain("context-files.ts assert-inputs-staged-clean");
    expect(preCommit).toContain("context-files.ts assert-outputs-clean");
    expect(workflow).toContain("node scripts/assert-clean-worktree.mjs");
    expect(workflow).not.toContain("context-files.ts assert-outputs-clean");
    expect(workflow).not.toContain("needs.changes.outputs.agent");
  });
});
