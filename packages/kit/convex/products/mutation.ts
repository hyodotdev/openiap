import { mutation, type MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { parse as parseToml } from "smol-toml";

import {
  normalizeProductLocalizations,
  productLocalizationsValidator,
} from "./localizations";
import { normalizeProductRegions, productRegionsValidator } from "./regions";
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

// Upserts a product in kit's catalog: a cache of App Store Connect / Play
// Console state that the dashboard, MCP server, and SDKs share.
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
    regions: v.optional(productRegionsValidator),
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

    // Push-sync carries prices as JS numbers, so a value past the safe-integer
    // range could be rounded before it reaches the store.
    if (
      args.priceAmountMicros !== undefined &&
      (!Number.isSafeInteger(args.priceAmountMicros) ||
        args.priceAmountMicros < 0)
    ) {
      throw new Error("priceAmountMicros must be a non-negative safe integer");
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

    // Validate now instead of failing with an opaque store 400 on the next
    // push. Reserve the row's actual base locale, which may not be en-US.
    const localizationsForValidation =
      args.localizations === undefined &&
      existing !== null &&
      existing.type !== args.type
        ? (existing.localizations ?? undefined)
        : args.localizations;
    const localizations = normalizeProductLocalizations(
      localizationsForValidation,
      args.platform,
      args.type,
      existing?.baseLocale,
    );
    const regions = normalizeProductRegions(args.regions);

    // Related iOS subscription tiers must share a group for StoreKit 2
    // upgrade/downgrade. Without a name, asc.ts falls back to the productId,
    // giving each subscription its own group, so reject the upsert instead.
    if (
      args.platform === "IOS" &&
      args.type === "Subscription" &&
      (!args.subscriptionGroupName || !args.subscriptionGroupName.trim())
    ) {
      throw new Error(
        "subscriptionGroupName is required for iOS Subscription products — related tiers must share a group for StoreKit 2 upgrade/downgrade to work. Pick a group name (e.g. 'premium_tiers') and reuse it for every related subscription. kit's push-sync (asc.ts) will create the group in App Store Connect on first push and reuse the existing group on subsequent pushes if a group with the same name already exists upstream — you do not have to create it in ASC manually first.",
      );
    }

    // Only the Android one-time push applies regions. ASC territories use a
    // resource this workflow does not touch, and Play's subscription update
    // masks `listings` only, so regions stored there would never apply.
    const supportsRegions =
      args.platform === "Android" && args.type !== "Subscription";
    // "all" is a declared footprint too, so it is refused on the same surfaces.
    const declaresFootprint =
      regions === "all" || Boolean(Array.isArray(regions) && regions.length);
    if (declaresFootprint && !supportsRegions) {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        args.platform === "IOS"
          ? "Sales regions are currently Android-only. Set App Store availability in App Store Connect."
          : "Sales regions cannot be set on a subscription. Play fixes a base plan's regional configs when it is created; change them in Play Console.",
      );
    }

    const now = Date.now();
    if (existing) {
      // Every supplied field is authoritative (a blank title is not "keep");
      // state-only changes use `setProductState`.
      await ctx.db.patch(existing._id, {
        type: args.type,
        title: args.title,
        description: args.description ?? existing.description,
        // An explicit `[]` clears them. Convex needs `null` for that: an
        // `undefined` patch is a no-op and the old locales would republish.
        localizations:
          args.localizations === undefined
            ? existing.localizations
            : (localizations ?? null),
        // Clear regions where they cannot apply (a product retyped as a
        // subscription, an old iOS row); an omitted field keeps them elsewhere.
        regions: !supportsRegions
          ? null
          : args.regions === undefined
            ? existing.regions
            : (regions ?? null),
        priceAmountMicros: args.priceAmountMicros ?? existing.priceAmountMicros,
        currency: args.currency ?? existing.currency,
        billingPeriod: args.billingPeriod ?? existing.billingPeriod,
        subscriptionGroupName:
          args.subscriptionGroupName ?? existing.subscriptionGroupName,
        reviewNote: args.reviewNote ?? existing.reviewNote,
        // An edit needs another push even if the row was Ready or Active, so
        // it returns to Draft (the `listDraft*Products` queue) unless the
        // caller set a state.
        state: nextStateForKitProductUpsert(args.state),
        storeRef: args.storeRef ?? existing.storeRef,
        updatedAt: now,
        // An edit claims the row for kit so push-sync picks it up; a row left
        // `origin: "store"` is skipped by `listDraft*Products`. Pull-sync
        // (`upsertFromStore`) only sets `origin` when it is undefined.
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
      regions: supportsRegions ? regions : undefined,
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

// State-only change for `manage_product` (MCP) and the dashboard's
// enable/disable. Separate from `upsertProduct`, which would also overwrite
// fields such as `type`.
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
      // Operator intent: a pulled row marked Removed becomes a kit deletion
      // request, so pull-sync cannot restore it before push-sync deletes it.
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
