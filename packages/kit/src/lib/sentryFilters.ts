import type { Event, EventHint } from "@sentry/react";

function messageFromOriginalException(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.message;
  }
  if (typeof exception === "string") {
    return exception;
  }
  return "";
}

function stringFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function breadcrumbText(event: Event): string {
  return (
    event.breadcrumbs
      ?.map((breadcrumb) =>
        [
          breadcrumb.category,
          breadcrumb.message,
          stringFromUnknown(breadcrumb.data?.url),
          stringFromUnknown(breadcrumb.data?.method),
          stringFromUnknown(breadcrumb.data?.status_code),
        ]
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean)
      .join(" ") ?? ""
  );
}

function eventMessage(event: Event, hint?: EventHint): string {
  const exception = hint?.originalException;
  return [
    messageFromOriginalException(exception),
    event.message ?? "",
    event.logentry?.message ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function hasConvexActionBreadcrumb(event: Event): boolean {
  return /convex\.cloud\/api\/action|\/api\/action/i.test(
    breadcrumbText(event),
  );
}

export function applySentryEventFilters<TEvent extends Event>(
  event: TEvent,
  hint?: EventHint,
): TEvent | null {
  const message = eventMessage(event, hint);
  const searchText = [
    message,
    event.request?.url ?? "",
    breadcrumbText(event),
  ].join(" ");

  const isFetchLoadFailed = /Load failed|Failed to fetch|NetworkError/i.test(
    message,
  );
  const looksConvex = /convex\.cloud|\/api\/(action|query|mutation)/i.test(
    searchText,
  );

  if (isFetchLoadFailed && looksConvex) {
    return null;
  }

  const isGenericConvexServerError =
    /^\[Request ID: [a-z0-9]+\] Server Error$/i.test(message.trim());
  if (isGenericConvexServerError && hasConvexActionBreadcrumb(event)) {
    event.tags = {
      ...(event.tags ?? {}),
      source: "convex-action-server-error",
    };
    event.fingerprint = ["convex-action-server-error"];
  }

  return event;
}
