import { Hono, type Context, type Next } from "hono";
import { ConvexError } from "convex/values";

import { api } from "@/convex";
import type { Id } from "@/convex";
import { client, handleConvexError } from "../../convex";
import { apiKeyValidationError } from "./middleware";
import {
  isContentLengthOverLimit,
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "./request-body";

// Catalog read/write surface mirroring onesub's @onesub/providers
// admin path. Store sync is queued through background jobs so the
// dashboard, MCP server, and API clients do not hold browser/mobile
// HTTP connections open while App Store Connect or Play Console work runs.

const products = new Hono();
const MAX_PRODUCT_ID_LENGTH = 256;
const MAX_SYNC_JOB_ID_LENGTH = 256;
const MAX_PRODUCT_BODY_BYTES = 64 * 1024;
const DEFAULT_CLIENT_PAYLOAD_PAGE_SIZE = 25;
const MAX_CLIENT_PAYLOAD_PAGE_SIZE = 50;
const MAX_CLIENT_PAYLOAD_CURSOR_LENGTH = 4096;

type ProductPlatform = "IOS" | "Android";
type ProductType = "Subscription" | "NonConsumable" | "Consumable";
type ProductState = "Draft" | "Ready" | "Active" | "Removed";
type BillingPeriod = "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
type SyncDirection = "pull" | "push" | "both" | "purge-local";
const PRODUCT_PLATFORMS = new Set<string>(["IOS", "Android"]);
const PRODUCT_TYPES = new Set<string>([
  "Subscription",
  "NonConsumable",
  "Consumable",
]);
const PRODUCT_STATES = new Set<string>(["Draft", "Ready", "Active", "Removed"]);
const BILLING_PERIODS = new Set<string>([
  "P1W",
  "P1M",
  "P2M",
  "P3M",
  "P6M",
  "P1Y",
]);
const SYNC_DIRECTIONS = new Set<string>([
  "pull",
  "push",
  "both",
  "purge-local",
]);

products.use("/:apiKey", pathApiKeyGuard);
products.use("/:apiKey/*", pathApiKeyGuard);

products.get("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const platformParam = c.req.query("platform");
  const includeClientPayloadParam = c.req.query("includeClientPayload");
  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const includeClientPayload = parseOptionalBoolean(includeClientPayloadParam);
  if (includeClientPayload === null) {
    return invalidInput(c, "includeClientPayload must be true|false");
  }
  let platform: ProductPlatform | undefined;
  if (platformParam !== undefined) {
    if (!isProductPlatform(platformParam)) {
      return invalidInput(c, "platform must be IOS|Android");
    }
    platform = platformParam;
  }
  if (includeClientPayload === true && !platform) {
    return invalidInput(
      c,
      "platform is required when includeClientPayload=true",
    );
  }
  const limit =
    includeClientPayload === true
      ? parseClientPayloadPageLimit(limitParam)
      : undefined;
  if (limit === null) {
    return invalidInput(
      c,
      `limit must be an integer between 1 and ${MAX_CLIENT_PAYLOAD_PAGE_SIZE}`,
    );
  }
  if (
    includeClientPayload === true &&
    cursor !== undefined &&
    (!cursor.trim() || cursor.length > MAX_CLIENT_PAYLOAD_CURSOR_LENGTH)
  ) {
    return invalidInput(
      c,
      `cursor must be a non-empty string of at most ${MAX_CLIENT_PAYLOAD_CURSOR_LENGTH} characters`,
    );
  }
  try {
    if (includeClientPayload === true) {
      const page = await client.query(
        api.products.query.listProductsWithClientPayloads,
        {
          apiKey,
          platform: platform!,
          limit: limit!,
          ...(cursor !== undefined ? { cursor } : {}),
        },
      );
      return c.json(page);
    }
    const list = await client.query(api.products.query.listProducts, {
      apiKey,
      platform,
    });
    return c.json({ products: list });
  } catch (error) {
    if (
      includeClientPayload === true &&
      cursor !== undefined &&
      isInvalidPaginationCursor(error)
    ) {
      return c.json(
        {
          errors: [
            {
              code: "INVALID_CURSOR",
              message:
                "cursor is no longer valid; restart from the first page without cursor",
            },
          ],
        },
        400,
      );
    }
    return productRouteError(
      c,
      error,
      "PRODUCT_LIST_FAILED",
      "Product list failed",
    );
  }
});

