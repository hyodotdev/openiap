---
name: e2e-matrix-runner-apple
description: Run the Apple half of the OpenIAP device matrix — six frameworks plus the native package on iOS — on a physical iPhone and report one row per cell with evidence. Use when asked for iOS e2e or delegated hardware testing.
---

# E2E Matrix Runner Apple (Claude Code)

The canonical procedure lives in
`.codex/skills/e2e-matrix-runner-apple/SKILL.md`. Read that file first and
follow it fully — the narrowed matrix, the parallel-run rules, and its
references to the full skill's driving techniques and reporting contract are
all defined there.

## Claude Code notes

- `.claude/commands/e2e-tests-apple.md` scopes this run;
  `.claude/commands/e2e-tests.md` is the authority on what an individual row
  means.
- Prefer the repo's own scripts over ad-hoc commands, and run long builds in the
  background so the session stays responsive.
