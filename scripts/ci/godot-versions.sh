#!/usr/bin/env sh
# Prints the Godot versions godot-iap owns as NAME=value lines: the Makefile's
# build version and the shipped .gdextension's minimum, plus the x.y.z form
# setup-godot needs. Append to $GITHUB_ENV, or eval in a single step.
set -eu

library="$(cd "$(dirname "$0")/../../libraries/godot-iap" && pwd)"
current="$(sed -n 's/^GODOT_VERSION ?= //p' "$library/Makefile")"
minimum="$(sed -n 's/^compatibility_minimum = "\(.*\)"$/\1/p' \
  "$library/addons/godot-iap/bin/godot_iap.gdextension")"

if [ -z "$current" ] || [ -z "$minimum" ]; then
  echo "Cannot read the Godot versions from $library" >&2
  exit 1
fi

# Godot tags drop a zero patch (4.3-stable); setup-godot requires one (4.3.0).
semver() {
  case "$1" in
    *.*.*) echo "$1" ;;
    *) echo "$1.0" ;;
  esac
}

echo "GODOT_CURRENT=$current"
echo "GODOT_CURRENT_SEMVER=$(semver "$current")"
echo "GODOT_MINIMUM=$minimum"
echo "GODOT_MINIMUM_SEMVER=$(semver "$minimum")"
