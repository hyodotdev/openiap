---
name: e2e-matrix-runner-android
description: Run the Android half of the OpenIAP device matrix — six frameworks across Google Play, Amazon Appstore, and Meta Horizon, plus VegaOS — on real hardware and report one row per cell with evidence. Use when asked for Android e2e or delegated hardware testing.
---

# E2E Matrix Runner Android (Claude Code)

The canonical procedure lives in
`.codex/skills/e2e-matrix-runner-android/SKILL.md`. Read that file first and
follow it fully — the narrowed matrix, the parallel-run rules, and its
references to the full skill's driving techniques and reporting contract are
all defined there.

## Claude Code notes

- `.claude/commands/e2e-tests-android.md` scopes this run;
  `.claude/commands/e2e-tests.md` is the authority on what an individual row
  means.
- Prefer the repo's own scripts over ad-hoc commands, and run long builds in the
  background so the session stays responsive.
