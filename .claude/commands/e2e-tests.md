# E2E Tests — Device-Backed OpenIAP Regression

Run this when a PR or release candidate needs real-device regression across
OpenIAP native packages and framework examples.

## Scope

Use the narrowest scope that satisfies the request, but broaden when native
build configuration, dependency placement, config plugins, package manifests,
or store-specific behavior changed.

- **Full PR regression**: package checks, native package flavor checks, and
  every supported library row in the matrix below. Do not stop after
  React Native and Expo unless the user explicitly narrows the scope.
- **Build-only regression**: all relevant compile/build commands, no purchase
  dialogs. Clearly report that purchase flows were not exercised.
- **Store-flow regression**: build/install each requested target, then verify
  product fetch, purchase, finish/consume, restore/get available purchases, and
  cancel/error handling where the example UI exposes them.
- **Vega/FireOS dependency regression**: run normal Expo/RN iOS and Android
  builds first, then FireOS/Amazon and Vega builds. This catches accidental
  Kepler dependency leakage.

## Full Regression Matrix

When `e2e-tests` is requested without a narrower scope, run every applicable
row and report every unavailable row as `BLOCKED` or `UNSUPPORTED` with the
exact missing command, tool, device, or store prerequisite.

| Target | Android / Play | FireOS / Amazon | Horizon | iOS | VegaOS | Onside |
| ------ | -------------- | --------------- | ------- | --- | ------ | ------ |
| `packages/google` native | build + tests | build + tests | build-only | n/a | n/a | n/a |
| `packages/apple` native | n/a | n/a | n/a | build + tests | n/a | n/a |
| `react-native-iap` | build + device flow | build + device flow | build-only | build + device flow | RN only | n/a |
| `expo-iap` | build + device flow | build + device flow | build-only | build + device flow | Expo only | build-only |
| `flutter_inapp_purchase` | build + device flow | build + device flow | build-only | build + device flow | n/a | n/a |
| `kmp-iap` | build + device flow | required row; currently blocked unless a FireOS flavor is wired | required row; currently blocked unless a Horizon flavor is wired | build + device flow | n/a | n/a |
| `maui-iap` | build + device flow | required row; currently blocked unless an Amazon binding flavor is wired | required row; currently blocked unless a Horizon binding flavor is wired | build + device flow | n/a | n/a |
| `godot-iap` | build + device flow | n/a | n/a | build + device flow | n/a | n/a |

Notes:

- VegaOS is required only for `react-native-iap` and `expo-iap`.
- Godot is required only on Android and iOS.
- Horizon is build-only unless the user explicitly provides a Horizon device and
  the library has a runnable Horizon example.
- Onside is Expo-only and build-only; do not require Onside purchase approval.
- KMP and MAUI must still appear in the final report for FireOS/Horizon. If the
  repo has no flavor switch for those libraries, mark the row blocked instead of
  treating the Play Android build as coverage.

## Rules

- Check `git status --short --branch` before changes. Do not revert user
  changes.
- Do not report a platform as green without a passing command or a concrete
  manual-device result.
- If a build fails, fix it and rerun the failing command plus the adjacent
  platform command that could regress.
- Use connected physical devices when available and record serials/UDIDs.
- Approve sandbox/test purchase dialogs only when the current user request
  explicitly authorizes purchase approval.
- Treat missing store account, catalog, entitlement, tester app, or device
  connectivity as blocked, not passed.
- For VegaOS, source `~/vega/env` before invoking `vega` when present.
- For VegaOS, `vega exec vda devices -l` is transport visibility only. Treat
  `kepler device list` or `vega device list` as the install/launch source of
  truth because plain VDA can also list Android and FireOS devices.
- For VegaOS, do not assume Android `screencap`, `input`, or `scrcpy` works.
  Prefer `kepler device launch-app`, `is-app-running`, `running-apps`, and logs;
  require user/capture-device visual confirmation for screen-only purchase UI.
- For Expo Vega, verify normal Expo iOS/Android manifests do not require
  Vega-only dependencies unless `amazon.vegaOS=true` or a generated Vega temp
  target requires them.
