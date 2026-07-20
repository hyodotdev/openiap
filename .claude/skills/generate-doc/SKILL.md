---
name: generate-doc
description: Use for OpenIAP documentation generation work, especially release-note entries in packages/docs/src/pages/docs/updates/releases.tsx where package releases are assumed to be deployed and links should be written as shipped release links.
---

# Generate OpenIAP Docs (Claude Code)

The canonical instructions live in `.codex/skills/generate-doc/SKILL.md`.
Read that file first and follow it fully — required reading, release-note
mode, version sources, tag formats, editing rules, multi-package release
trains, and validation are all defined there and apply to any agent.

## Claude Code Notes

- Where the canonical file says to use `openiap-workflows`, use the
  `.claude/skills/openiap-workflows` skill or the matching
  `.claude/commands/*.md` slash command instead.
- Run the same validation commands (`bunx prettier --check`, `bun run build`,
  `bun run audit:docs`, `git diff --check`) before reporting the docs change
  as done.
