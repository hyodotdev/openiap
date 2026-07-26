# IAPKit cost and abuse safety

This document records the cost model for the public IAPKit API as of July 26, 2026. It is an operational estimate, not an invoice forecast: actual Convex
database I/O depends on each project's document sizes and should be measured
from production function logs.

## Public request call graph

For a current scoped key, authentication is part of the same Convex
query/action as the requested operation. It performs one indexed `apiKeys`
lookup and point-reads the project and organization (three documents total).
It does not call `updateUsageStats`, mutate `usageCount`, or write
`lastUsedAt`. Invalid current-format keys perform bounded indexed misses; a
legacy project key may perform one additional indexed `apiKeys.by_project`
lookup while its compatibility fallback is active.

| Request                               |             Convex function executions |                                                              Indexed/point document reads on a current scoped key |                                                        New writes |
| ------------------------------------- | -------------------------------------: | ----------------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------: |
| Direct payload, `200`                 |                                1 query |                                                              3 auth + 1 product + 1 summary + 1 payload = up to 6 |                                                                 0 |
| Direct payload, matching ETag (`304`) |                                1 query |                                            3 auth + 1 product + 1 summary = up to 5; payload body row is not read |                                                                 0 |
| Catalog without payloads              |                                1 query |                                                  3 auth + at most 50 product rows; payload tables are not queried |                                                                 0 |
| Catalog with payloads                 |                                1 query |                                      3 auth + at most 50 product rows + at most 50 exact payload rows = up to 103 |                                                                 0 |
| Apple purchase verification           | 7-8 executions on a successful request |                           Indexed/point reads for auth, the Apple P8 file, and existing receipt/subscription rows | Existing receipt/statistics and optional subscription writes only |
| Google purchase verification          |   7 executions on a successful request | Indexed/point reads for auth, service-account file, optional catalog type, and existing receipt/subscription rows | Existing receipt/statistics and optional subscription writes only |

Apple/Google counts include the top-level action and its nested
`runQuery`/`runAction`/`runMutation` calls, which Convex bills as separate
function executions. Apple performs the project query, P8-loader action,
purpose-indexed file query, storage-reader action, file-record query, and
receipt mutation; a subscription adds its subscription mutation. Google
performs the project query, service-account metadata query, storage-reader
action, file-record query, receipt mutation, and either the in-app catalog-type
query or subscription mutation. Requesting `includeClientPayload` on a valid
Apple or Google result adds one query after verification. The enrichment query
is skipped for opt-out, invalid, Horizon, Amazon, missing-product, and
missing-payload cases; enrichment failure does not change a successful receipt
result.

All catalog reads use indexed pagination with a default of 25 and maximum of 50. Payload-inclusive pages perform a bounded N+1 of at most 50 exact indexed
lookups. A payload body is limited to 16 KiB of decoded UTF-8.

## Edge protection

Every publishable-key verification, product, payload, subscription-status,
entitlement, user-binding, and store-webhook ingress request passes an
in-memory token bucket before calling Convex:

- per API key: 600-request burst, 10 tokens/second;
- per source IP: 600-request burst, 5 tokens/second;
- per Fly process: 5,000-request burst, 100 tokens/second;
- payload catalog: a separate weighted limiter charges one token per requested
  product, so a 50-item body page costs 50 tokens.

Stores use a 15-minute idle TTL and LRU eviction. Key and IP stores are capped
at 10,000 entries, so random-key/IP churn cannot grow process memory without
bound. Rejections return `429 RATE_LIMITED`, `Retry-After`,
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, and the limiting
`X-RateLimit-Scope`.

The limiter intentionally stays in Fly memory. Recording a Convex mutation for
every request would add a paid function call/write and create a hot counter.
The current deployment runs one always-on Fly machine. If it scales to multiple
machines, each machine has an independent allowance, so the effective ceiling
multiplies by machine count. Convex deployment usage limits are the
cross-machine hard brake; a distributed globally consistent edge limit would
require additional infrastructure and is not justified for the current
single-machine deployment.

