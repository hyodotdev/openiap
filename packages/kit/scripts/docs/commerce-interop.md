# Replace the example with IAPKit

This check keeps one application backend and one event receiver alive while it
switches from `openiap-commerce-protocol-example` to IAPKit and back. It covers
verification, binding, paid cancellation, expiry, signed delivery, retries,
process restart, and account erasure. The same command also compares Apple,
Amazon and Horizon verification, binding, access and erasure, with negative
rechecks and upstream failures for Amazon/Horizon. It fails on a changed access result or
consumer source file.

From the OpenIAP checkout, with the example checkout beside it:

```sh
bun install --frozen-lockfile
(cd ../openiap-commerce-protocol-example && npm ci --ignore-scripts)
bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs \
  ../openiap-commerce-protocol-example
```

Tested with Bun 1.3.13 and Node.js 24. The first run downloads the pinned Convex
backend `precompiled-2026-08-25-7cce8fb`. Allow about a minute after setup: the
retry delay and paid expiry use the real clock. Pass a second argument to
choose a **new** output directory. The command prints its report path.

No credentials or environment variables are required. The runner discards
inherited Convex deployment settings and provisions a separate anonymous local
deployment. It copies IAPKit's functions into that directory; it never pushes
the fixture module into the working checkout or a cloud deployment. API and
signing keys are generated for the run. Keep the local deployment directory
private; publish only the report and source snapshots.

Both providers use the same receiver URL and inbox. Each signing key is bound
to its provider and project; deduplication includes that identity so equal
event IDs from different providers do not suppress each other.

## What runs

- The original example provider, client, app backend and signed-event receiver.
- IAPKit's Hono routes, shared handlers, Apple/Google/Amazon/Horizon verification and Google RTDN action
  bodies, and real Convex authorization, storage and subscription mutations.
- The real IAPKit delivery claim, signature, result and retry code. The Convex
  process is stopped and restarted while a failed delivery remains pending.
- Account erasure in both providers, the IAPKit background deletion job, and
  erasure of the app's delivered copies. Deleted sessions cannot submit new
  purchases; signed late deliveries cannot reintroduce erased identities.

The Google API/OIDC, Amazon RVS, Meta Graph, and Apple Server API/signature
verification boundaries return fixture responses. Apple signing-key loading
uses a test-only fixture. Node action
bodies execute under Bun with calls to the isolated Convex database. The
outbound worker's existing transport injection sends to the same loopback
receiver. The fixture-only `interopFixture` module creates project configuration
and inspects stored rows; commerce behavior stays in IAPKit's existing functions.
Unrelated image processing and maintenance cron entry points are omitted from
the disposable deployment.

This is provider replacement at the application contract, with the same
fictional purchase set up in both providers. It does not migrate a customer
database, make a store purchase, validate store signatures or OIDC against their services, or test
public HTTPS DNS/TLS. Those are separate deployment checks.

## Keep documentation evidence current

```sh
bun --conditions=openiap-source packages/kit/scripts/docs/export-commerce-interop.mjs \
  <successful-run-directory> ../openiap-commerce-protocol-example
```

The exporter rejects changed executed source. It produces the report and
readable source snapshots used by the purchase guide. The docs build checks
that the report, snapshots, source hashes and `#L<n>` anchors agree with each
other; it does not compare them with the current IAPKit sources.

```sh
bun run audit:commerce-evidence
```

This root audit lists every recorded input that changed, disappeared, or was
added since the recording: IAPKit `server/` and `convex/`, the workspace
lockfile and manifests, the protocol package sources and artifacts, the MCP
client, and this harness. Drift is advisory: the recorded run stays valid for
its recorded revision (a recording from an uncommitted tree is marked
`-dirty`), so CI reports it as a warning on docs, kit, and protocol changes.
Re-record before deploying docs when a displayed snapshot or a commerce code
path changed.

The first real run exposed a missing `entitlement.revoked` when the clock passed
expiry before RTDN arrived. `convex/subscriptions/internal.test.ts` now checks
that delayed expiry, including cancellation arriving first, revokes once.
