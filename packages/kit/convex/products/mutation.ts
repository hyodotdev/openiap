import { mutation, type MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { parse as parseToml } from "smol-toml";

import {
  normalizeProductLocalizations,
  productLocalizationsValidator,
} from "./localizations";
import {
  resolveProjectByApiKeyFromDb,
  resolveProjectByIdForCurrentUserFromDb,
} from "../projects/helpers";

const platformValidator = v.union(v.literal("IOS"), v.literal("Android"));
const clientPayloadFormatValidator = v.union(
  v.literal("toml"),
  v.literal("json"),
  v.literal("text"),
);
const typeValidator = v.union(
  v.literal("Subscription"),
  v.literal("NonConsumable"),
  v.literal("Consumable"),
);
const stateValidator = v.union(
  v.literal("Draft"),
  v.literal("Ready"),
  v.literal("Active"),
  v.literal("Removed"),
);
type ProductState = "Draft" | "Ready" | "Active" | "Removed";
export type ProductClientPayloadFormat = "toml" | "json" | "text";

export const MAX_PRODUCT_CLIENT_PAYLOAD_BYTES = 16 * 1024;

type ProductClientPayloadErrorData = {
  [key: string]: string | number | boolean | null | undefined;
  code:
    | "CLIENT_PAYLOAD_INVALID"
    | "CLIENT_PAYLOAD_VERSION_CONFLICT"
    | "PRODUCT_NOT_FOUND"
    | "PROJECT_ACCESS_DENIED";
  message: string;
};

function clientPayloadError(
  code: ProductClientPayloadErrorData["code"],
  message: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
): ConvexError<ProductClientPayloadErrorData> {
  return new ConvexError<ProductClientPayloadErrorData>({
    code,
    message,
    ...details,
  });
}

/** Validate payload contents without normalizing the stored body. */
export function validateProductClientPayloadBody(
  format: ProductClientPayloadFormat,
  body: string,
): void {
  if (!body.trim()) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      "Client payload body must not be blank",
    );
  }

  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength > MAX_PRODUCT_CLIENT_PAYLOAD_BYTES) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      `Client payload body must be at most ${MAX_PRODUCT_CLIENT_PAYLOAD_BYTES} UTF-8 bytes`,
      { byteLength, maxBytes: MAX_PRODUCT_CLIENT_PAYLOAD_BYTES },
    );
  }

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "Client payload body is not valid JSON",
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "JSON client payload must contain an object at the top level",
      );
    }
  } else if (format === "toml") {
    try {
      parseToml(body);
    } catch {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "Client payload body is not valid TOML",
      );
    }
  }
}

export function assertProductClientPayloadVersion(
  expectedVersion: number,
  actualVersion: number | null,
): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      "expectedVersion must be a non-negative safe integer",
    );
  }
  if (expectedVersion !== (actualVersion ?? 0)) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_VERSION_CONFLICT",
      "Client payload was changed by another request",
      { expectedVersion, actualVersion },
    );
  }
}

export function nextStateForKitProductUpsert(
  requestedState?: ProductState,
): ProductState {
  return requestedState ?? "Draft";
}

async function resolveProjectForMutationArgs(
  ctx: MutationCtx,
  args: { apiKey?: string; projectId?: Id<"projects"> },
): Promise<Doc<"projects"> | null> {
  if (args.projectId) {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    return resolved?.project ?? null;
  }

  if (args.apiKey !== undefined) {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    return resolved?.project ?? null;
  }

  throw new Error("apiKey or projectId is required");
}

async function resolveProjectForClientPayloadMutation(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const resolved = await resolveProjectByIdForCurrentUserFromDb(ctx, projectId);
  if (!resolved) {
    throw clientPayloadError(
      "PROJECT_ACCESS_DENIED",
      "Project not found or access denied",
    );
  }
  return resolved.project;
}

async function syncProductClientPayloadSummary(
  ctx: MutationCtx,
  input: {
    projectId: Id<"projects">;
    platform: "IOS" | "Android";
    productId: string;
    format: ProductClientPayloadFormat;
    version: number;
    createdAt: number;
    updatedAt: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("productClientPayloadSummaries")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", input.projectId)
        .eq("platform", input.platform)
        .eq("productId", input.productId),
    )
    .unique();
  if (!existing) {
    await ctx.db.insert("productClientPayloadSummaries", {
      ...input,
      deleted: false,
    });
    return;
  }
  if (
    existing.format !== input.format ||
    existing.version !== input.version ||
    existing.updatedAt !== input.updatedAt ||
    existing.deleted === true
  ) {
    await ctx.db.patch(existing._id, {
      format: input.format,
      version: input.version,
      updatedAt: input.updatedAt,
      deleted: false,
    });
  }
}

