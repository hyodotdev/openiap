#!/usr/bin/env bash

# Retry Gradle only when its output matches a transient dependency-network
# failure. Deterministic compile and test failures must remain single-attempt
# failures so CI feedback is not delayed or obscured.

set -u -o pipefail

readonly max_attempts="${GRADLE_NETWORK_RETRY_ATTEMPTS:-3}"
readonly base_delay_seconds="${GRADLE_NETWORK_RETRY_DELAY_SECONDS:-10}"
readonly fetch_pattern='could not (get|head|download).*https?://'
readonly transient_transport_pattern='read timed out|connect timed out|connection timed out|connection reset|connection refused|could not resolve host|temporary failure in name resolution|name or service not known|network is unreachable|remote host terminated the handshake|tls handshake timeout|(http response code|status code)[^0-9]*(408|425|429|500|502|503|504|520|522|523|524)|bad gateway|service unavailable|gateway time-?out'

has_retryable_dependency_failure() {
  awk \
    -v fetch_pattern="$fetch_pattern" \
    -v transport_pattern="$transient_transport_pattern" \
    '
      BEGIN {
        remaining_lines = 0
        matched = 0
      }

      {
        line = tolower($0)

        if (line ~ fetch_pattern) {
          # Gradle commonly nests "Could not get resource", "Could not GET",
          # and the transport cause on adjacent indented lines. A short
          # window keeps unrelated test output from satisfying both halves.
          remaining_lines = 5
        }

        if (remaining_lines > 0 && line ~ transport_pattern) {
          matched = 1
          exit
        }

        if (remaining_lines > 0) {
          remaining_lines -= 1
        }
      }

      END {
        exit matched ? 0 : 1
      }
    ' \
    "$1"
}

if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "GRADLE_NETWORK_RETRY_ATTEMPTS must be a positive integer" >&2
  exit 2
fi

if ! [[ "$base_delay_seconds" =~ ^[0-9]+$ ]]; then
  echo "GRADLE_NETWORK_RETRY_DELAY_SECONDS must be a non-negative integer" >&2
  exit 2
fi

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "$#" -eq 0 ]]; then
  echo "Usage: retry-gradle.sh [--] <gradle-command> [args...]" >&2
  exit 2
fi

retry_log="$(mktemp "${TMPDIR:-/tmp}/openiap-gradle-retry.XXXXXX")"
trap 'rm -f -- "$retry_log"' EXIT

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  : >"$retry_log"
  "$@" 2>&1 | tee "$retry_log"
  command_status="${PIPESTATUS[0]}"

  if [[ "$command_status" -eq 0 ]]; then
    exit 0
  fi

  if [[ "$attempt" -eq "$max_attempts" ]]; then
    exit "$command_status"
  fi

  if ! has_retryable_dependency_failure "$retry_log"; then
    echo "Gradle failed without a recognized transient network error; not retrying." >&2
    exit "$command_status"
  fi

  delay_seconds="$((base_delay_seconds * attempt))"
  echo "Transient Gradle dependency-network failure detected (attempt $attempt/$max_attempts)." >&2
  echo "Retrying in ${delay_seconds}s..." >&2
  sleep "$delay_seconds"
done
