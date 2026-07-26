---
name: generate-doc
description: Use for OpenIAP documentation generation work, especially pre-deployment release-note entries in packages/docs/src/pages/docs/updates/releases.tsx that must name the expected native and framework versions, link their future GitHub Releases, and update an existing unreleased train instead of creating a duplicate.
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
  `bun run audit:docs`, `bun run audit:release-state`, `git diff --check`)
  before reporting the docs change as done.
