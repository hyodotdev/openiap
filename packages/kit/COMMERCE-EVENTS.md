# Normalized commerce events

How a store notification becomes something an analytics pipeline, a SaaS
platform or a custom backend can consume without parsing Apple or Google
payloads.

## What IAPKit is, and is not

IAPKit is one open-source implementation of the server side of OpenIAP. It
validates receipts, keeps canonical subscription state, derives entitlement and
publishes normalized commerce events.

It is not a paywall builder, an experimentation platform, a CRM or an analytics
product. Those consume IAPKit; they are not built inside it. OpenIAP does not
require IAPKit, and IAPKit does not require any particular downstream vendor.

## Architecture

```text
Apple ASN v2 / Google RTDN
        │
        ▼
  Store adapter            purchases/{ios,android,horizon,amazon}.ts
        │                  webhooks/{apple,google}.ts
        ▼
  Validation / normalization   webhooks/shared.ts  →  webhookEvents
        │
        ▼
  Lifecycle engine          subscriptions/stateMachine.ts   (pure)
        │
        ▼
  Canonical subscription    subscriptions                    (+ entitlement gate)
        │
        ▼
  Normalized commerce event commerce/contract.ts → commerceEvents
        │
        ▼
  Outbound delivery         commerce/delivery.ts → developer HTTPS endpoint
```

## Five things that are not the same

| Concept        | Table            | Meaning                                              |
| -------------- | ---------------- | ---------------------------------------------------- |
| Transaction    | `purchases`      | One validated receipt/token verification             |
| Subscription   | `subscriptions`  | Canonical per-`purchaseToken` lifecycle record       |
| Entitlement    | _computed_       | Whether access should be granted right now           |
| Store event    | `webhookEvents`  | What a store said, in the store's own vocabulary     |
| Commerce event | `commerceEvents` | What happened, in IAPKit's vocabulary, for consumers |

Entitlement is derived, not stored: `stateMachine.ts` returns `active` alongside
each transition and `/v1/subscriptions/status` applies the same rule. A single
source avoids the classic drift between a cached flag and the record it came
from. `commerceEvents.entitlementActive` denormalizes that answer onto the
event, and the delivered body carries it as `subscription.active`, so a consumer
can act without joining back.

## Event vocabulary

The event types are the lifecycle transitions the state machine already
produces, renamed to a dotted form. There is deliberately no second taxonomy.

`subscription.started` · `subscription.renewed` ·
`subscription.recovered` · `subscription.entered_grace_period` ·
`subscription.entered_billing_retry` · `subscription.expired` ·
`subscription.canceled` · `subscription.uncanceled` ·
`subscription.revoked` · `subscription.refunded` ·
`subscription.product_changed` · `subscription.price_changed` ·
`subscription.deferred` · `subscription.paused` · `subscription.resumed`

Plus the entitlement delta, emitted only when the gate actually flips:
`entitlement.granted` · `entitlement.revoked`

For an Apple downgrade or scheduled crossgrade, top-level `productId` is the
next billing-period product while `subscription.productId` remains current until
renewal. An Apple `UPGRADE` applies the new product immediately.

When a lifecycle event applies a product switch, `previousProductId` names the
old product and `productId` names the new one. This includes an immediate Google
change and the Apple renewal where an earlier scheduled preference takes effect.
For a multi-item Google renewal, IAPKit matches the existing canonical product's
line item. When that item expires, IAPKit first selects the future line whose
`itemReplacement.productId` names the canonical product, then falls back to an
exactly-one future item. A multi-item product change or linked purchase uses the
same replacement metadata only for one active successor whose mode is neither
`DEFERRED` nor `KEEP_EXISTING`; otherwise it preserves the canonical product
instead of selecting an arbitrary item. A linked-token replacement still moves
the canonical row to the new token. An unlinked ambiguous multi-item purchase
is rejected before deduplication and retried until device receipt verification
establishes the canonical product; the retry then selects that product's line
item and applies the event once.
Google prepaid purchases and top-ups remain active with `willRenew: false` and
no `renewsAt`; a later top-up extends `expiresAt` without claiming auto-renewal.

Likewise, a scheduled price-change event carries the announced amount in
`price`; the canonical subscription and its revenue metrics keep the current
amount until a renewal applies the new price.

A no-op transition (a redelivery that changes nothing) emits nothing, so
consumers never count retries as activity.