- For React Native Vega, remember there is no Expo config plugin. RN users need
  a Vega-only target/package manifest; normal iOS/Android manifests must not
  require Kepler packages.

## Preflight

Run from the repo root:

```bash
git status --short --branch
git branch --show-current
git log --oneline --decorate -5
if command -v adb >/dev/null 2>&1; then
  adb devices -l
else
  echo "adb: not found"
fi
if command -v xcrun >/dev/null 2>&1; then
  xcrun devicectl list devices
else
  echo "xcrun: not found"
fi
if [ -f "$HOME/vega/env" ]; then source "$HOME/vega/env"; fi
if command -v vega >/dev/null 2>&1; then
  vega -v --json
  vega exec vda devices -l
  vega device list || true
  if command -v kepler >/dev/null 2>&1; then
    kepler --version
    kepler device list || true
  fi
else
  echo "vega: not found"
fi
node -v
bun -v
PATH="$HOME/.bun/bin:$PATH" bun -v
(cd libraries/react-native-iap && yarn -v)
java -version
if command -v flutter >/dev/null 2>&1; then
  flutter --version
else
  echo "flutter: not found"
fi
if command -v dotnet >/dev/null 2>&1; then
  dotnet --info
else
  echo "dotnet: not found"
fi
if command -v godot >/dev/null 2>&1; then
  godot --version
else
  echo "godot: not found"
fi
if command -v xcodebuild >/dev/null 2>&1; then
  xcodebuild -version
else
  echo "xcodebuild: not found"
fi
```

If the repo expects the bundled Bun version, prefer this from the repo root:

```bash
PATH="$HOME/.bun/bin:$PATH" bun run audit:parity
```

## VegaOS Device Checks

Run this before any Vega build/install claim:

```bash
if [ -f "$HOME/vega/env" ]; then source "$HOME/vega/env"; fi
vega exec vda start-server
vega exec vda devices -l
kepler device list || vega device list
: "${VEGA_DEVICE_ID:?Set VEGA_DEVICE_ID from kepler/vega device list}"
kepler device info -d "$VEGA_DEVICE_ID"
kepler device installed-packages -d "$VEGA_DEVICE_ID" | grep -E \
  'dev\.hyo\.openiap|dev\.hyo\.martie|com\.amazonappstore\.iap\.tester|com\.amazon\.iap\.core'
kepler device installed-apps -d "$VEGA_DEVICE_ID" | grep -E \
  'dev\.hyo\.openiap|dev\.hyo\.martie|com\.amazonappstore\.iap\.tester|com\.amazon\.iap\.tester'
```

USB and TCP/IP setup:

```bash
# USB mode should make the Fire TV / VegaOS device appear in both commands.
vega exec vda devices -l
kepler device list || vega device list

# TCP/IP mode uses the device IP as the VDA device id after connect.
# Use -s only when multiple VDA devices are attached over USB.
vega exec vda -s "$VEGA_DEVICE_ID" tcpip 5555
vega exec vda connect "$VEGA_DEVICE_HOST:5555"
vega exec vda devices -l
kepler device list || vega device list
```

VegaOS screen and input caveat:

```bash
# These may fail on VegaOS. Failure does not block build/install/run checks.
vega exec vda -s "$VEGA_DEVICE_ID" shell screencap -p > /tmp/vega.png || true
scrcpy -s "$VEGA_DEVICE_ID" --no-audio --time-limit=5 || true
```

If screen capture is unavailable, record app state with:

```bash
kepler device running-apps -d "$VEGA_DEVICE_ID"
kepler device is-app-running -d "$VEGA_DEVICE_ID" -a dev.hyo.openiap.expo.example.main
kepler device is-app-running -d "$VEGA_DEVICE_ID" -a dev.hyo.openiap.rniap.example.main
kepler device start-log-stream -d "$VEGA_DEVICE_ID"
```

If Vega install hangs or fails, keep build and install results separate:

