---
name: iapkit-e2e-petgu
description: Use for IAPKit product sync E2E testing in packages/kit with the Petgu React Native app, localhost dashboard, App Store Connect, and Google Play Console. Triggers when verifying kit product/entitlement create, update, delete, pull, push, or store sync behavior with Petgu.
---

# IAPKit Petgu E2E (Claude Code)

The canonical procedure lives in `.codex/skills/iapkit-e2e-petgu/SKILL.md`.
Read it and follow it exactly — default targets, safety rules, the standard
workflow, known good Petgu products, expected store behavior, and reporting
requirements are agent-agnostic and apply as written.

## Claude Code Notes

- Apple product IDs are permanently unusable after deletion; treat the
  canonical safety rules as hard gates and only ever delete temporary SKUs
  created for the current verification run.
- Where the canonical file prefers temporary IDs under `dev.hyo.petgu.codex.*`,
  IDs under `dev.hyo.petgu.claude.*` are equally acceptable — what matters is
  that the SKU is clearly temporary and is removed from IAPKit and both stores
  during cleanup.
- Where it says to use Chrome for logged-in Play Console / App Store Connect
  tabs, use Claude's browser tooling (Claude in Chrome) against the user's
  existing signed-in session; never handle store credentials directly.
