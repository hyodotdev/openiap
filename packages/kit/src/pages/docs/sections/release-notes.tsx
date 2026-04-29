import { DocsPage } from "../components/DocsPage";

// Release entries — newest first. Treat this as the changelog
// canonical source: every shipped PR that touched production should
// land an entry here, dated with the deploy date (not the merge
// date). Versioning tracks `package.json` — IAPKit is still
// pre-2.x, so entries live in the 1.x range.
interface ReleaseEntry {
  version: string;
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
    version: "1.2.0",
    date: "2026-04-22",
    tagline: "IAPKit joins OpenIAP. API is now free for everyone, no paywall.",
    items: [
      {
        kind: "feature",
        text: "IAPKit is now an OpenIAP project. Receipt validation is free for every developer, no usage caps, no credit card required.",
      },
      {
        kind: "feature",
        text: "Community sponsorship replaces paid plans. If your team or company depends on IAPKit, support the project at openiap.dev/sponsors.",
      },
      {
        kind: "feature",
        text: "Domain migration: IAPKit now lives at kit.openiap.dev. The legacy iapkit.com domain will expire at the end of 2026 — update your bookmarks and production API endpoints.",
      },
      {
        kind: "feature",
        text: "Previous paying customers were migrated to the free tier automatically. Any remaining balance was refunded in full.",
      },
      {
        kind: "ops",
        text: "Dropped Stripe + paid plans entirely. Dashboard now has a single 'Usage' tab that shows monthly verifications and a sponsor nudge.",
      },
      {
        kind: "fix",
        text: "getOrganizationReceiptStats no longer walks project records — denormalized organizationId + by_organization index on purchaseStats removes the read-bytes limit warning seen on orgs with large Horizon/iOS config payloads.",
      },
    ],
  },
  {
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
        text: "Horizon App Secret is now write-only on the wire. `getProject` redacts it server-side; the dashboard shows 'Configured ✓ / Replace' instead of a prefilled password field.",
      },
      {
        kind: "feature",
        text: "In-dashboard documentation site (/docs) — replaces the external link for signed-in users.",
      },
      {
        kind: "feature",
        text: "Per-API-key rate limiting on /v1/purchase/verify (60-request burst, 1 req/sec steady) with X-RateLimit-* headers.",
      },
      {
        kind: "feature",
        text: "Structured request logging: one JSON line per verify with correlation id, hashed key, store, isValid, state, durationMs, statusCode.",
      },
      {
        kind: "feature",
        text: "Input size limits: jws ≤ 16 KB, purchaseToken ≤ 2 KB, userId/sku ≤ 256 — rejected at the edge before upstream store calls.",
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

const LATEST_VERSION = RELEASES[0].version;

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
            <li key={release.version}>
              <a
                href={`#v${release.version}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs hover:border-primary/50 hover:text-primary"
              >
                <span className="font-semibold">v{release.version}</span>
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
          <section
            key={release.version}
            id={`v${release.version}`}
            className="scroll-mt-8"
          >
            <details
              // Most recent release opens by default; older ones are
              // collapsed so a long list stays scannable. Users who
              // want everything expanded can toggle via the summary.
              open={release.version === LATEST_VERSION}
              className="group rounded-lg border border-border bg-card/30 open:bg-card/50"
            >
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 border-b border-transparent px-4 py-3 group-open:border-border [&::-webkit-details-marker]:hidden">
                <div className="flex flex-1 flex-wrap items-baseline gap-3">
                  <span className="font-mono text-lg font-bold">
                    v{release.version}
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
