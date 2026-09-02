import { productLocalizationsValidator } from "./localizations";
import { productRegionsValidator } from "./regions";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import {
  resolveProjectByApiKeyFromDb,
  resolveProjectByIdForCurrentUserFromDb,
} from "../projects/helpers";

const offerShape = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("FreeTrial"),
    v.literal("IntroPayUpFront"),
    v.literal("IntroPayAsYouGo"),
    v.literal("PromotionalOffer"),
    v.literal("BasePlan"),
  ),
  duration: v.optional(v.string()),
  numberOfPeriods: v.optional(v.number()),
  priceAmountMicros: v.optional(v.number()),
  currency: v.optional(v.string()),
});

const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const clientPayloadShape = v.object({
  format: v.union(v.literal("toml"), v.literal("json"), v.literal("text")),
  body: v.string(),
  version: v.number(),
  updatedAt: v.number(),
});
const clientPayloadSummaryShape = v.object({
  platform: platformValidator,
  productId: v.string(),
  format: v.union(v.literal("toml"), v.literal("json"), v.literal("text")),
  version: v.number(),
  updatedAt: v.number(),
});
const clientPayloadEditorStateShape = v.object({
  expectedVersion: v.number(),
  clientPayload: v.optional(clientPayloadShape),
});
const conditionalClientPayloadShape = v.union(
  v.object({
    status: v.literal("found"),
    clientPayload: clientPayloadShape,
  }),
  v.object({
    status: v.literal("not_modified"),
    version: v.number(),
  }),
  v.object({ status: v.literal("not_found") }),
);
type ClientPayloadEditorState = Infer<typeof clientPayloadEditorStateShape>;

export const DEFAULT_CLIENT_PAYLOAD_PAGE_SIZE = 25;
export const MAX_CLIENT_PAYLOAD_PAGE_SIZE = 50;
const MAX_CLIENT_PAYLOAD_CURSOR_LENGTH = 4096;

export const getCatalogPriceInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    productId: v.string(),
  },
  returns: v.union(
    v.object({
      currency: v.string(),
      priceAmountMicros: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (
      !product ||
      product.state === "Removed" ||
      product.currency === undefined ||
      product.priceAmountMicros === undefined
    ) {
      return null;
    }
    return {
      currency: product.currency,
      priceAmountMicros: product.priceAmountMicros,
    };
  },
});

const productShape = v.object({
  productId: v.string(),
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  type: v.union(
    v.literal("Subscription"),
    v.literal("NonConsumable"),
    v.literal("Consumable"),
  ),
  title: v.string(),
  description: v.optional(v.string()),
  baseLocale: v.optional(v.string()),
  localizations: v.optional(productLocalizationsValidator),
  regions: v.optional(productRegionsValidator),
  priceAmountMicros: v.optional(v.number()),
  currency: v.optional(v.string()),
  state: v.union(
    v.literal("Draft"),
    v.literal("Ready"),
    v.literal("Active"),
    v.literal("Removed"),
  ),
  storeRef: v.optional(v.string()),
  subscriptionGroupId: v.optional(v.string()),
  subscriptionGroupName: v.optional(v.string()),
  // Subscription billing period — surfaced so the dashboard's
  // price column can render "USD 9.99 / 1 month" for parity with
  // the Android base-plan badges. iOS rows that lack a period in
  // the cached metadata fall back to the bare price.
  billingPeriod: v.optional(
    v.union(
      v.literal("P1W"),
      v.literal("P1M"),
      v.literal("P2M"),
      v.literal("P3M"),
      v.literal("P6M"),
      v.literal("P1Y"),
    ),
  ),
  offers: v.optional(v.array(offerShape)),
  clientPayload: v.optional(clientPayloadShape),
  updatedAt: v.number(),
});

type ProductClientPayloadView = Infer<typeof clientPayloadShape>;
type ProductView = Infer<typeof productShape>;

function shapeClientPayload(
  payload: Doc<"productClientPayloads">,
): ProductClientPayloadView {
  return {
    format: payload.format,
    body: payload.body,
    version: payload.version,
    updatedAt: payload.updatedAt,
  };
}

