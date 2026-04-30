import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
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
import { Badge } from "../../../../components/Badge";

type ProjectContext = { project: Doc<"projects"> };

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
  const [filter, setFilter] = useState<StateFilter>("all");

  const metrics = useQuery(api.subscriptions.query.metricsSummary, {
    apiKey: project.apiKey,
  });
  const subscriptions = useQuery(api.subscriptions.query.listSubscriptions, {
    apiKey: project.apiKey,
    state: filter === "all" ? undefined : filter,
    limit: 200,
  });

  const formattedMrr = useMemo(() => {
    if (!metrics) return "—";
    return formatMicros(metrics.mrrMicros, metrics.currency);
  }, [metrics]);

  if (subscriptions === undefined || metrics === undefined) {
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
          Authoritative state derived from webhooks. Keys map to the openiap{" "}
          <code className="text-xs">WebhookEvent</code> spec — rows update the
          moment kit ingests an Apple ASN v2 / Google RTDN notification.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={CheckCircle2}
          label="Active"
          value={metrics.activeSubs}
        />
        <MetricCard
          icon={AlertTriangle}
          label="In grace"
          value={metrics.inGracePeriod}
        />
        <MetricCard
          icon={RefreshCw}
          label="Billing retry"
          value={metrics.inBillingRetry}
        />
        <MetricCard icon={Calendar} label="MRR" value={formattedMrr} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          icon={XCircle}
          label="Refunded (30d)"
          value={metrics.refunded30d}
        />
        <MetricCard
          icon={PauseCircle}
          label="Canceled (30d)"
          value={metrics.canceled30d}
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
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-left">Platform</th>
              <th className="px-4 py-2 text-left">State</th>
              <th className="px-4 py-2 text-left">Expires</th>
              <th className="px-4 py-2 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No subscriptions for this filter yet. Webhook events from
                  Apple / Google will populate this table.
                </td>
              </tr>
            )}
            {subscriptions.items.map((sub) => (
              <tr key={sub.id} className="border-t border-border/50">
                <td className="px-4 py-2 font-mono text-xs">
                  {sub.userId ?? <span className="opacity-50">unbound</span>}
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
              </tr>
            ))}
          </tbody>
        </table>
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

function formatMicros(micros: number, currency?: string): string {
  if (!micros) return "—";
  const value = micros / 1_000_000;
  return `${currency ?? ""} ${value.toFixed(2)}`.trim();
}
