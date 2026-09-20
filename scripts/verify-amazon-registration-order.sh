#!/usr/bin/env bash
# Regression gate for issue #460: the Appstore SDK installs its lifecycle
# callbacks inside the FIRST registerListener call and only launches the
# purchase Activity from an Activity it has seen resume. Registering after the
# host Activity resumed parks the purchase until the next onResume — no dialog,
# then a 300s timeout.
#
# The ordering is observable on a cold start, so this needs no purchase, no
# store install and no Amazon account. Run it on any Fire OS device.
#
#   scripts/verify-amazon-registration-order.sh <serial> [package]
#
# It force-stops the app, clears logcat and relaunches, leaving it in the
# foreground. Pass [package] for an example other than dev.hyo.martie.
# Exit 0 on pass, 1 on failure. Needs Android 7+ (Fire OS 6 and later). Targets a
# debug build: consumer R8 can strip android.util.Log from release builds, which
# would remove the line this asserts on.
set -euo pipefail

SERIAL="${1:?usage: $0 <adb-serial> [package]}"
PACKAGE="${2:-dev.hyo.martie}"
adb() { command adb -s "$SERIAL" "$@"; }

state="$(adb get-state 2>&1 || true)"
[ "$state" = "device" ] ||
  { echo "FAIL: ${SERIAL} is not an available device (adb get-state: ${state})"; exit 1; }

grep -qx "package:${PACKAGE}" <<<"$(adb shell pm list packages "$PACKAGE" | tr -d '\r')" ||
  { echo "FAIL: ${PACKAGE} is not installed on ${SERIAL}"; exit 1; }

activity="$(adb shell cmd package resolve-activity --brief "$PACKAGE" | tail -1 | tr -d '\r')"
adb shell am force-stop "$PACKAGE"
adb logcat -c
adb shell am start -W -S "$activity" >/dev/null
sleep 8
pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' | awk '{print $1}' || true)"
[ -n "$pid" ] || { echo "FAIL: ${PACKAGE} did not stay running after launch."; exit 1; }
# Scoping to the pid keeps another app's Activity from being read as this one's.
log="$(adb logcat -d --pid="$pid" -v time 2>/dev/null)"

# grep exits non-zero when it finds nothing, which is a legitimate outcome here.
registered="$(grep -n 'Amazon listener registered at process start' <<<"$log" | head -1 | cut -d: -f1 || true)"
resumed="$(grep -n 'Activity resumed' <<<"$log" | head -1 | cut -d: -f1 || true)"
parked="$(grep -c 'No UI visible to execute task' <<<"$log" || true)"

fail=0
if [ -z "$registered" ]; then
  echo "FAIL: the early registration provider never ran."
  echo "      AmazonEarlyRegistrationProvider is missing from the merged manifest,"
  echo "      or registration moved back into initConnection (#460)."
  echo "      A Play-flavor build or an unrelated app also lands here."
  fail=1
elif [ -z "$resumed" ]; then
  echo "FAIL: the SDK never saw the first Activity resume, so it registered after it."
  echo "      Registration is being deferred — to a Handler, a coroutine, or a"
  echo "      later lifecycle point — and the purchase will be parked (#460)."
  echo "      After an Appstore SDK upgrade, first confirm it still logs"
  echo "      'Activity resumed' under tag Kiwi."
  fail=1
else
  echo "PASS: registered before the first Activity resume."
  echo "      $(sed -n "${registered}p" <<<"$log" | sed 's/^[[:space:]]*//')"
  echo "      $(sed -n "${resumed}p" <<<"$log" | sed 's/^[[:space:]]*//')"
  echo "      $(adb shell dumpsys package "$PACKAGE" | grep -m1 lastUpdateTime | tr -d '\r' | sed 's/^[[:space:]]*//' || true)"
fi

if [ "$parked" -ne 0 ]; then
  echo "FAIL: 'No UI visible to execute task' appeared ${parked}x — a task is parked."
  fail=1
fi

[ "$fail" -eq 0 ] && echo "OK: ${PACKAGE} registers early enough for the Appstore to present a dialog."
exit "$fail"
