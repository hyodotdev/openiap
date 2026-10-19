import { DocsPage } from "../components/DocsPage";

// Hosted changes are grouped by deployment week; legacy entries stay dated.
interface ReleaseEntry {
  id: string;
  version?: string;
  date: string; // Deploy date, YYYY-MM-DD
  weekStart?: string; // Monday in Asia/Seoul
  pullRequests?: number[];
  tagline: string;
  items: Array<{
    kind: "feature" | "fix" | "security" | "ops" | "docs";
    topic?: string;
    text: string;
  }>;
}

const CHANGE_GROUPS = [
  { title: "Improvements", kinds: ["feature", "docs"] },
  { title: "Fixes and security", kinds: ["fix", "security"] },
  { title: "Operations", kinds: ["ops"] },
] as const;

const RELEASES: ReleaseEntry[] = [
  {
    id: "week-2026-10-19",
    weekStart: "2026-10-19",
    date: "2026-10-19",
    pullRequests: [548],
    tagline:
      "API Keys dashboard readability, narrow-screen layout and an analytics error fix.",
    items: [
      {
        kind: "feature",
        topic: "Dashboard",
        text: "The API Keys list keeps each masked key on one line, uses consistent badges with aligned status, date and actions, and shows labeled cards with full actions on narrow screens. Long names and descriptions wrap readably, keyboard focus stays visible, and loading, empty and revoked states are unchanged.",
      },
      {
        kind: "fix",
        topic: "Analytics",
        text: "Browsers that still held session replays recorded before replay was turned off no longer raise a Mixpanel loading error on every page. The dashboard deletes those leftover replays from the browser; product analytics events are unchanged.",
      },
    ],
  },
  {
    id: "week-2026-10-12",
    weekStart: "2026-10-12",
    date: "2026-10-18",
    pullRequests: [523, 528, 532, 533, 537, 542, 544],
    tagline:
      "Amazon subscription lifecycle beta, purchase recovery tools, verified analytics and a security hardening pass.",
    items: [
      {
        kind: "ops",
        topic: "Analytics reads",
        text: "Revenue discovery now pages through historical inputs once and uses the existing run status for later ticks. New store events register their project atomically, avoiding repeated reads of signed webhook payloads. Rollup cadence, subscription expiry and late-event catch-up are unchanged. Edge budget guidance now accounts for every running or standby machine.",
      },
      {
        kind: "security",
        topic: "Organization consent",
        text: "Team invitations now wait for the invited account to accept before creating membership. Managers can withdraw pending invitations. Invitations can be declined, expire after seven days, and are checked again against the inviter's current permissions. Members can leave their organization in Settings; the last owner remains protected. Dashboard buttons and surfaces use the shared theme colors correctly.",
      },
      {
        kind: "feature",
        topic: "Verification",
        text: "Verify accepts includeTransactionDetails and returns the transaction ID, original transaction ID, expiry, environment, a correlation ID and whether a rejection is final (never for Meta Horizon or a Google subscription the store can still revive), to match a verification with commerce events. Responses without the flag are unchanged.",
      },
      {
        kind: "fix",
        topic: "Organization access",
        text: "Removing an organization member immediately stops that user's statistics query from reading the former organization's plan, usage and project count. A saved organization selection is checked against current membership, including profiles that already contain a stale selection. Organizations pending deletion no longer supply these statistics.",
      },
      {
        kind: "fix",
        topic: "Verification boundary",
        text: "Direct Convex verification actions and legacy aliases now require a short-lived proof from the admitted IAPKit server request. Public receipt verification still uses the same customer API keys and wire contract; service-source failures stay retryable. Self-hosted deployments must configure the private source credential in both services and use the coordinated rollout procedure.",
      },
      {
        kind: "ops",
        topic: "Deployment",
        text: "The locked Convex CLI fixes index checks that incorrectly required database-read permission during deployment. Scoped CI keys retain the documented code-deploy and environment-write permissions.",
      },
      {
        kind: "feature",
        topic: "Linking",
        text: "Secret-key bind-user links Apple and Google one-time purchases, including Google purchases awaiting acknowledgment, and returns a reason for each outcome. It never moves a purchase that another app user owns, and these links do not count toward the per-user link cap. An operator's secret-key rebind can move a one-time link; it reports notified: false, since one-time purchases send no commerce events.",
      },
      {
        kind: "security",
        topic: "Account access",
        text: "All subscription account reads and ownership binding now require a secret admin key, including legacy v1 and direct Convex calls. Publishable keys receive 403 INSUFFICIENT_SCOPE; legacy account paths containing a key return 410 LEGACY_ACCOUNT_ROUTE_RETIRED. Move shipped mobile helpers to an authenticated app backend using tokenless v2 reads. Never embed a secret key in the app. Authorized v1 server response fields are preserved and use no-store.",
      },
      {
        kind: "security",
        topic: "Test access",
        text: "V2 account reads accept an explicit production, sandbox or all environment filter and acknowledge it as environmentScope. Explicit filters exclude unknown historical environments; omission retains legacy mixed reads. The reference backend defaults to production-only access and applies its server-owned App Review/test-account allow-list during confirmation and later entitlement refresh. Missing verified environment or missing scope acknowledgement fails closed for retry instead of granting access.",
      },
      {
        kind: "feature",
        topic: "Purchase issues",
        text: "Verification and linking failures are recorded with a cause and correlation ID, viewable in the dashboard, secret-key routes and MCP. Product mismatches, pending payments and bind conflicts are kept per store-verified purchase and match its purchase page; other failures, including forged or unknown evidence, are counted per store and cause, so random input cannot flood the log.",
      },
      {
        kind: "feature",
        topic: "Operations",
        text: "Webhook deliveries keep their last 20 attempts and can be re-sent with the original event ID. Inbound store notifications are listed, and admins can re-sync an Apple or Google purchase or subscription from the store, using a rate limit separate from entitlement reads. A re-sync never repeats an access grant, and a store notification older than a re-sync keeps the re-synced state. Operator routes return 502 for store failures and 409 for deliveries that cannot be re-sent.",
      },
      {
        kind: "security",
        topic: "Dashboard",
        text: "Raw store evidence, subscription purchase tokens, inbound transaction IDs, raw delivery errors and destination descriptions are shown only to project owners and admins; members see a salted fingerprint, an error class or the destination host.",
      },
      {
        kind: "security",
        topic: "Privacy",
        text: "Session replay is disabled; event analytics remain enabled with identifying URL values redacted.",
      },
      {
        kind: "fix",
        topic: "Analytics",
        text: "Analytics, /v1/subscriptions/revenue and /v1/subscriptions/metrics now report production only by default, with a sandbox view on the dashboard and revenue route. Active totals no longer count a subscription twice when its state changes during a rollup. Stats rebuilds preserve active and grace-period totals through concurrent changes, linked-token merges and expiries; billing-period sync refreshes MRR. Free trials and refund reversals no longer count as revenue, billing recoveries count as renewals, refunds count once with store-reported amounts subtracted, churn counts only paid access that ended, Google plan changes are not new subscriptions or churn (immediate-charge changes count as renewals at list price), Apple promotional, offer-code and win-back offers are not trials, and an Apple resubscribe counts as a renewal unless it is the first charge after a lapsed trial.",
      },
      {
        kind: "ops",
        topic: "Analytics API",
        text: "/v1/subscriptions/revenue returns production data unless environment=sandbox is passed. newSubs, renewals, refunds, revenueMicros and activeSubs follow the corrected definitions, and the new expirations field counts paid access that ended; the Analytics page lists each change. Subscription metrics expose freshness and capped-scan flags; the dashboard hides incomplete headline totals and keeps its query range stable through live refreshes. Dashboard trial totals label partial recorded coverage and leave unknown values blank. MCP trial and paid-charge totals exclude rows without trial splits, report null when no rows qualify, and describe partial coverage per group. Missing refund amounts leave refunded and net totals unavailable in both views; recorded zeroes stay zero. An unknown API key on /v1/subscriptions/revenue or /v1/subscriptions/metrics now gets 400 INVALID_API_KEY, as documented, instead of empty results.",
      },
      {
        kind: "feature",
        topic: "Analytics",
        text: "Trial starts, trial conversions and direct paid starts are counted separately, with monthly retention and realized LTV cohorts. Bounded month-end and day-end access evidence preserves lapses, refunds and token replacements. Apple receipts first verified after expiry preserve their dated purchase-to-expiry period without granting current access; missing history shows as unavailable instead of a fabricated zero or retention rate. The dashboard and MCP label cohorts as project-wide within the selected environment and currency; date, product and platform filters apply only to daily metrics. Each metric shows, per environment, whether data is not collected, still processing or a real zero.",
      },
      {
        kind: "feature",
        topic: "Client payloads",
        text: "Client payloads have drafts, a preview of the exact app response, version history and rollback. A draft saved against an older version must be rebased before it can be published, API keys never see author emails, and history shows payloads published before it existed.",
      },
      {
        kind: "docs",
        topic: "Purchase flow",
        text: "A new Purchase flow guide splits the work between the SDK, IAPKit and your backend, with a tested reference handler.",
      },
      {
        kind: "fix",
        topic: "Google verification",
        text: "Google purchase verification and store-enriched subscription notifications preserve Sandbox or Production from verified store markers, allowing apps to isolate test purchases and lifecycle updates.",
      },
      {
        kind: "feature",
        topic: "Amazon subscriptions",
        text: "Signed Amazon RTN notifications refresh RVS before updating subscriptions. Configure the optional topic ARN and existing store lifecycle URL.",
      },
      {
        kind: "fix",
        topic: "Amazon subscriptions",
        text: "RVS verification and rechecks keep purchase and subscription state consistent. Disabling auto-renew retains verified access; renewalDate does not imply expiry.",
      },
      {
        kind: "ops",
        topic: "Amazon subscriptions",
        text: "Live SNS delivery and LAT renewal, cancellation, elapsed expiry and server entitlement revocation remain unverified. App Tester does not certify these transitions.",
      },
      {
        kind: "docs",
        topic: "Release history",
        text: "Updates deployed in the same week share one release entry, with related changes grouped by topic.",
      },
      {
        kind: "fix",
        topic: "Apple subscriptions",
        text: "Non-renewing passes no longer count as active subscriptions, including rows recorded before this fix; dashboard subscriber counts and MRR drop them once the daily stats recompute completes for the project. Grace periods are unaffected. Verifying an older renewal no longer rolls a subscription back to that period, and a verification fetched before a refund no longer undoes it. Verify responses are unchanged.",
      },
      {
        kind: "fix",
        topic: "Verification",
        text: "A Google Play, App Store (including its certificate checks) or Meta Horizon outage returns 503 with Retry-After and keeps the last confirmed purchase result instead of recording an invalid one.",
      },
      {
        kind: "security",
        topic: "Verification",
        text: "Failed App Store verifications are no longer stored as invalid purchases, so a forged JWS cannot overwrite or flood purchase records. Google Play errors no longer echo upstream or internal text.",
      },
      {
        kind: "fix",
        topic: "Rate limits",
        text: "One flooding IP no longer drains an app's per-key budget. Secret-key admin routes now share the limits of their URL-key forms.",
      },
      {
        kind: "security",
        topic: "Rate limits",
        text: "Verifications that fail IAPKit's own checks, such as an Apple JWS for another app or a store the project has not configured, return their own error without using the project's verification budget.",
      },
      {
        kind: "security",
        topic: "Headers",
        text: "Responses send nosniff, a referrer policy and HSTS in production, pages cannot be framed, and the /v1 API reference runs in a sandboxed origin that cannot read dashboard sign-in data.",
      },
      {
        kind: "security",
        topic: "Dashboard",
        text: "Only owners and admins can upload .p8 keys or change bundle and package IDs, App Store keys, and Amazon or Horizon secrets. Admins can no longer remove an owner.",
      },
      {
        kind: "fix",
        topic: "Dashboard",
        text: "A .p8 upload must be a P-256 private key and replaces the project's previous key. Verification signs with the key Settings shows, then with an organization key, preferring one with the same key ID, never another organization's. Cancelling a queued product sync frees the platform at once, and a sync that never starts expires.",
      },
      {
        kind: "security",
        topic: "Sign-in",
        text: "GitHub sign-in matches an existing account only by an email GitHub has verified. Profile records can no longer be written from the client.",
      },
      {
        kind: "security",
        topic: "MCP",
        text: "The hosted endpoint confirms the secret key before opening a session, always calls IAPKit itself, refuses redirects and bounds request and response sizes. One project holds at most 16 sessions, and a full table closes its least recently used session instead of refusing new ones.",
      },
      {
        kind: "security",
        topic: "MCP",
        text: "Local iapkit-mcp-http binds 127.0.0.1, rejects unknown Host headers, and requires a bearer on every request instead of using IAPKIT_API_KEY.",
      },
      {
        kind: "fix",
        topic: "MCP",
        text: "iapkit_manage_product rejects action disable with guidance. It previously marked the product Removed, which the next push sync deletes from the store.",
      },
      {
        kind: "ops",
        topic: "Commerce Protocol",
        text: "IAPKit passes the stricter conformance run: unknown store evidence is never bound for any store, and error extensions carry no evidence or internals.",
      },
    ],
  },
  {
    id: "week-2026-10-05",
    weekStart: "2026-10-05",
    date: "2026-10-11",
    pullRequests: [515, 520],
    tagline: "Verified Apple environments and clearer Amazon testing limits.",
    items: [
      {
        kind: "fix",
        topic: "Apple verification",
        text: "Apple receipt verification returns its verified Sandbox or Production environment, allowing apps to check provenance before finishing a transaction.",
      },
      {
        kind: "security",
        topic: "Sign-in",
        text: "Rejects invalid refresh-token and OAuth verifier IDs and redacts sensitive OAuth debug logs.",
      },
      {
        kind: "docs",
        topic: "Amazon testing",
        text: "Amazon testing guidance distinguishes App Tester simulation from Live App Testing. Renewal, timed expiry and server revocation remain unverified; discussion #522 records the follow-up criteria.",
      },
    ],
  },
  {
    id: "hosted-2026-08-27",
    date: "2026-08-27",
    tagline: "One offer-code flow across current OpenIAP SDKs.",
    items: [
      {
        kind: "docs",
        text: "The current SDK releases expose one openRedeemOfferCode call across Apple and Google. Keep purchase listeners active and verify redeemed transactions through the existing IAPKit flow.",
      },
      {
        kind: "docs",
        text: "Replace presentCodeRedemptionSheetIOS and openRedeemOfferCodeAndroid with openRedeemOfferCode before the platform-specific methods are removed in client-protocol@1.0.0.",
      },
    ],
  },
  {
    id: "hosted-2026-08-19",
    date: "2026-08-19",
    tagline: "Clearer product guidance and a complete operator reference.",
    items: [
      {
        kind: "docs",
        text: "IAPKit is now positioned consistently as optional OpenIAP infrastructure, with new guides for Amazon RVS, order lookup, store webhooks, version compatibility, fair use, and hosted-service data processing.",
      },
      {
        kind: "fix",
        text: "Creating an organization now opens its real dashboard instead of navigating to a removed onboarding route.",
      },
    ],
  },
  {
    id: "hosted-2026-08-16",
    date: "2026-08-16",
    tagline: "More reliable sign-in and post-deploy migrations.",
    items: [
      {
        kind: "fix",
        text: "A rejected email OTP or magic-link attempt no longer consumes the code, so users can correct the attempt without requesting another message.",
      },
      {
        kind: "ops",
        text: "Repeated migration starts now detect an already-running migration and return without competing with its active batches.",
      },
    ],
  },
  {
    id: "hosted-2026-08-15",
    date: "2026-08-15",
    tagline: "A smaller, pinned production container.",
    items: [
      {
        kind: "security",
        text: "The hosted runtime now uses a digest-pinned distroless Debian 12 image as a non-root user. The Bun build image is pinned by digest as well, reducing mutable supply-chain inputs and unnecessary runtime tools.",
      },
    ],
  },
  {
    id: "hosted-2026-08-14",
    date: "2026-08-14",
    tagline: "Project credential cards stay usable on narrow screens.",
    items: [
      {
        kind: "fix",
        text: "Long Apple and Google credential filenames, status text, and download or delete actions now wrap inside their Settings cards instead of overflowing on small screens.",
      },
    ],
  },
  {
    id: "hosted-2026-08-13",
    date: "2026-08-13",
    tagline:
      "Verify responses stay decodable by app builds compiled against an older SDK.",
    items: [
      {
        kind: "fix",
        text: "Every /v1/purchase/verify response is now validated against the published schema before it is sent. A value outside that schema is degraded rather than emitted: an unpublished state becomes UNKNOWN and an unreadable productId, environment, or clientPayload is dropped. isValid is never rewritten, so a metadata change cannot revoke an entitlement, and a verdict that cannot be made contract-valid returns 500 instead of a body no SDK can trust.",
      },
      {
        kind: "fix",
        text: "SDKs no longer fail a confirmed purchase over optional metadata. environment is forwarded as the opaque String the Client Protocol declares instead of being re-checked against Sandbox/Production, and a client payload whose format this build predates is dropped rather than thrown. The store echo and isValid typing stay strict.",
      },
      {
        kind: "ops",
        text: "The purchase-state, client-payload-format, and verify-store enums are declared in kit's Convex layer, its OpenAPI response docs, and the GraphQL schema every SDK generates from. bun audit:kit-contract compares all three and gates both CI and this deploy, so a kit-only enum change can no longer reach published apps unnoticed.",
      },
      {
        kind: "security",
        text: "The MCP endpoint now requires a secret project key, caps sessions, and applies source and process rate limits. Product tools return typed cursor pagination so assistants can traverse bounded catalog pages safely.",
      },
      {
        kind: "docs",
        text: "Version Compatibility documents what IAPKit guarantees to an app compiled against an older SDK: responses are additive, a breaking change would ship as /v2 while /v1 keeps serving, and unrecognised optional values degrade. Gate entitlement on isValid, treat state as a label, and never reject a verification because a value is unrecognised.",
      },
    ],
  },
  {
    id: "hosted-2026-08-13-entitlements",
    date: "2026-08-13",
    tagline:
      "Entitlement defects found by the new behavioral conformance suite.",
    items: [
      {
        kind: "fix",
        text: "A versioned behavioral conformance suite now binds protocol behaviors to real implementations, and the entitlement defects that binding surfaced are fixed. The type and API-surface contract was already drift-gated, but nothing verified what a declared symbol actually did.",
      },
    ],
  },
  {
    id: "hosted-2026-08-12",
    date: "2026-08-12",
    tagline:
      "Store verification integrity across Amazon, Horizon, and raw REST.",
    items: [
      {
        kind: "security",
        text: "Amazon RVS now requires an explicit project-level sandbox opt-in and carries first-class Sandbox / Production provenance, expected-product binding, and strict receipt identity and response validation. A bounded purchase-row reconciler preserves authoritative state across transient failures.",
      },
      {
        kind: "fix",
        text: "Raw REST verification persists only strict boolean verdicts and keeps the last confirmed snapshot across a transient or malformed store response. The unfinished Meta Horizon subscription reconciler is retired and its legacy synthetic metrics source quarantined.",
      },
      {
        kind: "feature",
        text: "Amazon expectedProductId and environment are wired through the GraphQL SSOT into Apple, Google, and every framework SDK, preserving published Kotlin constructor compatibility. Amazon and Horizon purchase counters were added with bounded migration support for existing self-hosted rows.",
      },
      {
        kind: "ops",
        text: "The Convex verifier tree is included in coverage behind separate server (90%) and Convex (48%) gates.",
      },
    ],
  },
  {
    id: "hosted-2026-08-11",
    date: "2026-08-11",
    tagline: "Production deploys verify their Convex target first.",
    items: [
      {
        kind: "ops",
        text: "The production deploy script verifies it is pointed at the production Convex deployment before publishing, and refuses a development target.",
      },
    ],
  },
  {
    id: "hosted-2026-08-07",
    date: "2026-08-07",
    tagline: "Product sync, verification, and MCP session correctness.",
    items: [
      {
        kind: "fix",
        text: "Google Play product sync converts the authored price into every Play region and writes each local currency, and reads before masked updates so existing regions, purchase options, and console-authored locales survive. App Store Connect sync, localized listings, and sales regions received the matching corrections.",
      },
      {
        kind: "fix",
        text: "MCP session routing and webhook lifecycle processing were corrected. This is phase 2 of the webhook idempotency work; later phases wait on legacy rows aging past the retention window.",
      },
    ],
  },
  {
    id: "hosted-2026-08-05",
    date: "2026-08-05",
    tagline: "Read-only order lookup for customer inquiries.",
    items: [
      {
        kind: "feature",
        text: "Paste an Apple or Google order id from a customer receipt and the dashboard returns the full order, plus current subscription status for subscription orders. Lookups are proxied live to the store APIs using the credentials the project already configured for verification; nothing is persisted or logged.",
      },
      {
        kind: "security",
        text: "Order lookup is gated on a dashboard session and organization membership and never accepts an API key. It is operator tooling, not part of the public /v1 surface.",
      },
    ],
  },
  {
    id: "hosted-2026-08-02",
    date: "2026-08-02",
    tagline: "Hosted capacity safeguards and safer Google Play catalog sync.",
    items: [
      {
        kind: "ops",
        text: "Verification now has bounded per-key, source-IP, and process concurrency in addition to rate and replay limits. Saturated requests return SERVICE_BUSY with Retry-After instead of queueing unbounded work, and capacity rejections do not consume replay budget.",
      },
      {
        kind: "fix",
        text: "Google Play one-time product sync now uses the canonical API path and maps Active, Draft, and Removed from purchase-option state. Missing or future store states fail closed instead of becoming sellable.",
      },
      {
        kind: "docs",
        text: "Hosted validation is documented as free shared infrastructure under fair-use safeguards, with explicit capacity planning and self-hosting guidance instead of paid plan quotas.",
      },
    ],
  },
  {
    id: "hosted-2026-07-31",
    date: "2026-07-31",
    tagline: "Deployments expose their public contract and revision safely.",
    items: [
      {
        kind: "ops",
        text: "GET /health now returns the v1 API contract, public Git revision, allowlisted environment, and timestamp without touching Convex or a store. Rolling shutdown drains in-flight API requests before exit.",
      },
    ],
  },
  {
    id: "hosted-2026-07-30",
    date: "2026-07-30",
    tagline: "Android package names preserve store identity exactly.",
    items: [
      {
        kind: "fix",
        text: "Project settings preserve the exact case of a Google Play package name and allow capitalization-only corrections. Changing a saved project to a different package identity remains blocked.",
      },
    ],
  },
  {
    id: "hosted-2026-07-28",
    date: "2026-07-28",
    tagline:
      "Conditional entitlement snapshots replace continuous app event streams.",
    items: [
      {
        kind: "feature",
        text: "Publishable-key subscription status and entitlement reads now return API-key, route, user, and content-scoped ETags. Matching If-None-Match requests return a body-free 304 after Convex supplies a database-invalidated row snapshot and Fly reevaluates expiry with its own current clock; secret-key responses remain no-store without an ETag.",
      },
      {
        kind: "ops",
        text: "Snapshot reads remain mutation-free, use the project-user-updated index, support 200 subscription rows with one bounded overflow probe, and fail closed instead of returning partial entitlements. Existing API-key, source-IP, and process rate limits still run before Convex.",
      },
      {
        kind: "docs",
        text: "The supported replacement for the removed outbound SSE feature is persisted snapshot state plus raw-HTTP conditional refresh on cold start, stale foreground, or explicit user action—not a raw webhook feed, WebSocket, long poll, or continuous timer. Offline fallback must have an app-defined maximum stale age.",
      },
    ],
  },
  {
    id: "hosted-2026-07-25",
    date: "2026-07-25",
    tagline:
      "Scoped mobile/admin keys, programmable client payloads, and safer operations.",
    items: [
      {
        kind: "security",
        text: "Projects now issue publishable openiap-kit_pk_ keys for shipped apps and secret openiap-kit_sk_ keys for MCP, CI, catalog writes, analytics, and store sync. Existing unclassified keys remain publishable so prior mobile builds keep verifying without gaining admin access.",
      },
      {
        kind: "security",
        text: "Secret keys are accepted only through Authorization headers. Secret-key-in-URL compatibility requests return 410, and rotating or deleting scoped keys can no longer reactivate the deprecated projects.apiKey fallback.",
      },
      {
        kind: "feature",
        text: "Secret-key REST and MCP automation can read, create, replace, and remove per-product TOML, JSON, or text client payloads. Editor-state reads expose the durable expectedVersion after deletion, and version conflicts retain their safe revision details.",
      },
      {
        kind: "feature",
        text: "Product client payloads remain public app-readable configuration: purchase verification or product reads can return them when explicitly requested, with a 16 KiB decoded UTF-8 limit and a bounded JSON envelope that still accepts fully escaped text.",
      },
      {
        kind: "ops",
        text: "Every public catalog is now cursor-paginated at 25 items by default and 50 maximum. Public API and store-webhook ingress use API-key, source-IP, process-wide, and weighted payload-page limits in bounded TTL/LRU memory before Convex, without adding a per-request usage mutation.",
      },
      {
        kind: "feature",
        text: "Direct payload reads now support project/key/product-scoped ETags and body-free 304 responses. React Native IAP and Expo IAP can persist the payload body, version, and ETag through an AsyncStorage-compatible cache and revalidate only on explicit refresh.",
      },
      {
        kind: "security",
        text: "Breaking SDK change: IAPKit keeps inbound Apple ASN v2 and Google RTDN processing but removes the outbound project event stream, replay queries, SDK webhook clients and hooks, and public generated webhook-event types. Apps use bounded verification and scoped reads; a developer backend owns any APNs or FCM delivery.",
      },
      {
        kind: "fix",
        text: "Apple ASN, Google RTDN, and Horizon reconciliation use source-aware lifecycle-event identity, preventing matching identifiers from colliding across projects or store sources.",
      },
      {
        kind: "feature",
        text: "App Store Connect push sync can validate and reuse a project review screenshot, prepare current IAP and subscription versions, and resume bounded review submissions with explicit manual-action states for Apple's first-IAP cases.",
      },
    ],
  },
  {
    id: "v1.2.0",
    version: "1.2.0",
    date: "2026-04-22",
    tagline: "IAPKit joins OpenIAP. Validation and analytics are now free.",
    items: [
      {
        kind: "feature",
        text: "IAPKit is now an OpenIAP project. Receipt validation and analytics are free for every developer, no credit card required.",
      },
      {
        kind: "feature",
        text: "Community sponsorship replaces paid validation plans. If your team or company depends on IAPKit, support the project at openiap.dev/sponsors.",
      },
      {
        kind: "ops",
        text: "AI-assisted workflows may later use separate usage-based pricing because model token costs are real infrastructure costs.",
      },
      {
        kind: "feature",
        text: "Domain migration: IAPKit now lives at kit.openiap.dev. The legacy iapkit.com domain will expire at the end of 2026 — update your bookmarks and production API endpoints.",
      },
      {
        kind: "feature",
        text: "Previous paying customers were migrated to free validation access automatically. Any remaining balance was refunded in full.",
      },
      {
        kind: "ops",
        text: "Dropped Stripe + paid validation plans. Dashboard now has a single 'Usage' tab that shows monthly verifications and a sponsor nudge.",
      },
      {
        kind: "fix",
        text: "getOrganizationReceiptStats no longer walks project records — denormalized organizationId + by_organization index on purchaseStats removes the read-bytes limit warning seen on orgs with large Horizon/iOS config payloads.",
      },
    ],
  },
  {
    id: "v1.1.0",
    version: "1.1.0",
    date: "2026-04-21",
    tagline: "Production hardening, Meta Horizon support, in-dashboard docs.",
    items: [
      {
        kind: "feature",
        text: 'Meta Horizon (Quest / VR) receipt validation: new `{ store: "horizon", userId, sku }` variant on /v1/purchase/verify, server-side verify via Meta Graph API verify_entitlement.',
      },
      {
        kind: "feature",
        text: "Project Settings: Horizon configuration sub-section inside the Android Configuration card, gated by a checkbox.",
      },
      {
        kind: "security",
        text: "Horizon App Secret is now write-only on the wire. `getProject` omits it server-side; the dashboard shows 'Configured ✓ / Replace' instead of a prefilled password field.",
      },
      {
        kind: "feature",
        text: "In-dashboard documentation site (/docs) — replaces the external link for signed-in users.",
      },
      {
        kind: "feature",
        text: "Per-API-key rate limiting on /v1/purchase/verify (600-request burst, 10 req/sec steady) with X-RateLimit-* headers.",
      },
      {
        kind: "feature",
        text: "Structured request logging: one JSON line per verify with correlation id, hashed key, store, isValid, state, durationMs, statusCode.",
      },
      {
        kind: "feature",
        text: "Input size limits: request body ≤ 32 KB, jws ≤ 16 KB, purchaseToken ≤ 2 KB, userId/sku ≤ 256 — rejected at the edge before upstream store calls.",
      },
      {
        kind: "feature",
        text: "Google Play verify_purchase calls now auto-retry transient 5xx + network errors with exponential backoff. 4xx still fails fast.",
      },
      {
        kind: "feature",
        text: "GET /health endpoint returns { ok: true } without hitting Convex.",
      },
      {
        kind: "ops",
        text: "Graceful shutdown via SIGTERM/SIGINT → Bun.serve().stop() drains in-flight verifies before the process exits. Fly.io deploys no longer cut connections mid-verify.",
      },
      {
        kind: "ops",
        text: "Sentry wired on both server (@sentry/bun) and SPA (@sentry/react) as separate projects. Default tracesSampleRate lowered to 0.05; /health transactions dropped.",
      },
      {
        kind: "fix",
        text: "Meta `grant_time` normalized to milliseconds on ingestion so it matches Apple `purchaseDate` / Google `purchaseDate` persisted units.",
      },
      {
        kind: "ops",
        text: "Project Settings page: fixed nested scroll that caused empty dark space below the last card.",
      },
      {
        kind: "docs",
        text: "Release notes, API reference, per-store setup guides, operations runbook all ship inside the dashboard.",
      },
    ],
  },
  {
    id: "v1.0.0",
    version: "1.0.0",
    date: "2024-10-05",
    tagline: "Initial public release.",
    items: [
      {
        kind: "feature",
        text: "Apple StoreKit 2 JWS receipt verification with App Store Server API integration.",
      },
      {
        kind: "feature",
        text: "Google Play purchase token verification via Android Publisher v3 (products + subscriptionsv2).",
      },
      {
        kind: "feature",
        text: "Multi-tenant dashboard: organizations, projects, per-project API keys.",
      },
      {
        kind: "feature",
        text: "Stripe billing — Developer / Pro / Enterprise tiers with monthly request quotas.",
      },
      {
        kind: "feature",
        text: "Email OTP (Resend) + GitHub OAuth sign-in via @convex-dev/auth.",
      },
      {
        kind: "feature",
        text: "OpenAPI spec auto-generated by hono-openapi, Redoc served at /v1.",
      },
      {
        kind: "feature",
        text: "Harmonized purchase state lifecycle across Apple + Google (ENTITLED / PENDING / CANCELED / …).",
      },
    ],
  },
];