```bash
kepler device install-app \
  -d "$VEGA_DEVICE_ID" \
  --packagePath build/armv7-debug/expoiapvegaexample_armv7.vpkg
kepler device installed-packages -d "$VEGA_DEVICE_ID" | grep 'dev.hyo.openiap'
tail -n 120 "$HOME/vega/sdk/vega-sdk/main/0.22.6759/logs/error-$(date +%F).log"
```

If `install-app` or synchronous `vpm install` returns `Internal Error` while
`vpm print --manifest` still works, inspect and cancel only the stale OpenIAP
install tokens, then retry with async high-priority install:

```bash
vega exec vda -s "$VEGA_DEVICE_ID" shell vpm query-installs | grep openiap
vega exec vda -s "$VEGA_DEVICE_ID" shell vpm cancel-download "$OPENIAP_INSTALL_TOKEN" --timeout=5
vega exec vda -s "$VEGA_DEVICE_ID" push \
  build/armv7-debug/expoiapvegaexample_armv7.vpkg \
  /tmp/expoiapvegaexample_armv7.vpkg
vega exec vda -s "$VEGA_DEVICE_ID" shell vpm install-async \
  /tmp/expoiapvegaexample_armv7.vpkg \
  --token=openiap_expo_$(date +%s) \
  --timeout=60 \
  --high-priority \
  --force \
  --update-max-timeout=5 \
  --terminate-on-max-timeout
```

Report `vpm install` internal errors, App Tester scratch permission errors, or
missing package rows as install failures, not build failures.

## Package-Level Checks

Google Android package:

```bash
cd packages/google
./gradlew :openiap:compilePlayDebugKotlin \
  :openiap:compileHorizonDebugKotlin \
  :openiap:compileAmazonDebugKotlin \
  :Example:compileAmazonDebugKotlin \
  :Example:compileHorizonDebugKotlin \
  :Example:compilePlayDebugKotlin \
  :openiap:test
```

Apple package:

```bash
cd packages/apple
swift build
swift test
# Required when iOS native packaging/bindings changed or MAUI/Godot iOS rows
# consume the xcframework.
bash scripts/build-xcframework.sh
```

Docs and parity when docs, API surface, generated types, examples, or package
parity changed:

```bash
# Run from the repo root.
PATH="$HOME/.bun/bin:$PATH" bun audit:docs
PATH="$HOME/.bun/bin:$PATH" bun audit:parity
```

## Expo Checks

Library and plugin:

```bash
cd libraries/expo-iap
bun run lint:tsc
cd plugin
bunx jest --runInBand
```

Example tests, normal Android build, and launch smoke:

```bash
cd libraries/expo-iap/example
bun run test --runInBand
# If Expo config, plugin, or native dependency wiring changed, run
# `bunx expo prebuild --platform android --clean` instead.
test -d android || bunx expo prebuild --platform android
cd android
./gradlew :app:assembleDebug
# Build-only regression can stop here.
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to the target Android device serial}"
adb -s "$ANDROID_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.openiap.expo.example 1
```

Normal iOS physical-device build and launch smoke:

```bash
cd libraries/expo-iap/example
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
: "${TEAM_ID:?Set TEAM_ID to the Apple development team ID}"
xcodebuild \
  -workspace ios/expoiapexample.xcworkspace \
  -configuration Debug \
  -scheme expoiapexample \
  -destination "id=$IOS_UDID" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -derivedDataPath build/DerivedData \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration
# Build-only regression can stop here.
xcrun devicectl device install app \
  --device "$IOS_UDID" \
  build/DerivedData/Build/Products/Debug-iphoneos/expoiapexample.app
xcrun devicectl device process launch \
  --device "$IOS_UDID" \
  dev.hyo.openiap.expo.example
```

FireOS/Amazon Android path:

```bash
cd libraries/expo-iap/example
EXPO_IAP_FIREOS=1 bunx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleDebug
# Build-only regression can stop here.
: "${FIREOS_SERIAL:?Set FIREOS_SERIAL to the target FireOS device serial}"
adb -s "$FIREOS_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$FIREOS_SERIAL" shell monkey -p dev.hyo.openiap.expo.example 1
```

