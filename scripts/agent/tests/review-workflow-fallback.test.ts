import { describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const repositoryRoot = path.resolve(import.meta.dir, "../../..");

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("review workflow fallback contract", () => {
  test("review-pr replaces unavailable automated reviewers with review-self", () => {
    const reviewPr = normalizeWhitespace(
      readRepositoryFile(".claude/commands/review-pr.md"),
    );

    expect(reviewPr).toContain("## Automated Reviewer Fallback");
    expect(reviewPr).toContain(
      "replace the missing coverage with one complete `$review-self` round",
    );
    expect(reviewPr).toContain(
      "Reviewer unavailability alone is neither a blocker nor a clean result",
    );
    expect(reviewPr).toContain(
      "Cache fallback coverage by reviewer failure set and head SHA",
    );
    expect(reviewPr).toContain(
      "Inspect the response instead of treating the trigger comment itself as review success",
    );
    expect(reviewPr).toContain(
      "Do not classify a queued, requested, or actively running review as unavailable",
    );
  });

  test("review-self exposes a non-recursive single-round fallback", () => {
    const reviewSelf = normalizeWhitespace(
      readRepositoryFile(".codex/skills/review-self/SKILL.md"),
    );

    expect(reviewSelf).toContain("## Act As A Review-PR Fallback");
    expect(reviewSelf).toContain(
      "Run exactly one complete review round against the supplied base",
    );
    expect(reviewSelf).toContain(
      "Do not re-enter `review-pr`, request external reviewers",
    );
    expect(reviewSelf).toContain(
      "`review-pr` remains the sole thread-handling and polling owner",
    );
  });

  test("Codex and Claude workflow routers preserve the fallback", () => {
    const codexWorkflow = normalizeWhitespace(
      readRepositoryFile(".codex/skills/openiap-workflows/SKILL.md"),
    );
    const claudeWorkflow = normalizeWhitespace(
      readRepositoryFile(".claude/skills/openiap-workflows/SKILL.md"),
    );

    expect(codexWorkflow).toContain(
      "run its single-round `review-pr` fallback",
    );
    expect(claudeWorkflow).toContain(
      "including its `.claude/skills/review-self/SKILL.md` fallback",
    );
  });
});
