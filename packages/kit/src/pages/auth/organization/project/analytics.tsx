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
import { cn, formatMicros, normalizeCurrencyCode } from "@/lib/utils";

type DashboardProject = Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
>;
type ProjectContext = { project: DashboardProject };

type Platform = "IOS" | "Android";
type PlatformFilter = "all" | Platform;

const DAY_MS = 86_400_000;

// Shared empty defaults for renders before `metrics` loads, so memo deps
// keep a stable identity instead of a new [] each render.
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

  // Day keys are UTC to match the rollup cron; local days would half-cover
  // the first/last column far from UTC, showing a "missing yesterday".
  // `now` ticks every minute so a page left open past UTC midnight picks up
  // the new day. `useQuery` compares args by value, so it refetches only
  // when the day key changes.
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

  const fromDay = useMemo(
    () => utcDayKey(now - (range.days - 1) * DAY_MS),
    [now, range],
  );

  // Fetch the max range unfiltered and filter everything client-side: a
  // refetch per filter click rebuilt the whole subtree (a visible flicker),
  // and the platform cards need the unfiltered breakdown anyway.
  const queryArgs = useMemo(
    () => ({ projectId: project._id, fromDay: maxFromDay, toDay }),
    [project._id, maxFromDay, toDay],
  );
  const metrics = useQuery(
    api.subscriptions.query.getRevenueMetrics,
    queryArgs,
  );

  // The loading return comes after every hook (rules of hooks), so until
  // data arrives the memos run on the empty defaults.
  const metricsDays = metrics?.days ?? EMPTY_DAYS;
  const metricsCurrencies = metrics?.currencies ?? EMPTY_STRINGS;
  const reportingCurrency = normalizeCurrencyCode(project.reportingCurrency);

  // Chart revenue uses one currency: it can't be summed across currencies
  // without an FX rate. That is the user's pick, else the reporting currency,
  // also before any rollup rows exist.
  const currencyOptions = useMemo(
    () => Array.from(new Set([reportingCurrency, ...metricsCurrencies])).sort(),
    [reportingCurrency, metricsCurrencies],
  );
  const currency = useMemo(() => {
    if (selectedCurrency && currencyOptions.includes(selectedCurrency)) {
      return selectedCurrency;
    }
    return reportingCurrency;
  }, [selectedCurrency, currencyOptions, reportingCurrency]);
  const excludedReportingCurrencies = useMemo(
    () =>
      metricsCurrencies.filter((candidate) => candidate !== reportingCurrency),
    [metricsCurrencies, reportingCurrency],
  );
  const calloutExcludedCurrencies = useMemo(
    () =>
      excludedReportingCurrencies.filter((candidate) => candidate !== currency),
    [excludedReportingCurrencies, currency],
  );

  // Revenue rows filter on the resolved `currency`, never the nullable
  // `selectedCurrency`. Lifecycle rows are counts, so they span every
  // currency; pinning them would under-report "All platforms". Rows before
  // `fromDay` stay in: `aggregateByDay` seeds `activeSubs` from them, so a
  // range with no events doesn't dip to zero on its first day.
  const revenueRows = useMemo(
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
  const reportingRevenueRows = useMemo(
    () =>
      metricsDays.filter((row) => {
        if (row.currency !== reportingCurrency) return false;
        if (selectedProduct && row.productId !== selectedProduct) return false;
        if (platformFilter !== "all" && row.platform !== platformFilter) {
          return false;
        }
        return true;
      }),
    [metricsDays, reportingCurrency, selectedProduct, platformFilter],
  );
  const lifecycleRows = useMemo(
    () =>
      metricsDays.filter((row) => {
        if (selectedProduct && row.productId !== selectedProduct) return false;
        if (platformFilter !== "all" && row.platform !== platformFilter) {
          return false;
        }
        return true;
      }),
    [metricsDays, selectedProduct, platformFilter],
  );

  const revenueDaily = useMemo(
    () => aggregateByDay(revenueRows, range.days, fromDay),
    [revenueRows, range.days, fromDay],
  );
  const reportingRevenueDaily = useMemo(
    () => aggregateByDay(reportingRevenueRows, range.days, fromDay),
    [reportingRevenueRows, range.days, fromDay],
  );
  const lifecycleDaily = useMemo(
    () => aggregateByDay(lifecycleRows, range.days, fromDay),
    [lifecycleRows, range.days, fromDay],
  );
  const revenueSeries = useMemo(
    () => bucketByPeriod(revenueDaily, periodId),
    [revenueDaily, periodId],
  );
  const reportingRevenueSeries = useMemo(
    () => bucketByPeriod(reportingRevenueDaily, periodId),
    [reportingRevenueDaily, periodId],
  );
  const lifecycleSeries = useMemo(
    () => bucketByPeriod(lifecycleDaily, periodId),
    [lifecycleDaily, periodId],
  );

  const revenueByBucket = useMemo(
    () => new Map(revenueSeries.map((row) => [row.dayKey, row.revenueMicros])),
    [revenueSeries],
  );
  const reportingRevenueByBucket = useMemo(
    () =>
      new Map(
        reportingRevenueSeries.map((row) => [row.dayKey, row.revenueMicros]),
      ),
    [reportingRevenueSeries],
  );

  // Final chart series merges the lifecycle counters (cross-currency)
  // with the revenue total (currency-pinned) by bucket key.
  const series = useMemo(
    () =>
      lifecycleSeries.map((row) => ({
        ...row,
        revenueMicros: revenueByBucket.get(row.dayKey) ?? 0,
      })),
    [lifecycleSeries, revenueByBucket],
  );

  const totals = useMemo(
    () =>
      lifecycleSeries.reduce(
        (acc, row) => {
          acc.newSubs += row.newSubs;
          acc.renewals += row.renewals;
          acc.cancellations += row.cancellations;
          acc.refunds += row.refunds;
          acc.revenueMicros += reportingRevenueByBucket.get(row.dayKey) ?? 0;
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
    [lifecycleSeries, reportingRevenueByBucket],
  );

  // The churn definition Stripe and RevenueCat use in their dashboards.
  const churnRate =
    totals.activeSubsLast > 0
      ? ((totals.cancellations + totals.refunds) / totals.activeSubsLast) * 100
      : 0;

  // Same split as above: counts span currencies, revenue is one currency.
  const platformTotals = useMemo(() => {
    const lifecycleBaseRows = metricsDays.filter((row) => {
      if (row.day < fromDay) return false;
      if (selectedProduct && row.productId !== selectedProduct) return false;
      return true;
    });
    const revenueBaseRows = metricsDays.filter((row) => {
      if (row.day < fromDay) return false;
      if (row.currency !== reportingCurrency) return false;
      if (selectedProduct && row.productId !== selectedProduct) return false;
      return true;
    });
    const byFilter = new Map<
      PlatformFilter,
      { revenueMicros: number; activeSubs: number; newSubs: number }
    >();
    for (const card of PLATFORM_CARDS) {
      const lifecycle = lifecycleForPlatform(lifecycleBaseRows, card.filter);
      const revenue = revenueForPlatform(revenueBaseRows, card.filter);
      byFilter.set(card.filter, {
        revenueMicros: revenue,
        activeSubs: lifecycle.activeSubs,
        newSubs: lifecycle.newSubs,
      });
    }
    return byFilter;
  }, [metricsDays, fromDay, reportingCurrency, selectedProduct]);

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

      {/* Only ASN v2 / RTDN report renewals, cancels, and refunds, so
          without webhooks the chart stays empty. */}
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
        // The scan hit `REVENUE_SCAN_CAP`, so the chart is partial; flat
        // numbers here are truncation, not a revenue trough.
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
                  {formatMicros(cardTotals.revenueMicros, {
                    currency: reportingCurrency,
                  })}
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
        {currencyOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Currency:</span>
            {/* No allowClear: the chart needs exactly one currency. Other
                currencies are for the chart only; totals stay in the
                reporting currency. */}
            <Select
              value={currency}
              onChange={(v) => setSelectedCurrency(v ?? null)}
              className="min-w-[100px]"
              options={currencyOptions.map((c) => ({
                value: c,
                label: c === reportingCurrency ? `${c} (reporting)` : c,
              }))}
            />
          </div>
        )}
      </div>

      {excludedReportingCurrencies.length > 0 && (
        <div className="border border-border bg-muted/20 rounded-lg p-4 text-sm text-muted-foreground">
          Headline revenue totals only include {reportingCurrency}.{" "}
          {currency !== reportingCurrency &&
            `The revenue chart is showing ${currency}. `}
          {calloutExcludedCurrencies.length > 0
            ? `${calloutExcludedCurrencies.join(", ")} ${
                calloutExcludedCurrencies.length === 1 ? "is" : "are"
              } also kept separate. `
            : "Other currency slices are kept separate. "}
          IAPKit does not convert currencies.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Revenue"
          value={formatMicros(totals.revenueMicros, {
            currency: reportingCurrency,
          })}
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
            subtitle={`Initial purchases + renewals · ${currency}`}
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
                  tickFormatter={(v) =>
                    formatMicros(v, { currency, compact: true })
                  }
                />
                <Tooltip
                  formatter={(value: number) =>
                    formatMicros(value, { currency })
                  }
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
  // bg-card and bg-muted/40 look the same in dark mode, so the active option
  // also gets a primary border.
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

type DailyRow = {
  day: string;
  activeSubs: number;
  newSubs: number;
  renewals: number;
  cancellations: number;
  refunds: number;
  revenueMicros: number;
};

// Collapses rollup rows (one per currency, product, and platform) into one
// row per day. Callers filter first, so summing here is safe.
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

  // Seed from the latest row before `fromDay` so the first day doesn't dip
  // to zero.
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

// Weeks are ISO (Mon–Sun), months are calendar months. Counters and revenue
// are summed; activeSubs takes the bucket's last day, since summing a
// snapshot would multiply it by the number of days.
function bucketByPeriod(
  daily: Array<DailyRow & { dayKey: string }>,
  period: PeriodId,
): Array<DailyRow & { dayKey: string; label: string; churnPct: number }> {
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

// `sortKey` keeps buckets in order across years; `label` is the x-axis text.
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

// Takes rows across every currency. Rollup rows are keyed by
// (day, productId, currency, platform), so activeSubs sums the rows of each
// platform's latest day, while newSubs sums every row.
function lifecycleForPlatform(
  rows: Array<{
    platform: Platform;
    activeSubs: number;
    newSubs: number;
    day: string;
  }>,
  filter: PlatformFilter,
): { activeSubs: number; newSubs: number } {
  const matching =
    filter === "all" ? rows : rows.filter((r) => r.platform === filter);
  const lastByPlatform = new Map<Platform, { day: string; active: number }>();
  let newSubs = 0;
  for (const row of matching) {
    newSubs += row.newSubs;
    const prior = lastByPlatform.get(row.platform);
    if (!prior || row.day > prior.day) {
      lastByPlatform.set(row.platform, {
        day: row.day,
        active: row.activeSubs,
      });
    } else if (row.day === prior.day) {
      prior.active += row.activeSubs;
    }
  }
  let activeSubs = 0;
  for (const v of lastByPlatform.values()) activeSubs += v.active;
  return { activeSubs, newSubs };
}

// Takes rows already pinned to one currency.
function revenueForPlatform(
  rows: Array<{ platform: Platform; revenueMicros: number }>,
  filter: PlatformFilter,
): number {
  const matching =
    filter === "all" ? rows : rows.filter((r) => r.platform === filter);
  let revenueMicros = 0;
  for (const row of matching) revenueMicros += row.revenueMicros;
  return revenueMicros;
}

function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