One-time purchase notifications remain in `webhookEvents` for operations, but
this subscription vocabulary does not relabel them as subscription events.

### Versioning

`eventVersion` is `"1.0"`. Additive optional fields keep the major; a field that
changes meaning or disappears bumps it. Pin on the major.

## Idempotency

Emission runs inside the same Convex transaction as the lifecycle transition, so
it inherits the guarantees already proven there rather than adding a second
layer:

- `webhookEvents` dedupes on `(projectId, source, sourceNotificationId)`
- `webhookEvents.appliedAt` is a durable applied-marker, so a redelivery cannot
  reapply a transition
- each subscription retains the last store timestamp, ingestion tie-break and
  notification id, so stale events remain rejected after source-row pruning

If the transition commits, its events commit. If it rolls back, so do they.

Fan-out runs once in the emission transaction and creates one
`outboundDeliveries` row per `(eventId, destinationId)`.

### Ordering, per provider

Apple `originalTransactionId` is stable for the entitlement's lifetime, so
ordering within a subscription is well-defined. Google can reissue
`purchaseToken` across upgrade/downgrade; subscriptionsv2 enrichment supplies
the linked predecessor so IAPKit moves the canonical row to the new token and
retains a bounded successor chain. Late predecessor status events cannot create
a second logical subscription; refunds and revocations remain visible without
deactivating an active successor.

## Outbound delivery

Direction is store → IAPKit → developer backend. Server-to-server only; nothing
here is reachable from a shipped app and no client-pullable stream exists.

- `outboundDestinations` — project-owned HTTPS endpoints, optional event-type
  allow list, per-destination secret plus a rotation slot
- `outboundDeliveries` — one attempt chain per `(event, destination)`, and the
  dead-letter store: a row that exhausts its budget stays `failed` and can be
  replayed without re-deriving the event
- the cron claims one row immediately before each send, so destination changes
  and breaker trips fence later claims; an already in-flight request may still
  complete. Each lease also carries a token so a reclaimed row ignores a
  superseded result
- delivered history expires after 30 days; failed rows and their event payloads
  remain as dead letters until an operator replays or removes the destination

### Registering a destination

Open the project's **Webhooks** tab to create, disable, rotate, or remove a
destination and to replay dead letters. All actions require organization admin:
a destination holds a signing secret and names an endpoint IAPKit will POST to,
so member access is not enough.

`create` returns the secret exactly once. No query ever returns it again —
`list` projects a fixed allow-list of fields that excludes both the secret and
its rotation slot. `rotateSecret` issues a new one and keeps the old valid for
24 hours so a receiver can roll without dropping in-flight deliveries. Another
rotation is rejected until that overlap ends.

### Signing

```text
openiap-signature: v1=<hex hmac-sha256 of "<timestamp>.<body>">
openiap-timestamp: <unix seconds>
openiap-event-id:  <commerceEvents id>
openiap-delivery-id: <outboundDeliveries id>
```

The timestamp is inside the signed material, so a captured body cannot be
replayed with a fresh header. Parse it as a finite Unix-seconds number and
require `Math.abs(nowSeconds - timestamp) <= 300` to reject stale and future
signatures. Require the event-id header to equal the signed body's `eventId`,
then atomically record the body's `eventId` before side effects. The header
alone is not signed and is never the idempotency authority. During rotation the
signature header carries both values comma-separated; accept if either matches.

### Retries

Exponential backoff from 30s, capped at 6h, 14 attempts. `408`, `429` and `5xx`
retry; other `4xx` are permanent. Twenty consecutive failures park the
destination for manual review rather than hammering a dead endpoint forever.

### Safety

Destination URLs must be public HTTPS. Loopback, private, shared, reserved and
link-local ranges, `.internal`/`.local` names and embedded credentials are
rejected. Every A/AAAA answer is validated and the accepted address is pinned
through TLS so DNS rebinding cannot change the target. Redirects are not
followed, requests time out at 10s, and deployment-level egress policy remains
recommended as defense in depth.

Payloads carry no raw store envelope, receipt, credentials, source-webhook id or
subscription-row id. `sourceStoreEventId` is the store's own notification id
(ASN `notificationUUID` / RTDN `messageId`), which is what a developer can
cross-reference with the store. The public `eventId` and `projectId` remain in
the contract for receiver idempotency and routing. `transactionId` and
`originalTransactionId` appear only when the provider supplies those
identifiers; a Play purchase token is never mislabeled as a transaction id.