function shape(
  product: Doc<"products">,
  payload?: Doc<"productClientPayloads">,
): ProductView {
  return {
    productId: product.productId,
    platform: product.platform,
    type: product.type,
    title: product.title,
    description: product.description,
    baseLocale: product.baseLocale,
    // Coerce the nullable column to optional: "cleared" and "never set"
    // read the same, and the dashboard form needs this to prefill rather
    // than silently discarding stored locales on the next save.
    localizations: product.localizations ?? undefined,
    // Hide stale values written before region support was limited to
    // Android one-time products. Returning them would make REST/MCP clients
    // believe an iOS or subscription footprint is active even though no
    // store push can apply it.
    regions:
      product.platform === "Android" &&
      product.type !== "Subscription" &&
      (product.regions === "all" ||
        (Array.isArray(product.regions) && product.regions.length > 0))
        ? product.regions
        : undefined,
    priceAmountMicros: product.priceAmountMicros,
    currency: product.currency,
    state: product.state,
    storeRef: product.storeRef,
    // The schema widened these to `string | null` so
    // `upsertFromStore` can clear stale values via patch (Convex
    // treats `undefined` as no-op). Coerce back to optional at
    // the public-query boundary so the dashboard / SDK clients
    // don't need to handle `null` — pre-existing call sites only
    // checked `.subscriptionGroupName` for truthiness, which still
    // works after coercion.
    subscriptionGroupId: product.subscriptionGroupId ?? undefined,
    subscriptionGroupName: product.subscriptionGroupName ?? undefined,
    billingPeriod: product.billingPeriod,
    offers: product.offers,
    ...(payload ? { clientPayload: shapeClientPayload(payload) } : {}),
    updatedAt: product.updatedAt,
  };
}

export const getProductClientPayload = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    platform: platformValidator,
    productId: v.string(),
  },
  returns: v.union(clientPayloadShape, v.null()),
  handler: async (ctx, args) => {
    const resolved = args.projectId
      ? await resolveProjectByIdForCurrentUserFromDb(ctx, args.projectId)
      : args.apiKey
        ? await resolveProjectByApiKeyFromDb(ctx, args.apiKey)
        : null;
    const project = resolved?.project ?? null;
    if (!project) return null;

    // Payload rows intentionally outlive catalog resets so a later store pull
    // can reattach them. API-key reads must not expose absent, Draft, or
    // Removed catalog entries. Authenticated dashboard reads may load a
    // Removed row so an operator can edit or delete its retained payload.
    const product = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!product) return null;
    if (args.apiKey) {
      const keyType =
        (resolved as { keyType?: "publishable" | "secret" }).keyType ??
        "publishable";
      if (product.state === "Removed") return null;
      if (!isCatalogRowVisibleTo(keyType, product)) return null;
    }

    const payload = await ctx.db
      .query("productClientPayloads")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();

    return payload ? shapeClientPayload(payload) : null;
  },
});

/**
 * App-facing conditional payload read. The body-free summary is checked before
 * the 16 KiB payload row, so a matching ETag still authenticates and verifies
 * catalog visibility but avoids reading or returning the body document.
 */
export const getProductClientPayloadIfChanged = query({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    productId: v.string(),
    knownVersion: v.optional(v.number()),
  },
  returns: conditionalClientPayloadShape,
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved) return { status: "not_found" } as const;

    const product = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", resolved.project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (
      !product ||
      !isCatalogRowVisibleTo(resolved.keyType, product) ||
      product.state === "Removed"
    ) {
      return { status: "not_found" } as const;
    }

    const summary = await ctx.db
      .query("productClientPayloadSummaries")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", resolved.project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (summary?.deleted === true) {
      return { status: "not_found" } as const;
    }
    if (
      summary &&
      args.knownVersion !== undefined &&
      summary.version === args.knownVersion
    ) {
      return { status: "not_modified", version: summary.version } as const;
    }

    const payload = await ctx.db
      .query("productClientPayloads")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", resolved.project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    return payload
      ? ({
          status: "found",
          clientPayload: shapeClientPayload(payload),
        } as const)
      : ({ status: "not_found" } as const);
  },
});

