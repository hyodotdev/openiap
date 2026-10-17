import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  Activity,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  RefreshCw,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { ResyncFromStoreButton } from "@/components/ResyncFromStoreButton";
import { Badge } from "../../../../components/Badge";
import {
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
  { id: "all", label: "All" },
  { id: "Active", label: "Active" },
  { id: "InGracePeriod", label: "Grace period" },
  { id: "InBillingRetry", label: "Billing retry" },
  { id: "Expired", label: "Expired" },
  { id: "Refunded", label: "Refunded" },
  { id: "Revoked", label: "Revoked" },
  { id: "Paused", label: "Paused" },
] as const;

type StateFilter = (typeof STATE_FILTERS)[number]["id"];

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Subscriptions
        </h2>
        <p className="text-sm text-muted-foreground">
          Authoritative state derived from IAPKit&apos;s internal lifecycle
          events. Rows update when kit ingests an Apple ASN v2 or Google RTDN
          notification. Counts and MRR cover production purchases only.
        </p>
      </div>

      {!totalsCurrent && (
        <p role="status" className="text-sm text-muted-foreground">
          {metrics === undefined || metrics.stats?.state === "rebuilding"
            ? "Updating subscription totals…"
            : "Subscription totals are not available yet."}{" "}
          Individual subscriptions remain available below.
        </p>
      )}
      {totalsCurrent && metrics && (
        <p className="text-xs text-muted-foreground">
          Totals evaluated {new Date(metrics.stats.asOf).toLocaleString()}.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={CheckCircle2}
          label="Active"
          value={totalsCurrent && metrics ? metrics.activeSubs : "—"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="In grace"
          value={totalsCurrent && metrics ? metrics.inGracePeriod : "—"}
        />
        <MetricCard
          icon={RefreshCw}
          label="Billing retry"
          value={totalsCurrent && metrics ? metrics.inBillingRetry : "—"}
        />
        <MetricCard
          icon={Calendar}
          label={`MRR (${reportingCurrency})`}
          value={formattedMrr}
        />
      </div>

      {totalsCurrent && metrics.excludedMrrByCurrency.length > 0 && (
        <div className="border border-border rounded-lg bg-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">
                MRR excludes non-reporting currencies
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                The main MRR card only includes {reportingCurrency}. Other
                currencies are shown separately and are not converted or summed.
              </p>
              <div className="flex flex-wrap gap-2">
                {metrics.mrrByCurrency.map((entry) => (
                  <span
                    key={entry.currency}
                    className={`rounded-md border px-2.5 py-1 text-xs tabular-nums ${
                      entry.currency === reportingCurrency
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {formatMicros(entry.mrrMicros, {
                      currency: entry.currency,
                    })}
                    {entry.currency === reportingCurrency ? " included" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {metrics?.recentCountsTruncated && (
        <p className="text-sm text-muted-foreground">
          The 30-day counts cover only the most recently updated subscriptions.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          icon={XCircle}
          label="Refunded (30d)"
          value={metrics?.refunded30d ?? "—"}
        />
        <MetricCard
          icon={PauseCircle}
          label="Auto-renew off (30d)"
          value={metrics?.canceled30d ?? "—"}
        />
        <MetricCard
          icon={Activity}
          label="Total tracked"
          value={subscriptions.total}
        />
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="flex flex-wrap gap-2 p-3 border-b border-border">
          {STATE_FILTERS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === option.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {option.label}
            </button>
          ))}
          <input
            aria-label="Filter by app user ID"
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="App user ID"
            className="ml-auto w-full rounded border border-border bg-background px-2 py-1 text-xs sm:w-56"
          />
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
                      <span className="opacity-50">unbound</span>
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
                    <td className="px-4 py-2">
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

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
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
