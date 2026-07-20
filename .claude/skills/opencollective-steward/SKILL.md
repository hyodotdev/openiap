---
name: opencollective-steward
description: Manage OpenIAP's OpenCollective presence, including profile copy, slug/link migrations, sponsor/backer recognition, update posts, and README/docs sponsor assets. Use when the user asks to draft or publish OpenCollective updates, maintain OpenCollective tiers/profile content, migrate react-native-iap OpenCollective links to openiap, or make supporters feel informed and appreciated.
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
- The Trix-editor guardrail applies verbatim: verify the hidden form input
  matches the visible editor content before pressing Save, and abort the save
  when they disagree.
