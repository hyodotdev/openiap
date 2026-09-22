---
name: e2e-matrix-runner
description: Run the full OpenIAP device matrix — six frameworks across iOS, Google Play, Amazon Appstore, Meta Horizon, and VegaOS — on real hardware and report one row per cell with evidence. Use when asked for a full e2e matrix or delegated hardware testing.
---

# E2E Matrix Runner (Claude Code)

The canonical procedure lives in `.codex/skills/e2e-matrix-runner/SKILL.md`.
Read that file first and follow it fully — the matrix, the device inventory, the
Quest virtual-display technique, the local IAPKit rules, the credential
boundary, and the reporting contract are all defined there.

## Claude Code notes

- `.claude/commands/e2e-tests.md` is the authority on what an individual row
  means; the matrix skill only adds scope and delegation rules.
- Prefer the repo's own scripts over ad-hoc commands, and run long builds in the
  background so the session stays responsive.
