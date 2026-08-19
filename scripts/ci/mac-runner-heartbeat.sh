#!/bin/sh
# Refreshes the MAC_CI heartbeat (unix epoch) while the Actions runner on this
# machine is alive. Workflow gate jobs treat a heartbeat older than 15 minutes
# as "Mac is off" and fall back to GitHub-hosted runners, so nothing hangs when
# the machine sleeps or shuts down.
#
# Install on the Mac Mini (once) as a LaunchAgent (cron edits can hang on
# macOS TCC): ~/Library/LaunchAgents/dev.openiap.mac-ci-heartbeat.plist running
# this script with StartInterval 300 + RunAtLoad, then
#   launchctl bootstrap gui/$(id -u) <plist>
# Requires `gh auth` with repo admin.
set -eu

# cron ships a minimal PATH without Homebrew.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

pgrep -q "Runner.Listener" || exit 0
exec gh variable set MAC_CI --repo hyodotdev/openiap --body "$(date +%s)"
