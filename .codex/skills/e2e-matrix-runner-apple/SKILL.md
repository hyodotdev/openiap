---
name: e2e-matrix-runner-apple
description: Run the Apple half of the OpenIAP device matrix — six frameworks plus the native package on iOS — on a physical iPhone and report one row per cell with evidence. Use when asked for iOS e2e or the Apple half of a parallel device run.
---

# E2E Matrix Runner Apple

Run every cell of the matrix below on a physical iPhone and report a row for
each. Run alone or in parallel with `$e2e-matrix-runner-google`; for the
full matrix in one run, use `$e2e-matrix-runner`.

`.claude/commands/e2e-tests-apple.md` scopes this run and
`.claude/commands/e2e-tests.md` is the authority on what a row means and how
to verify one — read both before starting and follow them. The full
`.codex/skills/e2e-matrix-runner/SKILL.md` is the authority on driving
technique, credentials, and reporting: its iOS section, device table,
local-receipt rules, and standing approvals all apply unchanged. This file
adds only the narrowed matrix.

## The matrix (pinned scope — do not renegotiate per run)

| Store | Frameworks                         | Device            | Depth                     |
| ----- | ---------------------------------- | ----------------- | ------------------------- |
| iOS   | all six + `packages/apple`         | iPhone (physical) | device purchase flow each |
| iOS   | Expo Onside (`EXPO_IAP_ONSIDE=1`)  | generic iOS build | build-only                |

That is the 7 iOS cells plus the Expo Onside build-only cell of the full
matrix. All six example apps share the bundle id `dev.hyo.martie`, so
install, purchase, and move to the next framework strictly one at a time.

## Parallel-run rules

- Share one local IAPKit server with the Android half: the iPhone verifies
  over the Mac's LAN address (confirm with `ipconfig getifaddr en1`,
  fallback `en0`, each run), Android over `adb reverse tcp:3100`.
- Run only one Metro packager at a time across both halves (the RN/Expo
  debug rows share port 8081); the devices otherwise proceed in parallel.
