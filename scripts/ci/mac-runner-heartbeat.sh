#!/bin/sh
# Refreshes the MAC_CI heartbeat (unix epoch) while the Actions runner on this
# machine is alive. Workflow gate jobs treat a heartbeat older than 15 minutes
# as "Mac is off" and fall back to GitHub-hosted runners, so nothing hangs when
# the machine sleeps or shuts down.
#
# Install on the Mac Mini (once), as the user that runs the Actions runner:
#   crontab -e   →   */5 * * * * /path/to/openiap/scripts/ci/mac-runner-heartbeat.sh
# or a LaunchAgent with StartInterval 300. Requires `gh auth` with repo admin.
set -eu

pgrep -q "Runner.Listener" || exit 0
exec gh variable set MAC_CI --repo hyodotdev/openiap --body "$(date +%s)"
