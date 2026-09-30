#!/usr/bin/env bash
# Run headless GDScript suites from Example/. Godot exits 0 when a script fails
# to parse or a test hits a script error, so the output is checked for both.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: run-godot-suite.sh <suite>..." >&2
  exit 2
fi

godot_bin="${GODOT:-godot}"
example_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../Example" && pwd)"
output="$(mktemp)"
trap 'rm -f "$output"' EXIT

for suite in "$@"; do
  echo "== $suite"
  status=0
  "$godot_bin" --headless --path "$example_dir" --script "res://tests/$suite.gd" 2>&1 | tee "$output" || status=$?
  if [[ $status -ne 0 ]]; then
    echo "::error::$suite failed with exit code $status"
    exit "$status"
  fi
  if grep -qE 'SCRIPT ERROR: Parse Error|Failed to load script' "$output"; then
    echo "::error::$suite did not load; Godot exits 0 on a parse error"
    exit 1
  fi
  if grep -q 'SCRIPT ERROR' "$output"; then
    echo "::error::$suite hit a script error, which ends its test without a result; Godot exits 0 on it"
    exit 1
  fi
done
