import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Input } from "antd";
import { AlertTriangle } from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { ResyncFromStoreButton } from "@/components/ResyncFromStoreButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  SECTION_LABEL,
  SummaryPanel,
  TOOLBAR,
} from "@/components/SummaryPanel";
import { Badge } from "../../../../components/Badge";
import {
  cn,
  DEFAULT_REPORTING_CURRENCY,
  formatMicros,
  normalizeCurrencyCode,
} from "@/lib/utils";

type DashboardProject = Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
>;
type ProjectContext = { project: DashboardProject };

const STATE_FILTERS = [
  { value: "all", label: "All" },
  { value: "Active", label: "Active" },
  { value: "InGracePeriod", label: "Grace period" },
  { value: "InBillingRetry", label: "Billing retry" },
  { value: "Expired", label: "Expired" },
  { value: "Refunded", label: "Refunded" },
  { value: "Revoked", label: "Revoked" },
  { value: "Paused", label: "Paused" },
] as const;

type StateFilter = (typeof STATE_FILTERS)[number]["value"];

const FIGURE = "font-semibold tracking-tight tabular-nums";
const NOTE = "px-2 pt-1.5 text-xs text-muted-foreground";

export default function ProjectSubscriptions() {
  const { project } = useOutletContext<ProjectContext>();
  const { orgSlug = "", projectSlug = "" } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [filter, setFilter] = useState<StateFilter>("all");
  const [userFilter, setUserFilter] = useState("");

  const [refreshAt, setRefreshAt] = useState(Date.now);
  const metrics = useQuery(api.subscriptions.query.metricsSummary, {
    projectId: project._id,
    refreshAt,
  });
  const subscriptions = useQuery(api.subscriptions.query.listSubscriptions, {
    projectId: project._id,
    state: filter === "all" ? undefined : filter,
    userId: userFilter.trim() || undefined,
    limit: 200,
  });
  const canManage = useQuery(api.commerce.destinations.canManage, {
    projectId: project._id,
  });

  const lastImmediateRefreshAt = useRef<number | null>(null);
  useEffect(() => {
    const expiry = metrics?.stats?.validUntil;
    const now = Date.now();
    const expired =
      metrics?.stats?.state === "current" &&
      expiry !== undefined &&
      expiry !== null &&
      expiry <= now;
    const canRefreshImmediately =
      lastImmediateRefreshAt.current === null ||
      now - lastImmediateRefreshAt.current >= 60_000;
    const delay =
      expired && canRefreshImmediately
        ? 0
        : expiry !== undefined && expiry !== null && expiry > now
          ? Math.min(60_000, expiry - now)
          : 60_000;
    const timer = window.setTimeout(() => {
      lastImmediateRefreshAt.current = Date.now();
      setRefreshAt((previous) => Math.max(Date.now(), previous + 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [metrics, refreshAt]);

  const reportingCurrency = normalizeCurrencyCode(
    metrics?.reportingCurrency ?? project.reportingCurrency,
    DEFAULT_REPORTING_CURRENCY,
  );
  const validUntil = metrics?.stats?.validUntil;
  const totalsCurrent =
    metrics?.stats?.state === "current" &&
    (validUntil === null ||
      (validUntil !== undefined &&
        validUntil > Math.max(refreshAt, Date.now())));
  const formattedMrr = useMemo(() => {
    if (!metrics || !totalsCurrent) return "—";
    return formatMicros(metrics.mrrMicros, {
      currency: reportingCurrency,
      emptyWhenZero: metrics.mrrByCurrency.length === 0,
    });
  }, [metrics, reportingCurrency, totalsCurrent]);

  if (subscriptions === undefined) {
    return <PageLoading />;
  }

  const shown = totalsCurrent && metrics ? metrics : undefined;
  const health = [
    { label: "Active", count: shown?.activeSubs, color: "bg-success" },
    { label: "In grace", count: shown?.inGracePeriod, color: "bg-warning" },
    {
      label: "Billing retry",
      count: shown?.inBillingRetry,
      color: "bg-danger",
    },
  ];
  const recent = [
    { label: "Refunded", count: metrics?.refunded30d },
    { label: "Auto-renew off", count: metrics?.canceled30d },
  ];

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="mb-1 text-2xl font-bold">Subscriptions</h2>
        <p className="text-muted-foreground">
          Authoritative state derived from IAPKit&apos;s internal lifecycle
          events. Rows update when kit ingests an Apple ASN v2 or Google RTDN
          notification. Counts and MRR cover production purchases only.
        </p>
      </div>

      <SummaryPanel label="Subscription summary">
        <div className="grid gap-px bg-border @xl:grid-cols-2 @4xl:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)_15rem]">
          <div className="bg-card p-5">
            <p className={SECTION_LABEL}>Active</p>
            <p className={cn(FIGURE, "mt-2 text-4xl")}>
              {shown?.activeSubs ?? "—"}
            </p>
          </div>

          <div className="bg-card p-3">
            <p className={cn(SECTION_LABEL, "px-2 pt-1")}>Health</p>
            <div
              className="mx-2 mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              {health.map(({ label, count, color }) => (
                <span
                  key={label}
                  className={color}
                  style={{ flexGrow: count ?? 0 }}
                />
              ))}
            </div>
            <dl className="mt-2">
              {health.slice(1).map(({ label, count, color }) => (
                <SummaryRow key={label} label={label} dot={color}>
                  {count ?? "—"}
                </SummaryRow>
              ))}
            </dl>
          </div>

          <div className="bg-card p-3">
            <p className={cn(SECTION_LABEL, "px-2 pt-1")}>Last 30 days</p>
            <dl className="mt-1.5">
              {recent.map(({ label, count }) => (
                <SummaryRow key={label} label={label}>
                  {count ?? "—"}
                </SummaryRow>
              ))}
            </dl>
            {metrics?.recentCountsTruncated && (
              <p className={NOTE}>
                The 30-day counts cover only the most recently updated
                subscriptions.
              </p>
            )}
          </div>

          <div className="flex flex-col bg-card">
            <div className="flex-1 p-5">
              <p className={SECTION_LABEL}>{`MRR (${reportingCurrency})`}</p>
              <p className={cn(FIGURE, "mt-2 text-2xl")}>{formattedMrr}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Monthly recurring revenue
              </p>
            </div>
            <dl className="border-t border-border px-3 py-1.5">
              <SummaryRow label="Total tracked">
                {subscriptions.total}
              </SummaryRow>
            </dl>
          </div>
        </div>
        <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
          {shown ? (
            <p>
              Totals evaluated {new Date(shown.stats.asOf).toLocaleString()}.
            </p>
          ) : (
            <p role="status">
              {metrics === undefined || metrics.stats?.state === "rebuilding"
                ? "Updating subscription totals…"
                : "Subscription totals are not available yet."}{" "}
              Individual subscriptions remain available below.
            </p>
          )}
        </div>
      </SummaryPanel>

      {shown && shown.excludedMrrByCurrency.length > 0 && (
        <div className="flex items-start gap-3 px-1">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="min-w-0 text-sm">
            <p className="font-medium">MRR excludes non-reporting currencies</p>
            <p className="mt-1 text-muted-foreground">
              The MRR figure only includes {reportingCurrency}. Other currencies
              are shown separately and are not converted or summed.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
              {shown.mrrByCurrency.map((entry) => (
                <li
                  key={entry.currency}
                  className={cn(
                    entry.currency === reportingCurrency &&
                      "font-medium text-foreground",
                  )}
                >
                  {formatMicros(entry.mrrMicros, {
                    currency: entry.currency,
                  })}
                  {entry.currency === reportingCurrency ? " included" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="@container overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className={TOOLBAR}>
          <SegmentedControl
            label="State"
            options={STATE_FILTERS}
            value={filter}
            onChange={setFilter}
            size="sm"
            className="shrink flex-wrap"
          />
          <div className="min-w-[9rem] flex-1 sm:w-56 sm:flex-none @4xl:ml-auto">
            <Input
              aria-label="Filter by app user ID"
              className="w-full"
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              placeholder="App user ID"
              allowClear
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Platform</th>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-left">Expires</th>
                <th className="px-4 py-2 text-left">Updated</th>
                {canManage ? <th className="px-4 py-2 text-left" /> : null}
              </tr>
            </thead>
            <tbody>
              {subscriptions.items.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No subscriptions for this filter yet. Webhook events from
                    Apple / Google will populate this table.
                  </td>
                </tr>
              )}
              {subscriptions.items.map((sub) => (
                <tr key={sub.id} className="border-t border-border/50">
                  <td className="px-4 py-2 font-mono text-xs break-all">
                    {sub.userId ? (
                      <Link
                        to={`/${orgSlug}/project/${projectSlug}/purchases/user/${encodeURIComponent(sub.userId)}`}
                        className="text-primary hover:underline"
                      >
                        {sub.userId}
                      </Link>
                    ) : (
                      <span className="whitespace-nowrap opacity-50">
                        unbound
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{sub.productId}</td>
                  <td className="px-4 py-2">
                    <Badge variant="default" size="xs">
                      {sub.platform}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <StateBadge state={sub.state} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {sub.expiresAt ? formatDate(sub.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(sub.updatedAt)}
                  </td>
                  {canManage ? (
                    <td className="whitespace-nowrap px-4 py-2">
                      <ResyncFromStoreButton
                        projectId={project._id}
                        target={{ subscriptionId: sub.id }}
                        label="Re-sync"
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  dot,
  children,
}: {
  label: string;
  dot?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 text-sm">
      <dt className="flex flex-1 items-center gap-3 text-muted-foreground">
        {dot ? (
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", dot)}
            aria-hidden="true"
          />
        ) : null}
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const variant: "default" | "new" =
    state === "Active" || state === "InGracePeriod" ? "new" : "default";
  return (
    <Badge variant={variant} size="xs">
      {state}
    </Badge>
  );
}

function formatDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 16).replace("T", " ");
}
