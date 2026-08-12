---
name: loop-review
description: "Run OpenIAP's complete change-to-merge loop from the latest origin/main: create a semantic branch, implement and verify the requested change, run review-self until stable, commit and open a PR, poll CodeRabbit and CI every five minutes, fix and reverify findings, and merge only when the exact head is clean. Use when the user invokes $loop-review or explicitly asks for the recurring review-self, commit --pr, review-pr until clean, then merge workflow."
---

# Loop Review

Own one OpenIAP change from a fresh `main` baseline through a verified merge.
Use the repository workflows as SSOT instead of duplicating their detailed
commands.

## Load The Workflows

Read these before acting:

- `AGENTS.md`
- `.codex/skills/openiap-workflows/SKILL.md`
- `.codex/skills/review-self/SKILL.md`
- `.claude/commands/commit.md`
- `.claude/commands/review-pr.md`

Load package conventions and specialized skills required by the changed paths.
An explicit `$loop-review` invocation or explicit natural-language request for
this complete loop authorizes the in-scope commit, push, PR, review replies,
thread resolution, and merge. It does not authorize deployment, publication,
release, or unrelated cleanup.

## 1. Start From Current Main

Before editing task files:

1. Snapshot `git status --short --branch`. Preserve every existing change.
2. For a new task, require a clean worktree, then run `git fetch origin`, switch
   to `main`, and run `git pull --ff-only origin main`.
3. Verify local `main` equals `origin/main`, then create a semantic branch named
   according to `.claude/commands/commit.md`.
4. Record the starting main SHA. The implementation diff must descend from that
   SHA.

Never start new implementation on a stale local `main`. If invoked for work
already in progress, do not manually switch branches, stash, reset, or discard
it. Treat that as a resumed loop, verify its recorded or merge-base baseline,
and use the repository's guarded `rebase-main` workflow when an update from
`origin/main` is needed; that workflow owns its safeguard stash and branch
transitions. Stop for direction if an update would overwrite unrelated user
work.

## 2. Implement And Verify

Implement the requested scope and run the checks required by each touched path.
Keep generated files, documentation, previews, and knowledge context in sync
through their canonical workflows. Do not proceed while the working diff has a
known failing required check.

## 3. Stabilize With Review Self

Run `$review-self` immediately against the complete base-to-working-tree diff.
Fix every validated in-scope finding and rerun affected verification. Continue
with five-minute recurring wake-ups until two consecutive complete snapshots are
clean, as defined by the review-self skill.

Do not emulate recurring review with a shell sleep loop. Keep the loop state out
of tracked files. Any material diff change resets the consecutive-clean count.

## 4. Commit And Open The PR

Follow `.claude/commands/commit.md --all --pr`:

- Stage only files owned by the task.
- Use the required commit order and an English conventional commit message.
- Push the semantic branch and open an English PR against `main`.
- Add applicable repository labels.
- For a visible or interactive change, attach a preview recording under 10 MB.
  Do not commit one-off preview media unless browser upload is blocked and the
  documented fallback is required.

Record the PR number and exact head SHA. A push invalidates all prior clean
review coverage.

## 5. Review PR Until The Exact Head Is Clean

Run `.claude/commands/review-pr.md` immediately, then re-enter it every five
minutes through the product's recurring wake-up mechanism.

For every round:

1. Fetch unresolved threads, review status, current head SHA, and required CI.
2. Fix all valid findings in one coherent batch; push, reply to the exact inline
   comments, and resolve only fixed or outdated threads under the command rules.
3. Rerun the checks affected by the batch plus all previously failing checks.
4. Request CodeRabbit again after a head change.
5. If CodeRabbit is unavailable, use the exact-head one-pass `$review-self`
   fallback defined by `review-pr`; never substitute another reviewer.
6. Keep polling while review or CI is pending. Do not rerun expensive unchanged
   local checks on a no-op poll.

Clean means all of the following hold for the same head SHA:

- zero unresolved actionable review threads;
- CodeRabbit is clean, or its unavailable result has clean review-self fallback
  coverage;
- every required CI check is terminal and successful or explicitly allowed to
  skip by repository policy;
- the PR is mergeable and the branch contains every required update from main;
- the worktree is clean and the final diff has been reread.

## 6. Gate Device Regression Before Merging

Device-backed regression needs real hardware, store accounts, and sandbox
purchases, so this loop cannot run it unattended. Decide whether the change
requires it **before** merging, not after.

Require `$e2e-tests` when the diff touches any of:

- `packages/apple/`, `packages/google/`, or `packages/kit/`;
- any `libraries/<sdk>/` implementation, example app, or podspec/gradle/csproj
  manifest;
- `packages/gql/src/*.graphql` or the generated types synced from it;
- native build configuration, dependency placement, config plugins, or store
  metadata for any of the above.

When it is required, **stop without merging even if the PR is otherwise
clean**. Report the exact regression-matrix rows the diff implicates and hand
back to the user to run `$e2e-tests`, or to confirm the change is covered
without it. Record that result on the PR before any merge. A clean CI run is
not a substitute: CI does not exercise purchase dialogs, store accounts, or
device wiring.

When it is not required, say so explicitly in the final report and name the
paths that justify it. Silence here reads as an untested merge.

A change confined to documentation, repository automation, agent workflows, or
release/security tooling does not need device regression.

## 7. Merge And Close The Loop

Immediately before merging, refetch the PR and confirm its head still equals the
clean reviewed SHA. Use the repository-supported merge method, defaulting to a
squash merge with branch deletion when no stricter policy applies. Never bypass
branch protection or merge a stale, pending, or failing head.

After merge:

1. Confirm the PR state is `MERGED` and record the merge commit.
2. Remove temporary review-trigger and terminal-unavailability comments as
   required by `review-pr`.
3. Switch to `main` and fast-forward from `origin/main` only when doing so cannot
   disturb other work.
4. Report the PR, merge commit, final checks, review coverage, and any skipped
   item. Do not deploy or release unless separately requested.

## Stop Conditions

Stop without merging when a required choice lacks authority, the same finding
survives two fix attempts, an access blocker repeats under the source workflow's
threshold, the change requires device regression that has not been run, or the
exact head cannot satisfy the clean gate. Report the concrete blocker; never
describe a pending or partially reviewed PR as clean.
