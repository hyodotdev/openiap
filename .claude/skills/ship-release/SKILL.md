---
name: ship-release
description: Merge a verified OpenIAP PR, release affected stable packages sequentially with public verification, publish release docs, run review-self to stability, and deploy production docs when the user explicitly requests the full shipping workflow.
---

# Ship an OpenIAP Release (Claude Code)

The canonical instructions live in `.codex/skills/ship-release/SKILL.md`.
Read that file first and follow it fully. It routes merge, stable package
publication, registry verification, release notes, self-review, commits, and
production docs deployment through their existing repository SSOT workflows.

Use Claude Code's matching `.claude/skills` and `.claude/commands` adapters for
the referenced workflows. Preserve the same explicit-authority, sequential
release, public-verification, two-clean-snapshot, and direct-`main` guardrails.