Horizon Android build-only path:

```bash
cd libraries/expo-iap/example
EXPO_IAP_HORIZON=1 bunx expo prebuild --platform android --clean
cd android
./gradlew :app:assembleDebug
```

Onside iOS build-only path:

```bash
cd libraries/expo-iap/example
EXPO_IAP_ONSIDE=1 bunx expo prebuild --platform ios --clean
xcodebuild \
  -workspace ios/expoiapexample.xcworkspace \
  -configuration Debug \
  -scheme expoiapexample \
  -destination "generic/platform=iOS" \
  CODE_SIGNING_ALLOWED=NO
```

VegaOS/Kepler path:

```bash
cd libraries/expo-iap/example
if [ -f "$HOME/vega/env" ]; then source "$HOME/vega/env"; fi
bun run build:vega:debug
bun run build:vega:release
# Build-only regression can stop here.
: "${VEGA_DEVICE_ID:?Set VEGA_DEVICE_ID to the target Vega device ID}"
VEGA_DEVICE_ID="$VEGA_DEVICE_ID" bun run run:vega:firetv
kepler device is-app-running \
  -d "$VEGA_DEVICE_ID" \
  -a dev.hyo.openiap.expo.example.main
```

## React Native Checks

Library:

```bash
cd libraries/react-native-iap
yarn lint:tsc
yarn test:library --runInBand
```

Normal Android build and launch smoke:

```bash
cd libraries/react-native-iap/example/android
./gradlew :app:assembleDebug
# Build-only regression can stop here.
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to the target Android device serial}"
adb -s "$ANDROID_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.martie 1
```

FireOS/Amazon Android build and launch smoke:

```bash
cd libraries/react-native-iap/example/android
./gradlew :app:assembleDebug -PfireOsEnabled=true
# Build-only regression can stop here.
: "${FIREOS_SERIAL:?Set FIREOS_SERIAL to the target FireOS device serial}"
adb -s "$FIREOS_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$FIREOS_SERIAL" shell monkey -p dev.hyo.martie 1
```

Horizon Android build-only path:

```bash
cd libraries/react-native-iap/example/android
./gradlew :app:assembleDebug -PhorizonEnabled=true
```

Normal iOS physical-device build and launch smoke:

```bash
cd libraries/react-native-iap/example
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
: "${TEAM_ID:?Set TEAM_ID to the Apple development team ID}"
xcodebuild \
  -workspace ios/example.xcworkspace \
  -configuration Debug \
  -scheme example \
  -destination "id=$IOS_UDID" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -derivedDataPath build/DerivedData \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration
# Build-only regression can stop here.
xcrun devicectl device install app \
  --device "$IOS_UDID" \
  build/DerivedData/Build/Products/Debug-iphoneos/example.app
xcrun devicectl device process launch \
  --device "$IOS_UDID" \
  dev.hyo.martie
```

VegaOS/Kepler path:

```bash
cd libraries/react-native-iap/example
if [ -f "$HOME/vega/env" ]; then source "$HOME/vega/env"; fi
yarn build:vega:debug
yarn build:vega:release
# Build-only regression can stop here.
: "${VEGA_DEVICE_ID:?Set VEGA_DEVICE_ID to the target Vega device ID}"
VEGA_DEVICE_ID="$VEGA_DEVICE_ID" yarn run:vega:firetv
kepler device is-app-running \
  -d "$VEGA_DEVICE_ID" \
  -a dev.hyo.openiap.rniap.example.main
```

## Flutter Checks

Library and Dart tests:

```bash
cd libraries/flutter_inapp_purchase
flutter pub get
git ls-files '*.dart' | grep -v '^lib/types.dart$' | \
  xargs dart format --page-width 80 --output=none --set-exit-if-changed
flutter analyze
flutter test
```

Normal Android build and launch smoke:

```bash
cd libraries/flutter_inapp_purchase/example
flutter pub get
flutter build apk --debug
# Build-only regression can stop here.
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to the target Android device serial}"
adb -s "$ANDROID_SERIAL" install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.martie 1
```

