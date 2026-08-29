---
name: loop-review
description: "Run OpenIAP's complete latest-main-to-production loop: review-self, PR review and merge, exact-main cleanup, sequential stable releases, consolidated release docs, and production docs deployment."
---

# Loop Review (Claude Code)

The canonical workflow lives in `.codex/skills/loop-review/SKILL.md`. Read that
file first and follow it fully.

Use Claude Code's matching skills or commands for each delegated phase:

- `/review-self` for pre-PR stabilization and exact-head fallback review.
- `/commit --all --pr` for commit, push, PR, labels, and preview.
- `/review-pr <PR>` for review threads, CodeRabbit, CI polling, and cleanup.
- `/e2e-tests` for the device-regression gate — hand back to the user to run it
  rather than merging, since it needs real devices and store accounts.
- `/ship-release` for affected-only sequential stable publication, registry
  verification, consolidated release docs, and production docs deployment.
- `/generate-doc` for the release-note entry and exact package links.
- `ScheduleWakeup` for every five-minute re-entry; never use a shell sleep loop.

Do not merge until the canonical exact-head clean gate is satisfied, and stop
without merging when the canonical device-regression gate applies. After merge,
confirm branch deletion, switch to `main`, fast-forward with no tag fetch, and
verify exact clean `main` before invoking `/ship-release`.
