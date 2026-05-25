import { Buffer } from "node:buffer";
import { Hono, type Context, type Next } from "hono";

import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import { apiKeyValidationError } from "./middleware";
import {
  APPLE_JWS_PATTERN,
  APPLE_JWS_MAX_LENGTH,
  GOOGLE_PURCHASE_TOKEN_MAX_LENGTH,
} from "./route-input-schemas";
import {
  isContentLengthOverLimit,
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "./request-body";

// Subscription state, entitlements, metrics, and user-binding routes.
// Mirrors the role of onesub's `/onesub/status`, `/onesub/admin/...`
// and `/onesub/metrics/*` endpoints, but with kit-style apiKey-in-path
// auth so the routes work without sticky bearer headers from RN-side
// fetch implementations that strip them.

const subscriptions = new Hono();
const MAX_USER_ID_LENGTH = 256;
const MAX_PRODUCT_ID_LENGTH = 256;
const MAX_BIND_USER_BODY_BYTES = 32 * 1024;
const INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE =
  "purchaseToken must be a valid Apple JWS containing originalTransactionId or transactionId";
type SubscriptionState =
  | "Active"
  | "InGracePeriod"
  | "InBillingRetry"
  | "Expired"
  | "Revoked"
  | "Refunded"
  | "Paused"
  | "Unknown";
const SUBSCRIPTION_STATES = new Set<string>([
  "Active",
  "InGracePeriod",
  "InBillingRetry",
  "Expired",
  "Revoked",
  "Refunded",
  "Paused",
  "Unknown",
]);
const API_KEY_ROUTES = [
  "/status/:apiKey",
  "/entitlements/:apiKey",
  "/list/:apiKey",
  "/metrics/:apiKey",
  "/bind-user/:apiKey",
];

for (const route of API_KEY_ROUTES) {
  subscriptions.use(route, pathApiKeyGuard);
}

subscriptions.get("/status/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const userId = c.req.query("userId");
  if (!isNonBlankString(userId)) {
    return invalidInput(c, "userId is required");
  }
  if (!isValidUserIdLength(userId)) {
    return invalidInput(c, "userId must be ≤ 256 chars");
  }
  try {
    const result = await client.query(
      api.subscriptions.query.subscriptionStatus,
      {
        apiKey,
        userId,
      },
    );
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_STATUS_FAILED",
      "Subscription status lookup failed",
    );
  }
});

subscriptions.get("/entitlements/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const userId = c.req.query("userId");
  if (!isNonBlankString(userId)) {
    return invalidInput(c, "userId is required");
  }
  if (!isValidUserIdLength(userId)) {
    return invalidInput(c, "userId must be ≤ 256 chars");
  }
  try {
    const result = await client.query(api.subscriptions.query.entitlements, {
      apiKey,
      userId,
    });
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_ENTITLEMENTS_FAILED",
      "Subscription entitlements lookup failed",
    );
  }
});

subscriptions.get("/list/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const stateParam = c.req.query("state");
  const productId = c.req.query("productId");
  const userId = c.req.query("userId");
  const limit = parseLimit(c.req.query("limit"));
  if (limit === null) {
    return invalidInput(c, "limit must be a positive integer");
  }
  if (userId !== undefined && !isNonBlankString(userId)) {
    return invalidInput(c, "userId must not be empty");
  }
  if (productId !== undefined && !isNonBlankString(productId)) {
    return invalidInput(c, "productId must not be empty");
  }
  if (userId !== undefined && !isValidUserIdLength(userId)) {
    return invalidInput(c, "userId must be ≤ 256 chars");
  }
  if (productId !== undefined && !isValidProductIdLength(productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }
  let state: SubscriptionState | undefined;
  if (stateParam !== undefined) {
    if (!isSubscriptionState(stateParam)) {
      return invalidInput(c, "state is invalid");
    }
    state = stateParam;
  }
  try {
    const result = await client.query(
      api.subscriptions.query.listSubscriptions,
      {
        apiKey,
        state,
        productId: productId ?? undefined,
        userId: userId ?? undefined,
        limit,
      },
    );
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_LIST_FAILED",
      "Subscription list failed",
    );
  }
});

subscriptions.get("/metrics/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  try {
    const result = await client.query(api.subscriptions.query.metricsSummary, {
      apiKey,
    });
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_METRICS_FAILED",
      "Subscription metrics lookup failed",
    );
  }
});

subscriptions.post("/bind-user/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(
      c.req.raw,
      MAX_BIND_USER_BODY_BYTES,
      "Subscription payload is too large",
    );
  } catch (error) {
    if (error instanceof JsonBodyTooLargeError) {
      return payloadTooLarge(c);
    }
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (!isJsonObject(body)) {
    return invalidInput(c, "purchaseToken and userId are required");
  }
  const payload = body as { purchaseToken?: string; userId?: string };
  if (
    !isNonBlankString(payload.purchaseToken) ||
    !isNonBlankString(payload.userId)
  ) {
    return invalidInput(c, "purchaseToken and userId are required");
  }
  const normalizedPurchaseToken = normalizeBindUserPurchaseToken(
    payload.purchaseToken,
  );
  if (!normalizedPurchaseToken.ok) {
    return invalidInput(c, normalizedPurchaseToken.message);
  }
  if (!isValidUserIdLength(payload.userId)) {
    return invalidInput(c, "userId must be ≤ 256 chars");
  }
  try {
    const result = await client.mutation(api.subscriptions.mutation.bindUser, {
      apiKey,
      purchaseToken: normalizedPurchaseToken.purchaseToken,
      userId: payload.userId,
    });
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_BIND_USER_FAILED",
      "Subscription user binding failed",
    );
  }
});