FireOS/Amazon Android build and launch smoke:

```bash
cd libraries/flutter_inapp_purchase/example/android
./gradlew :app:assembleDebug -PfireOsEnabled=true
# Build-only regression can stop here.
: "${FIREOS_SERIAL:?Set FIREOS_SERIAL to the target FireOS device serial}"
adb -s "$FIREOS_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
adb -s "$FIREOS_SERIAL" shell monkey -p dev.hyo.martie 1
```

Horizon Android build-only path:

```bash
cd libraries/flutter_inapp_purchase/example/android
./gradlew :app:assembleDebug -PhorizonEnabled=true
```

iOS physical-device build and launch smoke:

```bash
cd libraries/flutter_inapp_purchase/example
flutter build ios --debug --no-codesign
# Build-only regression can stop here.
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
flutter run -d "$IOS_UDID" --debug
```

## KMP Checks

Library build and tests:

```bash
cd libraries/kmp-iap
./gradlew :library:build :library:test :library:podspec :library:generateDummyFramework
```

Normal Android build and launch smoke:

```bash
cd libraries/kmp-iap/example
./gradlew :composeApp:assembleDebug
# Build-only regression can stop here.
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to the target Android device serial}"
adb -s "$ANDROID_SERIAL" install -r composeApp/build/outputs/apk/debug/composeApp-debug.apk
adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.martie 1
```

iOS physical-device build and launch smoke:

```bash
cd libraries/kmp-iap/example/iosApp
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
: "${TEAM_ID:?Set TEAM_ID to the Apple development team ID}"
xcodebuild \
  -project iosApp.xcodeproj \
  -configuration Debug \
  -scheme iosApp \
  -destination "id=$IOS_UDID" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -derivedDataPath build/DerivedData \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration
```

FireOS/Amazon and Horizon rows:

```text
KMP currently has no FireOS/Amazon or Horizon flavor switch in
libraries/kmp-iap/library/build.gradle.kts or example/composeApp/build.gradle.kts.
Report these rows as BLOCKED until the flavor is wired; do not count the normal
Android build as FireOS or Horizon coverage.
```

## MAUI Checks

Library build and native binding prerequisites:

```bash
cd packages/google
./gradlew :openiap:assemblePlayRelease
cd ../../libraries/maui-iap/android
../../../packages/google/gradlew :openiap:assembleRelease
cd ../../..
bash packages/apple/scripts/build-xcframework.sh
cd libraries/maui-iap
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -f net9.0
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -f net9.0-android
dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -f net9.0-ios
```

Normal Android build and launch smoke:

```bash
cd libraries/maui-iap/example/OpenIap.Maui.Example
dotnet build -t:Run -f net9.0-android
```

iOS physical-device build and launch smoke:

```bash
cd libraries/maui-iap/example/OpenIap.Maui.Example
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
dotnet build -t:Run -f net9.0-ios -p:_DeviceName="$IOS_UDID"
```

FireOS/Amazon and Horizon rows:

```text
MAUI currently builds its Android binding against the Play flavor. It has no
Amazon or Horizon binding flavor switch. Report FireOS/Horizon rows as BLOCKED
until libraries/maui-iap/android and the binding csproj expose those variants.
```

## Godot Checks

Godot is Android/iOS only for this e2e matrix.

Android build and launch smoke:

```bash
cd libraries/godot-iap
make setup
make android
# Build-only regression can stop here.
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to the target Android device serial}"
make export-android
adb -s "$ANDROID_SERIAL" install -r Example/android/Martie.apk
adb -s "$ANDROID_SERIAL" shell monkey -p dev.hyo.martie 1
```

iOS build and launch smoke:

```bash
cd libraries/godot-iap
make setup
make ios
make export-ios
: "${IOS_UDID:?Set IOS_UDID to the target iOS device UDID}"
: "${TEAM_ID:?Set TEAM_ID to the Apple development team ID}"
xcodebuild \
  -project Example/ios/Martie.xcodeproj \
  -configuration Debug \
  -scheme Martie \
  -destination "id=$IOS_UDID" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -derivedDataPath Example/ios/DerivedData \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration
```

