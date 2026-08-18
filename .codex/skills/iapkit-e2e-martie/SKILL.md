---
name: iapkit-e2e-martie
description: Run IAPKit local receipt-validation E2E with the dev.hyo.martie React Native or Expo examples, the compiled packages/kit server, real Convex, and Apple or Google sandbox purchases. Use when preparing an iOS Sandbox Apple Account for a development-signed or TestFlight build, verifying purchase-token or JWS routing, Local (IAPKit) baseUrl behavior, local server logs, receipt validity, transaction finishing, or the Martie purchases view; distinguish safe smoke checks from approval-gated live purchase verticals.
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
- Never place a sandbox/tester email or password in this skill, repository
  files, environment files, shell commands, logs, screenshots, or reports.
  Enter credentials only in Apple's on-device system sign-in UI. Redact the
  account identity from captured evidence unless the user explicitly needs it.
- Treat signing out of **Media & Purchases** as a separate, device-wide account
  change. Do it only for the TestFlight sandbox-controls path on a dedicated
  test device and only after the user approves that exact change; it can remove
  access to production purchased content on the device.
- Do not repeatedly retry a rejected account password or an Apple account
  challenge. Stop as `BLOCKED` and let the user complete password, verification,
  terms, or account-recovery prompts directly on the device.
- Prefer a repeatable consumable. Never leave a purchased transaction
  unfinished merely to preserve test evidence.

## Preflight

1. Read `$OPENIAP_REPO/AGENTS.md`, `packages/kit/CONVENTION.md`, the selected
   framework's `AGENTS.md`, and the `Local (IAPKit) Receipt Vertical` section of
   `.claude/commands/e2e-tests.md`.
2. Run `git status --short --branch` and preserve all existing changes.
3. Confirm port `3100` is free and identify the device:
   - Android: `adb devices -l`
   - iOS: `xcrun devicectl list devices`
