import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
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
  test("review-pr replaces unavailable CodeRabbit coverage with review-self", () => {
    const reviewPr = normalizeWhitespace(
      readRepositoryFile(".claude/commands/review-pr.md"),
    );

    expect(reviewPr).toContain("## Automated Reviewer Fallback");
    expect(reviewPr).toContain(
      "replace the missing coverage with one complete `$review-self` round",
    );
    expect(reviewPr).toContain(
      "CodeRabbit unavailability alone is neither a blocker nor a clean result",
    );
    expect(reviewPr).toContain(
      "Cache fallback coverage by CodeRabbit failure reason and head SHA",
    );
    expect(reviewPr).toContain(
      "inspect the response instead of treating the trigger comment itself as review success",
    );
    expect(reviewPr).toContain(
      "Do not classify a queued, requested, or actively running review as unavailable",
    );
    expect(reviewPr).toContain(
      "A terminal clean CodeRabbit result is successful reviewer coverage",
    );
    expect(reviewPr).toContain(
      "CodeRabbit is the only configured external reviewer",
    );
    expect(reviewPr).not.toContain("/gemini review");
    expect(reviewPr).not.toContain("Copilot");
  });

  test("review-pr deletes automation noise and keeps every substantive comment", () => {
    // Pinning the block verbatim froze a defect once: the invocation-marker
    // branch deleted CodeRabbit replies that carried findings. Run the filter
    // the file actually ships, over comment shapes taken from real PRs.
    const reviewPr = readRepositoryFile(".claude/commands/review-pr.md");
    const cleanupScript =
      reviewPr.match(
        /### Cleanup Review Automation Comments[\s\S]*?```bash\n([\s\S]*?)\n```/,
      )?.[1] ?? "";

    expect(cleanupScript).toContain("--paginate");
    expect(cleanupScript).toContain(
      'gh api -X DELETE "repos/hyodotdev/openiap/issues/comments/$comment_id"',
    );
    expect(normalizeWhitespace(reviewPr)).toContain(
      "Do **not** delete human comments, inline review replies, actual reviewer summaries, CodeRabbit walkthrough comments, or any comment containing substantive review feedback",
    );

    const filter = cleanupScript.match(/--jq '([\s\S]*?)'\s*\|\s*while read/)?.[1];
    expect(filter).toBeTruthy();

    const fixture = JSON.parse(
      readRepositoryFile("scripts/agent/tests/fixtures/coderabbit-cleanup-comments.json"),
    ) as Array<{ id: number; keep: boolean; why: string; body: string }>;
    // A real "too many files" notice embeds the file list and runs past 17k
    // characters, so the filter must not decide anything by length.
    for (const comment of fixture) {
      comment.body = comment.body.replace("FILLER_16K", "x".repeat(16000));
    }

    const input = JSON.stringify(fixture);
    const result = spawnSync("jq", ["-r", filter ?? ""], { input, encoding: "utf8" });
    if (result.error) {
      throw new Error(
        "jq is required to verify the cleanup filter; install it or run this suite on a runner that has it",
      );
    }
    expect(result.stderr).toBe("");

    const deleted = result.stdout.split("\n").filter(Boolean).map(Number);
    const expected = fixture.filter((c) => !c.keep).map((c) => c.id);
    expect(deleted.sort()).toEqual(expected.sort());

    for (const comment of fixture.filter((c) => c.keep)) {
      expect(deleted).not.toContain(comment.id); // ${comment.why}
    }
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
    expect(codexWorkflow).toContain("CodeRabbit is the only external reviewer");
    expect(claudeWorkflow).toContain(
      "including its `.claude/skills/review-self/SKILL.md` fallback",
    );
    expect(claudeWorkflow).toContain("do not invoke other review bots");
  });
});
