import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import { harmonizedPurchaseStateValidator } from "./purchaseState";
import { purchaseStoreValidator } from "../schema";
import { readPurchaseStats } from "./stats";
import { extractProductIdFromRemoteResponse } from "./shared";

// Get purchases by project
export const getReceiptsByProject = query({
  args: {
    projectId: v.id("projects"),
    store: v.optional(purchaseStoreValidator),
    paginationOpts: paginationOptsValidator,
    sortField: v.optional(
      v.union(
        v.literal("_creationTime"),
        v.literal("updatedAt"),
        v.literal("verificationDurationMs"),
      ),
    ),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    state: v.optional(harmonizedPurchaseStateValidator),
    isValid: v.optional(v.boolean()),
    requestIpQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    const requestIpQuery = args.requestIpQuery?.trim();
    const sortField = args.sortField ?? "_creationTime";
    const sortDirection = args.sortDirection ?? "desc";

    let paginated: PaginationResult<Doc<"purchases">>;

    // Filter application strategy: pick the most-selective index the
    // current arg combination allows, then push any remaining filters onto
    // the query builder via `.filter()` BEFORE `.paginate()` so Convex
    // applies them server-side and page sizes stay consistent. We
    // deliberately avoid a post-paginate `.filter(...)` on the result
    // page — that antipattern under-fills pages and can make the client
    // think there are no more rows while matching data still exists.
    //
    // The trade-off: combinations like `store + sortField=updatedAt`
    // without a matching composite index will scan the per-project slice
    // and filter in-engine. Add a composite index if a combination
    // becomes hot.

    if (requestIpQuery) {
      paginated = await ctx.db
        .query("purchases")
        .withSearchIndex("search_request_ip_by_project", (q) =>
          q.search("requestIp", requestIpQuery).eq("projectId", args.projectId),
        )
        .paginate(args.paginationOpts);
    } else if (args.state !== undefined) {
      const state = args.state;
      const isValid = args.isValid;
      const store = args.store;
      let q = ctx.db
        .query("purchases")
        .withIndex("by_project_state_isValid", (inner) => {
          const chained = inner
            .eq("projectId", args.projectId)
            .eq("state", state);
          return isValid !== undefined
            ? chained.eq("isValid", isValid)
            : chained;
        })
        .order("desc");
      if (store !== undefined) {
        q = q.filter((expr) => expr.eq(expr.field("store"), store));
      }
      paginated = await q.paginate(args.paginationOpts);
    } else if (args.store) {
      const store = args.store;
      const isValid = args.isValid;
      let q = ctx.db
        .query("purchases")
        .withIndex("by_project_and_store", (inner) =>
          inner.eq("projectId", args.projectId).eq("store", store),
        )
        .order("desc");
      if (isValid !== undefined) {
        q = q.filter((expr) => expr.eq(expr.field("isValid"), isValid));
      }
      paginated = await q.paginate(args.paginationOpts);
    } else if (args.isValid !== undefined) {
      const isValid = args.isValid;
      paginated = await ctx.db
        .query("purchases")
        .withIndex("by_project_isValid", (q) =>
          q.eq("projectId", args.projectId).eq("isValid", isValid),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (sortField === "updatedAt") {
      paginated = await ctx.db
        .query("purchases")
        .withIndex("by_project_updatedAt", (q) =>
          q.eq("projectId", args.projectId),
        )
        .order(sortDirection)
        .paginate(args.paginationOpts);
    } else if (sortField === "verificationDurationMs") {
      paginated = await ctx.db
        .query("purchases")
        .withIndex("by_project_verificationDurationMs", (q) =>
          q.eq("projectId", args.projectId),
        )
        .order(sortDirection)
        .paginate(args.paginationOpts);
    } else {
      paginated = await ctx.db
        .query("purchases")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order(sortDirection)
        .paginate(args.paginationOpts);
    }

    // `productId` is stored as a column by `savePurchaseInternal` so we
    // don't have to re-parse `remoteResponse` for every page item. Fall
    // back to parsing for rows that pre-date the column (older receipts
    // picked up before the `backfillPurchaseProductIds` migration ran).
    const pageWithProductId = paginated.page.map((purchase) => ({
      ...purchase,
      productId:
        purchase.productId ??
        extractProductIdFromRemoteResponse(
          purchase.store,
          purchase.remoteResponse,
        ),
    }));

    // Read the maintained per-project counters instead of iterating every
    // receipt. Counters are kept in sync by `savePurchaseInternal`,
    // `markReceiptInvalid`, and `deleteProjectWithData`; existing rows are
    // seeded by the `backfillPurchaseStats` migration.
    const stats = await readPurchaseStats(ctx, args.projectId);

    return {
      ...paginated,
      page: pageWithProductId,
      stats,
    };
  },
});

export const getPurchaseById = query({
  args: {
    purchaseId: v.id("purchases"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      return null;
    }

    const project = await ctx.db.get(purchase.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not authorized to view this purchase");
    }

    return {
      ...purchase,
      productId:
        purchase.productId ??
        extractProductIdFromRemoteResponse(
          purchase.store,
          purchase.remoteResponse,
        ),
    };
  },
});

// Aggregate purchase stats across an organization
export const getOrganizationReceiptStats = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    const totals = {
      total: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    };

    // Fast path: query purchaseStats directly by organizationId. Reads
    // only small counter docs instead of full project records, which can
    // carry large Horizon/iOS credential fields.
    let hasOrgIndexedStats = false;
    for await (const stats of ctx.db
      .query("purchaseStats")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )) {
      hasOrgIndexedStats = true;
      totals.total += stats.total;
      totals.googleOrders += stats.googleOrders ?? 0;
      totals.valid += stats.valid;
      totals.invalid += stats.invalid;
    }

    // Fallback for orgs whose stats rows predate the organizationId
    // denormalization (backfill runs lazily via applyPurchaseStatsDelta).
    // Walk projects and sum per-project stats in that case.
    if (!hasOrgIndexedStats) {
      for await (const project of ctx.db
        .query("projects")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )) {
        const stats = await readPurchaseStats(ctx, project._id);
        totals.total += stats.total;
        totals.googleOrders += stats.googleOrders;
        totals.valid += stats.valid;
        totals.invalid += stats.invalid;
      }
    }

    return totals;
  },
});
