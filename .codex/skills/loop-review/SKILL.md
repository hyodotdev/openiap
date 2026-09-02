---
name: loop-review
description: "Run OpenIAP's complete change-to-production loop from the latest origin/main: implement and verify, stabilize with review-self, open and review a PR until its exact head is clean, merge, return to an exact clean main, release affected stable packages sequentially, publish the consolidated release note, and deploy production docs."
---

# Loop Review

Own one OpenIAP change from a fresh `main` baseline through verified production
delivery. Use the repository workflows as SSOT instead of duplicating their
detailed commands.

## Load The Workflows

Read these before acting:

- `AGENTS.md`
- `.codex/skills/openiap-workflows/SKILL.md`
- `.codex/skills/review-self/SKILL.md`
- `.codex/skills/ship-release/SKILL.md`
- `.codex/skills/generate-doc/SKILL.md`
- `.claude/commands/commit.md`
- `.claude/commands/review-pr.md`
- `.claude/commands/release.md`

Load package conventions and specialized skills required by the changed paths.
An explicit `$loop-review` invocation or explicit natural-language request for
this complete loop authorizes the in-scope commit, push, PR, review replies,
thread resolution, merge, affected stable package releases, release-note and
workflow-documentation commits directly to `main`, production docs deployment,
and a Docs release when the spec version advances. It does not authorize
prereleases, unrelated cleanup, destructive recovery, or product-code commits
directly to `main`.

## 1. Start From Current Main

Before editing task files:

1. Snapshot `git status --short --branch`. Preserve every existing change.
2. For a new task, require a clean worktree, then run `git fetch origin`, switch
   to `main`, and run `git pull --ff-only --no-tags origin main`.
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
- `specs/openiap/client/src/*.graphql` or the generated types synced from it;
- native build configuration, dependency placement, config plugins, or store
  metadata for any of the above.

When it is required, **stop without merging even if the PR is otherwise
clean**. Report the exact regression-matrix rows the diff implicates and hand
back to the user. The loop does not merge such a change on its own authority.

Exactly two things clear the gate, and both are recorded on the PR before any
merge:

1. A `$e2e-tests` run covering the implicated rows, with its result posted.
2. An explicit written waiver from the user in this conversation, naming the
   rows waived and the reason. Record it verbatim on the PR. Absence of an
   objection is not a waiver, and the loop must never grant one to itself.

A clean CI run is not a substitute: CI does not exercise purchase dialogs,
store accounts, or device wiring.

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
3. Confirm the remote topic branch was deleted; if merge cleanup missed it,
   delete only that exact merged PR branch. Delete the local topic branch after
   proving its tip is merged or its tree is represented by the recorded squash
   merge. A squash merge may require `git branch -D` after that proof; never use
   it for an unverified branch or discard unrelated work.
4. Switch to `main`, fetch `origin/main`, and run
   `git pull --ff-only --no-tags origin main` only when doing so cannot disturb
   other work.
5. Verify `HEAD` equals `origin/main` and the worktree is clean before any
   release action.

## 8. Ship The Verified Change

Follow `.codex/skills/ship-release/SKILL.md` as the release SSOT:

1. Determine the affected stable packages from the merged diff. Skip unchanged
   packages and never infer a framework version from `openiap-versions.json`.
2. Release affected packages and libraries one at a time in dependency order.
   Before each release, require an exact clean `main`; after each release-bot
   commit, fast-forward `main` again. Do not start the next release until the
   GitHub Release and public registry or downloadable artifact are verified.
3. Use `$generate-doc` to add one consolidated release note with the exact
   published versions and GitHub Release links. Update the existing unreleased
   train instead of creating a duplicate when one exists.
4. Run `$review-self` over the complete docs and workflow diff until two
   consecutive five-minute snapshots are clean. Any edit resets the count.
5. Commit and push the reviewed release note and process-documentation changes
   directly to `main`. If review finds a product-code fix, return it to the PR
   loop instead of committing that fix directly to `main`. Do not open a PR for
   this post-release docs-only commit.
6. From a clean local `main` equal to `origin/main`, run `npm run deploy`, then
   verify the production release page and generated documentation assets.
7. If the native spec floor advanced, dispatch `.github/workflows/release.yml`
   with `version=current` only after production docs verification, and verify
   the resulting `docs-<spec-version>` GitHub Release.
8. Finish on `main`, fast-forward once more if a release workflow changed it,
   and verify `HEAD == origin/main` with a clean worktree.

Report the PR, merge commit, final checks, review coverage, released and skipped
packages, public registry evidence, docs commit and deployment, Docs release,
and any remaining manual follow-up.

## Stop Conditions

Stop without merging when a required choice lacks authority, the same finding
survives two fix attempts, an access blocker repeats under the source workflow's
threshold, the change requires device regression that has not been run, or the
exact head cannot satisfy the clean gate. Report the concrete blocker; never
describe a pending or partially reviewed PR as clean.

After merge, stop the shipping phase when an affected release fails, its public
artifact cannot be verified, production docs cannot be verified, or continuing
would require a code change outside the reviewed PR. Preserve every successful
release and report the exact resume point.
