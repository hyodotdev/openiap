---
name: opencollective-steward
description: Maintain OpenIAP's OpenCollective presence now that it no longer takes sponsorship, including the notice that points new sponsors to GitHub Sponsors, profile copy, update posts, past sponsor/backer recognition, and the README OpenCollective record. Use when the user asks to draft or publish OpenCollective updates, edit the OpenCollective profile or tiers, or thank past OpenCollective supporters.
---

# OpenCollective Steward (Claude Code)

The canonical instructions live in
`.codex/skills/opencollective-steward/SKILL.md`. Read that file and follow it
fully — the core workflow, live edit guardrails, positioning, update post
pattern, canonical README/asset links, publishing checklist, and example copy
are agent-agnostic and apply as written.

## Claude Code Notes

- For live OpenCollective writes, use Claude's browser tooling (Claude in
  Chrome) with the user's signed-in session. If OpenCollective asks for
  sign-in, hand control back to the user; never infer or extract auth tokens
  from browser state.
- The canonical Live Edit Guardrails apply verbatim: confirm the form will
  submit the new copy before pressing Save, and read it back from the public
  API afterwards.
