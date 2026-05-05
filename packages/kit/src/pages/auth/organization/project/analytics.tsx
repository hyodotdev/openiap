import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Select } from "antd";
import {
  BarChart3,
  TrendingUp,
  Users,
  RefreshCw,
  AlertCircle,
  Activity,
  Webhook,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

type ProjectContext = { project: Doc<"projects"> };

type Platform = "IOS" | "Android";
type PlatformFilter = "all" | Platform;

const DAY_MS = 86_400_000;

// Stable empty defaults. The kickoff render before `useQuery`
// returns has `metrics === undefined`; we still need to invoke
// every memo in the same order on that render so React's
// rules-of-hooks stay satisfied. Sharing these constants keeps the
// memo dependency identity stable across renders so the memos
// don't recompute when the empty defaults are passed in.
const EMPTY_DAYS: ReadonlyArray<{
  day: string;
  currency: string;
  productId: string;
  platform: Platform;
  activeSubs: number;
  newSubs: number;
  renewals: number;
  cancellations: number;
  refunds: number;
  revenueMicros: number;
}> = [];
const EMPTY_STRINGS: ReadonlyArray<string> = [];

const RANGES = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

type PlatformCardKey = "all" | "ios" | "android";

const PLATFORM_CARDS: Array<{
  key: PlatformCardKey;
  label: string;
  accent: string;
  filter: PlatformFilter;
}> = [
  {
    key: "all",
    label: "All platforms",
    accent: "from-violet-500/10 to-transparent",
    filter: "all",
  },
  {
    key: "ios",
    label: "App Store",
    accent: "from-blue-500/10 to-transparent",
    filter: "IOS",
  },
  {
    key: "android",
    label: "Google Play",
    accent: "from-green-500/10 to-transparent",
    filter: "Android",
  },
];

export default function ProjectAnalytics() {
  const { project } = useOutletContext<ProjectContext>();
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const webhooksHref =
    orgSlug && projectSlug
      ? `/${orgSlug}/project/${projectSlug}/webhooks`
      : null;
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const [periodId, setPeriodId] = useState<PeriodId>("daily");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1];
  const MAX_RANGE_DAYS = RANGES[RANGES.length - 1].days;

  // Always fetch the largest range so flipping the range chiclet
  // doesn't trigger a Convex refetch — we slice the result
  // client-side. UTC-day boundaries are computed in the browser to
  // keep the rollup table read-side consistent with the cron's
  // writes (both use UTC); using local-day here would cause the
  // chart's first/last column to half-cover when the user's tz is
  // far from UTC, surfacing as a "missing yesterday" off-by-one.
  //
  // `now` is held in state and refreshed every minute so a user who
  // leaves the dashboard open across a UTC midnight rollover gets a
  // re-render that picks up the new day. `useMemo` keys on `now`,
  // but `utcDayKey(now)` only changes once per day, so the chart
  // doesn't refetch every minute — Convex's `useQuery` deep-equals
  // the args object, and the day-key string is stable inside the
  // same UTC day.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { maxFromDay, toDay } = useMemo(() => {
    const today = utcDayKey(now);
    const from = utcDayKey(now - (MAX_RANGE_DAYS - 1) * DAY_MS);
    return { maxFromDay: from, toDay: today };
  }, [now, MAX_RANGE_DAYS]);

  // Per-range start day, derived without re-querying. Slicing the
  // unfiltered fetch in JS keeps the page below from flashing on
  // range/period clicks; only the bottom (charts + summary cards)
  // re-derives.
  const fromDay = useMemo(
    () => utcDayKey(now - (range.days - 1) * DAY_MS),
    [now, range],
  );

  // Fetch unfiltered for the maximum range — all filtering (range,
  // platform, product, currency, period) happens client-side below.
  // Two reasons:
  //   1. Filter clicks must NOT trigger a Convex refetch (the prior
  //      flicker the user reported was useQuery's stale→pending
  //      transition rebuilding the whole subtree).
  //   2. The platform cards always show the full breakdown
  //      (All / iOS / Android), regardless of which filter is
  //      active — so the cards need the unfiltered data anyway.
  const metrics = useQuery(api.subscriptions.query.getRevenueMetrics, {
    apiKey: project.apiKey,
    fromDay: maxFromDay,
    toDay,
  });

  // The loading-state early return has to live below ALL hooks so
  // React's rules-of-hooks (every hook called in the same order on
  // every render) stays satisfied — the memos below would
  // otherwise be conditional on `metrics !== undefined`. We work
  // off a stable empty default until the real data arrives, then
  // bail to `<PageLoading />` after the hooks have been registered.
  const metricsDays = metrics?.days ?? EMPTY_DAYS;
  const metricsCurrencies = metrics?.currencies ?? EMPTY_STRINGS;

  // Multi-currency projects: we always pin to a single currency for
  // chart rendering because revenueMicros can't be summed across
  // currencies without an FX rate. `selectedCurrency` resolves to
  // the explicit user choice, falling back to the first available
  // currency. The currency selector below is REQUIRED (not
  // clearable) when multiple currencies exist so a user can never
  // end up in the broken "no currency selected, sum across all"
  // state — otherwise the totals would mix USD + EUR + JPY into a
  // single number labeled with one currency code.
  //
  // Empty-project case (no rollup rows yet) leaves both
  // `selectedCurrency` and `metricsCurrencies[0]` undefined; we
  // resolve to "" deliberately and let the `EmptyState` below take
  // over rendering — the chart subtree is gated on
  // `metricsDays.length > 0` so a "" currency never reaches the
  // axis labels.
  const currency =
    selectedCurrency ??
    (metricsCurrencies.length > 0 ? metricsCurrencies[0] : "");

  // Client-side filtering. Range is also a client filter now (we
  // fetched the max range above), so flipping range chiclets stays
  // free — only the chart subtree re-derives. We always filter by
  // `currency` (the resolved value above), not `selectedCurrency`,
  // so the default-currency case still produces a single-currency
  // chart on multi-currency projects.
  //
  // We deliberately KEEP rows older than `fromDay` in `filteredRows`
  // (only attribute / range filters are applied here). `aggregateByDay`
  // uses those older rows to seed the `activeSubs` carry-forward at
  // the start of the chart — without them, a project with active
  // subscriptions but no events in the selected range would dip
  // visually to zero on the first day.
  //
  // Memoised so the per-minute `now` tick (which only changes
  // `fromDay` / `toDay` once per UTC day) doesn't re-run the full
  // filter / aggregate / bucket pipeline on every render.
  const filteredRows = useMemo(
    () =>
      metricsDays.filter((row) => {
        if (currency && row.currency !== currency) return false;
        if (selectedProduct && row.productId !== selectedProduct) return false;
        if (platformFilter !== "all" && row.platform !== platformFilter) {
          return false;
        }
        return true;
      }),
    [metricsDays, currency, selectedProduct, platformFilter],
  );

  const dailySeries = useMemo(
    () => aggregateByDay(filteredRows, range.days, fromDay),
    [filteredRows, range.days, fromDay],
  );
  const series = useMemo(
    () => bucketByPeriod(dailySeries, periodId),
    [dailySeries, periodId],
  );

  const totals = useMemo(
    () =>
      series.reduce(
        (acc, row) => {
          acc.newSubs += row.newSubs;
          acc.renewals += row.renewals;
          acc.cancellations += row.cancellations;
          acc.refunds += row.refunds;
          acc.revenueMicros += row.revenueMicros;
          acc.activeSubsLast = row.activeSubs;
          return acc;
        },
        {
          newSubs: 0,
          renewals: 0,
          cancellations: 0,
          refunds: 0,
          revenueMicros: 0,
          activeSubsLast: 0,
        },
      ),
    [series],
  );

  // Churn = (cancellations + refunds) / activeSubs at end of window.
  // Same definition Stripe / RevenueCat surface in their headline
  // dashboards. Guard against div-by-zero on a pre-revenue project.
  const churnRate =
    totals.activeSubsLast > 0
      ? ((totals.cancellations + totals.refunds) / totals.activeSubsLast) * 100
      : 0;

  // Platform-card totals: one filter pass over `metrics.days`
  // (without platform narrowing — the cards ARE the platform
  // breakdown), then `totalsForPlatform` for each card variant.
  // The prior implementation did this filter and `totalsForPlatform`
  // walk three times *per render* inside `PLATFORM_CARDS.map`
  // because of the per-minute `now` tick. Memoising collapses that
  // to one filter + three small reductions, only re-running when a
  // filter the cards actually depend on changes.
  const platformTotals = useMemo(() => {
    const baseRows = metricsDays.filter((row) => {
      if (row.day < fromDay) return false;
      if (currency && row.currency !== currency) return false;
      if (selectedProduct && row.productId !== selectedProduct) return false;
      return true;
    });
    const byFilter = new Map<
      PlatformFilter,
      { revenueMicros: number; activeSubs: number; newSubs: number }
    >();
    for (const card of PLATFORM_CARDS) {
      byFilter.set(
        card.filter,
        totalsForPlatform(baseRows, card.filter, currency),
      );
    }
    return byFilter;
  }, [metricsDays, fromDay, currency, selectedProduct]);

  if (metrics === undefined) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Revenue and subscription lifecycle metrics, rolled up from ingested
          webhook events. Refreshed every ~10 minutes on a trailing 3-day window
          — late Apple ASN v2 / Google RTDN notifications fold into their
          correct day automatically.
        </p>
      </div>

      {/* Webhook prerequisite callout. Verify alone doesn't tell IAPKit
          when a renewal/cancel/refund happens — only Apple ASN v2 /
          Google RTDN do — so a project without webhooks set up will
          forever see an empty chart. Surface this prominently above
          the data so the empty-state isn't ambiguous. */}
      <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
        <Webhook className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium mb-1">
            Analytics requires Apple ASN v2 / Google RTDN webhooks
          </p>
          <p className="text-muted-foreground">
            Without webhook integration this page will stay empty —{" "}
            <code className="text-xs">/v1/purchase/verify</code> alone doesn't
            tell IAPKit when renewals, cancellations, or refunds happen.{" "}
            {webhooksHref && (
              <Link
                to={webhooksHref}
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Open Webhooks tab <ArrowRight className="w-3 h-3" />
              </Link>
            )}{" "}
            ·{" "}
            <Link to="/docs/analytics" className="text-primary hover:underline">
              Read the setup guide
            </Link>
          </p>
        </div>
      </div>

      {metrics.truncated && (
        // Server hit `REVENUE_SCAN_CAP` on the rollup scan, so the
        // chart below is showing a partial view of the requested
        // range. Surface this so an operator doesn't read flat
        // numbers as a real revenue trough — they're a query-budget
        // truncation, not a business signal.
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium mb-1">Analytics partially loaded</p>
            <p className="text-muted-foreground">
              This range exceeded the per-query scan limit. Numbers below cover
              the most-recent slice of the window; tighten the range (7d / 30d)
              to load every row, or narrow by product / currency.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORM_CARDS.map((card) => {
          const active = platformFilter === card.filter;
          const cardTotals = platformTotals.get(card.filter) ?? {
            revenueMicros: 0,
            activeSubs: 0,
            newSubs: 0,
          };
          return (
            <div
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => setPlatformFilter(card.filter)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPlatformFilter(card.filter);
                }
              }}
              className={cn(
                "bg-card border rounded-xl p-4 shadow-sm relative overflow-hidden cursor-pointer transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50",
              )}
              aria-pressed={active}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none",
                  card.accent,
                )}
              />
              <div className="relative">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-semibold mt-2 tabular-nums">
                  {formatMicros(cardTotals.revenueMicros, currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cardTotals.activeSubs} active · {cardTotals.newSubs} new
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <ChicletGroup
          options={RANGES.map((r) => ({ id: r.id, label: r.label }))}
          value={rangeId}
          onChange={(v) => setRangeId(v as RangeId)}
        />
        <ChicletGroup
          options={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          value={periodId}
          onChange={(v) => setPeriodId(v as PeriodId)}
        />
        {metrics.productIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Product:</span>
            <Select
              value={selectedProduct ?? undefined}
              onChange={(v) => setSelectedProduct(v || null)}
              placeholder="All products"
              allowClear
              className="min-w-[200px]"
              options={metrics.productIds.map((id) => ({
                value: id,
                label: id,
              }))}
            />
          </div>
        )}
        {metrics.currencies.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Currency:</span>
            {/* No allowClear: revenue can't be summed across
                currencies without an FX rate, so the chart must
                always be pinned to exactly one. We surface the
                first available currency as the default rather
                than letting the user end up in a "no currency,
                sum across" state where amounts would be wrong. */}
            <Select
              value={currency || undefined}
              onChange={(v) => setSelectedCurrency(v ?? null)}
              className="min-w-[100px]"
              options={metrics.currencies.map((c) => ({ value: c, label: c }))}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Revenue"
          value={formatMicros(totals.revenueMicros, currency)}
        />
        <SummaryCard
          icon={Users}
          label="Active subs"
          value={totals.activeSubsLast.toString()}
        />
        <SummaryCard
          icon={Users}
          label="New subs"
          value={totals.newSubs.toString()}
        />
        <SummaryCard
          icon={RefreshCw}
          label="Renewals"
          value={totals.renewals.toString()}
        />
        <SummaryCard
          icon={Activity}
          label="Churn"
          value={`${churnRate.toFixed(1)}%`}
        />
      </div>

      {metrics.days.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue"
            subtitle={`Initial purchases + renewals${currency ? ` · ${currency}` : ""}`}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => formatMicros(v, currency, true)}
                />
                <Tooltip
                  formatter={(value: number) => formatMicros(value, currency)}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="revenueMicros"
                  name="Revenue"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Active subscriptions"
            subtitle="End-of-period snapshot"
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="activeSubs"
                  name="Active"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="New + renewed subs"
            subtitle="Transaction count per period"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="newSubs" stackId="a" name="New" fill="#3b82f6" />
                <Bar
                  dataKey="renewals"
                  stackId="a"
                  name="Renewals"
                  fill="#8b5cf6"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Cancellations + refunds"
            subtitle="User-canceled + store-issued refunds"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="cancellations"
                  stackId="a"
                  name="Canceled"
                  fill="#f59e0b"
                />
                <Bar
                  dataKey="refunds"
                  stackId="a"
                  name="Refunded"
                  fill="#ef4444"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Churn rate"
            subtitle="(cancellations + refunds) / active, %"
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="churnPct"
                  name="Churn"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

function ChicletGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  // Active state: primary-bordered card on top of the muted track.
  // Hover state on inactive options: muted fill + foreground text.
  // Both are now visually distinct in both light and dark modes —
  // the prior bg-card vs bg-muted/40 combo collapsed to identical
  // gray on dark, which is what the user reported.
  return (
    <div className="inline-flex gap-1 bg-muted/40 rounded-lg p-1 border border-border">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
            value === opt.id
              ? "bg-card text-foreground border-primary shadow-sm"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-border rounded-lg bg-card p-12 text-center">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm font-medium mb-1">No data yet for this range</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Analytics roll up daily from ingested Apple ASN v2 / Google RTDN webhook
        events. Once your first webhook arrives, the next cron tick (within 10
        min) will populate this view.
      </p>
    </div>
  );
}

// Aggregate the per-currency / per-product / per-platform rollup rows
// the query returns into a single per-day series. The query has
// already filtered by the user's selected currency / product /
// platform, so summation here is safe — we're collapsing
// multi-row days into one chart row.
type DailyRow = {
  day: string;
  activeSubs: number;
  newSubs: number;
  renewals: number;
  cancellations: number;
  refunds: number;
  revenueMicros: number;
};

function aggregateByDay(
  rows: Array<DailyRow>,
  rangeDays: number,
  fromDay: string,
): Array<DailyRow & { dayKey: string }> {
  const byDay = new Map<string, DailyRow>();
  for (const row of rows) {
    const existing = byDay.get(row.day);
    if (existing) {
      existing.activeSubs += row.activeSubs;
      existing.newSubs += row.newSubs;
      existing.renewals += row.renewals;
      existing.cancellations += row.cancellations;
      existing.refunds += row.refunds;
      existing.revenueMicros += row.revenueMicros;
    } else {
      byDay.set(row.day, { ...row });
    }
  }
  const fromTs = Date.parse(`${fromDay}T00:00:00.000Z`);
  const result: Array<DailyRow & { dayKey: string }> = [];

  // Seed `lastActive` from the most-recent pre-`fromDay` snapshot
  // so a project with active subs but no events in the selected
  // range doesn't visibly dip to zero on the first chart day. The
  // caller passes through pre-range rows for exactly this reason;
  // pick the latest one whose day is strictly older than `fromDay`.
  let lastActive = 0;
  let seedDay = "";
  for (const [day, row] of byDay) {
    if (day >= fromDay) continue;
    if (day > seedDay) {
      seedDay = day;
      lastActive = row.activeSubs;
    }
  }

  for (let i = 0; i < rangeDays; i++) {
    const dayKey = utcDayKey(fromTs + i * DAY_MS);
    const entry = byDay.get(dayKey);
    if (entry) {
      lastActive = entry.activeSubs;
      result.push({ ...entry, dayKey });
    } else {
      // Carry the prior activeSubs forward (no event = no churn that
      // period). For event-driven counters a no-event period is
      // genuinely zero.
      result.push({
        day: dayKey,
        dayKey,
        activeSubs: lastActive,
        newSubs: 0,
        renewals: 0,
        cancellations: 0,
        refunds: 0,
        revenueMicros: 0,
      });
    }
  }
  return result;
}

// Bucket the daily series into the selected period (Daily / Weekly /
// Monthly). Weekly buckets are ISO week (Mon-Sun). Monthly buckets
// are calendar month. Aggregation rules:
// - Sum: newSubs / renewals / cancellations / refunds / revenueMicros
// - End-of-period snapshot: activeSubs (last day's value in each bucket)
//
// Active subs is NOT summed across days — that would inflate by N.
function bucketByPeriod(
  daily: Array<DailyRow & { dayKey: string }>,
  period: PeriodId,
): Array<DailyRow & { label: string; churnPct: number }> {
  if (period === "daily") {
    return daily.map((row) => ({
      ...row,
      label: row.dayKey.slice(5), // MM-DD
      churnPct:
        row.activeSubs > 0
          ? ((row.cancellations + row.refunds) / row.activeSubs) * 100
          : 0,
    }));
  }

  const buckets = new Map<
    string,
    {
      label: string;
      sortKey: string;
      newSubs: number;
      renewals: number;
      cancellations: number;
      refunds: number;
      revenueMicros: number;
      activeSubsLast: number;
      activeSubsLastDay: string;
    }
  >();

  for (const row of daily) {
    const {
      bucketKey: key,
      label,
      sortKey,
    } = bucketLabelFor(row.dayKey, period);
    const existing = buckets.get(key) ?? {
      label,
      sortKey,
      newSubs: 0,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 0,
      activeSubsLast: 0,
      activeSubsLastDay: "",
    };
    existing.newSubs += row.newSubs;
    existing.renewals += row.renewals;
    existing.cancellations += row.cancellations;
    existing.refunds += row.refunds;
    existing.revenueMicros += row.revenueMicros;
    if (row.dayKey >= existing.activeSubsLastDay) {
      existing.activeSubsLast = row.activeSubs;
      existing.activeSubsLastDay = row.dayKey;
    }
    buckets.set(key, existing);
  }

  const sorted = Array.from(buckets.values()).sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey),
  );
  return sorted.map((b) => ({
    day: b.label,
    dayKey: b.sortKey,
    label: b.label,
    activeSubs: b.activeSubsLast,
    newSubs: b.newSubs,
    renewals: b.renewals,
    cancellations: b.cancellations,
    refunds: b.refunds,
    revenueMicros: b.revenueMicros,
    churnPct:
      b.activeSubsLast > 0
        ? ((b.cancellations + b.refunds) / b.activeSubsLast) * 100
        : 0,
  }));
}

