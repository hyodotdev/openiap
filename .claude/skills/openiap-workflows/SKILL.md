---
name: openiap-workflows
description: Use for OpenIAP monorepo work that should follow the repository's slash-command workflows when the user asks in natural language instead of typing a slash command, including review-pr, audit-code, audit-security, audit-iapkit, compile-knowledge, verify-all, e2e-tests, stable or prerelease package releases, resolve-issue, commit/push/PR, generated type sync, package-specific checks, GitHub review threads, and project conventions from AGENTS.md.
---

# OpenIAP Workflows (Claude Code)

The canonical workflow definitions live in `.claude/commands/*.md` and the
shared operating rules live in `.codex/skills/openiap-workflows/SKILL.md`.
Follow both; this file only adds the Claude Code specifics.

## Command Mapping

When the user asks in natural language, execute the matching workflow by
reading the command file (or invoke the slash command directly when available):

- Review PR comments / fix review feedback → `.claude/commands/review-pr.md`
  (`/review-pr`), including its `.claude/skills/review-self/SKILL.md` fallback
  when CodeRabbit cannot review the current head; do not invoke other review
  bots, and remove temporary CodeRabbit trigger and terminal
  skip/unavailable top-level comments when the loop is clean
- Audit code against knowledge rules → `.claude/commands/audit-code.md` (`/audit-code`)
- Audit supply-chain security / SBOM → `.claude/commands/audit-security.md` (`/audit-security`)
- Reconcile IAPKit with OpenIAP → `.claude/commands/audit-iapkit.md` (`/audit-iapkit`)
- Compile knowledge / rebuild AI context → `.claude/commands/compile-knowledge.md` (`/compile-knowledge`)
- Resolve a GitHub issue → `.claude/commands/resolve-issue.md` (`/resolve-issue`)
- Verify all / monorepo health check → `.claude/commands/verify-all.md` (`/verify-all`)
- Device-backed E2E regression → `.claude/commands/e2e-tests.md` (`/e2e-tests`)
- Stable or RC/next releases → `.claude/commands/release.md` (`/release`)
- Commit, push, or create PR → `.claude/commands/commit.md` (`/commit`)

## Claude Code Notes

- Read the "Source Of Truth", "Internal Workflow Change Guard",
  "Non-Negotiables", and "GitHub Review Threads" sections of
  `.codex/skills/openiap-workflows/SKILL.md` and apply them as written; they
  are agent-agnostic rules, not Codex-only rules.
- Where that file says to use the Codex Chrome Extension, use Claude's browser
  tooling (Claude in Chrome / Playwright) instead.
- Where that file mentions `$skill` syntax, the equivalent in Claude Code is
  the matching skill in `.claude/skills/` or the slash command in
  `.claude/commands/`.
- When `review-pr` falls back to `review-self`, follow the canonical
  single-round override and leave reviewer requests, thread handling, and
  polling ownership with `review-pr`.