products.post("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: unknown;
  try {
    body = await readProductJsonBody(c.req.raw);
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
    return invalidInput(c, "productId, platform, type, title are required");
  }
  const payload = body as {
    productId?: string;
    platform?: "IOS" | "Android";
    type?: ProductType;
    title?: string;
    description?: string;
    priceAmountMicros?: number;
    currency?: string;
    billingPeriod?: BillingPeriod;
    subscriptionGroupName?: string;
    reviewNote?: string;
    state?: ProductState;
    storeRef?: string;
  };
  if (
    !isNonBlankString(payload.productId) ||
    !payload.platform ||
    !payload.type ||
    payload.title == null
  ) {
    return invalidInput(c, "productId, platform, type, title are required");
  }
  if (!isValidProductIdLength(payload.productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }
  if (!isProductPlatform(payload.platform)) {
    return invalidInput(c, "platform must be IOS|Android");
  }
  if (!isProductType(payload.type)) {
    return invalidInput(
      c,
      "type must be Subscription|NonConsumable|Consumable",
    );
  }
  if (typeof payload.title !== "string") {
    return invalidInput(c, "title must be a string");
  }
  if (!payload.title.trim()) {
    return invalidInput(c, "productId, platform, type, title are required");
  }
  if (
    !areOptionalStrings(
      payload.description,
      payload.currency,
      payload.subscriptionGroupName,
      payload.reviewNote,
      payload.storeRef,
    )
  ) {
    return invalidInput(
      c,
      "description, currency, subscriptionGroupName, reviewNote, storeRef must be strings",
    );
  }
  if (
    payload.billingPeriod !== undefined &&
    !isBillingPeriod(payload.billingPeriod)
  ) {
    return invalidInput(c, "billingPeriod is invalid");
  }
  if (
    payload.priceAmountMicros !== undefined &&
    !isValidPriceAmountMicros(payload.priceAmountMicros)
  ) {
    return invalidInput(
      c,
      "priceAmountMicros must be a non-negative safe integer",
    );
  }
  if (payload.state !== undefined && !isProductState(payload.state)) {
    return invalidInput(c, "state must be Draft|Ready|Active|Removed");
  }
  if (
    payload.platform === "IOS" &&
    payload.type === "Subscription" &&
    !payload.subscriptionGroupName?.trim()
  ) {
    return invalidInput(
      c,
      "subscriptionGroupName is required for iOS Subscription products",
    );
  }
  try {
    const result = await client.mutation(api.products.mutation.upsertProduct, {
      apiKey,
      productId: payload.productId,
      platform: payload.platform,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      priceAmountMicros: payload.priceAmountMicros,
      currency: payload.currency,
      billingPeriod: payload.billingPeriod,
      subscriptionGroupName: payload.subscriptionGroupName,
      reviewNote: payload.reviewNote,
      state: payload.state,
      storeRef: payload.storeRef,
    });
    return c.json(result);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_UPSERT_FAILED",
      "Product upsert failed",
    );
  }
});

// State-only update for the existing row. MCP `manage_product` uses
// this so it doesn't have to re-supply `type` / `title` (and thus
// can't accidentally clobber them, which the prior `upsertProduct`
// reuse pattern silently did).
products.post("/:apiKey/state", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: unknown;
  try {
    body = await readProductJsonBody(c.req.raw);
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
    return invalidInput(c, "productId, platform, state are required");
  }
  const payload = body as {
    productId?: string;
    platform?: ProductPlatform;
    state?: ProductState;
  };
  if (
    !isNonBlankString(payload.productId) ||
    !payload.platform ||
    !payload.state
  ) {
    return invalidInput(c, "productId, platform, state are required");
  }
  if (!isValidProductIdLength(payload.productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }
  if (!isProductPlatform(payload.platform)) {
    return invalidInput(c, "platform must be IOS|Android");
  }
  if (!isProductState(payload.state)) {
    return invalidInput(c, "state must be Draft|Ready|Active|Removed");
  }
  try {
    const result = await client.mutation(
      api.products.mutation.setProductState,
      {
        apiKey,
        productId: payload.productId,
        platform: payload.platform,
        state: payload.state,
      },
    );
    return c.json(result);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_STATE_FAILED",
      "Product state update failed",
    );
  }
});