/**
 * Authenticated editor read that exposes the durable OCC revision without
 * exposing tombstone metadata or bodies to API-key clients. A deleted payload
 * returns no `clientPayload`, but its monotonic `expectedVersion` lets the next
 * editor save create revision N+1 instead of resetting to 1.
 */
export const getProductClientPayloadEditorState = query({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    productId: v.string(),
  },
  returns: v.union(clientPayloadEditorStateShape, v.null()),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    if (!resolved) return null;

    return loadProductClientPayloadEditorState(
      ctx,
      resolved.project._id,
      args.platform,
      args.productId,
    );
  },
});

/**
 * Secret-key equivalent of the dashboard editor read. This lets MCP, CI, and
 * other trusted automation recover the durable OCC revision after deletion.
 */
export const getProductClientPayloadEditorStateWithApiKey = query({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    productId: v.string(),
  },
  returns: v.union(clientPayloadEditorStateShape, v.null()),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) return null;
    return loadProductClientPayloadEditorState(
      ctx,
      resolved.project._id,
      args.platform,
      args.productId,
    );
  },
});

async function loadProductClientPayloadEditorState(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  platform: "IOS" | "Android",
  productId: string,
): Promise<ClientPayloadEditorState> {
  const [payload, summary] = await Promise.all([
    ctx.db
      .query("productClientPayloads")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", projectId)
          .eq("platform", platform)
          .eq("productId", productId),
      )
      .unique(),
    ctx.db
      .query("productClientPayloadSummaries")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", projectId)
          .eq("platform", platform)
          .eq("productId", productId),
      )
      .unique(),
  ]);
  const expectedVersion = Math.max(
    payload?.version ?? 0,
    summary?.version ?? 0,
  );
  return {
    expectedVersion,
    ...(payload && summary?.deleted !== true
      ? { clientPayload: shapeClientPayload(payload) }
      : {}),
  };
}

/**
 * Body-free metadata for the authenticated dashboard. Payload summaries live
 * in their own table so this query never reads the potentially 16 KiB body
 * documents merely to render an Add/Edit badge in the product table.
 */
export const listProductClientPayloadSummaries = query({
  args: { projectId: v.id("projects") },
  returns: v.array(clientPayloadSummaryShape),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    if (!resolved) return [];

    const summaries = await ctx.db
      .query("productClientPayloadSummaries")
      .withIndex("by_project", (q) => q.eq("projectId", resolved.project._id))
      .collect();
    return summaries
      .filter((summary) => summary.deleted !== true)
      .map((summary) => ({
        platform: summary.platform,
        productId: summary.productId,
        format: summary.format,
        version: summary.version,
        updatedAt: summary.updatedAt,
      }));
  },
});

function assertClientPayloadPageArgs(args: {
  platform?: "IOS" | "Android";
  limit?: number;
  cursor?: string;
}): void {
  if (!args.platform) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "platform is required when includeClientPayload=true",
    });
  }
  assertProductPageArgs(args);
}

function assertProductPageArgs(args: {
  limit?: number;
  cursor?: string;
}): void {
  if (
    args.limit !== undefined &&
    (!Number.isSafeInteger(args.limit) ||
      args.limit < 1 ||
      args.limit > MAX_CLIENT_PAYLOAD_PAGE_SIZE)
  ) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: `limit must be an integer between 1 and ${MAX_CLIENT_PAYLOAD_PAGE_SIZE}`,
    });
  }
  if (
    args.cursor !== undefined &&
    (!args.cursor.trim() ||
      args.cursor.length > MAX_CLIENT_PAYLOAD_CURSOR_LENGTH)
  ) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: `cursor must be a non-empty string of at most ${MAX_CLIENT_PAYLOAD_CURSOR_LENGTH} characters`,
    });
  }
}

