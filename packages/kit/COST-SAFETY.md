# IAPKit cost and abuse safety

This document records the cost model for the public IAPKit API as of August 27, 2026 in the project's Asia/Seoul timezone. It is an operational estimate, not an invoice forecast: actual Convex
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
| Subscription status or entitlements   |                                1 query |                                                   3 auth + at most 201 user-indexed subscription rows = up to 204 |                                                                 0 |
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
is skipped for opt-out, invalid, Horizon, Amazon, and missing verified-product
ID cases. A catalog or payload miss still uses that one query and returns no
enrichment; enrichment absence or failure does not change a successful receipt
result.

All catalog reads use indexed pagination with a default of 25 and maximum of 50. Payload-inclusive pages perform a bounded N+1 of at most 50 exact indexed
lookups. A payload body is limited to 16 KiB of decoded UTF-8. User-scoped
status and entitlement reads use
`subscriptions.by_project_and_user_and_updated` and cap the indexed slice at
201 rows: up to 200 are supported and the final row detects overflow. IAPKit
fails closed instead of returning a partial entitlement set. Typical users have
only one or a few rows.

## Purchase issues

A failed verification adds one indexed query and, at most, one scheduled
mutation off the response path. Only a product mismatch or a pending payment,
which the store reports about a purchase it verified, and a secret-key bind's
ownership conflict or link limit write a row per purchase. That row is keyed by
the store and the purchase's store-verified id, so every encoding of one
purchase's evidence lands on it. Every other cause shares one row per store and
cause: configuration, credentials, rejected input, rate limits, outages, and
evidence no store recognized, such as a forged JWS, an unknown Google token or
Amazon receipt, or Meta's `success: false`. The query skips that write when the
row was seen in the last minute, so a flood, even of distinct random evidence,
costs a read per request, evicts no other row, and leaves `count` a lower bound.
Bind issues are recorded only for secret-key callers. A project keeps at most
1,024 rows in 16 shards of 64; a new row reads only its own shard and replaces
that shard's least recently seen row. An hourly cron deletes rows older than 30
days, 200 at a time. The edge limiter below still bounds every publishable-key
request before it reaches Convex.

## Operator re-send and re-sync

Both need a project owner or admin, or a secret key behind the edge limiter.

- **Re-send.** One mutation: point reads of the delivery, its event and its
  destination, an indexed read of at most 30 recent re-sends, and two writes,
  the delivery and its project's queue row. A delivery can be re-sent once a
  minute and a project 30 times a minute; each re-send is one more request from
  the outbound worker.
- **Re-sync.** One action that takes a token from the project's own
  `storeResync` admission bucket (60 burst, 1 per second). It is separate from
  the entitlement recheck bucket, so a scripted bulk re-sync cannot make
  fail-closed entitlement reads refuse users. Apple makes one App Store Server
  API request, two when the row does not record its environment. Google makes
  one Play Developer API request for a subscription; a purchase row tries the
  product lookup, then the subscription lookup, and repeats the pair up to three
  times while Play reports the token unknown. Transient failures retry as on
  verification. A purchase is saved through the verification save path, and a
  changed subscription adds one mutation that records a `StoreResync`
  notification, updates the row, and emits at most one entitlement event. A
  verify that disagrees with a re-synced subscription but cannot prove it is
  newer schedules one such re-sync of that subscription from the same bucket,
  and is dropped when the bucket is empty.

## Outbound commerce worker

Developer-backend delivery runs in Convex, outside the Fly request path. The
one-minute worker claims at most 25 rows per run, sends sequentially, gives each
request a 10-second total DNS/connect/response budget, and has no separate
worker-level deadline. A full pass can therefore run for roughly 250 seconds
plus storage and scheduling overhead even though a new pass is scheduled every
minute. Runs may overlap, but each row is claimed immediately before delivery;
its active `LEASE_MS` lease prevents another run from reclaiming it. The queue
rotates projects, and each project can register at most 10 destinations. Retries
back off to six hours, stop after 14 attempts, and a 20-failure circuit breaker
disables a destination, bounding load when a receiver is unavailable.

