---
name: e2e-tests-android
description: Run Android-side device-backed OpenIAP regression across Google Play, Amazon Appstore, Meta Horizon, and VegaOS using packages/google and framework examples. Use when the user asks for Android e2e tests or the Android half of a parallel e2e run.
---

# E2E Tests Android — Play / Amazon / Horizon / VegaOS

Run this for the Android half of OpenIAP device regression, alone or in
parallel with `/e2e-tests-apple`. For the full matrix in one run, use
`/e2e-tests` instead. For a delegated hardware run, use
`$e2e-matrix-runner-android`.

`e2e-tests.md` is the authority on what a row means and how to verify one.
Read it first and follow the sections named below; this file only narrows the
scope.

## Scope

- `packages/google` native: Play, Amazon, and Horizon compile plus tests
  (`## Package-Level Checks`, Google Android package).
- Play rows: all six frameworks (`react-native-iap`, `expo-iap`,
  `flutter_inapp_purchase`, `kmp-iap`, `maui-iap`, `godot-iap`).
- FireOS/Amazon rows: all six except `godot-iap`, which has no Amazon flavor.
- Horizon rows: all six except `godot-iap`, which has no Horizon flavor.
  Horizon is build-only unless the request authorizes a visibly test/sandbox
  checkout.
- VegaOS rows: `react-native-iap` and `expo-iap` only.
- Local (IAPKit) receipt vertical on Android
  (`## Local (IAPKit) Receipt Vertical`).

That is the 21 Android/Horizon cells plus the 2 VegaOS cells of the full
matrix. Report the two Godot gaps as `UNSUPPORTED` with the reason, never
omitted; every other unavailable row is `BLOCKED` with its exact missing
prerequisite.

For each row, run the matching Android sections under `## Expo Checks`,
`## React Native Checks`, `## Flutter Checks`, `## KMP Checks`,
`## MAUI Checks`, and `## Godot Checks`, then the Android platform bullets
under `## Manual Store Flows` (Play, FireOS, VegaOS, Horizon).

## Preflight

Run the `## Preflight` block from `e2e-tests.md`, skipping only the iOS-only
probes (`xcrun`, `xcodebuild`).

## Parallel-run rules

- Start the local IAPKit server once and share it with the Apple half:
  Android verifies over `adb reverse tcp:3100`, the iPhone over the Mac's LAN
  address.
- Run only one Metro packager at a time across both halves (the RN/Expo
  debug rows share port 8081); the devices otherwise proceed in parallel.

## Final Report

Use the `## Final Report` matrix in `e2e-tests.md`, Android rows only.