export const listProducts = query({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    platform: v.optional(platformValidator),
  },
  returns: v.array(productShape),
  handler: async (ctx, args) => {
    const resolved = args.projectId
      ? await resolveProjectByIdForCurrentUserFromDb(ctx, args.projectId)
      : args.apiKey
        ? await resolveProjectByApiKeyFromDb(ctx, args.apiKey)
        : null;
    const project = resolved?.project ?? null;
    if (!project) return [];
    // The projectId branch is an authenticated dashboard read; the apiKey
    // branch can be a publishable key shipped inside an app.
    const keyType = args.projectId
      ? ("secret" as const)
      : ((resolved as { keyType?: "publishable" | "secret" }).keyType ??
        "publishable");

    const rows = args.platform
      ? await ctx.db
          .query("products")
          .withIndex("by_project_and_platform", (q) =>
            q.eq("projectId", project._id).eq("platform", args.platform!),
          )
          .collect()
      : await ctx.db
          .query("products")
          .withIndex("by_project_and_platform_and_product", (q) =>
            q.eq("projectId", project._id),
          )
          .collect();

    return rows
      .filter((row) => isCatalogRowVisibleTo(keyType, row))
      .map((row) => shape(row));
  },
});

// Publishable keys ship inside apps: hide unreleased rows (Draft — authored
// drafts, plus the fail-closed bucket for store states the pull mappers do not
// recognize) and rows pulled from sale (Removed). Ready rows are already in
// the store pipeline — purchasable in sandbox while under review — so hiding
// them would empty a catalog for the whole review window.
function isCatalogRowVisibleTo(
  keyType: "publishable" | "secret",
  row: Pick<Doc<"products">, "state">,
): boolean {
  if (keyType === "secret") return true;
  return row.state === "Active" || row.state === "Ready";
}

/** Bounded app/API catalog read; dashboard operator reads use listProducts. */
export const listProductsPage = query({
  args: {
    apiKey: v.string(),
    platform: v.optional(platformValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    products: v.array(productShape),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    assertProductPageArgs(args);
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved) return { products: [], hasMore: false };
    const keyType = resolved.keyType ?? "publishable";

    // A page filters after pagination, so it can come back short (or empty)
    // while hasMore is true; the documented contract is cursor iteration.
    const pageQuery = args.platform
      ? ctx.db
          .query("products")
          .withIndex("by_project_and_platform", (q) =>
            q
              .eq("projectId", resolved.project._id)
              .eq("platform", args.platform!),
          )
      : ctx.db
          .query("products")
          .withIndex("by_project_and_platform_and_product", (q) =>
            q.eq("projectId", resolved.project._id),
          );
    const page = await pageQuery.paginate({
      numItems: args.limit ?? DEFAULT_CLIENT_PAYLOAD_PAGE_SIZE,
      cursor: args.cursor ?? null,
    });

    return {
      products: page.page
        .filter((row) => isCatalogRowVisibleTo(keyType, row))
        .map((row) => shape(row)),
      hasMore: !page.isDone,
      ...(!page.isDone ? { nextCursor: page.continueCursor } : {}),
    };
  },
});

/**
 * App-facing payload-inclusive catalog read. Kept separate from listProducts
 * so the long-standing default query remains an array with no payload reads.
 */
export const listProductsWithClientPayloads = query({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    products: v.array(productShape),
    hasMore: v.boolean(),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    assertClientPayloadPageArgs(args);
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved) return { products: [], hasMore: false };
    const keyType = resolved.keyType ?? "publishable";

    const pageQuery = ctx.db
      .query("products")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", resolved.project._id).eq("platform", args.platform),
      );
    const page = await pageQuery.paginate({
      numItems: args.limit ?? DEFAULT_CLIENT_PAYLOAD_PAGE_SIZE,
      cursor: args.cursor ?? null,
    });

    // The product page is bounded before any body lookup. Exact indexed reads
    // keep off-page payload bodies out of this query's memory budget.
    const products = await Promise.all(
      page.page
        .filter((row) => isCatalogRowVisibleTo(keyType, row))
        .map(async (row) => {
          if (row.state === "Removed") return shape(row);
          const payload = await ctx.db
            .query("productClientPayloads")
            .withIndex("by_project_and_platform_and_product", (q) =>
              q
                .eq("projectId", resolved.project._id)
                .eq("platform", row.platform)
                .eq("productId", row.productId),
            )
            .unique();
          return shape(row, payload ?? undefined);
        }),
    );

    return {
      products,
      hasMore: !page.isDone,
      ...(!page.isDone ? { nextCursor: page.continueCursor } : {}),
    };
  },
});
