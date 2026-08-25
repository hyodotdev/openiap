# IAP Misuse Catalog

Concrete OpenIAP misuse patterns, catalogued MUBench-style: misuse is rare but
almost always severe (amann2016mubench; backlog R6). Each pattern names the
conformance surface that makes it detectable. Lint tooling is deferred until
this catalog stabilizes; the mined issue dataset
(`bun run research:mine-issues`) is the evidence base for adding patterns.

Severity: `revenue` (money lost or feature unlocked for free), `entitlement`
(paying user loses access), `stability` (crash or stuck state).

## misuse.entitlement-from-local-state — revenue

Granting entitlement because a purchase object exists locally. Forged or
replayed tokens pass this check (mulliner2014virtualswindle).

```ts
// bad — trusts whatever reached the client
onPurchaseUpdated((purchase) => grantEntitlement(purchase.productId));

// good — verification gates the grant
onPurchaseUpdated(async (purchase) => {
  const result = await verifyPurchase({ apple: { sku: purchase.productId } });
  if (result.isValid) await grantEntitlement(purchase.productId);
});
```

Detected by: `verification.forged-token-is-invalid`.

## misuse.error-treated-as-invalid — entitlement

Revoking or withholding entitlement because verification threw. A network
failure is not a verdict about the purchase.

```ts
// bad — network blip revokes a paying user
try {
  const result = await verifyPurchase({ apple: { sku } });
  grantIf(result.isValid);
} catch {
  revokeEntitlement(sku);
}

// good — errors keep prior state and retry
catch {
  scheduleRetry(sku); // keep the last known entitlement
}
```

Detected by: `verification.infrastructure-error-is-not-a-verdict`.

## misuse.finish-before-grant — entitlement

Finishing the transaction before the entitlement is durably granted. A crash
between the two loses a paid purchase; unfinished purchases redeliver.

```ts
// bad — finish first, grant second
await finishTransaction({ purchase, isConsumable: true });
await grantEntitlement(purchase.productId);

// good — verify, grant, then finish
await verifyAndGrant(purchase);
await finishTransaction({ purchase, isConsumable: true });
```

Detected by: `completion.unfinished-purchase-remains-available`.

## misuse.missing-finish — stability

Never calling finishTransaction. The store redelivers the purchase on every
launch and, on Android, refunds unacknowledged purchases.

Detected by: `completion.finish-removes-transaction-from-pending`.

## misuse.pending-treated-as-purchased — revenue

Granting on a purchase whose state is Pending (Ask to Buy, slow cards). The
purchase can still fail or be declined.

```ts
// bad
if (purchase) grant(purchase.productId);

// good
if (purchase.purchaseState === "purchased") grant(purchase.productId);
```

Detected by: `purchases.pending-purchase-is-not-delivered-as-purchased`,
`subscriptions.pending-subscription-is-not-active`.

## misuse.no-restore-path — entitlement

Shipping without a getAvailablePurchases-driven restore. Reinstalls and new
devices lose non-consumables; app review rejects it.

Detected by: `restoration.available-purchases-returns-owned-items`.

## misuse.listener-after-request — stability

Registering purchase listeners after calling requestPurchase. Fast store
callbacks (and app-relaunch redeliveries) are missed.

```ts
// bad
await requestPurchase({ request: { apple: { sku } } });
onPurchaseUpdated(handle);

// good — listeners exist before any request, ideally at connection init
onPurchaseUpdated(handle);
await requestPurchase({ request: { apple: { sku } } });
```

Detected by: `purchases.request-emits-purchase-updated-on-success` (adapter
checks register listeners first; SDK docs teach the same order).

## misuse.assume-fetch-returns-all-skus — stability

Indexing fetchProducts results by request position. Unknown skus are omitted,
not returned as placeholders.

```ts
// bad — products[i] does not correspond to skus[i]
const [premium] = await fetchProducts({ skus: ["premium", "pro"] });

// good — look up by id
const products = await fetchProducts({ skus: ["premium", "pro"] });
const premium = products.find((product) => product.id === "premium");
```

Detected by: `products.fetch-returns-requested-skus`.

## misuse.secrets-in-client — revenue

Embedding Google service-account keys, Apple shared secrets, or IAPKit secret
keys in the shipped app. Anything in the binary is public
(yang2017showme: leaked merchant credentials were a dominant exploit class).

Detected by: no client behavior can detect it mechanically yet — candidate for
lint tooling once the catalog stabilizes. The webhook direction guardrail
already forbids shipping project-wide secrets.

## misuse.wrong-consumable-flag — entitlement

Finishing a non-consumable with `isConsumable: true` (silently consumes a
lifetime purchase) or a consumable with `false` (blocks repurchase).

Detected by: `restoration.available-purchases-excludes-consumed-items`
exercises the consume path; the inverse relies on store dashboards today.
