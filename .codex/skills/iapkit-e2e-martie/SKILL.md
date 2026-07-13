---
name: iapkit-e2e-martie
description: Run IAPKit local receipt-validation E2E with the dev.hyo.martie React Native or Expo examples, the compiled packages/kit server, real Convex, and Apple or Google sandbox purchases. Use when verifying purchase-token or JWS routing, Local (IAPKit) baseUrl behavior, local server logs, receipt validity, transaction finishing, or the Martie purchases view; distinguish safe smoke checks from approval-gated live purchase verticals.
---

# IAPKit Martie Receipt E2E

Verify the complete mobile purchase-to-local-IAPKit receipt path with the
OpenIAP example apps. Do not treat product sync, public-page smoke, or mocked
receipts as a substitute for this vertical.

## Targets

- OpenIAP repo: `$OPENIAP_REPO` (the current checkout)
- IAPKit server: `$OPENIAP_REPO/packages/kit`
- React Native fixture: `$OPENIAP_REPO/libraries/react-native-iap/example`
- Expo fixture: `$OPENIAP_REPO/libraries/expo-iap/example`
- App bundle/application id: `dev.hyo.martie`
- IAPKit project: organization `hyo-dev`, project `martie`
- Purchases evidence: the dashboard or Convex Data view backed by the exact
  Martie Convex deployment used by the local server
- Local receipt endpoint: `POST /v1/purchase/verify`

Use one example framework and one store per live run. Prefer the already
installed, store-compatible example and record which framework, device, and
store produced the evidence.

## Keep Smoke and Live Receipt Results Separate

### Server smoke

Server smoke is safe and does not open a store purchase dialog. It may use the
placeholder Convex URL and a synthetic malformed request to prove that the
compiled binary boots and routes `/v1/purchase/verify` through authentication
and validation.

Run:

```bash
OPENIAP_REPO="${OPENIAP_REPO:-$(git rev-parse --show-toplevel)}"
cd "$OPENIAP_REPO/packages/kit"
bun run typecheck
bun run test
bun run smoke:server
```

Report this lane only as `SMOKE PASS` or `SMOKE FAIL`. A health check, HTTP 400
probe, mocked receipt, or public-page browser check never proves a live receipt.

### Live receipt vertical

The live lane purchases a Martie sandbox product on a mobile device, sends the
real token or JWS to the locally running compiled IAPKit server, verifies it
against the store through the real Martie Convex deployment, and finishes the
transaction. Report `LIVE RECEIPT PASS` only when every assertion below is
satisfied.

## Safety Gates

- Require explicit user approval for the live sandbox purchase in the current
  run. Stop immediately before pressing Purchase/Subscribe or confirming the
  store sheet when that approval has not yet been given. Permission to build,
  install, launch, fetch products, or run smoke does not authorize a purchase.
- Do not create, reveal, rotate, revoke, or regenerate an IAPKit API key without
  separate explicit approval. Use an existing Martie project key and redact it
  from commands, logs, screenshots, and reports.
- Do not create, edit, push, pull, or delete store products as part of this
  receipt workflow. Store-catalog mutation is a different E2E scope.
- Use sandbox/test accounts only. Do not claim that sandbox means no external
  side effect; the store still creates purchase/transaction state.
- Prefer a repeatable consumable. Never leave a purchased transaction
  unfinished merely to preserve test evidence.

## Preflight

1. Read `$OPENIAP_REPO/AGENTS.md`, `packages/kit/CONVENTION.md`, the selected
   framework's `CLAUDE.md`, and the `Local (IAPKit) Receipt Vertical` section of
   `.claude/commands/e2e-tests.md`.
2. Run `git status --short --branch` and preserve all existing changes.
3. Confirm port `3100` is free and identify the device:
   - Android: `adb devices -l`
   - iOS: `xcrun devicectl list devices`
4. Confirm the device is signed into the correct sandbox/tester account, can
   load the store, and can install or launch `dev.hyo.martie`.
5. Confirm an existing Martie IAPKit API key and the exact Martie Convex
   deployment that issued it are available. A placeholder or cross-deployment
   key/URL pair blocks the live lane.
6. Confirm the selected example exposes the distinct **Local (Device)**,
   **Local (IAPKit)**, **IAPKit**, and **None (Skip)** choices in that order,
   then fetches the Martie catalog before requesting purchase.

Treat a missing device, store account, catalog, API key, real Convex URL, or
network route as `BLOCKED`, not passed.

## Make the Local Server Reachable

Build and start the compiled server in a dedicated terminal with the real
Martie Convex deployment:

```bash
OPENIAP_REPO="${OPENIAP_REPO:-$(git rev-parse --show-toplevel)}"
cd "$OPENIAP_REPO/packages/kit"
: "${CONVEX_URL:?Set the real Martie Convex deployment URL}"
VITE_KIT_CONVEX_URL="$CONVEX_URL" bun run build:all
CONVEX_URL="$CONVEX_URL" \
VITE_KIT_CONVEX_URL="$CONVEX_URL" \
STATIC_ROOT="$PWD/dist" \
PORT=3100 \
KIT_DEBUG_VERIFY_LOGS=1 \
./openiap-kit-server
```

Verify `/health` from the host, then verify the same origin from the device or
an equivalent device-side network probe.