const LATEST_RELEASE_ID = RELEASES[0].id;

export default function ReleaseNotesPage() {
  return (
    <DocsPage
      slug="release-notes"
      title="Release notes"
      description="Weekly hosted changes, newest first."
    >
      <p>
        Hosted IAPKit changes are grouped into Monday–Sunday weeks in Korea
        time. Later changes in the same week update that entry, grouped by
        topic. Weeks without deployed changes are omitted. Older dated entries
        remain available for reference.
      </p>

      <nav
        aria-label="Release index"
        className="my-8 rounded-lg border border-border bg-card/30 p-4"
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Jump to week or release
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {RELEASES.map((release) => (
            <li key={release.id}>
              <a
                href={`#${release.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs hover:border-primary/50 hover:text-primary"
              >
                <span className="font-semibold">
                  {release.version
                    ? `v${release.version}`
                    : formatDate(release.weekStart ?? release.date)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 space-y-6">
        {RELEASES.map((release) => (
          <section key={release.id} id={release.id} className="scroll-mt-8">
            <details
              open={release.id === LATEST_RELEASE_ID}
              className="group rounded-lg border border-border bg-card/30 open:bg-card/50"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-3 border-b border-transparent px-4 py-3 group-open:border-border [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-3">
                  <span className="font-mono text-lg font-bold">
                    {release.version
                      ? `v${release.version}`
                      : release.weekStart
                        ? "Week of"
                        : "Hosted update"}
                  </span>
                  <time
                    dateTime={release.weekStart ?? release.date}
                    className="text-sm text-muted-foreground"
                  >
                    {formatDate(release.weekStart ?? release.date)}
                  </time>
                  <span className="text-sm text-muted-foreground">
                    — {release.tagline}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  <span className="group-open:hidden">Expand</span>
                  <span className="hidden group-open:inline">Collapse</span>
                </span>
              </summary>
              <div className="space-y-5 px-4 py-4">
                {releaseGroups(release).map(({ title, items }) => {
                  if (!items.length) return null;
                  return (
                    <section key={title}>
                      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
                      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
                        {items.map((item, index) => (
                          <li key={index}>{item.text}</li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
                {release.pullRequests && (
                  <p className="flex flex-wrap gap-3 text-sm">
                    {release.pullRequests.map((number) => (
                      <a
                        key={number}
                        href={`https://github.com/hyodotdev/openiap/pull/${number}`}
                        className="text-primary underline underline-offset-4"
                      >
                        PR #{number}
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </details>
          </section>
        ))}
      </div>
    </DocsPage>
  );
}

function releaseGroups(release: ReleaseEntry) {
  if (release.weekStart) {
    const topics = [...new Set(release.items.map((item) => item.topic))];
    return topics.map((topic) => ({
      title: topic ?? "Other updates",
      items: release.items.filter((item) => item.topic === topic),
    }));
  }
  return CHANGE_GROUPS.map((group) => ({
    title: group.title,
    items: release.items.filter((item) =>
      group.kinds.some((kind) => kind === item.kind),
    ),
  }));
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