// Enqueue an async sync job. Returns `{ jobId, deduped }`
// immediately. The caller polls `GET .../sync/jobs/:jobId` until
// `status` is `succeeded` or `failed`. The previous synchronous
// endpoint held the HTTP connection open for the entire sync, which
// iOS Safari aborted on cellular / backgrounded tabs as
// `TypeError: Load failed`.
products.post("/:apiKey/sync/:platform", async (c) => {
  const apiKey = c.req.param("apiKey");
  const platformParam = c.req.param("platform");
  const direction = c.req.query("direction") ?? "both";
  const dryRunParam = c.req.query("dryRun");
  if (platformParam !== "ios" && platformParam !== "android") {
    return invalidInput(c, "platform must be ios|android");
  }
  if (!isSyncDirection(direction)) {
    return invalidInput(c, "direction must be pull|push|both|purge-local");
  }
  if (
    dryRunParam !== undefined &&
    dryRunParam !== "true" &&
    dryRunParam !== "false"
  ) {
    return invalidInput(c, "dryRun must be true|false");
  }
  const dryRun = dryRunParam === "true";
  const platform: "IOS" | "Android" =
    platformParam === "ios" ? "IOS" : "Android";
  try {
    const result = await client.mutation(api.products.jobs.enqueueProductSync, {
      apiKey,
      platform,
      direction,
      dryRun,
    });
    return c.json(result, 202);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_SYNC_ENQUEUE_FAILED",
      "Product sync enqueue failed",
    );
  }
});

// Poll the job state. Clients should backoff (e.g. 3s) between
// polls; the typical sync finishes in tens of seconds, larger
// catalogs in 1-2 min. SSE is a future option; polling kept simple
// for v1.
products.get("/:apiKey/sync/jobs/:jobId", async (c) => {
  const apiKey = c.req.param("apiKey");
  const jobId = c.req.param("jobId");
  if (!isNonBlankString(jobId)) {
    return invalidInput(c, "jobId must not be empty");
  }
  if (!isValidSyncJobIdLength(jobId)) {
    return invalidInput(c, "jobId must be ≤ 256 chars");
  }
  try {
    const job = await client.query(api.products.jobs.getSyncJobById, {
      apiKey,
      jobId: jobId as Id<"productSyncJobs">,
    });
    if (!job) {
      return c.json(
        { errors: [{ code: "NOT_FOUND", message: "Sync job not found" }] },
        404,
      );
    }
    return c.json(job);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_SYNC_LOOKUP_FAILED",
      "Product sync lookup failed",
    );
  }
});

// Operator-initiated cancel. The worker checks `cancelRequested`
// at phase boundaries.
products.post("/:apiKey/sync/jobs/:jobId/cancel", async (c) => {
  const apiKey = c.req.param("apiKey");
  const jobId = c.req.param("jobId");
  if (!isNonBlankString(jobId)) {
    return invalidInput(c, "jobId must not be empty");
  }
  if (!isValidSyncJobIdLength(jobId)) {
    return invalidInput(c, "jobId must be ≤ 256 chars");
  }
  try {
    const result = await client.mutation(api.products.jobs.cancelProductSync, {
      apiKey,
      jobId: jobId as Id<"productSyncJobs">,
    });
    return c.json(result);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_SYNC_CANCEL_FAILED",
      "Product sync cancel failed",
    );
  }
});