- Android over USB: inspect the current reverse mappings and reuse an existing
  `tcp:3100` to `tcp:3100` mapping. If it is absent, create it and record that
  this run owns it:

  ```bash
  existing_reverse_rules="$(adb -s "$ANDROID_SERIAL" reverse --list)"
  IAPKIT_REVERSE_BLOCKED=0
  if printf '%s\n' "$existing_reverse_rules" | \
    grep -Eq '(^|[[:space:]])tcp:3100[[:space:]]+tcp:3100($|[[:space:]])'; then
    IAPKIT_REVERSE_CREATED=0
  elif adb -s "$ANDROID_SERIAL" reverse --no-rebind tcp:3100 tcp:3100; then
    IAPKIT_REVERSE_CREATED=1
  else
    IAPKIT_REVERSE_CREATED=0
    IAPKIT_REVERSE_BLOCKED=1
    echo 'BLOCKED: could not create tcp:3100 reverse mapping without rebinding' >&2
  fi
  [ "$IAPKIT_REVERSE_BLOCKED" = "0" ]
  ```

  Keep `IAPKIT_REVERSE_CREATED` in the shell used for cleanup and configure
  `http://127.0.0.1:3100` in the app. If `--no-rebind` fails, stop as `BLOCKED`
  or select a different free port; never overwrite the existing mapping.

- Physical iPhone: use the Mac's current LAN IP, for example
  `http://192.168.0.4:3100`. Device localhost points to the iPhone, not the Mac.
- Android without `adb reverse`: use the Mac LAN IP and keep both devices on a
  mutually reachable network.
- Simulator/emulator addresses differ from physical-device addresses. Discover
  the route instead of copying a stale IP.

The configured base URL is an origin only; do not append
`/v1/purchase/verify`. If HTTP cleartext is blocked in a non-debug build, fix or
use the example's intended debug networking configuration rather than claiming
the server is unreachable.

## Configure and Rebuild One Example

React Native environment:

```text
IAPKIT_API_KEY=<existing Martie project key>
IAPKIT_BASE_URL=<device-reachable local origin>
```

Expo environment:

```text
EXPO_PUBLIC_IAPKIT_API_KEY=<existing Martie project key>
EXPO_PUBLIC_IAPKIT_BASE_URL=<device-reachable local origin>
```

Keep secrets in ignored local environment files or the process environment.
Rebuild/reinstall the native app after changing these build-time values; do not
assume a JavaScript reload changed the native verification payload. Confirm the
screen label is **Local (IAPKit)**, not **Local (Device)** or **IAPKit**, before
purchase.

## Martie Catalog

- `dev.hyo.martie.10bulbs`: consumable; preferred repeatable receipt fixture
- `dev.hyo.martie.30bulbs`: consumable fallback
- `dev.hyo.martie.certified`: non-consumable
- `dev.hyo.martie.premium`: subscription
- `dev.hyo.martie.premium_year`: yearly subscription

Fetch visible store products first. Do not infer availability from constants
alone. Prefer `10bulbs`; use a subscription only when subscription behavior is
in scope and the tester can safely create that sandbox state.

## Run the Approval-Gated Live Vertical

1. Start log capture for the selected example and the local IAPKit server.
2. Launch `dev.hyo.martie`, open Purchase Flow or Subscription Flow, and select
   **Local (IAPKit)**.
3. Fetch products and record the visible SKU and localized price.
4. Obtain explicit approval if it is not already present for this exact live
   purchase run.
5. Purchase the selected sandbox SKU and complete the store sheet.
6. Match the app, local server, and same-deployment purchases evidence before
   stopping logs.

Require all of these assertions for `LIVE RECEIPT PASS`:

1. The app receives a real purchase token/JWS and calls
   `verifyPurchaseWithProvider({ provider: 'iapkit' })` with the configured
   local `baseUrl`.
2. The local server emits a matching structured `verify_request` entry for
   `POST /v1/purchase/verify` with a correlation id, expected store, HTTP 200,
   and `isValid: true`. Use debug logs only to correlate; never expose receipt
   or API-key material.
3. The app reports `isValid: true` with the expected IAPKit state/store and then
   successfully finishes, acknowledges, or consumes the transaction as
   appropriate.
4. The purchases view backed by the same Martie Convex deployment shows the
   matching store, SKU, and purchase time. For a Dev deployment, use its Convex
   Data view or a dashboard explicitly connected to Dev; the production-backed
   hosted UI will not contain the Dev row. Correlate identifiers where exposed.

If the request reaches the hosted endpoint, lacks `baseUrl`, never appears in
the local structured log, or cannot be correlated with the same-deployment
purchases evidence, fail the local vertical even when the store purchase itself
succeeds.

## Cleanup and Reporting

- Stop the local server and log streams.
- Remove the Android reverse mapping only when this run created it:

  ```bash
  if [ "${IAPKIT_REVERSE_CREATED:-0}" = "1" ]; then
    adb -s "$ANDROID_SERIAL" reverse --remove tcp:3100
  fi
  ```

  Reused and unrelated mappings must remain unchanged.

- Leave store products and project credentials unchanged.
- Preserve sufficient redacted evidence to distinguish server smoke from the
  live receipt result.

Report:

- framework, store, device identifier, app id, and SKU;
- local origin without secrets, server build/start result, and Convex target
  classification (`real Martie`, never the secret value);
- smoke result separately from live receipt result;
- local correlation id, HTTP status, `isValid`, state, store, and transaction
  finish/consume result;
- same-deployment Martie purchases correlation result;
- every `BLOCKED` prerequisite or failure, without upgrading partial evidence
  to PASS.
