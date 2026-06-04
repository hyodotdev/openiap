---
name: openiap-workflows
description: Use for OpenIAP monorepo work that should follow the repository's Claude slash-command workflows, including review-pr, audit-code, compile-knowledge, verify-all, resolve-issue, commit/push/PR, generated type sync, package-specific checks, GitHub review threads, and project conventions from CLAUDE.md/AGENTS.md.
---

# OpenIAP Workflows

Use this skill when the user asks Codex to perform an OpenIAP repo workflow that
previously lived under `.claude/commands`, such as reviewing a PR, resolving an
issue, auditing code, compiling knowledge, verifying the monorepo, or committing
and opening a PR.

## Source Of Truth

Before changing code, read the root `AGENTS.md` or `CLAUDE.md`; they are linked
in this repo. Then read the relevant detailed files:

- Package and library rules: `knowledge/internal/*.md`
- Package conventions: `packages/*/CONVENTION.md`
- Library conventions: `libraries/*/CLAUDE.md`
- Workflow details: `.claude/commands/*.md`

Do not duplicate or reinterpret those rules when a file already covers the
specific package or workflow.

## Command Mapping

Codex does not need Claude slash-command syntax. If the user says any of these
natural-language requests, execute the matching workflow:

- Review PR comments, fix review feedback, or "review-pr": read
  `.claude/commands/review-pr.md`.
- Audit code, check latest APIs, or "audit-code": read
  `.claude/commands/audit-code.md`.
- Compile knowledge or rebuild AI context: read
  `.claude/commands/compile-knowledge.md`.
- Resolve a GitHub issue: read `.claude/commands/resolve-issue.md`.
- Verify all, health check, or pre-PR verification: read
  `.claude/commands/verify-all.md`.
- Commit, push, or create PR: read `.claude/commands/commit.md`.

When a command file gives a sequence, follow it unless the user's newest
instruction narrows the scope.

## Internal Workflow Change Guard

Internal agent/workflow-only changes include `.claude/commands/`,
`.codex/skills/`, `AGENTS.md`, `CLAUDE.md`, and agent automation notes. Do not
create a branch, push, or open a PR for those changes unless the user explicitly
asks to publish, PR, or merge them.

If a user asks to update an internal workflow and does not explicitly ask for a
PR, keep the change local and report the changed files. If a PR is already open
for an internal workflow because the user explicitly requested it, add
appropriate labels before merging.

## Non-Negotiables

- Read relevant knowledge and package convention files before editing package or
  library code.
- Never hand-edit generated files unless the workflow explicitly says to verify
  generated output after running the generator.
- For GraphQL schema/API changes, follow the SDK Parity Checklist in
  `knowledge/internal/04-platform-packages.md`.
- Run the package-specific verification commands for touched paths.
- For Android package work, compile both Play and Horizon variants when relevant.
- For docs/API/type docs changes, run `bun audit:docs` or the documented audit
  command before pushing.
- For release-note package lists, verify versions from package metadata and
  GitHub release tags; never infer framework versions from `openiap-versions.json`
  or from a nearby release block.
- For PRs with new features, visible behavior changes, UI changes, docs pages,
  example flows, or developer workflows, record the actual changed surface,
  compress the video to under 10 MB, and upload it to the GitHub PR as a
  `Preview` comment or committed docs/example asset. If PR attachment upload is
  blocked by local browser or extension permissions, commit a compressed asset
  under `.github/pr-previews/` and link the GitHub-hosted raw/blob URL. Use the
  Codex Chrome Extension for web/docs/dashboard previews when applicable.
- Keep commits in Angular Conventional Commits format:
  `<type>(<scope>): <subject>`.

## GitHub Review Threads

For PR review feedback, use the GitHub app tools or `gh` as needed to inspect
inline review threads. Fix valid findings in the current PR, reply to the
specific inline comment with the plain commit hash, and resolve only threads
that are fixed or outdated per `.claude/commands/review-pr.md`.

Do not reply with "will address later" for valid correctness or operational
findings. Implement the fix in the current PR unless the finding is wrong on
the merits, and explain the concrete repo evidence when pushing back.
