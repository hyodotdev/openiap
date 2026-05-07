import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { deleteProjectWithData } from "./helpers";
import { generateApiKey } from "../utils/helpers";
import { createError, ErrorCode } from "../utils/errors";
import {
  DEFAULT_REPORTING_CURRENCY,
  normalizeReportingCurrency,
} from "../utils/currency";

const projectPlatformValidator = v.union(
  v.literal("react-native"),
  v.literal("flutter"),
  v.literal("kmp"),
  v.literal("android"),
  v.literal("ios"),
  v.literal("node"),
  v.literal("php"),
  v.literal("dotnet"),
  v.literal("unity"),
  v.literal("web"),
  v.literal("other"),
);

function normalizeAndroidPackageName(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Android package name cannot be empty.",
    );
  }

  const packagePattern = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
  if (!packagePattern.test(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Android package name must follow the standard reverse-domain format (e.g. com.example.app).",
    );
  }

  return normalized.toLowerCase();
}

function normalizeIosBundleId(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store bundle ID cannot be empty.",
    );
  }

  const bundlePattern = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/;
  if (!bundlePattern.test(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store bundle ID must follow the standard reverse-domain format (e.g. com.example.app).",
    );
  }

  return normalized;
}

function normalizeAppAppleId(input: number): number {
  if (!Number.isFinite(input) || input <= 0) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Apple ID must be a positive number.",
    );
  }

  return Math.trunc(input);
}

function normalizeAppStoreIssuerId(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store Connect Issuer ID cannot be empty.",
    );
  }

  const issuerPattern =
    /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
  if (!issuerPattern.test(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store Connect Issuer ID must be a valid UUID (e.g. 12345678-ABCD-1234-ABCD-1234567890AB).",
    );
  }

  return normalized;
}

function normalizeAppStoreKeyId(input: string): string {
  const normalized = input.trim().toUpperCase();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store Connect Key ID cannot be empty.",
    );
  }

  const keyPattern = /^[A-Z0-9]{10}$/;
  if (!keyPattern.test(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "App Store Connect Key ID must be 10 uppercase letters or numbers (e.g. ABCDE12345).",
    );
  }

  return normalized;
}

function normalizeHorizonAppId(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Meta Horizon App ID cannot be empty.",
    );
  }
  // Meta app IDs are numeric strings (typically 15–16 digits). Stored
  // as a string to avoid JS number-precision loss and to keep the
  // shape consistent with other credential fields.
  if (!/^\d{6,20}$/.test(normalized)) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Meta Horizon App ID must be a numeric string (6–20 digits).",
    );
  }
  return normalized;
}

function normalizeHorizonAppSecret(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Meta Horizon App Secret cannot be empty.",
    );
  }
  // Meta App Secrets are opaque hex/base64 strings. Meta doesn't
  // publish exact bounds; enforce a sane range so obvious mispastes
  // (empty-looking or multi-KB blobs) fail fast.
  if (normalized.length < 16 || normalized.length > 2_048) {
    throw createError(
      ErrorCode.INVALID_INPUT,
      "Meta Horizon App Secret looks malformed (expected 16–2048 characters).",
    );
  }
  return normalized;
}

// Helper to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