4. Classify the iOS app as **development-signed** or **TestFlight** and follow
   [Prepare the iOS Sandbox Account](#prepare-the-ios-sandbox-account). Confirm
   the device can load the store and install or launch `dev.hyo.martie`.
5. For Android, follow
   [Prepare the Google Play License Tester](#prepare-the-google-play-license-tester)
   and confirm which Google Account the Play purchase sheet will use.
6. Confirm an existing Martie IAPKit API key and the exact Martie Convex
   deployment that issued it are available. A placeholder or cross-deployment
   key/URL pair blocks the live lane.
7. Confirm the selected example exposes the distinct **Local (Device)**,
   **Local (IAPKit)**, **IAPKit**, and **None (Skip)** choices in that order,
   then fetches the Martie catalog before requesting purchase.

Treat a missing device, store account, catalog, API key, real Convex URL, or
network route as `BLOCKED`, not passed.

## Prepare the iOS Sandbox Account

Do not treat the TestFlight download account and Sandbox Apple Account as the
same role:

- The production Apple Account under **Media & Purchases** downloads the beta
  from TestFlight.
- The Sandbox Apple Account attributes test purchases and exposes sandbox
  controls. TestFlight and development-signed apps both create sandbox
  transactions, which do not incur charges.

For a **development-signed app** installed from Xcode, `devicectl`, React
Native, or Expo:

1. Keep the device's production **Media & Purchases** account signed in.
2. Launch the app and initiate the first purchase only after the live-purchase
   approval gate.
3. Complete Apple's Sandbox Apple Account sign-in in the on-device purchase
   flow or under **Settings → Developer → Sandbox Apple Account** when the
   option is available.
4. Require Apple's purchase UI to identify the environment as
   `[Environment: Sandbox]`. If it does not, cancel and report `BLOCKED`; never
   continue against a production environment.

For an app installed from **TestFlight**:

1. While the production **Media & Purchases** account is still signed in,
   download the beta from TestFlight.
2. Obtain explicit approval for the device-wide account change, then open
   **Settings → Apple Account → Media & Purchases** and sign out.
3. Open **Settings → Developer → Sandbox Apple Account → Sign In** and let the
   user enter the Sandbox Apple Account credentials directly on the device.
4. Keep production **Media & Purchases** signed out during the sandbox-control
   run. Signing it back in makes TestFlight purchases use the production Apple
   Account attribution instead of the Sandbox Apple Account.

If the execution environment cannot control the physical iPhone UI, prepare
the installed app and purchase screen, then pause for the user to complete only
the system account prompt. Never claim that a CLI install or a known email
proves the account is signed in. Follow Apple's current
[sandbox testing instructions](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox)
when device labels differ by iOS version.

## Prepare the Google Play License Tester

TestFlight and Apple's Sandbox Apple Account do not apply to Android. Google
Play needs a Google Account registered under **Play Console → Settings →
License testing**:

1. Confirm the device has an up-to-date Google Play Store and the intended
   license-tester account. Never store or type its credentials through a shell,
   repository file, environment file, log, or screenshot.
2. Confirm `dev.hyo.martie` matches the Play Console application id and that
   its products are published. A license tester may use a side-loaded debug
   build; otherwise install the opted-in internal/closed-test build from Play.
3. If the device has multiple Google Accounts, expand the purchase sheet and
   confirm the selected account. Prefer installing the app from Play with the
   tester account so Google selects it deterministically.
4. Require the Google purchase sheet to identify the transaction as a test and
   offer a test payment instrument. If it shows an ordinary payment method or
   could charge real money, cancel and report `BLOCKED`.

Follow Google's current
[Play Billing test instructions](https://developer.android.com/google/play/billing/test)
when the Play Store UI or tester controls differ.

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
  if [ "$IAPKIT_REVERSE_BLOCKED" != "0" ]; then
    exit 1
  fi
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

For the Expo Vega target, `bun run build:vega:debug` loads the normal Expo
development environment-file chain, including ignored `.env.local`, and
embeds only the two `EXPO_PUBLIC_*` values above. Do not manually print or
inspect the generated key value. After building, install with
`VEGA_DEVICE_ID="$VEGA_DEVICE_ID" bun run run:vega:firetv`, then require the
same local-server and purchases-view evidence as the other live lanes.

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
2. In the exact Convex deployment used by the local server, take a redacted
   pre-purchase snapshot for the Martie project, application id, target store,
   and SKU. Record the matching logical-row count, latest purchase time, and
   applicable aggregate/entitlement state without exposing a receipt, JWS,
   purchase token, API key, or account identity.
3. Launch `dev.hyo.martie`, open Purchase Flow or Subscription Flow, and select
   **Local (IAPKit)**.
4. Fetch products and record the visible SKU and localized price.
5. Obtain explicit approval if it is not already present for this exact live
   purchase run.
6. Purchase the selected sandbox SKU. Require the Apple sheet to show the
   sandbox environment on iOS or the Google sheet to show a test purchase and
   test instrument on Android. Account prompts are completed by the user
   directly on the physical device.
7. Match the app, local server, and same-deployment post-purchase data before
   stopping logs. Query by the store's logical transaction identity where it
   is exposed, not by a broad latest-row guess.

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
4. The purchases view backed by the same Martie Convex deployment contains
   exactly one canonical logical purchase for the verified transaction. Its
   project, application id, store/platform, SKU, sandbox/test environment,
   validity, purchase state, and purchase time match the app and server
   evidence. For a Dev deployment, use its Convex Data view or a dashboard
   explicitly connected to Dev; the production-backed hosted UI will not
   contain the Dev row.
5. The post-purchase snapshot has the intended delta only: purchase/order
   aggregates advance once, and subscription or durable-entitlement state is
   created or updated only when the selected product type requires it. A
   consumable must not accidentally create a durable entitlement.
6. The exact logical transaction identity has no duplicate row. Run the
   repository's purchase-save idempotency and replay-guard integration tests
   in the same revision as the live run; when the example safely retains the
   same receipt in memory before finishing, reverify it once and require the
   same canonical row and unchanged aggregate count. Never persist plaintext
   receipt material merely to perform this replay.

If the request reaches the hosted endpoint, lacks `baseUrl`, never appears in
the local structured log, or cannot be correlated with the same-deployment
purchases evidence, fail the local vertical even when the store purchase itself
succeeds. A correct purchase row in the wrong Convex deployment also fails.

## Cleanup and Reporting

- Stop the local server and log streams.
- Remove the Android reverse mapping only when this run created it:

  ```bash
  if [ "${IAPKIT_REVERSE_CREATED:-0}" = "1" ]; then
    current_reverse_rules="$(adb -s "$ANDROID_SERIAL" reverse --list 2>/dev/null)"
    if printf '%s\n' "$current_reverse_rules" | \
      grep -Eq '(^|[[:space:]])tcp:3100[[:space:]]+tcp:3100($|[[:space:]])'; then
      adb -s "$ANDROID_SERIAL" reverse --remove tcp:3100
    else
      echo 'SKIP: tcp:3100 reverse mapping changed before cleanup' >&2
    fi
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
- same-deployment Martie before/after row count, canonical purchase-field
  comparison, aggregate/entitlement delta, and duplicate-row result;
- purchase-save idempotency and replay-guard integration-test result, plus the
  optional live same-receipt replay result when it was safe to perform;
- every `BLOCKED` prerequisite or failure, without upgrading partial evidence
  to PASS.