// Read-only client payload endpoint. Writes intentionally remain dashboard
// mutations authenticated by project membership; an API key can only read the
// metadata destined for that project's app clients.
products.get("/:apiKey/:productId/client-payload", async (c) => {
  const apiKey = c.req.param("apiKey");
  const productId = c.req.param("productId");
  const platformParam = c.req.query("platform");
  if (!isProductPlatform(platformParam)) {
    return invalidInput(c, "platform query param required (IOS | Android)");
  }
  if (!isNonBlankString(productId)) {
    return invalidInput(c, "productId must not be empty");
  }
  if (!isValidProductIdLength(productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }

  try {
    const clientPayload = await client.query(
      api.products.query.getProductClientPayload,
      { apiKey, productId, platform: platformParam },
    );
    if (!clientPayload) {
      return c.json(
        {
          errors: [
            {
              code: "NOT_FOUND",
              message: "Product client payload not found",
            },
          ],
        },
        404,
      );
    }
    return c.json({ clientPayload });
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_CLIENT_PAYLOAD_LOOKUP_FAILED",
      "Product client payload lookup failed",
    );
  }
});

products.delete("/:apiKey/:productId", async (c) => {
  const apiKey = c.req.param("apiKey");
  const productId = c.req.param("productId");
  const platformParam = c.req.query("platform");
  if (!isProductPlatform(platformParam)) {
    return invalidInput(c, "platform query param required (IOS | Android)");
  }
  if (!isNonBlankString(productId)) {
    return invalidInput(c, "productId must not be empty");
  }
  if (!isValidProductIdLength(productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }
  try {
    const result = await client.mutation(api.products.mutation.removeProduct, {
      apiKey,
      productId,
      platform: platformParam,
    });
    return c.json(result);
  } catch (error) {
    return productRouteError(
      c,
      error,
      "PRODUCT_REMOVE_FAILED",
      "Product remove failed",
    );
  }
});

function isValidProductIdLength(productId: string): boolean {
  return productId.length <= MAX_PRODUCT_ID_LENGTH;
}

function isValidSyncJobIdLength(jobId: string): boolean {
  return jobId.length <= MAX_SYNC_JOB_ID_LENGTH;
}

function isValidPriceAmountMicros(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isProductPlatform(value: unknown): value is ProductPlatform {
  return typeof value === "string" && PRODUCT_PLATFORMS.has(value);
}

function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && PRODUCT_TYPES.has(value);
}

function isProductState(value: unknown): value is ProductState {
  return typeof value === "string" && PRODUCT_STATES.has(value);
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === "string" && BILLING_PERIODS.has(value);
}

function isSyncDirection(direction: string): direction is SyncDirection {
  return SYNC_DIRECTIONS.has(direction);
}

function parseOptionalBoolean(
  value: string | undefined,
): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function areOptionalStrings(...values: unknown[]): boolean {
  return values.every(
    (value) => value === undefined || typeof value === "string",
  );
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseClientPayloadPageLimit(value: string | undefined): number | null {
  if (value === undefined) return DEFAULT_CLIENT_PAYLOAD_PAGE_SIZE;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= MAX_CLIENT_PAYLOAD_PAGE_SIZE
    ? parsed
    : null;
}

function isInvalidPaginationCursor(error: unknown): boolean {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "isConvexSystemError" in data &&
      data.isConvexSystemError === true &&
      "paginationError" in data &&
      data.paginationError === "InvalidCursor"
    ) {
      return true;
    }
  }
  return error instanceof Error && error.message.includes("InvalidCursor");
}

function invalidInput(c: Context, message: string) {
  return c.json({ errors: [{ code: "INVALID_INPUT", message }] }, 400);
}

function payloadTooLarge(c: Context) {
  return c.json(
    {
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Product payload is too large" },
      ],
    },
    413,
  );
}

function readProductJsonBody(request: Request) {
  return readJsonBodyWithLimit(
    request,
    MAX_PRODUCT_BODY_BYTES,
    "Product payload is too large",
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
      MAX_PRODUCT_BODY_BYTES,
    )
  ) {
    return payloadTooLarge(c);
  }
  await next();
}

function productRouteError(
  c: Context,
  error: unknown,
  code: string,
  fallbackMessage: string,
) {
  const convexError = handleConvexError(error);
  if (convexError) {
    return c.json({ errors: [convexError] }, 400);
  }

  console.error(`[products] ${code}`, describeErrorForLog(error));
  return c.json({ errors: [{ code, message: fallbackMessage }] }, 500);
}

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export { products as productsRoutes };
