import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeft, RotateCw, Send } from "lucide-react";
import { toast } from "sonner";

import { api, type Id } from "@/convex";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { PageLoading } from "@/components/LoadingSpinner";
import { convexErrorMessage } from "@/lib/appError";
import { formatUtcDateTime } from "@/lib/utils";
import { COMMERCE_EVENT_TYPES } from "../../../../../convex/commerce/contract";
import { DELIVERY_STATUSES } from "../../../../../convex/utils/validation";

type OutletContext = { project: { _id: Id<"projects"> } };
type Delivery = FunctionReturnType<
  typeof api.commerce.deliveryState.listDeliveries
>["page"][number];

type Status = (typeof DELIVERY_STATUSES)[number];
const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  pending: "warning",
  delivering: "primary",
  delivered: "success",
  failed: "danger",
};

export default function WebhookDeliveries() {
  const { project } = useOutletContext<OutletContext>();
  const { orgSlug = "", projectSlug = "" } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const status = DELIVERY_STATUSES.find((value) => value === statusParam);
  const eventType = searchParams.get("eventType") ?? undefined;
  const eventId = searchParams.get("eventId") ?? undefined;
  const destinationId = searchParams.get("destinationId") ?? undefined;

  const canManage = useQuery(api.commerce.destinations.canManage, {
    projectId: project._id,
  });
  const deliveries = usePaginatedQuery(
    api.commerce.deliveryState.listDeliveries,
    { projectId: project._id, status, eventType, eventId, destinationId },
    { initialNumItems: 25 },
  );
  const resend = useMutation(api.commerce.deliveryState.resend);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const resendDelivery = async (delivery: Delivery) => {
    try {
      await resend({ deliveryId: delivery._id });
      toast.success("Queued for re-send with the same event ID");
    } catch (error) {
      toast.error(convexErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to={`/${orgSlug}/project/${projectSlug}/webhooks`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back to webhooks"}
      </Link>
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Send className="w-5 h-5" />
          {"Webhook deliveries"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {
            "Signed commerce events sent to your backend, newest first, with the last 20 attempts of each. A re-send keeps the event ID, so receivers that dedupe on it stay safe."
          }
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by status"
          value={status ?? ""}
          onChange={(event) => setFilter("status", event.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">{"All statuses"}</option>
          {DELIVERY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by event type"
          value={eventType ?? ""}
          onChange={(event) => setFilter("eventType", event.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">{"All event types"}</option>
          {COMMERCE_EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {eventId || destinationId ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("eventId");
              next.delete("destinationId");
              setSearchParams(next);
            }}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            {eventId ? "Clear event filter" : "Clear destination filter"}
          </button>
        ) : null}
      </div>

      {deliveries.status === "LoadingFirstPage" ? (
        <PageLoading />
      ) : deliveries.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {"No deliveries match these filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {deliveries.results.map((delivery) => (
            <li
              key={delivery._id}
              className="rounded-lg border border-border bg-card p-3 text-sm space-y-2"
            >
              <div className="contained-action-card">
                <div className="contained-action-card__text">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <code className="text-xs">{delivery.eventType}</code>
                    <Badge variant={STATUS_VARIANT[delivery.status]} size="xs">
                      {delivery.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {delivery.destinationHost}
                    {delivery.destinationDescription
                      ? ` · ${delivery.destinationDescription}`
                      : ""}
                    {" · "}
                    {summarize(delivery)}
                  </div>
                </div>
                {canManage && delivery.resendable ? (
                  <div className="contained-action-card__actions">
                    <button
                      type="button"
                      onClick={() => void resendDelivery(delivery)}
                      className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      {"Re-send"}
                    </button>
                  </div>
                ) : null}
              </div>
              {delivery.attemptHistory.length > 0 ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {`${delivery.attemptHistory.length} recent attempts`}
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px]">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3 text-left">{"Time"}</th>
                          <th className="py-1 pr-3 text-left">{"Outcome"}</th>
                          <th className="py-1 pr-3 text-left">{"HTTP"}</th>
                          <th className="py-1 pr-3 text-left">{"Latency"}</th>
                          <th className="py-1 text-left">{"Error"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...delivery.attemptHistory]
                          .reverse()
                          .map((attempt) => (
                            <tr key={attempt.at}>
                              <td className="py-1 pr-3">
                                {formatUtcDateTime(attempt.at)}
                              </td>
                              <td className="py-1 pr-3">{attempt.outcome}</td>
                              <td className="py-1 pr-3">
                                {attempt.statusCode ?? "—"}
                              </td>
                              <td className="py-1 pr-3">
                                {attempt.latencyMs !== undefined
                                  ? `${attempt.latencyMs} ms`
                                  : "—"}
                              </td>
                              <td className="py-1">
                                {attempt.errorClass ?? "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {deliveries.status === "CanLoadMore" ? (
        <button
          type="button"
          onClick={() => deliveries.loadMore(25)}
          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {"Load more"}
        </button>
      ) : null}
    </div>
  );
}

function summarize(delivery: Delivery): string {
  const parts = [
    `${delivery.attempts} ${delivery.attempts === 1 ? "attempt" : "attempts"}`,
    delivery.lastStatusCode ? `HTTP ${delivery.lastStatusCode}` : null,
    delivery.lastError ?? delivery.lastErrorClass ?? null,
    delivery.deliveredAt
      ? `delivered ${formatUtcDateTime(delivery.deliveredAt)}`
      : `updated ${formatUtcDateTime(delivery.updatedAt)}`,
    delivery.lastResendAt
      ? `re-sent ${formatUtcDateTime(delivery.lastResendAt)}`
      : null,
    delivery.eventAvailable ? null : "event pruned",
  ];
  return parts.filter(Boolean).join(" · ");
}
