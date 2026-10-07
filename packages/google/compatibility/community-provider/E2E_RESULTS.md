# Common provider device E2E — 2026-10-02

All 31 official matrix cells built. The 21 Apple, Play, and Amazon cells completed sandbox purchase, local IAPKit verification, and transaction finish. Onside passed its separate build-only check. Seven Horizon and two Vega purchase cells remain blocked.

Device evidence covers `b6a531e1` through `63b54bc0`; later commits changed runtime code, so later report edits do not imply device execution at a newer commit. React Native's canonical ownership query and the strengthened community fixture were also exercised with the final source corrections.

## Matrix

`PASS` in the final column means purchase, verification, and finish all completed. `BLOCKED` and `build-only` do not claim a completed purchase.

| Framework    | Store   | Build                  | Install / launch | Purchase / verify / finish | Local evidence                                                                                   |
| ------------ | ------- | ---------------------- | ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| native       | apple   | PASS                   | PASS             | PASS                       | `native-ios-finished.png`                                                                        |
| native       | play    | PASS                   | PASS             | PASS                       | `native-play-result.png`                                                                         |
| native       | amazon  | PASS                   | PASS             | PASS                       | `native-amazon-fresh-finished.png`                                                               |
| native       | horizon | PASS                   | PASS             | BLOCKED                    | `native-horizon-full-checkout.xml`                                                               |
| react-native | apple   | PASS                   | PASS             | PASS                       | `react-native-ios-final-verified-finished.png`                                                   |
| react-native | play    | PASS                   | PASS             | PASS                       | `react-native-play-verified-finished.png`                                                        |
| react-native | amazon  | PASS                   | PASS             | PASS                       | `react-native-amazon-verified-finished.png`                                                      |
| react-native | horizon | PASS                   | PASS             | BLOCKED                    | `react-native-horizon-checkout.xml`                                                              |
| react-native | vega    | PASS (debug + release) | PASS             | BLOCKED                    | `logs/react-native-vega-final-running.log, logs/vega-input-help.log, logs/vega-capture-help.log` |
| expo         | apple   | PASS                   | PASS             | PASS                       | `expo-ios-verified-finished.png`                                                                 |
| expo         | play    | PASS                   | PASS             | PASS                       | `expo-play-verified-finished.png`                                                                |
| expo         | amazon  | PASS                   | PASS             | PASS                       | `expo-amazon-verified-finished.png`                                                              |
| expo         | horizon | PASS                   | PASS             | BLOCKED                    | `expo-horizon-checkout-ready.xml`                                                                |
| expo         | vega    | PASS (debug + release) | PASS             | BLOCKED                    | `logs/expo-vega-final-running.log, logs/vega-input-help.log, logs/vega-capture-help.log`         |
| expo         | onside  | PASS                   | n/a              | build-only                 | `logs/expo-onside-build.log`                                                                     |
| flutter      | apple   | PASS                   | PASS             | PASS                       | `flutter-ios-fresh-verified-finished.png`                                                        |
| flutter      | play    | PASS                   | PASS             | PASS                       | `flutter-play-verification.png`                                                                  |
| flutter      | amazon  | PASS                   | PASS             | PASS                       | `flutter-amazon-verification.png`                                                                |
| flutter      | horizon | PASS                   | PASS             | BLOCKED                    | `flutter-horizon-checkout-loaded.xml`                                                            |
| kmp          | apple   | PASS                   | PASS             | PASS                       | `kmp-ios-fresh-json-verified-finished.png`                                                       |
| kmp          | play    | PASS                   | PASS             | PASS                       | `kmp-play-verified-finished.png`                                                                 |
| kmp          | amazon  | PASS                   | PASS             | PASS                       | `kmp-amazon-verified-finished.png`                                                               |
| kmp          | horizon | PASS                   | PASS             | BLOCKED                    | `kmp-horizon-full-checkout.xml`                                                                  |
| maui         | apple   | PASS                   | PASS             | PASS                       | `maui-ios-fresh-finished.png`                                                                    |
| maui         | play    | PASS                   | PASS             | PASS                       | `maui-play-verified-finished.png`                                                                |
| maui         | amazon  | PASS                   | PASS             | PASS                       | `maui-amazon-verified-finished.png`                                                              |
| maui         | horizon | PASS                   | PASS             | BLOCKED                    | `maui-horizon-checkout.xml`                                                                      |
| godot        | apple   | PASS                   | PASS             | PASS                       | `godot-ios-event-finished.png`                                                                   |
| godot        | play    | PASS                   | PASS             | PASS                       | `godot-play-final-recheck.png`                                                                   |
| godot        | amazon  | PASS                   | PASS             | PASS                       | `godot-amazon-final-game-recheck.png`                                                            |
| godot        | horizon | PASS                   | PASS             | BLOCKED                    | `godot-horizon-final-app.xml`                                                                    |

