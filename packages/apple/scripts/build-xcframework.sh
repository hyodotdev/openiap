#!/usr/bin/env bash
# Build a distribution-ready OpenIAP.xcframework from this SwiftPM package.
# Targets: iOS device, iOS simulator, Mac Catalyst.
# Output: packages/apple/.build/xcframework/OpenIAP.xcframework
#
# Consumed by libraries/maui-iap/src/OpenIap.Maui.Bindings.iOS via
# <NativeReference Kind="Framework" />.
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WRAPPER_DIR="${PACKAGE_DIR}/wrapper"
BUILD_DIR="${PACKAGE_DIR}/.build/xcframework"
DERIVED="${BUILD_DIR}/derived"
ARCHIVES="${BUILD_DIR}/archives"
OUT="${BUILD_DIR}/OpenIAP.xcframework"

if [[ ! -d "${WRAPPER_DIR}" ]] || [[ ! -f "${WRAPPER_DIR}/project.yml" ]]; then
  echo "error: wrapper project not found at ${WRAPPER_DIR}"
  exit 1
fi

# Regenerate the wrapper Xcode project (xcodegen) so source-file changes are picked up.
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "error: xcodegen not installed (brew install xcodegen)"
  exit 1
fi

(cd "${WRAPPER_DIR}" && xcodegen generate >/dev/null)

PROJECT="${WRAPPER_DIR}/OpenIAPWrapper.xcodeproj"

rm -rf "${BUILD_DIR}"
mkdir -p "${DERIVED}" "${ARCHIVES}"

archive() {
  local destination="$1"
  local archive_path="$2"
  echo "==> archiving ${destination}"
  xcodebuild archive \
    -project "${PROJECT}" \
    -scheme OpenIAP \
    -destination "${destination}" \
    -archivePath "${archive_path}" \
    -derivedDataPath "${DERIVED}" \
    -configuration Release \
    SKIP_INSTALL=NO \
    BUILD_LIBRARY_FOR_DISTRIBUTION=YES \
    -quiet
}

archive "generic/platform=iOS"                         "${ARCHIVES}/ios.xcarchive"
archive "generic/platform=iOS Simulator"               "${ARCHIVES}/iossim.xcarchive"
archive "generic/platform=macOS,variant=Mac Catalyst"  "${ARCHIVES}/maccatalyst.xcarchive"

# SwiftPM produces a static framework under Products/usr/local/lib/<scheme>.framework
# when archived without a host app. Locate the .framework in each archive and zip
# them into a single xcframework.
find_framework() {
  find "$1/Products" -name "OpenIAP.framework" -type d -print -quit
}

IOS_FW=$(find_framework "${ARCHIVES}/ios.xcarchive")
SIM_FW=$(find_framework "${ARCHIVES}/iossim.xcarchive")
CAT_FW=$(find_framework "${ARCHIVES}/maccatalyst.xcarchive")

if [[ -z "${IOS_FW}" || -z "${SIM_FW}" || -z "${CAT_FW}" ]]; then
  echo "error: could not locate one of the per-platform OpenIAP.framework bundles."
  echo "       ios=${IOS_FW}"
  echo "       sim=${SIM_FW}"
  echo "       cat=${CAT_FW}"
  exit 1
fi

# Some archive layouts also drop matching .swiftmodule alongside the archive
# Products dir; -create-xcframework will pick them up automatically when present.
echo "==> creating xcframework"
xcodebuild -create-xcframework \
  -framework "${IOS_FW}" \
  -framework "${SIM_FW}" \
  -framework "${CAT_FW}" \
  -output "${OUT}"

echo "==> done: ${OUT}"
