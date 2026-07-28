# Verify All — Full Monorepo Health Check

Run this before committing or creating a PR to verify the entire monorepo is healthy.

## Checks

### 0. SDK SSOT Parity

```bash
set -euo pipefail

# Godot is intentionally excluded until its example parity is automated.
bun run audit:parity

# Stable main / prerelease next branch contract.
bun run audit:release-state
node --test scripts/release-branch-policy.test.mjs
```

This fails if a new non-Godot library, Expo example route/product ID, generated
type sync target, or GQL root operation is not covered by the parity audit.

### 1. Build Verification

```bash
set -euo pipefail

# Regenerate the schema SSOT, run codegen tests, and sync every wrapper first.
(cd packages/gql && bun run generate && bun run test)

# Docs formatting, typecheck, and production bundle
(cd packages/docs && bun run format:check && bun run build)

# Swift build and unit tests (packages/apple)
(cd packages/apple && swift test)

# Android builds and unit tests (all store flavors)
(cd packages/google && ./gradlew \
  :openiap:compilePlayDebugKotlin :openiap:testPlayDebugUnitTest \
  :openiap:compileHorizonDebugKotlin :openiap:testHorizonDebugUnitTest \
  :openiap:compileAmazonDebugKotlin :openiap:testAmazonDebugUnitTest)

# Compiled agent-context regression tests
(cd scripts/agent && bun run compile:ai && bun test && bun run typecheck)

# React Native bridge generation, tests, and native consumer builds
(cd libraries/react-native-iap && yarn nitrogen && yarn typecheck && yarn test:ci && yarn test:ci:example)
(cd libraries/react-native-iap/example/android && \
  ./gradlew :react-native-iap:assembleDebug \
    :react-native-iap:testDebugUnitTest --stacktrace)
(cd libraries/react-native-iap/example && bundle install)
(cd libraries/react-native-iap/example/ios && \
  bundle exec pod install --repo-update && \
  xcodebuild build \
    -workspace example.xcworkspace \
    -scheme example \
    -destination 'generic/platform=iOS Simulator' \
    -configuration Debug \
    CODE_SIGNING_ALLOWED=NO \
    COMPILER_INDEX_STORE_ENABLE=NO)

# Expo bridge tests and clean native prebuilds/consumer builds
(cd libraries/expo-iap && bun run lint:tsc && bun run test)
(cd libraries/expo-iap/example && bun run test -- --runInBand)
(cd libraries/expo-iap/example && \
  npx expo prebuild --platform android --clean)
(cd libraries/expo-iap/example/android && \
  ./gradlew assembleDebug :expo-iap:testDebugUnitTest \
    -PreactNativeArchitectures=arm64-v8a --stacktrace)
(cd libraries/expo-iap/example && npx expo prebuild --platform ios --clean)
(cd libraries/expo-iap/example/ios && \
  pod install --repo-update && \
  xcodebuild build \
    -workspace expoiapexample.xcworkspace \
    -scheme ExpoIAPExample \
    -destination 'generic/platform=iOS Simulator' \
    -configuration Debug \
    CODE_SIGNING_ALLOWED=NO \
    COMPILER_INDEX_STORE_ENABLE=NO)

# Flutter analysis/tests plus Android and iOS consumer builds
(cd libraries/flutter_inapp_purchase && \
  flutter analyze && \
  flutter test && \
  bash scripts/verify-android-consumer-build.sh)
(cd libraries/flutter_inapp_purchase/example && \
  ([ -f env ] || cp env.example env) && \
  flutter build apk --debug)
(cd libraries/flutter_inapp_purchase/example/ios && \
  pod install --repo-update && \
  xcodebuild build \
    -workspace Runner.xcworkspace \
    -scheme Runner \
    -destination 'generic/platform=iOS Simulator' \
    -configuration Debug \
    CODE_SIGNING_ALLOWED=NO \
    COMPILER_INDEX_STORE_ENABLE=NO)

# Godot native bridges
(cd libraries/godot-iap/android && ./gradlew build)
(cd libraries/godot-iap/ios-gdextension && swift build)
(cd libraries/godot-iap && godot --headless --path Example --script res://tests/test_types_only.gd)
(cd libraries/godot-iap && godot --headless --path Example --script res://tests/test_godot_iap.gd)

# KMP library/iOS framework checks plus every Android store's native example build
(cd libraries/kmp-iap && ./gradlew \
  --no-parallel \
  -Dorg.gradle.jvmargs=-Xmx8192M \
  -Dkotlin.daemon.jvm.options=-Xmx4096M \
  :library:build \
  :library:test \
  :library:podspec \
  :library:generateDummyFramework \
  :library:compilePlayDebugKotlinAndroid \
  :library:compileHorizonDebugKotlinAndroid \
  :library:compileAmazonDebugKotlinAndroid \
  :example:composeApp:assemblePlayDebug \
  :example:composeApp:assembleHorizonDebug \
  :example:composeApp:assembleAmazonDebug)

# MAUI shared contracts, Android bindings, and platform library
(cd libraries/maui-iap && \
  dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj \
    -p:TargetFrameworks=net10.0 --nologo && \
  dotnet run \
    --project tests/OpenIap.Maui.ContractTests/OpenIap.Maui.ContractTests.csproj \
    --framework net10.0 --no-launch-profile)
(cd packages/google && ./gradlew \
  :openiap:assemblePlayRelease \
  :openiap:assembleAmazonRelease \
  :openiap:assembleHorizonRelease)
(
  cd libraries/maui-iap
  DOTNET_BUILD_ARGS=(/m:1 /nr:false -p:UseSharedCompilation=false --nologo)
  for store in play amazon horizon; do
    dotnet build-server shutdown || true
    rm -rf \
      src/OpenIap.Maui.Bindings.Android/bin \
      src/OpenIap.Maui.Bindings.Android/obj
    (cd android && ../../../packages/google/gradlew \
      :openiap:assembleRelease -PopenIapAndroidStore="$store")
    dotnet build \
      src/OpenIap.Maui.Bindings.Android/OpenIap.Maui.Bindings.Android.csproj \
      -p:TargetFrameworks=net10.0-android \
      -p:OpenIapAndroidStore="$store" \
      "${DOTNET_BUILD_ARGS[@]}"
    dotnet build \
      src/OpenIap.Maui/OpenIap.Maui.csproj \
      -p:TargetFrameworks=net10.0-android \
      -p:OpenIapAndroidStore="$store" \
      -p:BuildProjectReferences=false \
      "${DOTNET_BUILD_ARGS[@]}"
  done
)

# MAUI iOS/macCatalyst binding and platform library (requires xcodegen + MAUI workload)
bash packages/apple/scripts/build-xcframework.sh
(cd libraries/maui-iap/src/OpenIap.Maui.Bindings.iOS && \
  dotnet build -p:TargetFrameworks=net10.0-ios --nologo && \
  dotnet build -p:TargetFrameworks=net10.0-maccatalyst --nologo)
(cd libraries/maui-iap/src/OpenIap.Maui && \
  dotnet build -p:TargetFrameworks=net10.0-ios --nologo && \
  dotnet build -p:TargetFrameworks=net10.0-maccatalyst --nologo)

# Documentation/context consistency and patch hygiene
bun test scripts/audit-docs.test.ts
bun run audit:docs
git diff --check
```

