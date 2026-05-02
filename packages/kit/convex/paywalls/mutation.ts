import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const layoutValidator = v.union(
  v.literal("Single"),
  v.literal("Compare"),
  v.literal("Carousel"),
);

const themeValidator = v.optional(
  v.object({
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
  }),
);

// Public mutation that owns the project's paywall catalog. Auth via the
// project apiKey — same model as the rest of the v1 surface so the MCP
// server / dashboard / SDK can all drive it without a separate admin
// session.
//
// ⚠️ SECURITY: the apiKey is intentionally shared between
// "read-only" SDK callers (paywall fetch, webhook stream, status
// probes) and "write" admin callers (this mutation, upsertProduct,
// the push-sync actions). That conflation is a known limitation —
// `customHtml` here can carry arbitrary script that the kit-hosted
// paywall serves into a WebView, so anyone with the apiKey can
// inject content into the operator's app surface.
//
// Mitigation today: treat the project apiKey as a secret. Don't
// commit it to repos, scope CI access tightly, and rotate
// immediately on suspected leak. The follow-up plan is a split
// publishable/secret-key model (see GitHub discussion) where SDKs
// only ever ship the publishable key (read-only) and write
// mutations require the secret key. That refactor is intentionally
// out of scope for the kit-webhook-receivers PR.
export const upsertPaywall = mutation({
  args: {
    apiKey: v.string(),
    slug: v.string(),
    title: v.string(),
    layout: layoutValidator,
    productIds: v.array(v.string()),
    headline: v.string(),
    subheadline: v.optional(v.string()),
    cta: v.string(),
    legalCopy: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    logoUrl: v.optional(v.string()),
    backgroundImageUrl: v.optional(v.string()),
    productImages: v.optional(
      v.array(v.object({ productId: v.string(), imageUrl: v.string() })),
    ),
    customCss: v.optional(v.string()),
    customHtml: v.optional(v.string()),
    theme: themeValidator,
  },
  returns: v.object({
    id: v.id("paywalls"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) {
      throw new Error("Invalid API key");
    }

    const existing: Doc<"paywalls"> | null = await ctx.db
      .query("paywalls")
      .withIndex("by_project_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.slug),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        layout: args.layout,
        productIds: args.productIds,
        headline: args.headline,
        subheadline: args.subheadline,
        cta: args.cta,
        legalCopy: args.legalCopy,
        features: args.features,
        logoUrl: args.logoUrl,
        backgroundImageUrl: args.backgroundImageUrl,
        productImages: args.productImages,
        customCss: args.customCss,
        customHtml: args.customHtml,
        theme: args.theme,
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("paywalls", {
      projectId: project._id,
      slug: args.slug,
      title: args.title,
      layout: args.layout,
      productIds: args.productIds,
      headline: args.headline,
      subheadline: args.subheadline,
      cta: args.cta,
      legalCopy: args.legalCopy,
      features: args.features,
      logoUrl: args.logoUrl,
      backgroundImageUrl: args.backgroundImageUrl,
      productImages: args.productImages,
      customCss: args.customCss,
      customHtml: args.customHtml,
      theme: args.theme,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const deletePaywall = mutation({
  args: { apiKey: v.string(), slug: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return { ok: false };

    const existing = await ctx.db
      .query("paywalls")
      .withIndex("by_project_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.slug),
      )
      .unique();
    if (!existing) return { ok: false };

    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});