Evidence is retained in the private local directory `/tmp/openiap-common-provider-e2e-20261002/`. Raw receipts, credentials, account details, and private backend rows are not committed.

## Independent providers

- The separately published `community.fixture:provider:1.0.0` initially passed the 17-behavior Android profile on suite 4.0.0 and Client Protocol 0.2.0. The final Apple and Android fixtures pass the expanded 18-behavior profile, including exactly one canonical error event before a failed purchase request returns an empty result or throws. Negative cases reject missing capabilities, invalid platform/token behavior, and missing, duplicate, or contradictory failure events. These final checks ran 15 Swift tests and 26 Android tests; they are local conformance checks, not another hardware-matrix run.
- Expo, KMP, and MAUI ran the strengthened fixture on the Pixel. All fetched products, purchased, and finished with `store = unknown` and `storeId = community_fixture`. Product loading called its separately published vendor SDK, the Kotlin Multiplatform JVM date runtime, and the core Compose context. They used **None (Skip)** verification because the fixture has no receipt-validation service.
- A separately packed MAUI NuGet consumer resolved the same provider, vendor runtime, and core dependencies with one core artifact. Its Gradle wrapper and resolver came from the package.
- React Native's final ownership-query correction fetched an existing Play purchase through the required common API on hardware.
- After the public-method corrections, fresh Expo and KMP fixture builds again loaded the vendor JVM and core Compose dependencies, purchased with `None (Skip)`, and finished. Expo also returned `true` from its public redemption override with the optional handler unset; its purchase detail showed `store = unknown` and `storeId = community_fixture`. This recheck covers those corrected paths, not a rerun of the 31 official cells.
- The Apple fixture builds independently against the public OpenIAP Swift product. Its conformance and discovery checks cover the matching Apple provider contract; this does not claim a third-party Apple store purchase on hardware.

## Backend and recovery evidence

- Every passing official purchase flow used the locally compiled IAPKit server and the dev-only Convex deployment. App evidence records a valid verification result and completion after awaiting finish.
- Private before/after snapshots and structured server logs retain canonical identity hashes and correlation identifiers. Concurrent device checks and retries can add more than one row between snapshots; aggregate row deltas are not assigned to individual frameworks.
- Local network permission or URL failures left the transaction unfinished. The examples recovered those transactions through the normal verify-then-finish path before fresh consumable checks.
- The latest Godot Play run also exercised **Restore Purchases** through the selected native provider, verified the owned purchase, and finished it. Fresh Play and Amazon consumables were then verified and finished.

## External limits

- Amazon used App Tester. Live App Testing remains blocked because the current candidate was not distributed through that channel. App Tester does not prove the live Appstore foreground purchase Activity.
- Six Horizon apps reached a checkout showing KRW14 and **Confirm**, without a sandbox/no-charge marker. Confirmation was withheld. Godot launched and fetched products but its Horizon canvas could not be driven with the available device input. No Horizon purchase, verification, or finish is claimed.
- Both Vega release apps installed, launched, and remained running. The device exposes neither the required purchase input nor a usable screen-capture command. Their purchase, verification, and finish remain blocked.
- Expo Onside prebuild, pods, and the unsigned device build passed. The app embeds `OnsideKit.framework` and the `dev.hyo.martie.onside-auth` callback scheme. No Onside runtime purchase is claimed.

No merge, package release, production data write, or production deployment was performed. Temporary device settings were restored and task-owned local processes stopped. The original Quest app was restored and its APK hash verified.