function parseLimit(raw: string | undefined): number | undefined | null {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return Math.min(n, 200);
}

function isValidUserIdLength(userId: string): boolean {
  return userId.length <= MAX_USER_ID_LENGTH;
}

function isValidProductIdLength(productId: string): boolean {
  return productId.length <= MAX_PRODUCT_ID_LENGTH;
}

type BindUserPurchaseTokenResult =
  | { ok: true; purchaseToken: string }
  | { ok: false; message: string };
type AppleJwsParseResult =
  | { kind: "valid"; purchaseToken: string }
  | { kind: "invalid" }
  | { kind: "notAppleJws" };

function normalizeBindUserPurchaseToken(
  purchaseToken: string,
): BindUserPurchaseTokenResult {
  if (isCompactJwsShape(purchaseToken)) {
    if (purchaseToken.length > APPLE_JWS_MAX_LENGTH) {
      return { ok: false, message: bindUserPurchaseTokenLimitMessage() };
    }

    const appleJws = parseApplePurchaseTokenFromJws(purchaseToken);
    if (appleJws.kind === "valid") {
      return { ok: true, purchaseToken: appleJws.purchaseToken };
    }
    if (appleJws.kind === "invalid") {
      return {
        ok: false,
        message: INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE,
      };
    }
    if (purchaseToken.length <= GOOGLE_PURCHASE_TOKEN_MAX_LENGTH) {
      return { ok: true, purchaseToken };
    }

    return {
      ok: false,
      message: INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE,
    };
  }

  if (purchaseToken.length <= GOOGLE_PURCHASE_TOKEN_MAX_LENGTH) {
    return { ok: true, purchaseToken };
  }

  return { ok: false, message: bindUserPurchaseTokenLimitMessage() };
}

function parseApplePurchaseTokenFromJws(jws: string): AppleJwsParseResult {
  if (!isCompactJwsShape(jws) || jws.length > APPLE_JWS_MAX_LENGTH) {
    return { kind: "notAppleJws" };
  }

  try {
    const [headerBase64, payloadBase64] = jws.split(".");
    const header = decodeJwsJsonPart(headerBase64);
    const payload = decodeJwsJsonPart(payloadBase64);

    if (!isJsonObject(header) || !isJsonObject(payload)) {
      return { kind: "notAppleJws" };
    }

    const originalTransactionId = normalizeTransactionId(
      payload.originalTransactionId,
    );
    if (originalTransactionId) {
      return { kind: "valid", purchaseToken: originalTransactionId };
    }

    const transactionId = normalizeTransactionId(payload.transactionId);
    if (transactionId) {
      return { kind: "valid", purchaseToken: transactionId };
    }
  } catch {
    return { kind: "notAppleJws" };
  }

  return { kind: "invalid" };
}

function isCompactJwsShape(value: string): boolean {
  return APPLE_JWS_PATTERN.test(value);
}

function decodeJwsJsonPart(part: string): unknown {
  const raw = Buffer.from(part, "base64url").toString("utf-8");
  const safeRaw = raw.replace(
    /"((?:originalT|t)ransactionId)"\s*:\s*(\d+)(?=\s*[,}])/g,
    '"$1":"$2"',
  );
  return JSON.parse(safeRaw);
}

function normalizeTransactionId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function bindUserPurchaseTokenLimitMessage(): string {
  return `purchaseToken must be ≤ ${GOOGLE_PURCHASE_TOKEN_MAX_LENGTH} chars, or an Apple JWS ≤ ${APPLE_JWS_MAX_LENGTH} chars`;
}

function isSubscriptionState(state: string): state is SubscriptionState {
  return SUBSCRIPTION_STATES.has(state);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidInput(c: Context, message: string) {
  return c.json({ errors: [{ code: "INVALID_INPUT", message }] }, 400);
}

function payloadTooLarge(c: Context) {
  return c.json(
    {
      errors: [
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "Subscription payload is too large",
        },
      ],
    },
    413,
  );
}

async function pathApiKeyGuard(c: Context, next: Next) {
  const validationError = apiKeyValidationError(c.req.param("apiKey"));
  if (validationError) {
    return c.json(
      { errors: [{ code: "INVALID_API_KEY", message: validationError }] },
      403,
    );
  }
  if (
    c.req.method !== "GET" &&
    isContentLengthOverLimit(
      c.req.header("content-length"),
      MAX_BIND_USER_BODY_BYTES,
    )
  ) {
    return payloadTooLarge(c);
  }
  await next();
}

function subscriptionRouteError(
  c: Context,
  error: unknown,
  code: string,
  fallbackMessage: string,
) {
  const convexError = handleConvexError(error);
  if (convexError) {
    return c.json({ errors: [convexError] }, 400);
  }

  console.error(`[subscriptions] ${code}`, describeErrorForLog(error));
  return c.json({ errors: [{ code, message: fallbackMessage }] }, 500);
}

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export { subscriptions as subscriptionsRoutes };
