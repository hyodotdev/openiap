---
name: e2e-tests-apple
description: Run Apple-side device-backed OpenIAP regression on iOS using packages/apple and framework examples. Use when the user asks for iOS e2e tests or the Apple half of a parallel e2e run.
---

# E2E Tests Apple — iOS

Run this for the Apple half of OpenIAP device regression, alone or in
parallel with `/e2e-tests-google`. For the full matrix in one run, use
`/e2e-tests` instead. For a delegated hardware run, use
`$e2e-matrix-runner-apple`.

`e2e-tests.md` is the authority on what a row means and how to verify one.
Read it first and follow the sections named below; this file only narrows the
scope.

## Scope

- `packages/apple` native: `swift build` and `swift test`, plus the
  xcframework build when iOS native packaging or bindings changed
  (`## Package-Level Checks`, Apple package).
- iOS rows: all six frameworks (`react-native-iap`, `expo-iap`,
  `flutter_inapp_purchase`, `kmp-iap`, `maui-iap`, `godot-iap`).
- Expo Onside: iOS build-only (`EXPO_IAP_ONSIDE=1` path under
  `## Expo Checks`).
- Local (IAPKit) receipt vertical on iOS
  (`## Local (IAPKit) Receipt Vertical`).

That is the 7 iOS cells plus the Expo Onside build-only cell of the full
matrix. Report every unavailable row as `BLOCKED` with its exact missing
prerequisite.

For each row, run the matching iOS sections under `## Expo Checks`,
`## React Native Checks`, `## Flutter Checks`, `## KMP Checks`,
`## MAUI Checks`, and `## Godot Checks`, then the iPhone bullet under
`## Manual Store Flows`.

## Preflight

Run the `## Preflight` block from `e2e-tests.md`, skipping only the
Android-only probes (`adb`, `vega`/`kepler`).

## Parallel-run rules

- Start the local IAPKit server once and share it with the Android half:
  the iPhone verifies over the Mac's LAN address, Android over
  `adb reverse tcp:3100`.
- Run only one Metro packager at a time across both halves (the RN/Expo
  debug rows share port 8081); the devices otherwise proceed in parallel.

## Final Report

Use the `## Final Report` matrix in `e2e-tests.md`, iOS rows only.
