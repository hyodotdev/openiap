import { DocsPage } from "../components/DocsPage";

// Release entries — newest first. Treat this as the changelog
// canonical source: every shipped PR that touched production should
// land an entry here, dated with the deploy date (not the merge
// date). Hosted updates have no installable package version; older
// version labels remain as historical release identifiers.
interface ReleaseEntry {
  id: string;
  version?: string;
  date: string; // YYYY-MM-DD
  tagline: string;
  items: Array<{
    kind: "feature" | "fix" | "security" | "ops" | "docs";
    text: string;
  }>;
}

const KIND_STYLES: Record<ReleaseEntry["items"][number]["kind"], string> = {
  feature:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  fix: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  security: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  ops: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  docs: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const RELEASES: ReleaseEntry[] = [
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
        text: "SDKs no longer fail a confirmed purchase over optional metadata. environment is forwarded as the opaque String the spec declares instead of being re-checked against Sandbox/Production, and a client payload whose format this build predates is dropped rather than thrown. The store echo and isValid typing stay strict.",
      },
      {
        kind: "ops",
        text: "The purchase-state, client-payload-format, and verify-store enums are declared in kit's Convex layer, its OpenAPI response docs, and the GraphQL schema every SDK generates from. bun audit:kit-contract compares all three and gates both CI and this deploy, so a kit-only enum change can no longer reach published apps unnoticed.",
      },
      {
        kind: "feature",
        text: "Native verification requests send X-OpenIAP-Spec with the OpenIAP spec version the build was compiled against, and kit records it on the structured verify log line. The value is shape-checked and bounded, and nothing branches on it: a client cannot change how its receipt is verified by claiming a version.",
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
        text: "A versioned behavioral conformance suite now binds spec behaviors to real implementations, and the entitlement defects that binding surfaced are fixed. The type and API-surface contract was already drift-gated, but nothing verified what a declared symbol actually did.",
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
      description="Every release that touched this deployment, newest first."
    >
      <p>
        Every entry here corresponds to a merged PR that landed on the live{" "}
        <code>kit.openiap.dev</code> machine. The date is the deploy date, not
        the PR merge date — in practice they're the same day for IAPKit since CI
        auto-deploys on push to <code>main</code>.
      </p>

      {/* Sticky-ish version index at the top. Cheap, scales to many
          releases without pagination — skim down to find the
          version, click to expand or anchor-jump. */}
      <nav
        aria-label="Release index"
        className="my-8 rounded-lg border border-border bg-card/30 p-4"
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Jump to version
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {RELEASES.map((release) => (
            <li key={release.id}>
              <a
                href={`#${release.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs hover:border-primary/50 hover:text-primary"
              >
                <span className="font-semibold">
                  {release.version ? `v${release.version}` : "Hosted update"}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(release.date)}
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
              // Most recent release opens by default; older ones are
              // collapsed so a long list stays scannable. Users who
              // want everything expanded can toggle via the summary.
              open={release.id === LATEST_RELEASE_ID}
              className="group rounded-lg border border-border bg-card/30 open:bg-card/50"
            >
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 border-b border-transparent px-4 py-3 group-open:border-border [&::-webkit-details-marker]:hidden">
                <div className="flex flex-1 flex-wrap items-baseline gap-3">
                  <span className="font-mono text-lg font-bold">
                    {release.version ? `v${release.version}` : "Hosted update"}
                  </span>
                  <time className="text-sm text-muted-foreground">
                    {formatDate(release.date)}
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
              <ul className="space-y-2 px-4 py-4">
                {release.items.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-3"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_STYLES[item.kind]}`}
                    >
                      {item.kind}
                    </span>
                    <span className="flex-1 text-sm leading-relaxed text-foreground/90">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>
    </DocsPage>
  );
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
