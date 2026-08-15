#!/usr/bin/env bash
set -euo pipefail

TOOL=${1:-}
TARGET=${2:-}
if [[ -z "$TOOL" || -z "$TARGET" ]]; then
  echo "Usage: install-security-tool.sh <cyclonedx|osv-scanner|trivy> TARGET" >&2
  exit 1
fi

SECURITY_TOOL_TMP=$(mktemp -d)
trap 'rm -rf "$SECURITY_TOOL_TMP"' EXIT

case "$TOOL" in
  cyclonedx)
    ARCHIVE="$SECURITY_TOOL_TMP/cyclonedx"
    URL=https://github.com/CycloneDX/cyclonedx-cli/releases/download/v0.33.1/cyclonedx-linux-x64
    SHA256=bfc8b2538da86fe239bc53658bbb63c1c8c510a293c1e6891aa5bea5d3c58746
    ;;
  osv-scanner)
    ARCHIVE="$SECURITY_TOOL_TMP/osv-scanner"
    URL=https://github.com/google/osv-scanner/releases/download/v2.5.0/osv-scanner_linux_amd64
    SHA256=edcfc41d257db36148f065055655fe3fcfc434b0b423ea67468a84c207524e0c
    ;;
  trivy)
    ARCHIVE="$SECURITY_TOOL_TMP/trivy.tar.gz"
    URL=https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz
    SHA256=2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a
    ;;
  *)
    echo "Unknown security tool: $TOOL" >&2
    exit 1
    ;;
esac

curl --proto '=https' --tlsv1.2 -fsSL \
  --retry 3 --retry-all-errors --retry-delay 2 \
  --connect-timeout 15 --max-time 300 \
  --output "$ARCHIVE" "$URL"
echo "$SHA256  $ARCHIVE" | sha256sum --check --strict
if [[ "$TOOL" == "trivy" ]]; then
  tar -xzf "$ARCHIVE" -C "$SECURITY_TOOL_TMP" trivy
  ARCHIVE="$SECURITY_TOOL_TMP/trivy"
fi
install -m 0755 "$ARCHIVE" "$TARGET"