## Analytics rollups

Analytics run only in scheduled Convex mutations; no public request computes
them, and the dashboard reads the small rollup and cohort tables, one
environment at a time.

- **Daily rows.** The 10-minute cron picks at most 100 projects per tick. Each
  run stamps its start in its own mutation, then pages the `webhookEvents`
  received on the last 3 UTC days, then the counted-state subscriptions, and
  replaces those days' rows. An event page holds 400 rows: an Apple
  notification keeps its signed payload, about 20 KB, so a page stays under
  12.5 MiB of the 16 MiB a mutation may read even at 32 KB per event.
  Subscription pages hold 5,000 rows of about 1 KB. Google expirations without
  a trial flag, Play voided purchases, and Google subscription notifications
  without a Play-reported environment each add an alias lookup and a
  subscription read. Every page also reads the project's run status row.
- **Slices.** A wider run covers its window in 3-day slices, one after
  another. Each slice reads the events received from its first day until the
  run started, so it replaces its days with complete counts and a day is never
  incremented. An event is read once per slice that starts on or before the
  day it arrived: once in a regular run, up to 10 times and 5.5 on average in
  the 30-day rebuild, which also reads the counted-state subscriptions ten
  times. A catch-up from 7 days back reads its events about 1.7 times.
- **Failed runs.** A run that started without finishing is picked again after
  an hour, then after 2, 4, and so on up to 24 hours while it keeps failing.
  Each failed run in a row also halves both page sizes, down to 25 rows. The
  retry covers the unfinished run's window, and the older run's remaining
  pages stop when they see the newer start, so two runs never write at once.
- **Definitions rebuild.** When `ROLLUP_DEFINITIONS_VERSION` changes, each
  project's next run covers the retained 30 days once instead of 3.
- **Late-event catch-up.** Only when a run finds notifications that no
  finished run covered. It recomputes from the oldest such day, at most every
  6 hours per project.
- **Stats rebuild.** When `STATS_DEFINITIONS_VERSION` changes, each project's
  next rollup requests one `subscriptionStats` rebuild, retried at most every
  6 hours until it commits. The upgrade that excluded sandbox triggers this
  once per project. The rebuild pages subscriptions in creation order, 5,000
  per mutation, into one `subscriptionStatsRebuilds` row. Every subscription
  write that changes the live totals also reads that row (one indexed read)
  and, during a rebuild, updates it for rows the scan has passed, so a rebuild
  commits on its first pass however busy the project is.
- **Cohorts.** At most once a day per project: one paginated pass over its
  `subscriptions` and a replace of at most 24 months × 2 environments ×
  currencies rows.

Each applied store event also patches its subscription's analytics facts and,
when the first paid charge moves, at most two `webhookEvents` rows, inside the
mutation that already applies the event.

## Edge protection

Every publishable-key verification, product, payload, subscription-status,
entitlement, user-binding, and store-webhook ingress request passes an
in-memory token bucket before calling Convex:

- per API key: 600-request burst, 10 tokens/second;
- per source IP: 600-request burst, 5 tokens/second;
- per Fly process: 5,000-request burst, 100 tokens/second;
- payload catalog: a separate weighted limiter charges one token per requested
  product, so a 50-item body page costs 50 tokens.

Fly Proxy limits the complete HTTP service to 80 soft / 120 hard concurrent
requests per machine. Inside the app, purchase verification has a stricter
default of 8 in-flight handlers per API key, 16 per trusted source IP, and 32
per process. The key and source shares prevent simple key rotation from
occupying every shared verification slot from one network source.
When any axis reaches its configured limit, IAPKit returns `503 SERVICE_BUSY` with
`Retry-After` and `X-Concurrency-Scope` instead of retaining request bodies and
sockets in an unbounded queue. The slot is released in a `finally` block on
both normal responses and downstream errors; idle key entries are deleted.

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

