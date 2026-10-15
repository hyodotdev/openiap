import { Hono, type Context } from "hono";

import { api } from "@/convex";
import { COMMERCE_STORES } from "../../../convex/commerce/contract";
import { purchaseIssueCauseValidator } from "../../../convex/utils/validation";
import { client, handleConvexError } from "../../convex";
import { apiKeyMiddleware, secretAdminApiKeyMiddleware } from "./middleware";
import { multiAxisRateLimitMiddleware } from "./rate-limit";
import { JsonBodyTooLargeError, readJsonBodyWithLimit } from "./request-body";

// Operator routes for secret keys: outbound delivery history and re-send,
// inbound notification history, purchase issues, store re-sync, and one app
// user's timeline. Each is a bounded request/response call; none of them
// streams to an app.

const operations = new Hono<{
  Variables: { apiKey: string; apiKeyHash?: string };
}>();
const rateLimit = multiAxisRateLimitMiddleware();
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_ID_LENGTH = 256;
const MAX_CURSOR_LENGTH = 4096;
const MAX_RESYNC_BODY_BYTES = 4 * 1024;
const DELIVERY_STATUSES = [
  "pending",
  "delivering",
  "delivered",
  "failed",
] as const;
const ISSUE_CAUSES = purchaseIssueCauseValidator.members.map(
  (member) => member.value,
);

function oneOf<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}

operations.get(
  "/webhooks/deliveries",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    const pageOptions = parsePage(c);
    if (typeof pageOptions === "string") return invalidInput(c, pageOptions);
    const status = c.req.query("status");
    if (status !== undefined && !oneOf(DELIVERY_STATUSES, status)) {
      return invalidInput(c, `status must be ${DELIVERY_STATUSES.join(", ")}`);
    }
    const filters: Record<string, string> = {};
    for (const name of ["eventType", "destinationId", "eventId"] as const) {
      const value = c.req.query(name);
      if (value === undefined) continue;
      if (!isBoundedText(value, MAX_ID_LENGTH)) {
        return invalidInput(c, `${name} must be 1 to ${MAX_ID_LENGTH} chars`);
      }
      filters[name] = value;
    }
    try {
      const result = await client.query(
        api.commerce.deliveryState.listDeliveries,
        {
          apiKey: c.var.apiKey,
          ...(status !== undefined ? { status } : {}),
          ...filters,
          paginationOpts: pageOptions,
        },
      );
      return c.json({
        deliveries: result.page,
        hasMore: !result.isDone,
        nextCursor: result.isDone ? null : result.continueCursor,
      });
    } catch (error) {
      return operationError(c, error, "DELIVERY_LIST_FAILED");
    }
  },
);

operations.post(
  "/webhooks/deliveries/:deliveryId/resend",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    const deliveryId = c.req.param("deliveryId");
    if (!isBoundedText(deliveryId, MAX_ID_LENGTH)) {
      return invalidInput(c, `deliveryId must be 1 to ${MAX_ID_LENGTH} chars`);
    }
    try {
      return c.json(
        await client.mutation(api.commerce.deliveryState.resend, {
          apiKey: c.var.apiKey,
          deliveryId,
        }),
        202,
      );
    } catch (error) {
      return operationError(c, error, "DELIVERY_RESEND_FAILED");
    }
  },
);

operations.get(
  "/webhooks/notifications",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    const pageOptions = parsePage(c);
    if (typeof pageOptions === "string") return invalidInput(c, pageOptions);
    try {
      const result = await client.query(
        api.webhooks.inbound.listInboundNotifications,
        { apiKey: c.var.apiKey, paginationOpts: pageOptions },
      );
      return c.json({
        notifications: result.page,
        hasMore: !result.isDone,
        nextCursor: result.isDone ? null : result.continueCursor,
      });
    } catch (error) {
      return operationError(c, error, "NOTIFICATION_LIST_FAILED");
    }
  },
);

