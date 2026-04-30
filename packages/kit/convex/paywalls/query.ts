import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const paywallShape = v.object({
  slug: v.string(),
  title: v.string(),
  layout: v.union(
    v.literal("Single"),
    v.literal("Compare"),
    v.literal("Carousel"),
  ),
  productIds: v.array(v.string()),
  headline: v.string(),
  subheadline: v.optional(v.string()),
  cta: v.string(),
  legalCopy: v.optional(v.string()),
  theme: v.optional(
    v.object({
      primaryColor: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
    }),
  ),
  updatedAt: v.number(),
});

function shape(paywall: Doc<"paywalls">) {
  return {
    slug: paywall.slug,
    title: paywall.title,
    layout: paywall.layout,
    productIds: paywall.productIds,
    headline: paywall.headline,
    subheadline: paywall.subheadline,
    cta: paywall.cta,
    legalCopy: paywall.legalCopy,
    theme: paywall.theme,
    updatedAt: paywall.updatedAt,
  };
}

export const getPaywall = query({
  args: { apiKey: v.string(), slug: v.string() },
  returns: v.union(paywallShape, v.null()),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return null;
    const row = await ctx.db
      .query("paywalls")
      .withIndex("by_project_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.slug),
      )
      .unique();
    return row ? shape(row) : null;
  },
});

export const listPaywalls = query({
  args: { apiKey: v.string() },
  returns: v.array(paywallShape),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return [];
    const all = await ctx.db
      .query("paywalls")
      .withIndex("by_project_and_slug", (q) => q.eq("projectId", project._id))
      .collect();
    return all.map(shape);
  },
});
