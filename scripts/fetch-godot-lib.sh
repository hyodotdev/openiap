#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <4.3-stable|4.7.1-stable> <destination>" >&2
  exit 1
fi

version="$1"
destination="$2"
case "$version" in
  4.3-stable)
    asset="godot-lib.4.3.stable.template_release.aar"
    digest="89b8466051cd471ca0c4fc5b90f0248bca9a7e108f4f6b87a1bb63f8ebaf337c"
    ;;
  4.7.1-stable)
    asset="godot-lib.4.7.1.stable.template_release.aar"
    digest="9c4bc60f915095a4f75f306340023c4519a1975e7886ffd5cdccb9a594fadd81"
    ;;
  *)
    echo "Unsupported Godot release: $version" >&2
    exit 1
    ;;
esac

if [ -f "$destination" ] && \
  echo "$digest  $destination" | shasum -a 256 -c - >/dev/null 2>&1; then
  echo "Verified existing $asset"
  exit 0
fi

temporary="${destination}.partial"
trap 'rm -f "$temporary"' EXIT
curl -fsSL --retry 3 --retry-all-errors \
  "https://github.com/godotengine/godot/releases/download/$version/$asset" \
  -o "$temporary"
echo "$digest  $temporary" | shasum -a 256 -c -
mv "$temporary" "$destination"
