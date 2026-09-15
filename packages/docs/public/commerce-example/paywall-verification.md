# Connect your paywall to experiment data

Keep the paywall and experiment assignment in your app. Let a purchase backend
check the purchase, then send Commerce Protocol events to your analytics service.
This example adds that connection to the backend built in the first seven commits.

## Run and see the result

Install Bun and Node.js/npm. In this example's folder:

```sh
npm ci
npm run verify
PORT=5198 npm start
```

Open `http://127.0.0.1:5198/paywall`.

| Click | What you will see |
| --- | --- |
| Apple fixture → Buy Premium → Deliver events | Premium opens. Two events arrive; the purchase contributes a fictional USD 4.99 to Onboarding / A. |
| Simulate renewal → Deliver events | Another purchase observation brings the known amount to USD 9.98. |
| Cancel renewal → Deliver events | Premium stays open. The known amount remains USD 9.98. |
| Google fixture → Buy Premium → Deliver events | The same receiver joins the purchase to Onboarding / B. Its amount is unknown, not zero. |
| Redeliver saved events, for each store | Event count and amounts stay unchanged. |

`npm run verify` runs the CLI handoff for all three roles, the full behavioral
suite, and the purchase → renewal → cancellation → redelivery flow over HTTP.
It starts an isolated server, stops it, starts a new process, and checks that
access, experiment assignments and deduplication survive. Failures exit nonzero;
actual commands, responses, source hashes and results are saved to
`.runtime/verification.json`. This command executes existing code; it does not
launch an AI or implement your project.

Expand the HTTP exchange to inspect the actual destination, request, and response.
Stop and restart the server: the received events and experiment assignments stay
in SQLite. A fresh checkout starts empty. Use `DATA_DIR=.runtime/another-run` for
a separate local database; use `PORT` for a different port.

## Ask AI to implement your connection

Run `npx @hyodotdev/openiap init --role experience` in your existing product
(`--role data` for an event receiver). Paste its entire output into the coding
assistant's chat for that same project, then append:

```text
Keep our existing paywall, experiment assignments, and purchase callback.
Connect our app backend to the chosen commerce provider. Fulfill and finish only
after the backend grants the selected product. If we also own analytics, join
signed lifecycle events to our existing customer and experiment mapping.
Keep unknown amounts unknown, preserve currencies, and deduplicate by event ID
in the authenticated emitter/project scope. Show cancellation and redelivery.
Use PAYWALL.md and paywall.test.mjs from the example as acceptance references.
Run npm run verify in its separate checkout and inspect .runtime/verification.json.
Run the example separately, then run equivalent checks against OUR changed code.
Show our running result, commands, failures and corrections, and untested parts.
```

The CLI prints context; the coding assistant implements the connection. Your
decisions are the store, provider, authentication/account mapping, and experiment
attribution policy. A paywall-only product can leave analytics to another service.

## Follow one purchase through the code

| Responsibility | Example code | Boundary |
| --- | --- | --- |
| Paywall and simulated host callback | [paywall.html](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/paywall.html), [paywall.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/paywall.mjs) | `/paywall/*` is this app's demo interface. It is not a protocol API. |
| Purchase verification, ownership and access | [server.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/server.mjs), [backend.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/backend.mjs) | Actual local requests to `/commerce/v1/purchases/verify`, `/purchases/bind`, and `/entitlements`. |
| Subscription changes | [backend.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/backend.mjs) | `/fixture/renew` and `/fixture/cancel` simulate store observations. They are not public protocol operations. |
| Signed delivery and durable inbox | [delivery.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/delivery.mjs) | The producer sends the same CommerceEvent envelope to `/webhooks/commerce` over local HTTP. |
| Experiment association and reporting | [attribution.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/attribution.mjs) | Product-owned join keyed by project, store, environment, purchase chain and bound user. No experiment fields are added to the protocol. |
| Customer outcomes and failure cases | [paywall.test.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/paywall.test.mjs) | Also rejects tampering, handles missing amounts/currencies, preserves mappings on reopen, and erases them with the customer. |

The default host fixture catalog supplies the purchase-chain/account association.
`paywall.mjs` reads access through the configured provider's HTTP API. Configure
its server-side `provider.baseUrl` and `provider.credential` for another provider;
keep credentials out of the browser. Provider requests require HTTPS; plain HTTP
is accepted only for literal IPv4/IPv6 loopback addresses in local tests.
Redirects are rejected so a provider cannot forward credentials to another URL.
The receiver accepts one configured
`projectId` and signing `secret`; use a separate database for each emitter.
`/fixture/*` controls belong only to the local demo provider.

Some providers omit transaction references. For those events, `assignAccount`
records an explicit trusted account/store/environment/product assignment.
The report uses it only when `originalTransactionId` is absent. An unknown
nonempty chain never falls back to an account match. It does not invent IDs.
Both policies keep the first assignment and remove it when the customer is erased.