operations.get(
  "/purchase/issues",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    const pageOptions = parsePage(c);
    if (typeof pageOptions === "string") return invalidInput(c, pageOptions);
    const cause = c.req.query("cause");
    if (cause !== undefined && !oneOf(ISSUE_CAUSES, cause)) {
      return invalidInput(c, `cause must be ${ISSUE_CAUSES.join(", ")}`);
    }
    const store = c.req.query("store");
    if (store !== undefined && !oneOf(COMMERCE_STORES, store)) {
      return invalidInput(c, `store must be ${COMMERCE_STORES.join(", ")}`);
    }
    const filters: Record<string, string> = {};
    for (const name of ["productId", "appUserId"] as const) {
      const value = c.req.query(name);
      if (value === undefined) continue;
      if (!isBoundedText(value, MAX_ID_LENGTH)) {
        return invalidInput(c, `${name} must be 1 to ${MAX_ID_LENGTH} chars`);
      }
      filters[name] = value;
    }
    const range: { from?: number; to?: number } = {};
    for (const name of ["from", "to"] as const) {
      const value = c.req.query(name);
      if (value === undefined) continue;
      if (!/^\d{1,15}$/.test(value)) {
        return invalidInput(c, `${name} must be epoch milliseconds`);
      }
      range[name] = Number(value);
    }
    try {
      const result = await client.query(
        api.purchaseIssues.query.listPurchaseIssues,
        {
          apiKey: c.var.apiKey,
          ...(cause !== undefined ? { cause } : {}),
          ...(store !== undefined ? { store } : {}),
          ...filters,
          ...range,
          paginationOpts: pageOptions,
        },
      );
      return c.json({
        issues: result.page,
        hasMore: !result.isDone,
        nextCursor: result.isDone ? null : result.continueCursor,
      });
    } catch (error) {
      return operationError(c, error, "PURCHASE_ISSUE_LIST_FAILED");
    }
  },
);

operations.post(
  "/subscriptions/resync",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    let body: unknown;
    try {
      body = await readJsonBodyWithLimit(c.req.raw, MAX_RESYNC_BODY_BYTES);
    } catch (error) {
      return invalidInput(
        c,
        error instanceof JsonBodyTooLargeError
          ? "Body is too large"
          : "Body is not JSON",
      );
    }
    const { purchaseId, subscriptionId } = (body ?? {}) as {
      purchaseId?: unknown;
      subscriptionId?: unknown;
    };
    const ids = [purchaseId, subscriptionId].filter((id) => id !== undefined);
    if (
      ids.length !== 1 ||
      !ids.every((id) => isBoundedText(id, MAX_ID_LENGTH))
    ) {
      return invalidInput(
        c,
        "Send exactly one of purchaseId or subscriptionId",
      );
    }
    try {
      return c.json(
        await client.action(api.subscriptions.action.resyncFromStore, {
          apiKey: c.var.apiKey,
          ...(typeof purchaseId === "string" ? { purchaseId } : {}),
          ...(typeof subscriptionId === "string" ? { subscriptionId } : {}),
        }),
      );
    } catch (error) {
      return operationError(c, error, "STORE_RESYNC_FAILED");
    }
  },
);

operations.get(
  "/subscriptions/timeline",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  rateLimit,
  async (c) => {
    const userId = c.req.query("userId");
    if (!isBoundedText(userId, MAX_ID_LENGTH)) {
      return invalidInput(c, `userId must be 1 to ${MAX_ID_LENGTH} chars`);
    }
    try {
      return c.json(
        await client.query(api.subscriptions.query.userTimeline, {
          apiKey: c.var.apiKey,
          appUserId: userId,
        }),
      );
    } catch (error) {
      return operationError(c, error, "USER_TIMELINE_FAILED");
    }
  },
);

function parsePage(
  c: Context,
): { numItems: number; cursor: string | null } | string {
  const limit = c.req.query("limit");
  const cursor = c.req.query("cursor");
  if (limit !== undefined && !/^\d+$/.test(limit)) {
    return "limit must be a positive integer";
  }
  const numItems = limit === undefined ? DEFAULT_PAGE_SIZE : Number(limit);
  if (numItems < 1 || numItems > MAX_PAGE_SIZE) {
    return `limit must be 1 to ${MAX_PAGE_SIZE}`;
  }
  if (cursor !== undefined && !isBoundedText(cursor, MAX_CURSOR_LENGTH)) {
    return "cursor is invalid";
  }
  return { numItems, cursor: cursor ?? null };
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function invalidInput(c: Context, message: string): Response {
  return c.json({ errors: [{ code: "INVALID_INPUT", message }] }, 400);
}

const STATUS_BY_CODE: Record<string, 403 | 404 | 409 | 429 | 502> = {
  INVALID_API_KEY: 403,
  INSUFFICIENT_SCOPE: 403,
  NOT_FOUND: 404,
  NOT_RESENDABLE: 409,
  RATE_LIMITED: 429,
  // An upstream store failure, not a bad request: retry later.
  STORE_REQUEST_FAILED: 502,
};

function operationError(c: Context, error: unknown, code: string): Response {
  const convexError = handleConvexError(error);
  if (convexError) {
    if (convexError.retryAfterSec !== undefined) {
      c.header("Retry-After", String(convexError.retryAfterSec));
    }
    return c.json(
      { errors: [convexError] },
      STATUS_BY_CODE[convexError.code] ?? 400,
    );
  }
  console.error(
    `[operations] ${code}`,
    error instanceof Error ? error.name : typeof error,
  );
  return c.json(
    { errors: [{ code, message: "The operation failed. Try again." }] },
    500,
  );
}

export { operations as operationsRoutes };
