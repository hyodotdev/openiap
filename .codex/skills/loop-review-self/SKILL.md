---
name: loop-review-self
description: "Land a minor documentation, release-note, or repository-housekeeping change on main without a pull request: review it with review-self until two consecutive snapshots are clean, run the checks its paths require, then commit and push directly to main and verify the result."
---

# Loop Review Self

Take a small change that is already written and land it on `main` by itself.
This skill owns exactly two phases: self-review until stable, then a direct
push. It opens no pull request, requests no external reviewer, releases no
package, and runs no device regression.

Use `$loop-review` instead whenever the change needs a PR.

## Qualifying Scope

The change qualifies only when every touched path is one of:

- the documentation site's own content and presentation — `packages/docs/src/`,
  `packages/docs/public/`, and the data files they read, such as
  `packages/docs/sponsor-registry.json`;
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, and files under
  `knowledge/`;
- agent workflows: `.codex/skills/`, `.claude/skills/`, `.claude/commands/`,
  `plugins/openiap/skills/`;
- repository housekeeping that ships no published artifact: `.gitignore`,
  editor or formatter configuration, and comment-only edits;
- the generated files a documented generator rewrites from any of the above —
  the README sponsor blocks from `bun run sponsors:sync`, the agent context
  from `bun run compile:ai`.

The docs site ships no package and carries no version, so its pages, styles,
and release cards are documentation.

Stop and hand the change to `$loop-review` when it touches anything else,
including: any other `packages/` or `libraries/` source, `packages/docs`
build or deployment configuration, `specs/`, generated SDK types, native build
configuration, store metadata, a `version` field of a published package, or
anything that implicates the device-regression gate in
`.codex/skills/loop-review/SKILL.md`. Size is not the test; the paths are. If
the scope is ambiguous, ask rather than assume.

## Authority

An explicit `$loop-review-self` invocation authorizes, for the qualifying
scope only: in-scope fixes, the checks the touched paths require, and one
commit pushed directly to `main`. It does not authorize a pull request, a
package release, a manual deployment, a branch rewrite, or any edit outside
the change the user described.

Direct pushes to `main` follow
`knowledge/internal/06-git-deployment.md#opening-pull-requests`. Product code
never lands this way.

## 1. Establish The Target

1. Read `AGENTS.md` and every convention or knowledge file that applies to the
   changed paths.
2. Snapshot `git status --short --branch`. Preserve every pre-existing change
   that the task does not own, and never stash in this shared checkout.
3. Confirm the working tree is on `main` and that `main` is not behind
   `origin/main`. Fetch and fast-forward with `--ff-only --no-tags` when it is.
4. Run the qualifying-scope check above over `git status --short`. Stop here if
   anything falls outside it.

## 2. Review Until Clean

Run `$review-self` against the full working-tree diff and follow it as written:
fix every validated in-scope finding, rerun the verification the fix affects,
and recheck at the user's interval, or five minutes by default, until two
consecutive complete snapshots are clean. Any edit resets the count.

Keep loop state out of tracked files, and never emulate the interval with a
shell sleep loop.

## 3. Verify

Before committing, run the checks the touched paths require and record their
output. For documentation and docs-data changes that is at least:

```bash
(cd packages/docs && bun run build && bun run lint)
bun run audit:docs
git diff --check
```

Add the generator and audit each path owns, all from the repository root
unless noted — `bun run sponsors:sync` and `bun run audit:sponsors` for the
sponsor registry, `bun run compile:ai` from `scripts/agent` after editing
`knowledge/` or `AGENTS.md`, `bunx prettier --check` on the files the change
touches. Leave unrelated pre-existing failures alone and say so. A failing
check on an owned file blocks the push; fix it and return to review.

## 4. Push To Main

Stage only the files this task owns, write one English conventional commit
message per
`knowledge/internal/06-git-deployment.md#git-commit-message-format`, and push
to `main`. One verified batch, not one commit per finding.

## 5. Confirm

1. Verify `HEAD` equals `origin/main` and the worktree is clean, so the Source
   Control panel is left empty.
2. When the change touches `packages/docs`, wait for Vercel's automatic
   production deployment of that commit and verify the affected page. Use
   `npm run deploy` only when the automatic path cannot complete.
3. Report the commit SHA, the files changed, the checks run with their results,
   the clean-count evidence, and the deployment verification.

## Stop Conditions

Stop without pushing, and report the concrete blocker, when the scope leaves
the qualifying list, a finding needs a decision or authority that is not
available, the same root finding survives two fix attempts, a required check
keeps failing, or `main` cannot be fast-forwarded safely. A blocked result is
never reported as clean.
