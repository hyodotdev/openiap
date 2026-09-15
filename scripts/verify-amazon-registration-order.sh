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
set -euo pipefail

SERIAL="${1:?usage: $0 <adb-serial> [package]}"
PACKAGE="${2:-dev.hyo.martie}"
adb() { command adb -s "$SERIAL" "$@"; }

case "$(adb shell pm list packages "$PACKAGE" | tr -d '\r')" in
  *"package:${PACKAGE}"*) ;;
  *) echo "FAIL: ${PACKAGE} is not installed on ${SERIAL}"; exit 1 ;;
esac

activity="$(adb shell cmd package resolve-activity --brief "$PACKAGE" | tail -1 | tr -d '\r')"
adb shell am force-stop "$PACKAGE"
adb logcat -c
adb shell am start -W -S "$activity" >/dev/null
sleep 8
pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' | awk '{print $1}')"
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
  fail=1
elif [ -z "$resumed" ]; then
  echo "SKIP: the SDK logged no Activity resume; cannot order the two events."
  echo "      Check that this is an Amazon-flavor build on Fire OS."
  exit 2
elif [ "$registered" -ge "$resumed" ]; then
  echo "FAIL: registration happened at or after the first Activity resume."
  echo "      The SDK will park the purchase until the next onResume (#460)."
  fail=1
else
  echo "PASS: registered before the first Activity resume."
fi

if [ "$parked" -ne 0 ]; then
  echo "FAIL: 'No UI visible to execute task' appeared ${parked}x — a task is parked."
  fail=1
fi

[ "$fail" -eq 0 ] && echo "OK: ${PACKAGE} registers early enough for the Appstore to present a dialog."
exit "$fail"