export const createProject = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.optional(v.string()),
    platform: v.optional(projectPlatformValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    // Check if user has access to create projects in this organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
    }

    // Generate slug if not provided, or validate user-provided slug
    let slug = args.slug || generateSlug(args.name);

    // Validate slug format if user-provided
    if (args.slug) {
      // Ensure slug only contains lowercase letters, numbers, and hyphens
      slug = args.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) {
        slug = generateSlug(args.name);
      }
    }

    // Ensure slug is unique within organization: probe once; on collision
    // append a short random suffix rather than linear-scanning `slug-1`,
    // `slug-2`, … (mirrors the approach in `createOrganization`).
    const existingBase = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", slug),
      )
      .first();

    let finalSlug = slug;
    if (existingBase) {
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      finalSlug = `${slug}-${randomSuffix}`;
    }

    const apiKey = generateApiKey();
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      organizationId: args.organizationId,
      name: args.name,
      slug: finalSlug,
      apiKey, // Keep for backward compatibility, will be deprecated
      reportingCurrency: DEFAULT_REPORTING_CURRENCY,
      createdAt: now,
      updatedAt: now,
      ...(args.platform ? { platform: args.platform } : {}),
    });

    // Create a default API key in the new system
    const apiKeyId = await ctx.db.insert("apiKeys", {
      projectId,
      organizationId: args.organizationId,
      key: apiKey,
      name: "Default Production Key",
      description: "Automatically generated production key",
      permissions: undefined,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return { projectId, slug: finalSlug, apiKey, apiKeyId };
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    platform: v.optional(projectPlatformValidator),
    androidPackageName: v.optional(v.string()),
    iosBundleId: v.optional(v.string()),
    iosAppAppleId: v.optional(v.number()),
    iosAppStoreIssuerId: v.optional(v.string()),
    iosAppStoreKeyId: v.optional(v.string()),
    // App Store Connect API credentials — separate from the Server API
    // (In-App Purchase) credentials above. See schema.ts for the
    // distinction. Used by `products/asc.ts` push-sync.
    iosAscIssuerId: v.optional(v.string()),
    iosAscKeyId: v.optional(v.string()),
    // Meta Horizon (Quest / VR) — piggybacks on the Android section
    // in the dashboard since the client SDK is Google-Play-Billing-
    // compatible. Validation only runs when horizonEnabled === true.
    // horizonAppSecret intentionally accepts only a fresh value from
    // the client: the UI never prefills the existing secret (the query
    // redacts it), so an undefined value here means "leave existing
    // untouched". A `null` from the Horizon-off branch clears it.
    horizonEnabled: v.optional(v.boolean()),
    horizonAppId: v.optional(v.string()),
    horizonAppSecret: v.optional(v.string()),
    reportingCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND);
    }

    // Check if user has access to this project's organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.platform !== undefined) updates.platform = args.platform;
    if (args.androidPackageName !== undefined) {
      updates.androidPackageName = normalizeAndroidPackageName(
        args.androidPackageName,
      );
    }
    if (args.iosBundleId !== undefined) {
      updates.iosBundleId = normalizeIosBundleId(args.iosBundleId);
    }
    if (args.iosAppAppleId !== undefined) {
      updates.iosAppAppleId = normalizeAppAppleId(args.iosAppAppleId);
    }
    if (args.iosAppStoreIssuerId !== undefined) {
      updates.iosAppStoreIssuerId = normalizeAppStoreIssuerId(
        args.iosAppStoreIssuerId,
      );
    }
    if (args.iosAppStoreKeyId !== undefined) {
      updates.iosAppStoreKeyId = normalizeAppStoreKeyId(args.iosAppStoreKeyId);
    }
    if (args.iosAscIssuerId !== undefined) {
      updates.iosAscIssuerId = normalizeAppStoreIssuerId(args.iosAscIssuerId);
    }
    if (args.iosAscKeyId !== undefined) {
      updates.iosAscKeyId = normalizeAppStoreKeyId(args.iosAscKeyId);
    }
    if (args.reportingCurrency !== undefined) {
      updates.reportingCurrency = normalizeReportingCurrency(
        args.reportingCurrency,
      );
    }

    // Horizon fields: validated only when the feature is being
    // enabled or when populated values are supplied. Toggling off
    // clears the credential fields so a stale secret can't linger in
    // the DB after the user deselected Horizon support. Convex treats
    // `undefined` in a patch object as "leave alone", so we use
    // explicit `null` to actually drop the column — the schema widens
    // both fields to allow null.
    if (args.horizonEnabled !== undefined) {
      updates.horizonEnabled = args.horizonEnabled;
      if (args.horizonEnabled === false) {
        updates.horizonAppId = null;
        updates.horizonAppSecret = null;
      }
    }
    if (
      args.horizonAppId !== undefined &&
      // Only validate when we're also keeping the feature on (or it
      // was already on). Prevents a "clear while toggling off" from
      // tripping the non-empty check above.
      args.horizonEnabled !== false
    ) {
      updates.horizonAppId = normalizeHorizonAppId(args.horizonAppId);
    }
    if (args.horizonAppSecret !== undefined && args.horizonEnabled !== false) {
      updates.horizonAppSecret = normalizeHorizonAppSecret(
        args.horizonAppSecret,
      );
    }

    // Invariant: enabling Horizon without both credentials leaves the
    // project in a state where verify calls would throw
    // META_HORIZON_APP_{ID,SECRET}_NOT_CONFIGURED. Fail closed instead
    // — check against what the project WILL look like after the patch
    // (pending args + existing row), not just what's in args.
    if (args.horizonEnabled === true) {
      const effectiveAppId =
        updates.horizonAppId !== undefined
          ? updates.horizonAppId
          : project.horizonAppId;
      const effectiveAppSecret =
        updates.horizonAppSecret !== undefined
          ? updates.horizonAppSecret
          : project.horizonAppSecret;
      if (!effectiveAppId) {
        throw createError(
          ErrorCode.INVALID_INPUT,
          "Enabling Meta Horizon requires a Horizon App ID.",
        );
      }
      if (!effectiveAppSecret) {
        throw createError(
          ErrorCode.INVALID_INPUT,
          "Enabling Meta Horizon requires a Horizon App Secret.",
        );
      }
    }

    await ctx.db.patch(args.projectId, updates);
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND);
    }

    // Check if user is owner or admin
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Delete the project along with all related data
    await deleteProjectWithData(ctx, args.projectId);
  },
});

export const regenerateApiKey = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND);
    }

    // Check if user has access
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    const newApiKey = generateApiKey();

    await ctx.db.patch(args.projectId, {
      apiKey: newApiKey,
      updatedAt: Date.now(),
    });

    return newApiKey;
  },
});