function currentProductClientPayloadRevision(
  payload: Doc<"productClientPayloads"> | null,
  summary: Doc<"productClientPayloadSummaries"> | null,
): number {
  return Math.max(payload?.version ?? 0, summary?.version ?? 0);
}

type UpsertProductClientPayloadInput = {
  platform: "IOS" | "Android";
  productId: string;
  format: ProductClientPayloadFormat;
  body: string;
  expectedVersion?: number;
};

async function upsertProductClientPayloadForProject(
  ctx: MutationCtx,
  project: Doc<"projects">,
  args: UpsertProductClientPayloadInput,
) {
  validateProductClientPayloadBody(args.format, args.body);

  const product = await ctx.db
    .query("products")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", project._id)
        .eq("platform", args.platform)
        .eq("productId", args.productId),
    )
    .unique();
  if (!product) {
    throw clientPayloadError(
      "PRODUCT_NOT_FOUND",
      "A matching product must exist before client payload can be saved",
    );
  }

  const existing = await ctx.db
    .query("productClientPayloads")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", project._id)
        .eq("platform", args.platform)
        .eq("productId", args.productId),
    )
    .unique();
  const summary = await ctx.db
    .query("productClientPayloadSummaries")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", project._id)
        .eq("platform", args.platform)
        .eq("productId", args.productId),
    )
    .unique();
  const currentRevision = currentProductClientPayloadRevision(
    existing,
    summary,
  );
  if (args.expectedVersion !== undefined) {
    assertProductClientPayloadVersion(
      args.expectedVersion,
      currentRevision === 0 ? null : currentRevision,
    );
  }

  if (
    existing &&
    summary?.deleted !== true &&
    existing.version === currentRevision
  ) {
    if (existing.format === args.format && existing.body === args.body) {
      await syncProductClientPayloadSummary(ctx, {
        projectId: project._id,
        platform: args.platform,
        productId: args.productId,
        format: existing.format,
        version: existing.version,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
      return {
        id: existing._id,
        created: false,
        changed: false,
        version: existing.version,
        updatedAt: existing.updatedAt,
      };
    }

    const version = currentRevision + 1;
    const updatedAt = Date.now();
    await ctx.db.patch(existing._id, {
      format: args.format,
      body: args.body,
      version,
      updatedAt,
    });
    await syncProductClientPayloadSummary(ctx, {
      projectId: project._id,
      platform: args.platform,
      productId: args.productId,
      format: args.format,
      version,
      createdAt: existing.createdAt,
      updatedAt,
    });
    return {
      id: existing._id,
      created: false,
      changed: true,
      version,
      updatedAt,
    };
  }

  const now = Date.now();
  const version = currentRevision + 1;
  const id = existing
    ? existing._id
    : await ctx.db.insert("productClientPayloads", {
        projectId: project._id,
        platform: args.platform,
        productId: args.productId,
        format: args.format,
        body: args.body,
        version,
        createdAt: now,
        updatedAt: now,
      });
  if (existing) {
    await ctx.db.patch(existing._id, {
      format: args.format,
      body: args.body,
      version,
      updatedAt: now,
    });
  }
  await syncProductClientPayloadSummary(ctx, {
    projectId: project._id,
    platform: args.platform,
    productId: args.productId,
    format: args.format,
    version,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return {
    id,
    created: !existing,
    changed: true,
    version,
    updatedAt: now,
  };
}

async function removeProductClientPayloadForProject(
  ctx: MutationCtx,
  project: Doc<"projects">,
  args: {
    platform: "IOS" | "Android";
    productId: string;
    expectedVersion?: number;
  },
) {
  const existing = await ctx.db
    .query("productClientPayloads")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", project._id)
        .eq("platform", args.platform)
        .eq("productId", args.productId),
    )
    .unique();
  const summary = await ctx.db
    .query("productClientPayloadSummaries")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", project._id)
        .eq("platform", args.platform)
        .eq("productId", args.productId),
    )
    .unique();

  const currentRevision = currentProductClientPayloadRevision(
    existing,
    summary,
  );
  if (args.expectedVersion !== undefined) {
    assertProductClientPayloadVersion(
      args.expectedVersion,
      currentRevision === 0 ? null : currentRevision,
    );
  }
  if (!existing) return { ok: false };

  const version = currentRevision + 1;
  const updatedAt = Date.now();
  await ctx.db.delete(existing._id);
  if (summary) {
    await ctx.db.patch(summary._id, {
      format: existing.format,
      version,
      deleted: true,
      updatedAt,
    });
  } else {
    await ctx.db.insert("productClientPayloadSummaries", {
      projectId: project._id,
      platform: args.platform,
      productId: args.productId,
      format: existing.format,
      version,
      deleted: true,
      createdAt: existing.createdAt,
      updatedAt,
    });
  }
  return { ok: true };
}

export const upsertProductClientPayload = mutation({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    productId: v.string(),
    format: clientPayloadFormatValidator,
    body: v.string(),
    expectedVersion: v.number(),
  },
  returns: v.object({
    id: v.id("productClientPayloads"),
    created: v.boolean(),
    changed: v.boolean(),
    version: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const project = await resolveProjectForClientPayloadMutation(
      ctx,
      args.projectId,
    );
    return upsertProductClientPayloadForProject(ctx, project, args);
  },
});

export const upsertProductClientPayloadWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    productId: v.string(),
    format: clientPayloadFormatValidator,
    body: v.string(),
    expectedVersion: v.optional(v.number()),
  },
  returns: v.object({
    id: v.id("productClientPayloads"),
    created: v.boolean(),
    changed: v.boolean(),
    version: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) {
      throw clientPayloadError(
        "PROJECT_ACCESS_DENIED",
        "Project not found or access denied",
      );
    }
    return upsertProductClientPayloadForProject(ctx, resolved.project, args);
  },
});

