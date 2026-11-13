---
name: loop-review-self
description: "Land a minor docs, release-note, or repository-housekeeping change on main with no pull request: run review-self until two consecutive clean snapshots, run the checks the touched paths require, then commit and push straight to main and verify it."
---

# Loop Review Self (Claude Code)

The canonical workflow lives in `.codex/skills/loop-review-self/SKILL.md`. Read
that file first and follow it fully — the qualifying scope, the authority it
grants, the review-until-clean phase, the verification, the direct push, and
the stop conditions all apply as written.

## Claude Code Notes

- `/review-self` runs the review phase; it owns the interval loop, so do not
  start a second one.
- `ScheduleWakeup` drives every five-minute re-entry. Never use a shell sleep
  loop or an abandoned background process.
- `/commit` covers staging and the commit message, but this skill pushes to
  `main` with no branch and no PR. Do not pass `--pr`;
  `scripts/guard-pull-request.mjs` holds PR creation for approval anyway.
- An explicit `$loop-review-self` invocation is the publish authorization that
  the "Internal Workflow Guard" in `.claude/commands/commit.md` requires, so an
  agent-workflow-only change does push under this skill. Nothing else in that
  guard is relaxed.
- Use read-only subagents (the Agent tool with an Explore-style agent) for an
  independent review lens when the diff spans many files.
- Use `/generate-doc` for release cards and `/verify-all` only when the user
  asks for the full health check.