## Revenue data

`amountProvenance` records where a number came from — `store`, `catalog` or
`inferred` — and the three are never mixed silently. Today only
store-authoritative amounts are emitted; when a store asserts no price, the
amount fields are simply absent rather than being back-filled from the catalog.
Downstream revenue math should treat a missing amount as unknown, not zero.

## Provider capabilities

`commerce/capabilities.ts` declares what is implemented, not what a store's API
theoretically allows. Consumers branch on it instead of assuming Apple-shaped
behavior everywhere.

|                            | Apple | Google | Meta/Horizon     | Amazon           |
| -------------------------- | ----- | ------ | ---------------- | ---------------- |
| Initial validation         | ✅    | ✅     | ✅               | ✅               |
| Server notifications       | ✅    | ✅     | ❌               | ❌               |
| Canonical subscription     | ✅    | ✅     | ❌               | ❌               |
| Renewal events             | ✅    | ✅     | ❌               | ❌               |
| Refund / revocation events | ✅    | ✅     | ❌               | ❌               |
| Expiration                 | ✅    | ✅     | ❌               | ❌               |
| Scheduled reconciliation   | ❌    | ❌     | ❌               | ✅               |
| Entitlements               | ✅    | ✅     | ⚠️ point-in-time | ⚠️ point-in-time |
| Store-authoritative amount | ✅    | ✅     | ❌               | ❌               |

Meta integrates only the Graph `verify_entitlement` endpoint: a one-shot check
that the viewer owns the SKU. There is no notification channel, so there is no
renewal, expiration or refund signal and no canonical subscription record.
Entitlement is answerable only at the moment it is asked.

Amazon RVS validates receipts and a five-minute worker processes rows that are
due on a 48-hour cadence. Backlog and retries can extend that interval. RVS
alone does not carry enough lifecycle detail for a canonical subscription
record, but each verification still answers point-in-time entitlement.

Apple and Google have no scheduled reconciliation pass. A notification lost past
the store's retry window is not self-healing. Receipt verification bootstraps a
token before its first store event, but never overwrites webhook-governed state
because a client can replay an older valid transaction.

## Integrating without touching IAPKit core

Register a destination, verify the signature, switch on `eventType`. Nothing
provider-specific is required, and no integration code belongs in this package:

```ts
// The header carries one `v1=` value normally and two during rotation, so
// compare against each rather than against the header as a whole.
const expected = Buffer.from(
  `v1=${hmacSha256(secret, `${timestamp}.${rawBody}`)}`,
);
const presented =
  typeof headerSignature === "string"
    ? headerSignature.split(",").map((part) => part.trim())
    : [];
const signatureMatches = presented.some((signature) => {
  const candidate = Buffer.from(signature);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
});
if (!signatureMatches) return 401;
const timestampSeconds = Number(timestamp);
if (
  !Number.isFinite(timestampSeconds) ||
  Math.abs(nowSeconds - timestampSeconds) > 300
) {
  return 401;
}
if (headerEventId !== event.eventId) return 401;

if (!event.userId || !event.productId) {
  await queueForAccountCorrelationOnce(event.eventId, event);
  return 202;
}

// Enforce event-id uniqueness in the same database transaction as the effect.
await applyEventOnce(event.eventId, () => {
  if (event.previousProductId) {
    revokeAccess(event.userId, event.previousProductId);
    grantAccess(event.userId, event.productId);
  }
  switch (event.eventType) {
    case "entitlement.granted":
      grantAccess(event.userId, event.productId);
      break;
    case "entitlement.revoked":
      revokeAccess(event.userId, event.productId);
      break;
  }
});
```

Call bind-user promptly after verification. If a store webhook arrives first,
IAPKit emits a correlated `entitlement.granted` after binding so the receiver
does not need a purchase token in the public payload.

This correlation uses a compact source snapshot retained with the subscription.
For subscriptions whose final source event was already pruned before that
snapshot existed, IAPKit cannot reconstruct the old event safely; bind promptly
or wait for the next store lifecycle event rather than inventing source fields.

A future `@openiap/integration-*` package would consume this contract from
outside; the contract does not depend on any downstream consumer.