## Manual Store Flows

Run these on each connected platform requested:

- Android phone / Google Play: install the Play build, launch, fetch products,
  buy a consumable, approve sandbox purchase if authorized, verify purchase
  update and finish/consume behavior, then test restore/available purchases if
  exposed.
- FireOS tablet / Amazon Appstore tester: install the Amazon/FireOS build, copy
  tester catalog/config if needed, launch, fetch products, buy a consumable,
  approve tester purchase if authorized, verify no crash on success, cancel, or
  timeout/error paths.
- iPhone / StoreKit sandbox: install the iOS build, launch, fetch products, buy
  a visible consumable or subscription, approve sandbox purchase if authorized,
  verify transaction finish and restore behavior.
- VegaOS / Fire TV: build and install the VPK, copy Amazon tester catalog/config
  with the project script, launch, fetch products, and run at least one purchase
  attempt when device input and tester UI are available.
- Horizon: build-only unless a runnable Horizon device and store prerequisites
  are explicitly available. If it is build-only, do not claim purchase flow
  coverage.
- Onside: Expo iOS build-only. Verify the generated Podfile and iOS project
  include the Onside module when `EXPO_IAP_ONSIDE=1`; do not claim purchase
  flow coverage unless the Onside app/account/test flow was actually exercised.

If a product catalog or sandbox account is missing, stop that row and report it
as blocked with the exact missing prerequisite.

## Final Report

Use this compact matrix:

```text
Platform/package      | Target/device | Command/flow | Result | Notes
packages/google Play  | local Gradle  | compile/test | PASS   | ...
packages/google Fire  | local Gradle  | compile/test | PASS   | ...
packages/google Horz  | local Gradle  | compile      | PASS   | build-only
packages/apple iOS    | local SwiftPM | build/test   | PASS   | ...
RN Android            | {serial}      | build/install/purchase | PASS | ...
RN FireOS             | {serial}      | build/install/purchase | PASS | ...
RN Horizon            | local Gradle  | build        | PASS   | build-only
RN iOS                | {UDID}        | build/install/purchase | PASS | ...
RN Vega               | {device id}   | build debug/release/run | PASS | ...
Expo Android          | {serial}      | build/install/purchase | PASS | ...
Expo FireOS           | {serial}      | build/install/purchase | PASS | ...
Expo Horizon          | local Gradle  | build        | PASS   | build-only
Expo iOS              | {UDID}        | build/install/purchase | PASS | ...
Expo Onside           | generic iOS   | prebuild/build | PASS | build-only
Expo Vega             | {device id}   | build debug/release/run | PASS | ...
Flutter Android       | {serial}      | build/install/purchase | PASS | ...
Flutter FireOS        | {serial}      | build/install/purchase | PASS | ...
Flutter Horizon       | local Gradle  | build        | PASS   | build-only
Flutter iOS           | {UDID}        | build/install/purchase | PASS | ...
KMP Android           | {serial}      | build/install/purchase | PASS | ...
KMP FireOS            | n/a           | flavor check | BLOCKED | not wired
KMP Horizon           | n/a           | flavor check | BLOCKED | not wired
KMP iOS               | {UDID}        | build/install/purchase | PASS | ...
MAUI Android          | {serial}      | build/run/purchase | PASS | ...
MAUI FireOS           | n/a           | flavor check | BLOCKED | not wired
MAUI Horizon          | n/a           | flavor check | BLOCKED | not wired
MAUI iOS              | {UDID}        | build/run/purchase | PASS | ...
Godot Android         | {serial}      | build/install/purchase | PASS | ...
Godot iOS             | {UDID}        | build/install/purchase | PASS | ...
```

Always list untested rows. Do not collapse "build passed" and "purchase flow
passed" into one claim unless both actually ran. For unsupported rows, include
the exact file or build script that lacks the required target switch.
