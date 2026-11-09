#!/usr/bin/env bash
set -euo pipefail

# The pin lives here so every caller installs the same verified artifact.
VERSION=2.45.4
SHA256=090ec29491aad50aec10631bf6e62253fed733c50f3aab0f5ffc86bc170bdbef
ASSET_API=https://api.github.com/repos/yonaskolb/XcodeGen/releases/assets/396214908

INSTALL_DIR="${XCODEGEN_INSTALL_DIR:-${HOME}/.local/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${INSTALL_DIR}"

download=(--proto '=https' --tlsv1.2 -fsSL --retry 3 --retry-all-errors --retry-delay 2
  --connect-timeout 15 --max-time 120 -o "${TMP_DIR}/xcodegen.zip")
if ! curl "${download[@]}" \
  "https://github.com/yonaskolb/XcodeGen/releases/download/${VERSION}/xcodegen.zip"; then
  curl "${download[@]}" -H 'Accept: application/octet-stream' "$ASSET_API"
fi

echo "${SHA256}  ${TMP_DIR}/xcodegen.zip" | shasum -a 256 -c -

unzip -q "${TMP_DIR}/xcodegen.zip" -d "${TMP_DIR}"
install -m 0755 "${TMP_DIR}/xcodegen/bin/xcodegen" "${INSTALL_DIR}/xcodegen"

if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "${INSTALL_DIR}" >> "${GITHUB_PATH}"
fi

"${INSTALL_DIR}/xcodegen" --version