### 2. Type Consistency

Verify the manifest-owned generated graph and cross-SDK contracts:

```bash
set -euo pipefail

(cd packages/gql && bun run test)
bun run audit:parity
```

The GQL suite derives source/target paths from
`packages/gql/generated-sync-manifest.mjs`; do not add a hard-coded file loop.

Also verify `COMMON_ERROR_CODE_MAP` in react-native-iap and expo-iap includes all ErrorCode entries:

- `libraries/react-native-iap/src/utils/errorMapping.ts`
- `libraries/expo-iap/src/utils/errorMapping.ts`

And Swift switch exhaustiveness:

- `packages/apple/Sources/Models/OpenIapError.swift`
- `packages/apple/Sources/OpenIapModule.swift`

### 3. Symlinks Valid

```bash
set -euo pipefail

broken=0
for lib in react-native-iap expo-iap flutter_inapp_purchase godot-iap kmp-iap maui-iap; do
  if [ -L "libraries/$lib/openiap-versions.json" ] && \
     [ -f "libraries/$lib/openiap-versions.json" ]; then
    echo "$lib: OK"
  else
    echo "$lib: BROKEN" >&2
    broken=1
  fi
done
exit "$broken"
```

### 4. No Broken References

```bash
set -euo pipefail

assert_no_matches() {
  local matches
  if matches=$(rg -n "$1" packages/docs/src -g '*.tsx' -g '*.ts'); then
    printf '%s\n' "$matches" >&2
    return 1
  else
    local status=$?
    [ "$status" -eq 1 ] || return "$status"
  fi
}

# Deleted images and non-spec API names must have no matches.
assert_no_matches 'openiap-apple\.png|openiap-google\.png'
assert_no_matches 'getProducts\b|buyProduct|completePurchase'

# Old repository links are allowed only for historical issue/discussion URLs
# and the archived-repository list in the monorepo migration announcement.
old_links="$(rg -n 'github\.com/hyochan/' packages/docs/src \
  -g '*.tsx' -g '*.ts' || { status=$?; [ "$status" -eq 1 ] || exit "$status"; })"
unexpected=""
if [ -n "$old_links" ]; then
  unexpected="$(printf '%s\n' "$old_links" | \
    rg -v 'issues/|discussions/|updates/announcements\.tsx:' || {
    status=$?
    [ "$status" -eq 1 ] || exit "$status"
  })"
fi
if [ -n "$unexpected" ]; then
  printf '%s\n' "$unexpected" >&2
  exit 1
fi
```

