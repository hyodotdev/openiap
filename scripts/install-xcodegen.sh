#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-${XCODEGEN_VERSION:-}}"
if [[ -z "${VERSION}" ]]; then
  echo "error: XcodeGen version is required"
  echo "usage: scripts/install-xcodegen.sh <version>"
  exit 1
fi

INSTALL_DIR="${XCODEGEN_INSTALL_DIR:-${HOME}/.local/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${INSTALL_DIR}"

curl -fsSL \
  -o "${TMP_DIR}/xcodegen.zip" \
  "https://github.com/yonaskolb/XcodeGen/releases/download/${VERSION}/xcodegen.zip"

if [[ -n "${XCODEGEN_SHA256:-}" ]]; then
  echo "${XCODEGEN_SHA256}  ${TMP_DIR}/xcodegen.zip" | shasum -a 256 -c -
fi

unzip -q "${TMP_DIR}/xcodegen.zip" -d "${TMP_DIR}"
install -m 0755 "${TMP_DIR}/xcodegen/bin/xcodegen" "${INSTALL_DIR}/xcodegen"

if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "${INSTALL_DIR}" >> "${GITHUB_PATH}"
fi

"${INSTALL_DIR}/xcodegen" --version
