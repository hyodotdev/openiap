#!/usr/bin/env bash
# Builds the example the way an installed react-native-iap resolves OpenIAP:
# the published Swift package at the pinned version, never the local checkout.
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apple_version="$(node -p "require('$package_root/openiap-versions.json').apple")"
consumer_ios="$package_root/example/ios-swiftpm-consumer"
derived_data="${DERIVED_DATA_PATH:-$(mktemp -d)}"

cleanup() { rm -rf "$consumer_ios"; }
trap cleanup EXIT

# A sibling of example/ios keeps every ../node_modules path valid.
rm -rf "$consumer_ios"
rsync -a --exclude Pods --exclude build "$package_root/example/ios/" "$consumer_ios/"

# CI passes POD="bundle exec pod".
(cd "$consumer_ios" && OPENIAP_APPLE_PATH='' ${POD:-pod} install)

pbxproj="$consumer_ios/Pods/Pods.xcodeproj/project.pbxproj"
if grep -q 'XCLocalSwiftPackageReference' "$pbxproj"; then
  echo "The consumer build links a local OpenIAP package" >&2
  exit 1
fi
grep -Fq 'repositoryURL = "https://github.com/hyodotdev/openiap.git";' "$pbxproj"
grep -Fq "version = $apple_version;" "$pbxproj"

xcodebuild \
  -workspace "$consumer_ios/example.xcworkspace" \
  -scheme example \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$derived_data" \
  CODE_SIGNING_ALLOWED=NO \
  build

resolved="$consumer_ios/example.xcworkspace/xcshareddata/swiftpm/Package.resolved"
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
