---
name: iapkit-e2e-martie
description: Run IAPKit local receipt-validation E2E with the dev.hyo.martie React Native or Expo examples, the compiled packages/kit server, real Convex, and Apple or Google sandbox purchases. Use when preparing an iOS Sandbox Apple Account for a development-signed or TestFlight build, verifying purchase-token or JWS routing, Local (IAPKit) baseUrl behavior, local server logs, receipt validity, transaction finishing, or the Martie purchases view; distinguish safe smoke checks from approval-gated live purchase verticals.
---

# IAPKit Martie Receipt E2E (Claude Code)

The canonical procedure lives in `.codex/skills/iapkit-e2e-martie/SKILL.md`.
Read it and follow it exactly — targets, smoke vs live lanes, safety gates,
preflight, server startup, example configuration, the Martie catalog, the
approval-gated live vertical, its `LIVE RECEIPT PASS` assertions, and cleanup
are all agent-agnostic and apply as written.

## Claude Code Notes

- The safety gates are non-negotiable in Claude Code too: never press
  Purchase/Subscribe or confirm a store sheet without explicit approval in the
  current run, never persist sandbox account credentials, never rotate or
  reveal IAPKit API keys, and never mutate the store catalog from this
  workflow.
- Report results with the same vocabulary: `SMOKE PASS` / `SMOKE FAIL` for the
  server smoke lane, `LIVE RECEIPT PASS` only when every live-lane assertion
  holds, and `BLOCKED` when a device, account, catalog, key, Convex URL, or
  network route is missing.
- Also read the `Local (IAPKit) Receipt Vertical` section of
  `.claude/commands/e2e-tests.md` during preflight, as the canonical file
  requires.
