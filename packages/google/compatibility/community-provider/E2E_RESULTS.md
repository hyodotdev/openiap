# Device E2E — Android providers, 2026-10-01

All 31 cells built successfully. All 21 Apple, Play, and Amazon cells completed a sandbox purchase, local IAPKit verification, and transaction finish. All seven Horizon apps reached the checkout; real-money confirmation was not approved. Both Vega apps built in debug and release, installed, and stayed running. Onside is build-only.

The primary agent ran the entire device matrix without Muse or delegated hardware work. Ordinary runtime builds include `14e13674`; Flutter was rebuilt and rerun at `9af1820d` after its strict identity fix. Client Protocol 0.2.0 generation and the 4.0.0 provider suite were reverified at `4432e609`. The subsequent changes are release documentation and this report.

## Matrix

`PASS` in purchase/verify/finish means all three steps passed. `BLOCKED` is a specific unavailable purchase prerequisite, not a successful purchase.

| Framework    | Store   | Build                  | Install / launch | Products | Checkout | Purchase / verify / finish | Evidence                                                                  |
| ------------ | ------- | ---------------------- | ---------------- | -------- | -------- | -------------------------- | ------------------------------------------------------------------------- |
| native       | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `native-ios-approve-ready.png`, `native-ios-status.png`                   |
| native       | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `native-play-30-sheet.png`, `native-play-30-result.png`                   |
| native       | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `native-amazon-fresh-checkout.png`, `native-amazon-finished-final.png`    |
| native       | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `native-horizon-checkout.xml`                                             |
| react-native | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `rn-ios-real-sheet.png`, `rn-ios-finished-status.png`                     |
| react-native | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `rn-play-finished-status.png`, `rn-play-real-sheet.png`                   |
| react-native | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `rn-amazon-finished-status.png`, `rn-amazon-real-sheet.png`               |
| react-native | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `rn-horizon-real-checkout.xml`                                            |
| react-native | vega    | PASS (debug + release) | PASS             | n/a      | n/a      | BLOCKED                    | `logs/rn-vega-device.log`, `logs/vega-input-size.log`                     |
| expo         | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `expo-ios-fresh-30-sandbox-checkout.png`, `expo-ios-finished-final.png`   |
| expo         | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `expo-play-finished.png`, `expo-play-sandbox-checkout.png`                |
| expo         | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `expo-amazon-finished.png`, `expo-amazon-checkout.xml`                    |
| expo         | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `expo-horizon-checkout.xml`                                               |
| expo         | vega    | PASS (debug + release) | PASS             | n/a      | n/a      | BLOCKED                    | `logs/expo-vega-device.log`, `logs/vega-input-size.log`                   |
| expo         | onside  | PASS                   | n/a              | n/a      | n/a      | UNSUPPORTED                | `logs/expo-onside-build.log`                                              |
| flutter      | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `flutter-ios-final-retry-result.png`                                      |
| flutter      | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `flutter-play-final-finished.png`                                         |
| flutter      | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `flutter-amazon-final-finished.png`                                       |
| flutter      | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `flutter-horizon-final-gate.xml`                                          |
| kmp          | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `kmp-ios-final-result.xml`                                                |
| kmp          | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `kmp-play-final.xml`                                                      |
| kmp          | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `kmp-amazon-final.xml`                                                    |
| kmp          | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `kmp-horizon-sheet.xml`                                                   |
| maui         | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `maui-ios-finished.xml`                                                   |
| maui         | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `maui-play-finished.xml`                                                  |
| maui         | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `maui-amazon-final-dialog.xml`, `maui-amazon-latest-finished.xml`         |
| maui         | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `maui-horizon-final.xml`                                                  |
| godot        | apple   | PASS                   | PASS             | PASS     | PASS     | PASS                       | `godot-ios-fresh-10-sandbox-checkout.png`, `godot-ios-finished-check.png` |
| godot        | google  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `godot-play-finished-final.png`                                           |
| godot        | amazon  | PASS                   | PASS             | PASS     | PASS     | PASS                       | `godot-amazon-finished-final.png`                                         |
| godot        | horizon | PASS                   | PASS             | PASS     | PASS     | BLOCKED                    | `godot-horizon-store.png`, `godot-horizon-virtual-checkout-final.xml`     |

Evidence names refer to the private local run directory `/tmp/openiap-provider-e2e/`; receipt material, account information, and credentials are not committed.

## Devices

| Device                 | Serial                      | Targets               |
| ---------------------- | --------------------------- | --------------------- |
| iPhone 13 mini, iOS 27 | `00008110-0004081E1A79801E` | Apple, seven apps     |
| Pixel 2, Android 11    | `HT79F1A00473`              | Play, seven apps      |
| Fire tablet, Fire OS   | `GN43T503515200BA`          | Amazon, seven apps    |
| Quest 3                | `2G0YC5ZG480381`            | Horizon, seven apps   |
| Vega OS 1.2 TV         | `G0733M085512021G`          | React Native and Expo |

## Provider and backend evidence

- The independent `community-fixture` provider passed 21 JVM tests and all 17 Android-profile behaviors with Client Protocol 0.2.0 and suite 4.0.0. Expo and KMP device flows preserved `store = unknown` and `storeId = community-fixture` through finish.
- All seven Amazon wrappers passed `scripts/verify-amazon-registration-order.sh`: listener registration precedes the first Activity resume.
- React Native live sandbox receipts reached the locally compiled IAPKit server for both Apple and Google. Each receipt produced HTTP 200, `isValid = true`, one canonical purchase row, a store-stat increment of one, no subscription row, and app finish success.
- The dev-only Convex project increased from 147 to 175 purchase rows; its purchase count increased by exactly 28. Canonical identity hashes have no duplicates. The consumable run added no subscriptions.
- Reverification of an existing Apple nonconsumable changed neither row counts nor statistics. All 82 replay, admission, and ownership regression tests passed.
- Reinstalled iOS apps initially encountered local-network permission failures in several flows. They skipped finish, then redelivered and finished the same pending transaction after permission became available and the app restarted.

## Limits and cleanup

- Amazon purchases used App Tester. Live App Testing is **BLOCKED**: the tested candidate is a sideloaded debug build, and a store-distributed Live App Testing installation of this candidate was not configured for this run. App Tester and the registration-order gate do not prove the live Appstore foreground purchase Activity.
- Horizon checkout uses a real payment method. Each checkout was inspected and closed without confirmation; no paid purchase, verification, or finish is claimed. Godot used a captured virtual display for its canvas and inspected the checkout on display 0.
- Vega purchase is **BLOCKED**: `inputd-cli get_screen_size` reports unavailable, `list_devices` finds no input devices, and `screenshooter` cannot create its capture buffer (permission denied).
- Temporary local URLs and sandbox settings were restored. All 19 original ignored environment files match their starting fingerprints. Owned Metro, IAPKit, WDA, syslog, and scrcpy processes and ADB reverses were stopped. The original Quest app was restored; disposable Pixel, Fire, and iPhone candidates were removed.
- Only local Maven publication and dev backend writes occurred. No package release, merge, production data write, or production deployment was performed.
