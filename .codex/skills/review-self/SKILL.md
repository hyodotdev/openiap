---
name: review-self
description: Independently review and simplify Codex's current implementation, working-tree changes, or pull request; enforce KISS and repository SSOT rules, fix actionable in-scope gaps, rerun relevant verification, and recheck at the user-requested interval (five minutes by default) until stable or genuinely blocked. Use when the user says "review-self", asks Codex to review its own changes, requests a self-review loop, or wants current work monitored for new issues after implementation.
---

# Review Self

Review the current work immediately, fix validated gaps, and use confirmation
rounds at the user's requested interval, or five minutes by default, until the
result is stable.

## Preserve Authority And Scope

- Treat invocation as authorization to inspect the current work, make local
  in-scope fixes, and run relevant verification.
- Preserve the authority of the original request. Do not commit, push, create or
  edit a PR, post comments, merge, deploy, release, or change live external state
  unless the user already authorized that action.
- Keep fixes tied to the original goal. Do not turn self-review into a broad
  audit, speculative refactor, dependency upgrade, or unrelated cleanup.
- Preserve pre-existing user changes. Record the initial working-tree state and
  never sweep-stage or discard files that are outside the current fix batch.
- Stop and ask for direction when a valid fix requires a material product choice,
  new authority, an irreversible action, or a meaningful expansion of scope.

## Establish The Review Target

1. Reconstruct the requested outcome and its acceptance criteria from the active
   conversation and repository evidence.
2. Use an explicitly supplied PR, branch, commit range, or path as the target.
   Otherwise, review the current branch plus its staged, unstaged, and untracked
   changes.
3. For a PR, derive the actual base and head from PR metadata. Without a PR, use
   the configured upstream and merge base; do not assume a base branch when it is
   ambiguous.
4. Read the repository's `AGENTS.md` and every convention or knowledge file that
   applies to the changed paths before editing them.
5. Stop immediately with a concise report when there is no reviewable diff and no
   asynchronous PR state to monitor.

## Run One Review Round

1. Resnapshot the target from disk. Include the full base-to-head diff, staged
   and unstaged overlays, and the contents of untracked files. Do not review only
   the latest commit or trust a snapshot from a previous round.
2. Read surrounding implementation, tests, documentation, issue/PR requirements,
   and current CI or review feedback needed to understand the change.
3. Review for evidence-backed, actionable gaps:
   - requirement completeness and end-to-end wiring;
   - correctness, error paths, edge cases, state transitions, concurrency,
     idempotency, data safety, and security;
   - public contracts, naming, compatibility, generated-file rules, and
     cross-package or SDK parity;
   - missing or weak tests, documentation, examples, migrations, and operational
     safeguards required by the change;
   - the canonical KISS/SSOT release rules in
     `knowledge/internal/03-coding-style.md`.
4. Use independent read-only subagents for separate review lenses when the diff
   is large or cross-cutting. Give them the raw target and request, not suspected
   findings or an expected answer.
5. Validate every finding against the current code and applicable instructions.
   Reject pure taste, cosmetic churn, duplicate findings, and unrelated
   nice-to-have work.
6. Fix all validated in-scope findings in one coherent batch under those
   canonical KISS/SSOT rules. Regenerate generated files only through their
   documented generator and preserve unrelated edits.
7. Re-read the resulting diff, then run the path-specific lint, typecheck, tests,
   builds, audits, and `git diff --check` required by the repository. Do not rerun
   an expensive unchanged check fingerprint unless new state can affect it.
8. If the target has a PR, inspect new failed checks and unresolved feedback as
   additional evidence. Reuse the repository's `review-pr` rules for a single
   thread-handling pass when GitHub writes are authorized. Do not invoke or
   schedule its polling section; keep `review-self` as the only polling-loop
   owner and never retrigger review bots on a no-op poll.
9. Commit or push only when already authorized. Stage only files owned by the
   current round, follow repository commit ordering, and publish one verified fix
   batch rather than one commit per finding.

## Use Related OpenIAP Workflows

Load only the workflow needed by the current finding; do not run every command by
default. Use `$openiap-workflows` as the router for `.claude/commands/`:

- Read `review-pr.md` for one pass of external review-thread handling. Skip its
  polling section so `review-self` remains the only loop owner.
- Read `verify-all.md` for an explicitly requested full health check or a risky
  cross-package change; otherwise run the touched-path checks.
- Read `audit-code.md` only for an explicitly requested broad knowledge/API audit.
- Read `compile-knowledge.md` after changing knowledge sources or compiled agent
  context.
