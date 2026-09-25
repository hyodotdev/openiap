---
name: e2e-matrix-runner-google
description: Run the Android half of the OpenIAP device matrix — six frameworks across Google Play, Amazon Appstore, and Meta Horizon, plus VegaOS — on real hardware and report one row per cell with evidence. Use when asked for Android e2e or the Android half of a parallel device run.
---

# E2E Matrix Runner Google

Run every cell of the matrix below on real hardware and report a row for
each. Run alone or in parallel with `$e2e-matrix-runner-apple`; for the full
matrix in one run, use `$e2e-matrix-runner`.

`.claude/commands/e2e-tests-google.md` scopes this run and
`.claude/commands/e2e-tests.md` is the authority on what a row means and how
to verify one — read both before starting and follow them. The full
`.codex/skills/e2e-matrix-runner/SKILL.md` is the authority on driving
technique, credentials, and reporting: its Android, Quest, and VegaOS
sections, device table, local-receipt rules, and standing approvals all
apply unchanged. This file adds only the narrowed matrix.

## The matrix (pinned scope — do not renegotiate per run)

| Store        | Frameworks                              | Device      | Depth                        |
| ------------ | --------------------------------------- | ----------- | ---------------------------- |
| Google Play  | all six + `packages/google`             | Pixel       | device purchase flow each    |
| Amazon       | all six except Godot + `packages/google` | Fire tablet | device purchase flow each    |
| Meta Horizon | all six except Godot + `packages/google` | Quest 3     | build + install + launch; purchase only when the checkout UI is visibly test/sandbox |
| VegaOS       | react-native-iap and expo-iap only      | Vega device | build + install + launch; purchase attempt when device input allows |

That is the 21 Android/Horizon cells plus the 2 VegaOS cells of the full
matrix. Godot has no Amazon or Horizon flavor in its Android plugin, so
report both cells as `UNSUPPORTED` with the reason, never omitted.

## Parallel-run rules

- Share one local IAPKit server with the Apple half: Android verifies over
  `adb reverse tcp:3100`, the iPhone over the Mac's LAN address. Re-check the
  reverse mapping immediately before each purchase.
- Run only one Metro packager at a time across both halves (the RN/Expo
  debug rows share port 8081); the devices otherwise proceed in parallel.
