---
name: loop-review
description: "Run OpenIAP's complete latest-main-to-merge review loop: review-self, commit and PR, five-minute CodeRabbit and CI polling, fixes, verification, and clean-head merge."
---

# Loop Review (Claude Code)

The canonical workflow lives in `.codex/skills/loop-review/SKILL.md`. Read that
file first and follow it fully.

Use Claude Code's matching skills or commands for each delegated phase:

- `/review-self` for pre-PR stabilization and exact-head fallback review.
- `/commit --all --pr` for commit, push, PR, labels, and preview.
- `/review-pr <PR>` for review threads, CodeRabbit, CI polling, and cleanup.
- `ScheduleWakeup` for every five-minute re-entry; never use a shell sleep loop.

Do not merge until the canonical exact-head clean gate is satisfied.
