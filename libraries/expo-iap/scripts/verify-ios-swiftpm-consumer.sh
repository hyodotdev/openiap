#!/usr/bin/env bash
# Builds the example the way an installed expo-iap resolves OpenIAP: the
# published Swift package at the pinned version, never the local checkout.
# Prebuild regenerates example/ios; run it again afterwards for local work.
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
example="$package_root/example"
apple_version="$(node -p "require('$package_root/openiap-versions.json').apple")"
derived_data="${DERIVED_DATA_PATH:-$(mktemp -d)}"

(cd "$example" && OPENIAP_APPLE_PATH='' CI=1 npx expo prebuild --platform ios --clean)

podfile="$example/ios/Podfile"
pbxproj="$example/ios/Pods/Pods.xcodeproj/project.pbxproj"
if grep -q 'OPENIAP_APPLE_PATH' "$podfile" || grep -q 'XCLocalSwiftPackageReference' "$pbxproj"; then
  echo "The consumer build links a local OpenIAP package" >&2
  exit 1
fi
grep -Fq 'repositoryURL = "https://github.com/hyodotdev/openiap.git";' "$pbxproj"
grep -Fq "version = $apple_version;" "$pbxproj"

xcodebuild \
  -workspace "$example/ios/ExpoIAPExample.xcworkspace" \
  -scheme ExpoIAPExample \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO \
  build

resolved="$example/ios/ExpoIAPExample.xcworkspace/xcshareddata/swiftpm/Package.resolved"
node -e '
  const [file, version] = process.argv.slice(1);
  const pins = JSON.parse(require("fs").readFileSync(file, "utf8")).pins;
  const openiap = pins.find((pin) => pin.location === "https://github.com/hyodotdev/openiap.git");
  if (openiap?.state?.version !== version) {
    console.error(`Resolved OpenIAP ${openiap?.state?.version ?? "(none)"}, expected ${version}`);
    process.exit(1);
  }
  console.log(`Built against the published OpenIAP Swift package ${version}`);
' "$resolved" "$apple_version"
