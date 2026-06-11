# E2E Tests — Device-Backed OpenIAP Regression

Run this when a PR or release candidate needs real-device regression across
OpenIAP native packages and framework examples.

## Scope

Use the narrowest scope that satisfies the request, but broaden when native
build configuration, dependency placement, config plugins, package manifests,
or store-specific behavior changed.

- **Full PR regression**: package checks, Expo checks, React Native checks,
  Android/FireOS/iOS builds, Vega debug/release builds, and manual purchase
  smoke flows on connected devices.
- **Build-only regression**: all relevant compile/build commands, no purchase
  dialogs. Clearly report that purchase flows were not exercised.
- **Store-flow regression**: build/install each requested target, then verify
  product fetch, purchase, finish/consume, restore/get available purchases, and
  cancel/error handling where the example UI exposes them.
- **Vega/FireOS dependency regression**: run normal Expo/RN iOS and Android
  builds first, then FireOS/Amazon and Vega builds. This catches accidental
  Kepler dependency leakage.

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
  vega exec vda devices
else
  echo "vega: not found"
fi
node -v
bun -v
PATH="$HOME/.bun/bin:$PATH" bun -v
(cd libraries/react-native-iap && yarn -v)
java -version
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

## Package-Level Checks

Google Android package:

```bash
cd packages/google
./gradlew :openiap:compilePlayDebugKotlin \
  :openiap:compileHorizonDebugKotlin \
  :openiap:compileAmazonDebugKotlin \
  :Example:compileAmazonDebugKotlin \
  :Example:compilePlayDebugKotlin \
  :openiap:test
```

Apple package:

```bash
cd packages/apple
swift test
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

VegaOS/Kepler path:

```bash
cd libraries/expo-iap/example
if [ -f "$HOME/vega/env" ]; then source "$HOME/vega/env"; fi
bun run build:vega:debug
bun run build:vega:release
# Build-only regression can stop here.
: "${VEGA_DEVICE_ID:?Set VEGA_DEVICE_ID to the target Vega device ID}"
VEGA_DEVICE_ID="$VEGA_DEVICE_ID" bun run run:vega:firetv
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

If a product catalog or sandbox account is missing, stop that row and report it
as blocked with the exact missing prerequisite.

## Final Report

Use this compact matrix:

```text
Platform/package | Target/device | Command/flow | Result | Notes
packages/google  | local Gradle   | ./gradlew ... | PASS   | ...
packages/apple   | local SwiftPM  | swift test    | PASS   | ...
Expo Android     | {serial}       | assemble/install/purchase | PASS | ...
Expo FireOS      | {serial}       | prebuild/assemble/install/purchase | PASS | ...
Expo iOS         | {UDID}         | xcodebuild/purchase       | PASS | ...
Expo Vega        | {device id}    | build debug/release/run   | PASS | ...
RN Android       | {serial}       | assemble/install/purchase | PASS | ...
RN FireOS        | {serial}       | assemble/install/purchase | PASS | ...
RN iOS           | {UDID}         | xcodebuild/purchase       | PASS | ...
RN Vega          | {device id}    | build debug/release/run   | PASS | ...
```

Always list untested rows. Do not collapse "build passed" and "purchase flow
passed" into one claim unless both actually ran.
