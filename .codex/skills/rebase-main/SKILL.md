---
name: rebase-main
description: Safely update the local main branch with a fast-forward-only pull, rebase the current work branch onto it, resolve conflicts without losing local work, and restore staged, unstaged, and untracked changes. Use when the user asks to pull main and rebase the current branch, update a branch from main, remove rebase conflicts, or says "rebase-main".
---

# Rebase Main

Update `main`, rebase the current work branch, and preserve every pre-existing
working-tree change. Do not commit or push unless the user separately authorizes
it.

## Establish The Target

1. Read the repository Git instructions.
2. Record the current branch, `HEAD`, upstream, worktrees, staged changes,
   unstaged changes, untracked files, and relevant ignored environment files
   with content fingerprints.
3. Stop if the checkout is detached, the current branch is `main`, another
   merge/rebase/cherry-pick is active, or `main` is checked out in another
   worktree that cannot safely be updated.
4. Use `origin` and `main` by default. If either is absent or the repository uses
   another base, derive the target from repository configuration or ask.

## Safeguard Local Work

If the worktree is dirty:

1. Capture status and content fingerprints so restoration can be checked.
2. Create one clearly named stash with `--include-untracked`. Never use
   `--all`: ignored `.env`, credentials, build caches, and other ignored local
   state must remain in place.
3. Record the stash object and confirm the tracked/untracked worktree is clean.
4. If stashing a modified ignore rule makes a previously ignored local file
   appear untracked, do not stash, move, or delete that file. Add only its exact
   path to `.git/info/exclude` as a recorded temporary safeguard, but only after
   confirming that neither `main` nor the work branch tracks that exact path.
   If either target tree contains it, stop without switching branches.
5. If stashing fails or other changes remain unexplained, stop before switching
   branches.

Treat the stash as a recovery point. Do not drop it until restoration is
complete and verified.

## Update Main And Rebase

Before every branch switch, compare each recorded ignored/local path with the
destination tree and stop on any tracked-path collision. Git normally permits a
checkout to overwrite ignored files, so use `git checkout
--no-overwrite-ignore <branch>` for these guarded transitions rather than a
plain switch.

1. Run `git fetch origin main`, then check every recorded ignored/local path
   against both the current `main` tree and the freshly fetched `origin/main`.
   Stop on any collision.
2. Check out `main` with `--no-overwrite-ignore`.
3. Run `git merge --ff-only origin/main`. This explicit fetch-plus-fast-forward
   is the guarded equivalent of `git pull --ff-only origin main`: it updates
   only to the exact remote commit whose paths were checked. Never reset,
   force-update, or create a merge commit for a divergent local `main`.
4. Confirm that `main` and `origin/main` resolve to the exact same commit after
   the fast-forward. A local `main` that is ahead-only makes a fast-forward
   update report no incoming work without publishing or removing its unique
   commits; stop and report that divergence instead of rebasing the work branch
   onto unpublished work.
5. Check out the recorded work branch with `--no-overwrite-ignore` after
   repeating the ignored-path collision check against that branch.
6. Run `git rebase origin/main`, using the exact remote-tracking commit just
   verified against local `main`.
7. For each conflict, inspect the base, new-main side, and work-branch side.
   Preserve both compatible intents; do not apply blanket `ours`/`theirs`
   resolution. Regenerate generated files through their documented generator.
8. Run `git rebase --continue` only after the resolved files and staged diff
   have been reviewed. If intent is ambiguous, stop with the exact conflict
   list and keep the rebase recoverable.

Never use `git reset --hard`, `git checkout --`, `git clean`, or destructive
recovery shortcuts.

## Restore And Verify

1. Apply the recorded stash with its index so staged state is restored.
2. Resolve restoration conflicts with the same three-way care. Do not drop the
   stash while any restoration conflict or mismatch remains.
3. Remove any temporary `.git/info/exclude` entries only after the restored
   worktree ignore rules cover those paths again.
4. Compare the restored staged, unstaged, and untracked state with the initial
   snapshot. Confirm ignored environment files still exist and were not added to
   Git.
5. Once restoration is exact, drop only the named safeguard stash.
6. Run `git status`, `git diff --check`, and the repository's affected
   lightweight audits or tests. Confirm the branch is based on the updated
   `main` and report the old/new main and branch heads.

If the work branch was already published, explain that the rewritten history
will require a later `git push --force-with-lease`. Never perform that push
unless the user authorized it.