Only trust the source-IP headers inserted by the Fly/CDN ingress. Direct local
requests without a trusted header share the bounded `unknown` IP bucket.

## HTTP cache behavior

Direct payload responses use an ETag scoped by API key, platform, product ID,
and payload version. A matching `If-None-Match` returns `304` without reading
the payload body row. The scope prevents an ETag from one project/key being
accepted for another.

The direct response sends `Cache-Control: private, no-cache` and
`Vary: Authorization`. Catalog pages and every secret-admin response use
`private, no-store`; shared caches must never retain them. React Native IAP and
Expo IAP accept an AsyncStorage-compatible `clientPayloadCache`. They persist
the body, version, and ETag, return a valid cache entry without polling, and
conditionally revalidate only when `refresh: true` is requested.

Apps with a known product ID should use the direct endpoint. Do not download
the complete payload catalog on every foreground event.

## Approximate high-volume cost

The following deliberately isolates this feature from all other IAPKit traffic
and assumes every payload is the 16 KiB maximum. Metadata and JSON framing add
some overhead.

- **1,000,000 direct `200` payload reads:** 1,000,000 function calls and at
  least 15.26 GiB each of payload-body database I/O and egress. On Convex
  Starter, the calls alone fit the included 1M only if the deployment has no
  other traffic; payload I/O/egress exceeds the 1 GB inclusions. At listed
  overage rates, the body-only portion is roughly $3.14 database I/O and $1.88
  egress, plus metadata. Fly North America egress is roughly $0.31. On
  Professional, this isolated volume fits the 25M-call and 50 GB I/O/egress
  inclusions.
- **1,000,000 maximum 50-payload catalog pages:** up to 50,000,000 payload
  bodies, about 762.94 GiB before metadata, while still using 1,000,000
  top-level query calls. Body-only Convex overage is roughly $167.6 database
  I/O plus $100.6 egress on Starter, or $142.6 plus $85.6 on Professional
  after its 50 GB inclusions. Fly North America egress is roughly $15.3.
  Weighted catalog limiting exists specifically to make this worst case hard
  to sustain.

A `304` still uses one Convex query and reads small auth/product/summary
documents, but avoids the 16 KiB body read and response egress.

Pricing references:
[Convex pricing](https://www.convex.dev/pricing),
[Convex usage limits](https://docs.convex.dev/production/usage-limits), and
[Fly pricing](https://fly.io/docs/about/pricing/).

## Production guardrails

Configure deployment limits in the Convex dashboard under the production
deployment's **Settings → Usage Limits**, or inspect/set them with
`npx convex deployment usage --prod --json` and
`npx convex deployment usage-limits`. Configure team overage warnings and a
hard spending limit under the Convex team **Billing** page.

Start from seven days of real baseline data. Until that baseline exists, these
are conservative initial thresholds:

| Plan         | Daily warning / disable                                                        | Monthly warning / disable                                                                        | Team spend warning / disable |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| Starter      | 50k / 200k calls; 50 / 250 MB DB I/O and egress; 1 / 4 GB-hours action compute | warn at 80% of each included allowance; disable at 2M calls, 2 GB DB I/O/egress, and 40 GB-hours | $10 / $25                    |
| Professional | 1M / 4M calls; 2 / 8 GB DB I/O and egress; 10 / 40 GB-hours action compute     | warn at 80% included; disable at 50M calls, 100 GB DB I/O/egress, and 500 GB-hours               | $50 / $150                   |

Tune disable values to the service's availability policy: a disable limit
pauses the deployment for the rest of the daily/monthly window. Team spending
limits apply to usage overage rather than included usage and do not include
seat fees. IAPKit does not set these external account controls from source code.

Monitor `function_execution` logs for `database_io_read_bytes`,
`database_read_documents`, and network egress. Investigate clients repeatedly
fetching payload catalogs, high `304`-free direct payload traffic, rate-limit
scope saturation, and unexpected nested purchase-verification calls.

No additional Fly machine, deployment, paid cache, or rate-limit service is
introduced by this feature.