In your product, derive the purchase-chain/account association from authenticated purchase records; never
trust an experiment or customer identifier merely because the client sent it.
This sample fixes the first assignment for one subscription chain. Your product
chooses its attribution window, cross-device identity and experiment policy.

## What the amount means

The projection records positive `subscription.started` and `subscription.renewed`
observations with store-provenance prices, grouped by currency and experiment.
The Apple fixture explicitly simulates such a price; no store asserted real money.
The Google fixture intentionally omits price. That omission illustrates an absent
field; it is not a claim about everything that store can report.

Event IDs deduplicate deliveries. Transaction IDs remain reference data, not a
second event deduplication key. Cancellation and entitlement changes add no
charge. Missing, catalog, and inferred prices stay unknown for this projection.
Refunds and recoveries are marked for reconciliation; the event's price is not a
refund amount. These totals are fictional gross observations, not net revenue,
MRR, ARPU, a refund ledger, or complete financial reporting.

## Verify an independent provider

The same `paywall.mjs`, `delivery.mjs` and `attribution.mjs` also have a provider
check in [verify-provider.mjs](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/verify-provider.mjs). The OpenIAP local IAPKit
harness supplies its real HTTP routes, Convex functions, RTDN normalizer and
outbound signer. Google responses and OIDC remain fixtures. No hosted account
or production write is involved.

That run buys, renews, cancels and redelivers through the configured IAPKit
provider. Its Google events omit transaction references: the explicitly
configured account/product association joins them to Onboarding / A. Two
fictional USD 5.00 observations produce USD 10.00. This verifies the second
provider's actual output, without changing the consumer code or rewriting events.
It does not migrate purchases from one provider to another.

Run the OpenIAP harness with this checkout as its optional final argument; the original
example checkout is still required for the existing regression matrix:

```sh
# From an OpenIAP checkout with dependencies installed, using a new output path:
bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs \
  ../openiap-commerce-protocol-example /tmp/commerce-provider-run \
  ../openiap-commerce-protocol-example-fresh
```

The output's `report.json` contains `freshConnection` with the actual requests,
signed bodies, returned access and experiment results. It also records the
runtime and source hashes. A default OpenIAP checkout must contain the updated
harness with the optional fresh-example argument; use the harness source linked in the
recorded evidence when reproducing an unpublished docs change.

## Verification scope

This was an iterative AI extension of the existing example with conversation
context. It is not an independent one-prompt trial. Apple and Google receipts,
identity, clock, amounts and store outcomes are fixtures. Real local HTTP,
SQLite, signatures and application joins execute. It verifies neither a real
store checkout nor integration with an external paywall/analytics product.
It does not add a production events-profile or GraphQL conformance claim.

The first full run caught an invalid capability declaration. The
[failed output](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/evidence/paywall-first-run.json) is retained; the declaration was
corrected without dropping a test or profile. [Initial connection test output](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/e93c68f3f7b62753f42d22002a927f5163a0c613/evidence/paywall-tests.json)
includes the original regression suite and the new connection tests.

## Acceptance checklist for your implementation

| Requirement | Executable reference | What still belongs to your project |
| --- | --- | --- |
| CLI prepares the AI brief | `npm run verify`: cli-handoff | The AI must run equivalent checks on your changed code. |
| Preserve paywall and purchase outcomes | `paywall.test.mjs`: unsuccessful results and ownership | Your real host SDK callback and durable fulfillment. |
| Purchases and renewals reach experiment data | `paywall.test.mjs`: two store fixtures and account attribution | Authenticated identity, assignment window and experiment policy. |
| Backend choice uses the same consumer code | `verify-provider.mjs` through the IAPKit harness | Store credentials, provisioning and any purchase migration. |
| Cancellation and expiry keep access correct | `lifecycle.test.mjs`, expiry-boundary renewal test | Real store lifecycle and device sandbox tests. |
| Signatures, retries, restart and erasure | `delivery.test.mjs`, `recovery.test.mjs`, `erasure.test.mjs`, `npm run verify` | Public HTTPS deployment and operational monitoring. |
| Unknown amounts and currencies are honest | `paywall.test.mjs`: reporting | Refund reconciliation, taxes, conversion and financial reporting. |

Verified source: [e93c68f3f7b62753f42d22002a927f5163a0c613](https://github.com/hyodotdev/openiap-commerce-protocol-example/tree/e93c68f3f7b62753f42d22002a927f5163a0c613).
[Recorded CLI, tests, HTTP and restart results](./paywall-harness.json).
[Independent provider run](./paywall-provider-run.json) · [Exact sources and commands to reproduce it](./paywall-provider-reproduction.md).