export const removeProductClientPayload = mutation({
  args: {
    projectId: v.id("projects"),
    platform: platformValidator,
    productId: v.string(),
    expectedVersion: v.number(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await resolveProjectForClientPayloadMutation(
      ctx,
      args.projectId,
    );
    return removeProductClientPayloadForProject(ctx, project, args);
  },
});

export const removeProductClientPayloadWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    platform: platformValidator,
    productId: v.string(),
    expectedVersion: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) {
      throw clientPayloadError(
        "PROJECT_ACCESS_DENIED",
        "Project not found or access denied",
      );
    }
    return removeProductClientPayloadForProject(ctx, resolved.project, args);
  },
});

// Public mutation: upsert a product in kit's catalog. Authoritative
// state lives in App Store Connect / Play Console; this row is a
// kit-side cache so the dashboard, MCP server, and SDKs share one
// canonical view. Phase 3 follow-ups will add ASC / Play push-sync
// — until then, treat this as a hand-managed catalog.
export const upsertProduct = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    productId: v.string(),
    platform: platformValidator,
    type: typeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    localizations: v.optional(productLocalizationsValidator),
    priceAmountMicros: v.optional(v.number()),
    currency: v.optional(v.string()),
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
    subscriptionGroupName: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    state: v.optional(stateValidator),
    storeRef: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("products"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await resolveProjectForMutationArgs(ctx, args);
    if (!project) throw new Error("Invalid API key");

    // Reject unsafe prices. The catalog row round-trips through JS
    // numbers into push-sync (asc.ts / play.ts); values beyond the
    // safe-integer range can already be rounded before they reach the
    // store API.
    if (
      args.priceAmountMicros !== undefined &&
      (!Number.isSafeInteger(args.priceAmountMicros) ||
        args.priceAmountMicros < 0)
    ) {
      throw new Error("priceAmountMicros must be a non-negative safe integer");
    }

    // Throws on a malformed/duplicate locale or an over-long string so
    // the operator sees the problem here rather than as an opaque 400
    // from Play or ASC during the next push.
    const localizations = normalizeProductLocalizations(
      args.localizations,
      args.platform,
    );

    // iOS subscriptions REQUIRE a subscriptionGroupName upstream —
    // related tiers must share a group for StoreKit 2's native
    // upgrade/downgrade UI to work. The Apple push-sync (asc.ts)
    // falls back to using the productId as the group name when this
    // is missing, which results in each subscription landing in its
    // own fragmented group and silently breaks the upgrade flow.
    // Reject the upsert before that drift can happen so the operator
    // gets a loud, actionable error instead of a broken store
    // experience two sync passes later (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    if (
      args.platform === "IOS" &&
      args.type === "Subscription" &&
      (!args.subscriptionGroupName || !args.subscriptionGroupName.trim())
    ) {
      throw new Error(
        "subscriptionGroupName is required for iOS Subscription products — related tiers must share a group for StoreKit 2 upgrade/downgrade to work. Pick a group name (e.g. 'premium_tiers') and reuse it for every related subscription. kit's push-sync (asc.ts) will create the group in App Store Connect on first push and reuse the existing group on subsequent pushes if a group with the same name already exists upstream — you do not have to create it in ASC manually first.",
      );
    }

    const existing: Doc<"products"> | null = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      // State-only flips moved to `setProductState`. This mutation
      // now treats every supplied field as authoritative — keeping
      // the prior "blank title preserves existing" hack would still
      // mask cases where a caller really did mean to clear a field.
      await ctx.db.patch(existing._id, {
        type: args.type,
        title: args.title,
        description: args.description ?? existing.description,
        // Explicitly authoritative, like every other field here: an
        // operator who removes the last localization means to clear it.
        // An explicitly supplied empty array is a clear request; Convex
        // needs `null` for that, since `undefined` would be a no-op and
        // silently keep republishing the old locales.
        localizations:
          args.localizations === undefined
            ? existing.localizations
            : (localizations ?? null),
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        billingPeriod: args.billingPeriod ?? existing.billingPeriod,
        subscriptionGroupName:
          args.subscriptionGroupName ?? existing.subscriptionGroupName,
        reviewNote: args.reviewNote ?? existing.reviewNote,
        // A dashboard / MCP edit is a new kit-authored version that
        // needs another push pass even if the previous version was
        // already Ready or Active. `listDraft*Products` is the worker
        // queue, so move edited rows back to Draft unless the caller
        // explicitly requested a state.
        state: nextStateForKitProductUpsert(args.state),
        storeRef: args.storeRef ?? existing.storeRef,
        updatedAt: now,
        // ALWAYS claim kit-management on dashboard / MCP edits —
        // an operator touching the row through this mutation is
        // explicitly saying "I want this version to land on the
        // store", which means push-sync should pick it up next
        // run. Without overwriting, a pulled-then-edited row
        // would stay `origin: "store"` and silently get skipped
        // by `listDraft*Products`, dropping the operator's edit.
        // Reverse direction (pull overwriting kit edits) is
        // handled in `upsertFromStore`, which only back-fills
        // `origin` when it's undefined.
        origin: "kit" as const,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("products", {
      projectId: project._id,
      productId: args.productId,
      platform: args.platform,
      type: args.type,
      title: args.title,
      description: args.description,
      localizations,
      priceAmountMicros: args.priceAmountMicros,
      currency: args.currency,
      billingPeriod: args.billingPeriod,
      subscriptionGroupName: args.subscriptionGroupName,
      reviewNote: args.reviewNote,
      state: args.state ?? "Draft",
      storeRef: args.storeRef,
      updatedAt: now,
      origin: "kit",
    });
    return { id, created: true };
  },
});