### 5. LLM Files

```bash
set -euo pipefail

# Quick reference includes the generated DuplicatePurchase error code.
grep "duplicate-purchase" llms.txt

# llms-full.txt synced
diff llms-full.txt packages/docs/public/llms-full.txt
```

### 6. Documentation

- All 6 framework setup pages exist: `packages/docs/src/pages/docs/setup/{react-native,expo,flutter,godot,kmp,maui}.tsx`
- Testing & Sandbox guide exists: `packages/docs/src/pages/docs/guides/testing.tsx`
- All LanguageTabs have KMP tab where kotlin tab exists
- GDScript examples use `await` for async calls

### 7. CI Workflows

All release workflows exist and have valid YAML:

```bash
set -euo pipefail

ls .github/workflows/release-{apple,google,react-native,expo,flutter,godot,kmp,maui}.yml
test -f .github/workflows/release.yml
ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |f| YAML.safe_load(File.read(f), [], [], true) }'
```

### 8. Agent instructions

- Root AGENTS.md lists all framework library CLAUDE.md files
- Root CLAUDE.md and GEMINI.md are symlinks to AGENTS.md
- `knowledge/internal/02-architecture.md` includes `libraries/` in structure
- Auto-generated files list includes library types

## Quick Preflight (Not Full Verification)

This preflight intentionally omits native consumer builds. It does not replace
the complete platform matrix in step 1.

```bash
set -euo pipefail

(cd packages/gql && bun run generate && bun run test)
(cd packages/docs && bun run format:check && bun run build)
(cd packages/apple && swift test)
(cd packages/google && ./gradlew \
  :openiap:compilePlayDebugKotlin :openiap:testPlayDebugUnitTest \
  :openiap:compileHorizonDebugKotlin :openiap:testHorizonDebugUnitTest \
  :openiap:compileAmazonDebugKotlin :openiap:testAmazonDebugUnitTest)
(cd scripts/agent && bun run compile:ai && bun test && bun run typecheck)
bun run audit:parity
bun run audit:release-state
bun test scripts/audit-docs.test.ts
bun run audit:docs
git diff --check
diff llms-full.txt packages/docs/public/llms-full.txt
```
