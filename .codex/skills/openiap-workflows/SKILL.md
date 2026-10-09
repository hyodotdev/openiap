---
name: openiap-workflows
description: Use for OpenIAP monorepo work that should follow the repository's shared agent workflows, including review-pr, audit-code, audit-security, audit-iapkit, compile-knowledge, verify-all, e2e-tests, stable or prerelease package releases, resolve-issue, commit/push/PR, generated type sync, package-specific checks, GitHub review threads, and project conventions from AGENTS.md.
---

# OpenIAP Workflows

Use this skill when the user asks the agent to perform an OpenIAP repo workflow that
previously lived under `.claude/commands`, such as reviewing a PR, resolving an
issue, auditing code, compiling knowledge, running device-backed E2E regression,
verifying the monorepo, or committing and opening a PR.

## Source Of Truth

Before changing code, read the root `AGENTS.md`; `CLAUDE.md` and `GEMINI.md`
are symlinks to it in this repo, while Grok, Codex, and Muse consume
`AGENTS.md` directly. Then read the relevant detailed files:

- Package and library rules: `knowledge/internal/*.md`
- Package conventions: `packages/*/CONVENTION.md`
- Library conventions: `libraries/*/AGENTS.md`
- Workflow details: `.claude/commands/*.md`

Do not duplicate or reinterpret those rules when a file already covers the
specific package or workflow.

## Command Mapping

You do not need Claude slash-command syntax. If the user says any of these
natural-language requests, execute the matching workflow:

- Review PR comments, fix review feedback, or "review-pr": read
  `.claude/commands/review-pr.md`. CodeRabbit is the only external reviewer that
  posts to the PR; do not invoke other review bots. If CodeRabbit cannot review
  the current head, run the single-round Codex fallback that command defines;
  read `.codex/skills/review-self/SKILL.md` and run its single-round `review-pr`
  fallback only when Codex is unavailable too. At the clean end of the loop, remove the
  temporary CodeRabbit trigger and terminal skip/unavailable top-level comments
  exactly as defined by the command workflow.
- Audit code, check latest APIs, or "audit-code": read
  `.claude/commands/audit-code.md`.
- Audit SBOM quality, release provenance, workflow permissions, or
  supply-chain/security posture: read `.claude/commands/audit-security.md`.
- Reconcile the IAPKit site with OpenIAP, audit kit docs, or check whether
  IAPKit reflects a spec/store update: read `.claude/commands/audit-iapkit.md`.
- Compile knowledge or rebuild AI context: read
  `.claude/commands/compile-knowledge.md`.
- Resolve a GitHub issue: read `.claude/commands/resolve-issue.md`.
- Verify all, health check, or pre-PR verification: read
  `.claude/commands/verify-all.md`.
- E2E tests, device regression, connected-device purchase flow checks, or
  "e2e-tests": read `.claude/commands/e2e-tests.md`.
- Android E2E tests, Play/Amazon/Horizon/VegaOS regression, or
  "e2e-tests-google": read `.claude/commands/e2e-tests-google.md`.
- Apple E2E tests, iOS regression, or "e2e-tests-apple": read
  `.claude/commands/e2e-tests-apple.md`.
- Stable releases, RC/next releases, registry publication, or package deploys:
  read `.claude/commands/release.md`.
- Commit, push, or create PR: read `.claude/commands/commit.md`.

When a command file gives a sequence, follow it unless the user's newest
instruction narrows the scope.

For `e2e-tests`, an unqualified request means the full regression matrix in the
command file, including native packages, framework libraries, build-only
platform rows, connected-device rows, and explicit blocked/unsupported rows.
A request naming one platform runs only that half's scoped file.

## Internal Workflow Change Guard

Internal agent/workflow-only changes include `.claude/commands/`,
`.claude/skills/`, `.codex/skills/`, `.cursor/rules/`, `AGENTS.md`,
`CLAUDE.md`, `GEMINI.md`, and agent automation notes. Do not create a branch,
push, or open a PR for those changes unless the user explicitly asks to publish,
PR, or merge them.

If a user asks to update an internal workflow and does not explicitly ask for a
PR, keep the change local and report the changed files. If a PR is already open
for an internal workflow because the user explicitly requested it, add
appropriate labels before merging.

## Non-Negotiables

- Apply the canonical KISS/SSOT release criteria in
  `knowledge/internal/03-coding-style.md`.
- Before any public GitHub write, apply the English-only communication guard in
  `knowledge/internal/06-git-deployment.md`. Private maintainer conversation
  language must never leak into issue, PR, review, release, or commit prose.
- Read relevant knowledge and package convention files before editing package or
  library code.
- Never hand-edit generated files unless the workflow explicitly says to verify
  generated output after running the generator.
- For GraphQL schema/API changes, follow the SDK Parity Checklist in
  `knowledge/internal/04-platform-packages.md`.
- Run the package-specific verification commands for touched paths.
- For dependency modernization release trains, keep the entire train in one PR
  and follow `.claude/commands/release.md` for the all-workflow preflight. If a
  post-merge stable release reveals a CI-only blocker, pause the train, inspect
  all remaining workflows, and prepare the confirmed repairs together. Apply
  `knowledge/internal/06-git-deployment.md#opening-pull-requests` before opening
  a recovery PR; release authorization alone does not authorize that new PR.
- For Android package work, compile Play, Horizon, and Amazon variants when relevant.
- For docs/API/type docs changes, run `bun audit:docs` or the documented audit
  command before pushing.
- For release-note package lists, verify versions from package metadata and
  GitHub release tags; never infer framework versions from `openiap-versions.json`
  or from a nearby release block.
- Before creating or updating a PR, declaring review clean, or releasing, apply
  `knowledge/internal/05-docs-patterns.md#release-note-completeness-gate`.
- Run stable and prerelease package releases from `main` through an explicit
  dispatch. RCs use npm `next`; stable uses `latest`. Vercel automatically
  deploys main's docs, including RC metadata; docs deployment publishes no
  package. Run
  `bun run audit:release-state` before release work.
- Decide whether a preview video helps the reviewer under
  `knowledge/internal/06-git-deployment.md#pull-request-preview-recordings`.
  Record and attach it only when useful; follow that section's capture,
  compression, upload, and privacy rules. A video is not a merge or release gate.
- Keep commits in Angular Conventional Commits format:
  `<type>(<scope>): <subject>`.
- When creating branches for commit/push/PR workflows, follow
  `.claude/commands/commit.md`: use meaningful semantic prefixes such as
  `feat/`, `fix/`, `ci/`, `docs/`, `test/`, `chore/`, or `refactor/`. Do not
  use generic agent/tool prefixes such as `codex/`.

## GitHub Review Threads

For PR review feedback, use the GitHub app tools or `gh` as needed to inspect
inline review threads. Fix valid findings in the current PR, reply to the
specific inline comment with the plain commit hash, and resolve only threads
that are fixed or outdated per `.claude/commands/review-pr.md`.

Do not call a PR clean merely because CodeRabbit skipped or failed. Do not
replace it with another external review bot. Use the head-specific Codex
fallback required by the command workflow — or the `review-self` fallback when
Codex is unavailable too — and include its clean result in the completion gate.

Do not reply with "will address later" for valid correctness or operational
findings. Implement the fix in the current PR unless the finding is wrong on
the merits, and explain the concrete repo evidence when pushing back.