// Compute (bucketKey, label, sortKey) for a given day. sortKey
// guarantees chronological order across years; label is the
// short user-facing string drawn on the chart's x-axis.
function bucketLabelFor(
  dayKey: string,
  period: PeriodId,
): { bucketKey: string; label: string; sortKey: string } {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  if (period === "weekly") {
    // Start of ISO week (Monday). UTC day 1=Mon … 0=Sun.
    const weekday = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const monday = new Date(date.getTime() - weekday * DAY_MS);
    const key = utcDayKey(monday.getTime());
    return {
      bucketKey: key,
      label: `wk ${key.slice(5)}`, // wk MM-DD (Mon)
      sortKey: key,
    };
  }
  // Monthly
  const month = dayKey.slice(0, 7); // YYYY-MM
  return {
    bucketKey: month,
    label: month,
    sortKey: `${month}-01`,
  };
}

// Per-platform totals for the platform cards. Run on the unaggregated
// `metrics.days` so the card numbers stay correct regardless of the
// selected platform filter (the cards ARE the filter — they always
// show the breakdown). `currency` is just for display formatting; the
// rows have already been filtered to the selected currency upstream.
function totalsForPlatform(
  rows: Array<{
    platform: Platform;
    activeSubs: number;
    newSubs: number;
    revenueMicros: number;
    day: string;
  }>,
  filter: PlatformFilter,
  _currency: string,
): { revenueMicros: number; activeSubs: number; newSubs: number } {
  const matching =
    filter === "all" ? rows : rows.filter((r) => r.platform === filter);
  // For activeSubs, sum every product/currency row that lands on the
  // most recent day per platform. The rollup table is keyed by
  // `(day, productId, currency, platform)`, so a multi-product
  // project has multiple rows for the same day+platform — keeping
  // only the first row encountered (the prior bug) silently
  // undercounted projects with >1 product. Summing across days
  // would inflate by N, so we still take only the LAST day's snapshot
  // per platform.
  const lastByPlatform = new Map<Platform, { day: string; active: number }>();
  let revenueMicros = 0;
  let newSubs = 0;
  for (const row of matching) {
    revenueMicros += row.revenueMicros;
    newSubs += row.newSubs;
    const prior = lastByPlatform.get(row.platform);
    if (!prior || row.day > prior.day) {
      lastByPlatform.set(row.platform, {
        day: row.day,
        active: row.activeSubs,
      });
    } else if (row.day === prior.day) {
      // Same platform + same day = different (product, currency)
      // tuple. Sum its activeSubs into the platform's total.
      prior.active += row.activeSubs;
    }
  }
  let activeSubs = 0;
  for (const v of lastByPlatform.values()) activeSubs += v.active;
  return { revenueMicros, activeSubs, newSubs };
}

function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function formatMicros(
  micros: number,
  currency: string,
  compact = false,
): string {
  if (!micros) return compact ? "0" : `${currency} 0`.trim();
  const value = micros / 1_000_000;
  if (compact) {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  }
  return `${currency} ${value.toFixed(2)}`.trim();
}
