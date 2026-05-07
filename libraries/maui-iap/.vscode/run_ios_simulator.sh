#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$LIB_DIR/example/OpenIap.Maui.Example"
PROJECT="$APP_DIR/OpenIap.Maui.Example.csproj"

case "$(uname -m)" in
  arm64) RID="iossimulator-arm64" ;;
  x86_64) RID="iossimulator-x64" ;;
  *)
    echo "Unsupported macOS architecture for iOS simulator: $(uname -m)" >&2
    exit 1
    ;;
esac

if ! dotnet workload list | grep -Eq '^maui([[:space:]]|$)'; then
  echo "MAUI workload missing. Run: sudo dotnet workload install maui" >&2
  exit 1
fi

cd "$APP_DIR"
dotnet build "$PROJECT" \
  -t:Run \
  -f net9.0-ios \
  -p:RuntimeIdentifier="$RID" \
  -tl:off \
  -v:minimal
