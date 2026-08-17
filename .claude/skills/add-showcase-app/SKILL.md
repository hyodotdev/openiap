---
name: add-showcase-app
description: Add one or more apps to the OpenIAP "Who uses OpenIAP?" showcase — record OpenIAP library and IAPKit usage, normalize icons, refresh ordering metrics, and verify the docs build. Use when someone submits apps through discussion #350, a showcase pull request, X, or email, or when the user asks to add or update apps on openiap.dev/showcase.
---

# Add Showcase App (Claude Code)

The canonical procedure lives in `.codex/skills/add-showcase-app/SKILL.md`.
Read it and follow every section — collecting the submission, masking the icon,
appending the JSON entry, refreshing metrics, verifying, and closing the loop
are agent-agnostic and apply as written.

## Claude Code Notes

- Fetch submissions with the GitHub MCP tools or `gh` (for example
  `gh api repos/hyodotdev/openiap/issues/280/comments`) instead of asking the
  user to paste them.
- To verify rendering, start the docs dev server through `preview_start`
  (`.claude/launch.json` defines the `docs` configuration) and check the
  showcase section in the browser pane. The home page section sits far down the
  page — scroll to the `Who uses OpenIAP?` heading, or open `/showcase`
  directly, which renders the full list near the top.
- If browser screenshots come back blank, fall back to headless Chrome against
  the dev server and crop the region with Pillow.
- Attach the rendered section back to the user with `SendUserFile` so they can
  approve the card before anything is committed.
