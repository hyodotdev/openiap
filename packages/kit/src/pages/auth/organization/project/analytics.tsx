import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Select } from "antd";
import {
  BarChart3,
  TrendingUp,
  Users,
  RefreshCw,
  AlertCircle,
  Webhook,
  ArrowRight,
  Clock,
  Hourglass,
  UserPlus,
  UserCheck,
  LogOut,
  Undo2,
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
import {
  REVENUE_COUNTERS,
  type RevenueCounters,
  zeroRevenueCounters,
} from "../../../../../convex/subscriptions/revenueCounters";

type DashboardProject = Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
>;
type ProjectContext = { project: DashboardProject };

type Platform = "IOS" | "Android";
type PlatformFilter = "all" | Platform;
type RevenueMetrics = FunctionReturnType<
  typeof api.subscriptions.query.getRevenueMetrics
>;
type Environment = RevenueMetrics["environment"];
type Cohort = NonNullable<RevenueMetrics["cohorts"]>[number];

const DAY_MS = 86_400_000;

type DailyRow = RevenueCounters & { day: string };
type MetricRow = DailyRow & {
  currency: string;
  productId: string;
  platform: Platform;
};

// Rows written before the current definitions lack the newer counters, and
// days before `trialSplitFromDay` lack the trial counters and expirations;
// both read as 0.
function withDefaults(row: RevenueMetrics["days"][number]): MetricRow {
  const counters = zeroRevenueCounters();
  for (const key of REVENUE_COUNTERS) counters[key] = row[key] ?? 0;
  return {
    ...counters,
    day: row.day,
    currency: row.currency,
    productId: row.productId,
    platform: row.platform,
  };
}

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

const ENVIRONMENTS: Array<{ id: Environment; label: string }> = [
  { id: "Production", label: "Production" },
  { id: "Sandbox", label: "Sandbox" },
];

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
  const [environment, setEnvironment] = useState<Environment>("Production");
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

  // From the day before the longest range: its snapshot is the first day's
  // starting paid count, the churn denominator.
  const { maxFromDay, toDay } = useMemo(() => {
    const today = utcDayKey(now);
    const from = utcDayKey(now - MAX_RANGE_DAYS * DAY_MS);
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
    () => ({
      projectId: project._id,
      fromDay: maxFromDay,
      toDay,
      environment,
      includeCohorts: true,
    }),
    [project._id, maxFromDay, toDay, environment],
  );
  const metrics = useQuery(
    api.subscriptions.query.getRevenueMetrics,
    queryArgs,
  );

  // The loading return comes after every hook (rules of hooks), so until
  // data arrives the memos run on the empty defaults.
  const metricsDays = useMemo(
    () => (metrics?.days ?? []).map(withDefaults),
    [metrics],
  );
  const metricsCurrencies = useMemo(() => metrics?.currencies ?? [], [metrics]);
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
  const matchesFilters = useCallback(
    (row: MetricRow) =>
      (!selectedProduct || row.productId === selectedProduct) &&
      (platformFilter === "all" || row.platform === platformFilter),
    [selectedProduct, platformFilter],
  );
  const trialSplitFromDay = metrics?.trialSplitFromDay;
  const revenueDaily = useMemo(
    () =>
      aggregateByDay(
        metricsDays.filter(
          (row) => row.currency === currency && matchesFilters(row),
        ),
        range.days,
        fromDay,
        trialSplitFromDay,
      ),
    [
      metricsDays,
      currency,
      matchesFilters,
      range.days,
      fromDay,
      trialSplitFromDay,
    ],
  );
  const reportingRevenueDaily = useMemo(
    () =>
      aggregateByDay(
        metricsDays.filter(
          (row) => row.currency === reportingCurrency && matchesFilters(row),
        ),
        range.days,
        fromDay,
        trialSplitFromDay,
      ),
    [
      metricsDays,
      reportingCurrency,
      matchesFilters,
      range.days,
      fromDay,
      trialSplitFromDay,
    ],
  );
  const lifecycleDaily = useMemo(
    () =>
      aggregateByDay(
        metricsDays.filter(matchesFilters),
        range.days,
        fromDay,
        trialSplitFromDay,
      ),
    [metricsDays, matchesFilters, range.days, fromDay, trialSplitFromDay],
  );
  const revenueSeries = useMemo(
    () => bucketByPeriod(revenueDaily, periodId),
    [revenueDaily, periodId],
  );
  const lifecycleSeries = useMemo(
    () => bucketByPeriod(lifecycleDaily, periodId),
    [lifecycleDaily, periodId],
  );

  // Final chart series merges the lifecycle counters (cross-currency)
  // with the revenue totals (currency-pinned) by bucket key.
  const series = useMemo(() => {
    const revenueByBucket = new Map(
      revenueSeries.map((row) => [row.dayKey, row]),
    );
    return lifecycleSeries.map((row) => ({
      ...row,
      revenueMicros: revenueByBucket.get(row.dayKey)?.revenueMicros ?? 0,
      refundedMicros: revenueByBucket.get(row.dayKey)?.refundedMicros ?? 0,
      paidActiveSubs: row.activeSubs - row.activeTrials,
    }));
  }, [lifecycleSeries, revenueSeries]);

  // Days before the split omit trial counters and expirations.
  const splitDaily = useMemo(
    () =>
      trialSplitFromDay === undefined
        ? lifecycleDaily
        : lifecycleDaily.filter((row) => row.dayKey >= trialSplitFromDay),
    [lifecycleDaily, trialSplitFromDay],
  );

  const totals = useMemo(() => {
    const sum = zeroRevenueCounters();
    for (const row of lifecycleDaily) {
      for (const key of REVENUE_COUNTERS) sum[key] += row[key];
    }
    const revenue = reportingRevenueDaily.reduce(
      (acc, row) => ({
        gross: acc.gross + row.revenueMicros,
        refunded: acc.refunded + row.refundedMicros,
      }),
      { gross: 0, refunded: 0 },
    );
    const last = lifecycleDaily[lifecycleDaily.length - 1];
    return {
      ...sum,
      grossMicros: revenue.gross,
      refundedMicros: revenue.refunded,
      activeSubsLast: last?.activeSubs ?? 0,
      activeTrialsLast: last?.activeTrials ?? 0,
    };
  }, [lifecycleDaily, reportingRevenueDaily]);

  // Churn counts paid access that actually ended, not auto-renew turned off
  // or a free trial that ran out.
  const churn = useMemo(() => churnOver(lifecycleDaily), [lifecycleDaily]);

  // Same split as above: counts span currencies, revenue is one currency.
  const platformTotals = useMemo(() => {
    const inRange = metricsDays.filter(
      (row) =>
        row.day >= fromDay &&
        (!selectedProduct || row.productId === selectedProduct),
    );
    const byFilter = new Map<
      PlatformFilter,
      { revenueMicros: number; activeSubs: number; newSubs: number }
    >();
    for (const card of PLATFORM_CARDS) {
      const lifecycle = lifecycleForPlatform(inRange, card.filter);
      const revenue = revenueForPlatform(
        inRange.filter((row) => row.currency === reportingCurrency),
        card.filter,
      );
      byFilter.set(card.filter, {
        revenueMicros: revenue,
        activeSubs: lifecycle.activeSubs,
        newSubs: lifecycle.newSubs,
      });
    }
    return byFilter;
  }, [metricsDays, fromDay, reportingCurrency, selectedProduct]);

  const cohorts = useMemo(
    () => (metrics?.cohorts ?? []).filter((row) => row.currency === currency),
    [metrics, currency],
  );

  if (metrics === undefined) {
    return <PageLoading />;
  }

  const dataState = metrics.dataState;
  const hasNumbers = dataState === "ready" || dataState === "zero";
  const count = (value: number): string =>
    hasNumbers ? value.toString() : "—";
  const money = (value: number): string =>
    hasNumbers ? formatMicros(value, { currency: reportingCurrency }) : "—";
  const legacyDays =
    metrics.definitionsFromDay !== undefined &&
    fromDay < metrics.definitionsFromDay;
  const unsplitDays =
    trialSplitFromDay !== undefined && fromDay < trialSplitFromDay;
  // Trial and churn figures need at least one day with the split.
  const hasSplitNumbers = hasNumbers && splitDaily.length > 0;
  const splitCount = (value: number): string =>
    hasSplitNumbers ? value.toString() : "—";
  const splitDetail = (detail?: string): string | undefined =>
    hasSplitNumbers && unsplitDays ? `From ${trialSplitFromDay}` : detail;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Subscription revenue and lifecycle metrics from verified Apple ASN v2
          and Google RTDN notifications, in UTC days. Revenue is the store list
          price before store fees.{" "}
          <Link to="/docs/analytics" className="text-primary hover:underline">
            Metric definitions
          </Link>
        </p>
        <p className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {metrics.lastRunAt
              ? `Updated ${formatAgo(now - metrics.lastRunAt)}`
              : "Not rolled up yet"}
          </span>
          {legacyDays && (
            <span>
              Days before {metrics.definitionsFromDay} follow the previous
              definitions: they include sandbox purchases and have no trial
              split.
            </span>
          )}
        </p>
      </div>

      {unsplitDays && (
        <Notice icon={AlertCircle} title="Trial split starts mid-range">
          Notifications before {trialSplitFromDay} were stored without the
          free-trial and refund-reversal flags. Those days show no trial counts
          or expirations, Google free trials count as paid starts, and Apple
          refund reversals count as new subscriptions.
        </Notice>
      )}

      {dataState === "not_collected" && (
        // Only ASN v2 / RTDN report renewals, cancels, and refunds, so
        // without webhooks the page stays empty.
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
          <Webhook className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium mb-1">
              No store notifications received yet
            </p>
            <p className="text-muted-foreground">
              Analytics need Apple ASN v2 or Google RTDN.{" "}
              <code className="text-xs">/v1/purchase/verify</code> alone
              doesn&apos;t tell IAPKit when renewals, cancellations, or refunds
              happen.{" "}
              {webhooksHref && (
                <Link
                  to={webhooksHref}
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Open Webhooks tab <ArrowRight className="w-3 h-3" />
                </Link>
              )}{" "}
              ·{" "}
              <Link
                to="/docs/analytics"
                className="text-primary hover:underline"
              >
                Read the setup guide
              </Link>
            </p>
          </div>
        </div>
      )}

      {dataState === "processing" && (
        <Notice icon={Hourglass} title="Rolling up notifications">
          Store notifications have arrived, but this range has not been rolled
          up yet. Numbers appear within about 10 minutes.
        </Notice>
      )}

      {metrics.pendingLateEvents > 0 && (
        <Notice icon={Clock} title="Late notifications pending">
          {metrics.pendingLateEvents} notification
          {metrics.pendingLateEvents === 1 ? "" : "s"} arrived after their day
          was rolled up
          {metrics.oldestPendingLateDay
            ? ` (oldest ${metrics.oldestPendingLateDay})`
            : ""}
          . A catch-up recompute adds them; until then those days read low.
        </Notice>
      )}

      {metrics.truncated && (
        // The scan hit `REVENUE_SCAN_CAP`, so the chart is partial; flat
        // numbers here are truncation, not a revenue trough.
        <Notice icon={AlertCircle} title="Analytics partially loaded">
          This range exceeded the per-query scan limit, so some days are
          missing. Pick a shorter range to load every row.
        </Notice>
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
                  {money(cardTotals.revenueMicros)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  gross · {count(cardTotals.activeSubs)} active ·{" "}
                  {count(cardTotals.newSubs)} new
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <ChicletGroup
          options={ENVIRONMENTS}
          value={environment}
          onChange={(v) => setEnvironment(v as Environment)}
        />
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
            `The charts and cohorts are showing ${currency}. `}
          {calloutExcludedCurrencies.length > 0
            ? `${calloutExcludedCurrencies.join(", ")} ${
                calloutExcludedCurrencies.length === 1 ? "is" : "are"
              } also kept separate. `
            : "Other currency slices are kept separate. "}
          IAPKit does not convert currencies.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Net revenue"
          value={money(totals.grossMicros - totals.refundedMicros)}
          detail={
            hasNumbers
              ? `Gross ${formatMicros(totals.grossMicros, {
                  currency: reportingCurrency,
                })} · refunds ${formatMicros(totals.refundedMicros, {
                  currency: reportingCurrency,
                })}`
              : undefined
          }
        />
        <SummaryCard
          icon={Users}
          label="Active subscriptions"
          value={count(totals.activeSubsLast)}
          detail={
            hasSplitNumbers
              ? `${totals.activeTrialsLast} in free trial`
              : undefined
          }
        />
        <SummaryCard
          icon={UserPlus}
          label="Trials started"
          value={splitCount(totals.trialStarts)}
          detail={splitDetail()}
        />
        <SummaryCard
          icon={UserCheck}
          label="Trial conversions"
          value={splitCount(totals.trialConversions)}
          detail={splitDetail("Paid charge that ends a trial")}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Direct paid starts"
          value={splitCount(totals.directPaidStarts)}
          detail={splitDetail("Paid from day one, no trial")}
        />
        <SummaryCard
          icon={RefreshCw}
          label="Renewals"
          value={count(totals.renewals)}
          detail="Includes billing recoveries"
        />
        <SummaryCard
          icon={Undo2}
          label="Auto-renew off"
          value={count(totals.cancellations)}
          detail="Access continues until the period ends"
        />
        <SummaryCard
          icon={LogOut}
          label="Churn"
          value={hasNumbers && churn ? `${churn.rate.toFixed(1)}%` : "—"}
          detail={
            hasNumbers && churn
              ? `${churn.expirations} expired of ${churn.paidAtStart} paid at start${
                  churn.fromDay > fromDay ? `, from ${churn.fromDay}` : ""
                }`
              : undefined
          }
        />
      </div>

      {dataState !== "ready" ? (
        <EmptyState dataState={dataState} environment={environment} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue"
            subtitle={`Gross list price of paid charges and store refunds · ${currency}`}
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
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="revenueMicros"
                  name="Gross"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="refundedMicros"
                  name="Refunded"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Active subscriptions"
            subtitle="End-of-period snapshot · paid and in free trial"
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
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="paidActiveSubs"
                  name="Paid"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="activeTrials"
                  name="In trial"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Starts and conversions"
            subtitle="Trials started, trials converted, direct paid starts"
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
                <Bar dataKey="trialStarts" name="Trials" fill="#a78bfa" />
                <Bar
                  dataKey="trialConversions"
                  name="Converted"
                  fill="#8b5cf6"
                />
                <Bar
                  dataKey="directPaidStarts"
                  name="Direct paid"
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Auto-renew off and expirations"
            subtitle="Turning auto-renew off is not churn until access ends"
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
                  name="Auto-renew off"
                  fill="#f59e0b"
                />
                <Bar dataKey="expirations" name="Expired" fill="#ef4444" />
                <Bar dataKey="refunds" name="Refunded" fill="#b91c1c" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Churn rate"
            subtitle="Paid expirations / paid subscriptions at period start, %"
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

      {cohorts.length > 0 && (
        <CohortTable
          cohorts={cohorts}
          currency={currency}
          computedAt={metrics.cohortsComputedAt}
          now={now}
        />
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

function Notice({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof AlertCircle;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 flex items-start gap-3">
      <Icon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm min-w-0">
        <p className="font-medium mb-1">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-4 min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {detail && (
        <p className="text-xs text-muted-foreground mt-1 break-words">
          {detail}
        </p>
      )}
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

function EmptyState({
  dataState,
  environment,
}: {
  dataState: RevenueMetrics["dataState"];
  environment: Environment;
}) {
  const copy =
    dataState === "zero"
      ? {
          title: "No subscription activity in this range",
          body: `The ${environment.toLowerCase()} rollup ran and found no charges, starts, cancellations, or active subscriptions. These zeros are real.`,
        }
      : dataState === "processing"
        ? {
            title: "Not rolled up yet",
            body: "Notifications are in. The next rollup tick, within about 10 minutes, fills this view.",
          }
        : {
            title: "Nothing collected yet",
            body: "Analytics roll up from Apple ASN v2 / Google RTDN notifications. Once your first notification arrives, the next tick fills this view.",
          };
  return (
    <div className="border border-border rounded-lg bg-card p-12 text-center">
      <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm font-medium mb-1">{copy.title}</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        {copy.body}
      </p>
    </div>
  );
}

// Paid cohorts by month of first paid charge: retention per month and
// realized (observed, never projected) revenue per member.
function CohortTable({
  cohorts,
  currency,
  computedAt,
  now,
}: {
  cohorts: Cohort[];
  currency: string;
  computedAt?: number;
  now: number;
}) {
  const offsets = Math.min(
    12,
    Math.max(0, ...cohorts.map((row) => row.retained.length)),
  );
  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Monthly cohorts · {currency}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cohort = UTC month of the first paid charge. M+k is the share still
          paying at the end of month k; a canceled subscription counts until its
          paid period ends. Realized LTV is gross revenue observed so far per
          member, before store fees and refunds — never a projection.
          {computedAt ? ` Rebuilt ${formatAgo(now - computedAt)}.` : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-3 font-medium">Month</th>
              <th className="py-1 pr-3 font-medium">Members</th>
              {Array.from({ length: offsets }, (_, k) => (
                <th key={k} className="py-1 pr-3 font-medium">
                  M+{k}
                </th>
              ))}
              <th className="py-1 pr-3 font-medium">Realized LTV</th>
              <th className="py-1 pr-3 font-medium">Trial → paid</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row) => {
              const resolvedTrials = row.trialStarts - row.trialsPending;
              return (
                <tr key={row.month} className="border-t border-border">
                  <td className="py-1 pr-3">{row.month}</td>
                  <td className="py-1 pr-3">{row.members}</td>
                  {Array.from({ length: offsets }, (_, k) => (
                    <td key={k} className="py-1 pr-3">
                      {row.members > 0 && row.retained[k] !== undefined
                        ? `${Math.round((row.retained[k] / row.members) * 100)}%`
                        : ""}
                    </td>
                  ))}
                  <td className="py-1 pr-3">
                    {row.members > 0
                      ? formatMicros(row.realizedLtvMicros, { currency })
                      : "—"}
                  </td>
                  <td className="py-1 pr-3">
                    {resolvedTrials > 0
                      ? `${Math.round((row.trialConversions / resolvedTrials) * 100)}% of ${resolvedTrials}`
                      : row.trialsPending > 0
                        ? `${row.trialsPending} in trial`
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DayPoint = DailyRow & { dayKey: string; paidAtStart: number | null };

// Collapses rollup rows (one per currency, product, and platform) into one
// row per day. Callers filter first, so summing here is safe. `paidAtStart`,
// the churn denominator, is the previous day's paid (not in trial) snapshot;
// null until a row has been seen, or while it predates the trial split and its
// trials are unknown.
function aggregateByDay(
  rows: MetricRow[],
  rangeDays: number,
  fromDay: string,
  trialSplitFromDay: string | undefined,
): DayPoint[] {
  const byDay = new Map<string, DailyRow>();
  for (const row of rows) {
    const existing = byDay.get(row.day);
    if (existing) {
      for (const key of REVENUE_COUNTERS) existing[key] += row[key];
    } else {
      const fresh: DailyRow = { ...zeroRevenueCounters(), day: row.day };
      for (const key of REVENUE_COUNTERS) fresh[key] = row[key];
      byDay.set(row.day, fresh);
    }
  }
  const fromTs = Date.parse(`${fromDay}T00:00:00.000Z`);
  const result: DayPoint[] = [];

  // Seed from the latest row before `fromDay` so the first day doesn't dip
  // to zero.
  let lastActive = 0;
  let lastTrials = 0;
  let snapshotDay = "";
  for (const [day, row] of byDay) {
    if (day >= fromDay) continue;
    if (day > snapshotDay) {
      snapshotDay = day;
      lastActive = row.activeSubs;
      lastTrials = row.activeTrials;
    }
  }

  for (let i = 0; i < rangeDays; i++) {
    const dayKey = utcDayKey(fromTs + i * DAY_MS);
    const paidAtStart =
      snapshotDay !== "" &&
      (trialSplitFromDay === undefined || snapshotDay >= trialSplitFromDay)
        ? lastActive - lastTrials
        : null;
    const entry = byDay.get(dayKey);
    if (entry) {
      lastActive = entry.activeSubs;
      lastTrials = entry.activeTrials;
      snapshotDay = dayKey;
      result.push({ ...entry, dayKey, paidAtStart });
    } else {
      // Carry the snapshot forward (no event = no change that period). For
      // event-driven counters a no-event period is genuinely zero.
      result.push({
        ...zeroRevenueCounters(),
        day: dayKey,
        dayKey,
        activeSubs: lastActive,
        activeTrials: lastTrials,
        paidAtStart,
      });
    }
  }
  return result;
}

// Churn over consecutive days: expirations from the first day with a known
// paid base, over that base.
function churnOver(days: DayPoint[]): {
  rate: number;
  expirations: number;
  paidAtStart: number;
  fromDay: string;
} | null {
  const first = days.findIndex((day) => day.paidAtStart !== null);
  const paidAtStart = days[first]?.paidAtStart;
  if (paidAtStart === undefined || paidAtStart === null) return null;
  let expirations = 0;
  for (const day of days.slice(first)) expirations += day.expirations;
  return {
    rate: paidAtStart > 0 ? (expirations / paidAtStart) * 100 : 0,
    expirations,
    paidAtStart,
    fromDay: days[first].dayKey,
  };
}

// Weeks are ISO (Mon–Sun), months are calendar months. Counters and revenue
// are summed; snapshots take the bucket's last day, since summing a snapshot
// would multiply it by the number of days.
function bucketByPeriod(
  daily: DayPoint[],
  period: PeriodId,
): Array<DayPoint & { label: string; churnPct: number }> {
  const buckets = new Map<string, DayPoint & { label: string }>();
  const daysByBucket = new Map<string, DayPoint[]>();
  for (const row of daily) {
    const { bucketKey, label, sortKey } =
      period === "daily"
        ? {
            bucketKey: row.dayKey,
            label: row.dayKey.slice(5), // MM-DD
            sortKey: row.dayKey,
          }
        : bucketLabelFor(row.dayKey, period);
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, { ...row, day: label, dayKey: sortKey, label });
      daysByBucket.set(bucketKey, [row]);
      continue;
    }
    daysByBucket.get(bucketKey)?.push(row);
    for (const key of REVENUE_COUNTERS) {
      if (key === "activeSubs" || key === "activeTrials") continue;
      existing[key] += row[key];
    }
    existing.activeSubs = row.activeSubs;
    existing.activeTrials = row.activeTrials;
  }

  return Array.from(buckets, ([bucketKey, bucket]) => ({
    ...bucket,
    churnPct: churnOver(daysByBucket.get(bucketKey) ?? [])?.rate ?? 0,
  })).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

// `sortKey` keeps buckets in order across years; `label` is the x-axis text.
function bucketLabelFor(
  dayKey: string,
  period: Exclude<PeriodId, "daily">,
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
  rows: MetricRow[],
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
function revenueForPlatform(rows: MetricRow[], filter: PlatformFilter): number {
  const matching =
    filter === "all" ? rows : rows.filter((r) => r.platform === filter);
  let revenueMicros = 0;
  for (const row of matching) revenueMicros += row.revenueMicros;
  return revenueMicros;
}

function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function formatAgo(elapsedMs: number): string {
  const minutes = Math.max(0, Math.round(elapsedMs / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
