import { Link, useOutletContext, useParams } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";
import { ArrowLeft, Inbox } from "lucide-react";

import { api, type Id } from "@/convex";
import { Badge } from "@/components/Badge";
import { PageLoading } from "@/components/LoadingSpinner";
import { formatUtcDateTime } from "@/lib/utils";

type OutletContext = { project: { _id: Id<"projects"> } };

export default function WebhookNotifications() {
  const { project } = useOutletContext<OutletContext>();
  const { orgSlug = "", projectSlug = "" } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const base = `/${orgSlug}/project/${projectSlug}`;
  const notifications = usePaginatedQuery(
    api.webhooks.inbound.listInboundNotifications,
    { projectId: project._id },
    { initialNumItems: 25 },
  );

  return (
    <div className="space-y-6">
      <Link
        to={`${base}/webhooks`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back to webhooks"}
      </Link>
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          {"Inbound notifications"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {
            "Store notifications IAPKit accepted in the last 30 days, newest first. A store retry of the same notification never adds a row. Signed payloads stay on the server; the fingerprint is a SHA-256 prefix of one."
          }
        </p>
      </div>

      {notifications.status === "LoadingFirstPage" ? (
        <PageLoading />
      ) : notifications.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {"No store notifications yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.results.map((notification) => (
            <li
              key={notification._id}
              className="contained-action-card rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="contained-action-card__text">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{notification.type}</span>
                  <Badge variant="default" size="xs">
                    {notification.store}
                  </Badge>
                  <Badge variant="outline" size="xs">
                    {notification.environment}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {`Received ${formatUtcDateTime(notification.receivedAt)}`}
                  {notification.productId ? ` · ${notification.productId}` : ""}
                  {notification.transactionId
                    ? ` · transaction ${notification.transactionId}`
                    : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {`ID ${notification.sourceNotificationId}`}
                  {notification.payloadFingerprint
                    ? ` · fingerprint ${notification.payloadFingerprint}`
                    : ""}
                </div>
              </div>
              <div className="contained-action-card__actions">
                {notification.userId ? (
                  <Link
                    to={`${base}/purchases/user/${encodeURIComponent(notification.userId)}`}
                    className="max-w-full break-all text-xs text-primary hover:underline"
                  >
                    {notification.userId}
                  </Link>
                ) : null}
                <Badge
                  variant={
                    notification.status === "applied"
                      ? "success"
                      : notification.status === "test"
                        ? "outline"
                        : "warning"
                  }
                  size="xs"
                >
                  {notification.status === "applied"
                    ? `applied ${formatUtcDateTime(notification.appliedAt ?? notification.receivedAt)}`
                    : notification.status === "test"
                      ? "test notification"
                      : "not applied"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notifications.status === "CanLoadMore" ? (
        <button
          type="button"
          onClick={() => notifications.loadMore(25)}
          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {"Load more"}
        </button>
      ) : null}
    </div>
  );
}
