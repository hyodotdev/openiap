# Capacitor IAP Agent Guidelines

## Project Overview

capacitor-iap is the Capacitor 8 plugin for in-app purchases. It implements
the OpenIAP Client Protocol on top of `packages/apple` (StoreKit 2) and
`packages/google` (Play, Horizon, Amazon). The public TypeScript API mirrors
expo-iap and react-native-iap; there are no React hooks.

## Package Manager

- The library uses **Bun**: `bun install`, `bun run <script>`.
- The example uses **npm**, so `capacitor-iap` links to this directory as one
  symlink (`file:..`). Bun mirrors file dependencies file by file and drops
  `openiap-versions.json` and `android/openiap-store.gradle`, which are links.

## Project Structure

```text
src/
├── index.ts               # Public API: cross-platform operations, listeners, purchase flow
├── modules/ios.ts         # iOS-only operations (…IOS)
├── modules/android.ts     # Android-only operations (…Android)
├── definitions.ts         # Internal bridge contract with the native plugins
├── plugin.ts              # registerPlugin('CapacitorIap')
├── utils/                 # Error bridge, platform guards, purchase decoding
└── __tests__/             # Jest suites over a fake native plugin (src/__mocks__)

ios/Sources/CapacitorIapPlugin/   # Swift plugin over OpenIapModule.shared
android/src/main/java/dev/hyo/capacitoriap/  # Kotlin plugin over OpenIapProvider
Package.swift                                # SwiftPM manifest; the release validates no podspec
example/                   # Vite app + native projects, bundle id dev.hyo.martie
```

### Generated and synced files (do not edit)

`cd specs/client && bun run generate` writes these; edit the source instead:

- `src/types.ts`, `src/kit-api.ts`, `src/purchase-flow-core.ts`,
  `src/purchase-flow-confirmers.ts` (from `specs/client/src`)
- `src/utils/errorMapping.ts`, `src/utils/purchaseFlowBinding.ts`, and the
  `*.shared.test.ts` suites (from `libraries/react-native-iap`)
- `src/utils/availablePurchases.ts` (from `libraries/expo-iap`)
- `src/__tests__/fixtures/purchase-flow.vectors.json`

## Bridge Contract

- Every native method takes one options object and resolves `{ value }`.
- Native rejections carry the OpenIAP error code as `code` and the full
  PurchaseError payload as `data`; `utils/nativeError.ts` rebuilds it.
- `purchase-updated` and `promoted-product-ios` are sent with
  `retainUntilConsumed`, so Capacitor holds them until the first JavaScript
  listener attaches. Other events reach only current listeners.
- A method added to `definitions.ts` needs `@objc func` plus a
  `pluginMethods` entry in Swift (unless it ends in `Android`) and a
  `@PluginMethod` in Kotlin (unless it ends in `IOS`). `bun audit:parity`
  checks both.

## Pre-commit Checks

```bash
bun run lint:ci        # tsc, ESLint, Prettier
bun run test           # Jest
bun run build          # dist/ (ESM + CJS + IIFE)
bun run verify:consumer-install
```

Native compile checks use the example:

```bash
cd example && npm install && npx vite build && npx cap sync
cd android && ./gradlew :app:assembleDebug :capacitor-iap:testDebugUnitTest
cd ../ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

The example Android build compiles `packages/google` from this checkout. iOS
resolves OpenIAP through SwiftPM from the published tag that `Package.swift`
pins.

## Releasing

`release-capacitor.yml` publishes to npm through trusted publishing only.
Before the first run:

- npm can attach a trusted publisher only to an existing package, so create
  it with a placeholder that never ships, then add `release-capacitor.yml` as
  its trusted publisher. Never publish 1.0.0 by hand: the workflow refuses a
  published version without its release tag. npm also never reuses a version,
  and this name already held 0.0.1 before it was unpublished in 2023.

  ```bash
  npm version 0.0.2-bootstrap.0 --no-git-tag-version
  npm publish --tag bootstrap
  npm deprecate capacitor-iap@0.0.2-bootstrap.0 "Placeholder; install 1.0.0 or later"
  git checkout package.json
  ```

- Dispatch the first release with `version: current`: `package.json` already
  holds 1.0.0, which the release card names. `patch` would publish 1.0.1.
- Once 1.0.0 ships, move `capacitor` from `UNRELEASED_COMPONENTS` to
  `SBOM_COVERAGE_FLOOR` (`capacitor-iap-1.0.0`) in `scripts/generate-sbom.mjs`.

## Commit Message Convention

Follow the monorepo [Git Commit Message Format](../../knowledge/internal/06-git-deployment.md#git-commit-message-format)
with the `capacitor` scope, e.g. `fix(capacitor): keep purchase events until a listener attaches`.
