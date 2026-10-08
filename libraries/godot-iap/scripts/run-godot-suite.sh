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
export_fixture=""
trap 'rm -f "$output"; if [[ -n "$export_fixture" ]]; then rm -rf "$export_fixture"; fi' EXIT

for suite in "$@"; do
  echo "== $suite"
  status=0
  project_dir="$example_dir"
  godot_args=(--headless)
  if [[ "$suite" == "test_android_export" ]]; then
    # Editor-only objects need a project without unrelated newer test APIs.
    export_fixture="$(mktemp -d)"
    mkdir -p "$export_fixture/addons/godot-iap" "$export_fixture/tests"
    cp "$example_dir/addons/godot-iap/"*.gd "$export_fixture/addons/godot-iap/"
    cp "$example_dir/tests/$suite.gd" "$export_fixture/tests/"
    printf 'config_version=5\n' > "$export_fixture/project.godot"
    project_dir="$export_fixture"
    godot_args+=(--editor)
  fi
  "$godot_bin" "${godot_args[@]}" --path "$project_dir" --script "res://tests/$suite.gd" 2>&1 | tee "$output" || status=$?
  if [[ $status -ne 0 ]]; then
    echo "::error::$suite failed with exit code $status"
    exit "$status"
  fi
  if [[ ! -s "$output" ]]; then
    echo "::error::$suite produced no test output"
    exit 1
  fi
  if grep -qE 'SCRIPT ERROR: Parse Error|Failed to load script' "$output"; then
    echo "::error::$suite did not load; Godot exits 0 on a parse error"
    exit 1
  fi
  if grep -q 'SCRIPT ERROR' "$output"; then
    echo "::error::$suite hit a script error, which ends its test without a result; Godot exits 0 on it"
    exit 1
  fi
  if [[ "$suite" == "test_android_export" ]] && ! grep -qE '^Results: [1-9][0-9]* passed, 0 failed$' "$output"; then
    echo "::error::$suite did not complete its export checks successfully"
    exit 1
  fi
  if [[ -n "$export_fixture" ]]; then
    rm -rf "$export_fixture"
    export_fixture=""
  fi
done
