---
name: link-sponsor
description: "Link a GitHub sponsorship of OpenIAP to the IAPKit organization it pays for, so that organization gets no sponsorship requests and sees the sponsorship on its Usage page, or remove the link when the sponsorship ends. Use when Hyo says a company sponsored or stopped sponsoring, forwards a reply naming its sponsoring account, or asks to check sponsor links."
---

# Link Sponsor (Claude Code)

The canonical workflow lives in `.codex/skills/link-sponsor/SKILL.md`. Read
that file first and follow it fully.

## Claude Code Notes

- The only production write is `sponsorship/internal:setSponsorshipLink`, after
  Hyo's yes for that exact pair. Confirm the pair with `AskUserQuestion` when
  Hyo is at the keyboard.
- Run the `npx convex` commands from `packages/kit` of the SSD checkout; they
  use the Convex login on this machine. Never upload Hyo's `gh` token anywhere.
