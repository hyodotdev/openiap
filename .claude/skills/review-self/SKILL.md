---
name: review-self
description: Independently review and improve the agent's current implementation, working-tree changes, or pull request; fix actionable in-scope gaps; rerun relevant verification; and recheck at five-minute intervals until the work is stable or genuinely blocked. Use when the user says "review-self", asks Claude to review its own changes, requests a self-review loop, or wants current work monitored for new issues after implementation.
---

# Review Self (Claude Code)

The canonical loop definition lives in `.codex/skills/review-self/SKILL.md`.
Read it and follow every section — authority and scope preservation, target
establishment, the review round, related OpenIAP workflows, the five-minute
recheck contract, safe stopping conditions, and per-round communication are
agent-agnostic and apply as written.

## Claude Code Notes

- Where the canonical file routes through `$openiap-workflows`, read the
  matching `.claude/commands/*.md` file directly (or use the
  `.claude/skills/openiap-workflows` skill).
- For the five-minute recheck, use Claude's real wake-up mechanism for the
  current surface (for example a scheduled reminder / wake-up tool in Cowork
  or the Agent SDK). If no such mechanism is available in the current session,
  complete the current round and report that automatic re-entry could not be
  scheduled — never emulate the loop with `sleep 300`, `while true`, or an
  abandoned background process.
- Use read-only subagents (Task/Agent tool with an Explore-style agent) for
  independent review lenses on large or cross-cutting diffs.
