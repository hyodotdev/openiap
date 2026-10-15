import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  History,
  Receipt,
  Repeat,
  Send,
} from "lucide-react";

import { api, type Id } from "@/convex";
import { Badge } from "@/components/Badge";
import { PageLoading } from "@/components/LoadingSpinner";
import { PURCHASE_ISSUE_CAUSES } from "@/lib/purchaseIssues";
import { formatUtcDateTime } from "@/lib/utils";

type OutletContext = { project: { _id: Id<"projects"> } };

const KIND_ICON = {
  purchase: Receipt,
  subscription: Repeat,
  event: Send,
  issue: AlertTriangle,
};
const KIND_LABEL = {
  purchase: "Purchase",
  subscription: "Subscription",
  event: "Commerce event",
  issue: "Purchase issue",
};

export default function UserTimeline() {
  const { project } = useOutletContext<OutletContext>();
  const {
    orgSlug = "",
    projectSlug = "",
    appUserId = "",
  } = useParams<{
    orgSlug: string;
    projectSlug: string;
    appUserId: string;
  }>();
  const base = `/${orgSlug}/project/${projectSlug}`;
  const timeline = useQuery(api.subscriptions.query.userTimeline, {
    projectId: project._id,
    appUserId,
  });

  return (
    <div className="space-y-6">
      <Link
        to={`${base}/purchases?user=${encodeURIComponent(appUserId)}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back to purchases"}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <History className="w-5 h-5" />
            {"User timeline"}
          </h2>
          <p className="text-sm text-muted-foreground break-all">
            {
              "Purchases, subscriptions, commerce events and purchase issues for "
            }
            <code className="text-xs">{appUserId}</code>
            {", newest first."}
          </p>
        </div>
        <Link
          to={`${base}/purchases/issues?appUserId=${encodeURIComponent(appUserId)}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <AlertTriangle className="h-4 w-4" />
          {"Purchase issues"}
        </Link>
      </div>

      {timeline === undefined ? (
        <PageLoading />
      ) : timeline.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {"Nothing is linked to this app user yet."}
        </p>
      ) : (
        <ol className="space-y-2">
          {timeline.items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="contained-action-card rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="contained-action-card__content">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="contained-action-card__text">
                    <div className="font-medium">
                      {KIND_LABEL[item.kind]}
                      {" · "}
                      {item.kind === "event"
                        ? item.eventType
                        : item.kind === "issue"
                          ? PURCHASE_ISSUE_CAUSES[item.cause].label
                          : (item.productId ?? "unknown product")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatUtcDateTime(item.at)} · {item.store}
                      {item.kind === "subscription" && item.expiresAt
                        ? ` · expires ${formatUtcDateTime(item.expiresAt)}`
                        : ""}
                      {item.kind === "issue"
                        ? `${item.productId ? ` · ${item.productId}` : ""} · count ${item.count}`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="contained-action-card__actions">
                  {item.kind === "purchase" ? (
                    <>
                      <Badge
                        variant={item.isValid ? "success" : "danger"}
                        size="xs"
                      >
                        {item.state}
                      </Badge>
                      <Link
                        to={`${base}/purchases/${item.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {"Details"}
                      </Link>
                    </>
                  ) : item.kind === "subscription" ? (
                    <Badge variant="default" size="xs">
                      {item.state}
                    </Badge>
                  ) : item.kind === "issue" ? (
                    <Link
                      to={`${base}/purchases/issues?appUserId=${encodeURIComponent(appUserId)}&issue=${item.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {"Details"}
                    </Link>
                  ) : (
                    <Link
                      to={`${base}/webhooks/deliveries?eventId=${item.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {"Deliveries"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {timeline?.truncated ? (
        <p className="text-xs text-muted-foreground">
          {"Showing the newest 50 rows of each kind."}
        </p>
      ) : null}
    </div>
  );
}