// State-only mutation used by `manage_product` (MCP) and the
// dashboard's enable/disable affordance. Distinct from `upsertProduct`
// because the previous reuse pattern (passing a blank title +
// hardcoded type so only `state` would update) would silently
// overwrite the existing row's `type` — e.g. flipping a NonConsumable
// to Subscription. Splitting the mutation prevents that class of
// drive-by clobber.
export const setProductState = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    productId: v.string(),
    platform: platformValidator,
    state: stateValidator,
  },
  returns: v.object({
    id: v.id("products"),
    state: stateValidator,
  }),
  handler: async (ctx, args) => {
    const project = await resolveProjectForMutationArgs(ctx, args);
    if (!project) throw new Error("Invalid API key");

    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) throw new Error("Product not found");

    await ctx.db.patch(existing._id, {
      state: args.state,
      // State flips are operator intent too. In particular, marking a
      // pulled row Removed must turn it into a kit-authored deletion
      // request so pull-sync does not resurrect it before push-sync can
      // remove it from the store.
      origin: "kit" as const,
      updatedAt: Date.now(),
    });
    return { id: existing._id, state: args.state };
  },
});

export const removeProduct = mutation({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    productId: v.string(),
    platform: platformValidator,
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await resolveProjectForMutationArgs(ctx, args);
    if (!project) return { ok: false };

    const existing = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", project._id)
          .eq("platform", args.platform)
          .eq("productId", args.productId),
      )
      .unique();
    if (!existing) return { ok: false };

    // Soft-remove via state flag — keeps audit history for the
    // dashboard and preserves any webhook events that reference this productId.
    await ctx.db.patch(existing._id, {
      state: "Removed",
      origin: "kit" as const,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