These controls reduce the blast radius of buggy clients, traffic spikes, and
common resource-exhaustion attempts. They are defense in depth, not a guarantee
that a public endpoint is immune to DDoS. Operators may still block abusive
sources at the platform edge and should review Fly and Convex telemetry during
an incident.

The Convex deployment URL is public configuration, and the legacy public
`subscriptionStatus` / `entitlements` functions remain callable with a
publishable key for rolling-deploy and rollback compatibility. Such direct
Convex calls bypass Fly's in-memory limiter. Their reads are still indexed and
bounded, and the new evaluation snapshot exposes only stored-state entitlement
candidates plus one latest status fallback rather than raw subscription
history. This is a pre-existing, non-expanding residual risk; Convex usage
limits are the current process-independent cost brake. Remove the legacy direct
functions in a later coordinated major deployment after every old Fly binary
has drained.

Only the `Fly-Client-IP` header inserted by the current Fly ingress is trusted.
Forwarding and CDN headers supplied by callers are ignored. Direct local
requests without the Fly header share the bounded `unknown` IP bucket.

## HTTP cache behavior

Direct payload responses use an ETag scoped by API key, platform, product ID,
and payload version. A matching `If-None-Match` returns `304` without reading
the payload body row. The scope prevents an ETag from one project/key being
accepted for another.

Subscription status and entitlement responses use a content ETag scoped by API
key, route, and opaque user ID. A tag from another key, user, or route cannot
produce a `304`. Convex returns a time-independent, bounded row snapshot and
invalidates its cached query result whenever a dependent subscription row
changes. Fly evaluates `expiresAt` against its own current clock on every HTTP
request before comparing the tag. This prevents cached query results or
caller-controlled timestamps from preserving expired access and detects a
time-only expiration transition on the next refresh even when no webhook
arrives. Therefore a subscription `304` still costs one query invocation; when
Convex recomputes it, the indexed-read ceiling is the same as a `200`, while a
valid Convex cache hit may avoid those reads. The `304` itself avoids
response-body egress and unnecessary client state replacement.

The direct response sends `Cache-Control: private, no-cache` and
`Vary: Authorization`. The subscription snapshots use the same private,
revalidate-on-use policy. Catalog pages and every secret-admin response use
`private, no-store`; shared caches must never retain them. React Native IAP and
Expo IAP accept an AsyncStorage-compatible `clientPayloadCache`. They persist
the body, version, and ETag, return a valid cache entry without polling, and
conditionally revalidate only when `refresh: true` is requested.

Apps with a known product ID should use the direct endpoint. Do not download
the complete payload catalog on every foreground event. For entitlement state,
persist one user-scoped snapshot and conditionally refresh it on cold start,
when it is stale on foreground, or after explicit user action. Do not run a
continuous timer or rebuild the removed outbound event stream. Coalesce
concurrent callers through one in-app refresh coordinator. Define a maximum
stale age for offline or rate-limited fallback and fail closed after that
app-specific window.

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

One million user-scoped status or entitlement polls use one million Convex
function calls. Database I/O depends on the number and size of that user's
subscription rows: normal accounts read one or a few rows, while the bounded
pathological ceiling is 201 million small row reads across those requests.
Rate limiting is the primary protection against an app polling continuously;
`304` responses do not make that request free.

One million requests spread evenly across one day average approximately 11.6
requests/second, already above the hosted default per-key steady rate of 10
requests/second before peak clustering. High-volume consumers must reduce call
frequency, coordinate shared capacity before launch, or self-host with limits
sized from measured latency and peak concurrency.

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

No additional Fly machine, deployment, paid cache, or distributed rate-limit
service is introduced by these source guardrails. Increasing hosted capacity is
an explicit operational and funding decision rather than an automatic promise.