- Read `e2e-tests.md` when purchase behavior, native wiring, examples, or
  device-backed flows change.
- Read `resolve-issue.md` when the target is a GitHub issue, while preserving its
  external-write authorization gates.
- Read `commit.md` for an authorized commit, push, or PR, and `release.md` only
  for an explicitly authorized release on the correct branch.

Use the more specific local skill when its domain matches: `$generate-doc` for
OpenIAP docs and release notes, `$iapkit-e2e-petgu` for Petgu product-sync E2E,
`$iapkit-e2e-martie` for Martie local-receipt E2E, and
`$opencollective-steward` for OpenCollective work.

## Act As A Review-PR Fallback

When `review-pr` invokes this skill because an external reviewer cannot review
the current PR head:

- Run exactly one complete review round against the supplied base, head SHA,
  requirements, and acceptance criteria. Preserve the commit/push and external
  write authority supplied by the calling workflow.
- Do not re-enter `review-pr`, request external reviewers, handle its trigger
  comments, invoke this fallback again, or schedule this skill's recurring
  loop. `review-pr` remains the sole thread-handling and polling owner.
- Return the reviewed head and working-tree fingerprints, validated findings and
  fixes, checks run, and a clean or blocked result. The caller may cache a clean
  result only for that exact head and invalidate it after any head change.

This single-round override prevents nested polling loops while still replacing
the missing external review coverage with the full self-review procedure.

## Recheck At The Requested Interval

- Run the first round immediately; never wait before the initial review.
- If the user explicitly requests one pass, finish after that round and do not
  schedule a confirmation.
- Use the product's real recurring-monitor or wake-up mechanism to schedule the
  next round after the user's explicit interval, or 300 seconds by default.
  Make the scheduled prompt explicitly invoke `$review-self`; re-enter this
  skill rather than trying to perform semantic review inside a shell loop.
- Keep at most one outstanding wake-up for the same target. Cancel or supersede
  stale duplicate wake-ups when the mechanism supports it.
- Carry a compact state capsule in the scheduled prompt or monitor state. Include
  the original goal and acceptance criteria, target and base, head/tree and
  working-tree fingerprints, seen feedback and check IDs, poll count, clean
  count, start time, the requested interval, the active interval, the current
  pending-state fingerprint and first-seen time, finding fingerprints with fix
  attempts, and the existing commit/push authority.
- Keep loop state out of tracked repository files. Revalidate it against disk and
  remote state on every wake-up.
- Validate the requested and active intervals on every wake-up. Preserve an
  explicit user interval unless the user changes it; otherwise use the default.
- Increment the clean count only after a complete round has no actionable
  findings, all requested verification passes, required checks are terminal and
  successful or explicitly allowed to skip, no actionable feedback remains, and
  the final diff has been reread. Reset it when any material state or finding
  changes, then allow the fully clean post-change result to start a new count.
- Finish successfully after two consecutive clean snapshots separated by the
  active interval. Continue without a fixed round cap while new findings or
  state changes lead to meaningful progress.
- Treat pending CI or review automation as neither clean nor failed. Poll it at
  the active interval without repeating expensive local checks on an unchanged
  fingerprint. Reset its first-seen time whenever the pending-state fingerprint
  changes.
- If no recurring mechanism is available, complete the current round and report
  that automatic re-entry could not be scheduled. Do not emulate it with
  `sleep`, `while true`, `nohup`, or an abandoned background process, and
  never claim a future pass was scheduled unless the mechanism actually accepted
  it.

## Stop Safely

Stop the loop and report the exact state when any of these conditions holds:

- two clean confirmation snapshots establish stability;
- the user stops, replaces, or materially redirects the task;
- the target PR is merged or closed, the target branch disappears, or the target
  changes incompatibly with the active worktree;
- a finding needs authority or a decision that is not already available;
- the same root finding remains after two fix attempts;
- the same authentication, rate-limit, tool, or environment failure blocks three
  consecutive rounds;
- only unchanged pending external state remains for at least one hour.

Do not call a blocked or interrupted result clean. Do not stop merely because one
poll is a no-op while asynchronous state is still pending.

## Communicate Each Round

- At startup, state the target, base, review scope, and whether commit/push or
  external writes are authorized.
- Report material findings, fixes, validation failures, pushes, and external-state
  transitions promptly. Keep no-op updates brief.
- On success or stop, provide a self-contained summary of findings fixed, files
  changed, checks run, commits or pushes made, clean-count evidence, and any
  unresolved blocker.
