import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeGeneratedFileIfChanged } from "../compile-context.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("writeGeneratedFileIfChanged", () => {
  test("preserves timestamps when generated content is otherwise unchanged", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-context-"));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "llms.txt");
    const first = "# Reference\n\n> Generated: 2026-07-11T00:00:00.000Z\n\nBody";
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-context-"));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, "context.md");
    const first = "# Context\n\n> Last updated: 2026-07-11T00:00:00.000Z\n\nOld";
    const changed =
      "# Context\n\n> Last updated: 2026-07-11T01:00:00.000Z\n\nNew";

    expect(writeGeneratedFileIfChanged(outputPath, first)).toBe(true);
    expect(writeGeneratedFileIfChanged(outputPath, changed)).toBe(true);
    const written = fs.readFileSync(outputPath, "utf-8");
    expect(written).toContain("2026-07-11T01:00:00.000Z");
    expect(written).toContain("New");
  });
});
