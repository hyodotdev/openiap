import {
  paginationOptsValidator,
  type OrderedQuery,
  type PaginationResult,
} from "convex/server";
import { query, type QueryCtx } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { harmonizedPurchaseStateValidator } from "./purchaseState";
import { purchaseStoreValidator } from "../schema";
import { readPurchaseStats } from "./stats";
import { extractProductIdFromRemoteResponse } from "./shared";
import {
  evidenceFingerprint,
  purchaseEvidence,
} from "../purchaseIssues/evidence";
import { sha256Hex } from "../utils/sha256";
import {
  getWritableOrganization,
  getWritableProject,
} from "../projects/writable";
import { canReadRawStoreEvidence } from "../projects/helpers";

// remoteId is a Google purchase token, so it goes with the raw evidence.
function withoutRawEvidence<
  T extends Pick<
    Doc<"purchases">,
    "requestData" | "remoteResponse" | "remoteId"
  >,
>(purchase: T): Omit<T, "requestData" | "remoteResponse" | "remoteId"> {
  const {
    requestData: _requestData,
    remoteResponse: _remoteResponse,
    remoteId: _remoteId,
    ...rest
  } = purchase;
  return rest;
}

async function getPendingProjectIdsForOrganization(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<Set<Id<"projects">>> {
  const pendingProjectIds = new Set<Id<"projects">>();
  for await (const project of ctx.db
    .query("projects")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )) {
    if (project.pendingDeletion === true) {
      pendingProjectIds.add(project._id);
    }
  }
  return pendingProjectIds;
}

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
    appUserId: v.optional(v.string()),
    productId: v.optional(v.string()),
    // Inclusive bounds on the row's creation time, epoch milliseconds.
    createdFrom: v.optional(v.number()),
    createdTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const project = await getWritableProject(ctx, args.projectId);
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
    const { appUserId, productId, createdFrom, createdTo } = args;

    // Use the most selective index, then `.filter()` before `.paginate()`:
    // filtering a page afterwards under-fills it and can end pagination early.
    // Combinations without a composite index scan the project's rows; add one
    // if a combination gets hot.
    const narrow = (
      query: OrderedQuery<DataModel["purchases"]>,
      covered: { appUser?: boolean; created?: boolean } = {},
    ): OrderedQuery<DataModel["purchases"]> => {
      let narrowed = query;
      if (productId !== undefined) {
        narrowed = narrowed.filter((q) =>
          q.eq(q.field("productId"), productId),
        );
      }
      if (appUserId !== undefined && !covered.appUser) {
        narrowed = narrowed.filter((q) =>
          q.eq(q.field("appUserId"), appUserId),
        );
      }
      if (createdFrom !== undefined && !covered.created) {
        narrowed = narrowed.filter((q) =>
          q.gte(q.field("_creationTime"), createdFrom),
        );
      }
      if (createdTo !== undefined && !covered.created) {
        narrowed = narrowed.filter((q) =>
          q.lte(q.field("_creationTime"), createdTo),
        );
      }
      return narrowed;
    };

    if (requestIpQuery) {
      paginated = await narrow(
        ctx.db
          .query("purchases")
          .withSearchIndex("search_request_ip_by_project", (q) =>
            q
              .search("requestIp", requestIpQuery)
              .eq("projectId", args.projectId),
          ),
      ).paginate(args.paginationOpts);
    } else if (appUserId !== undefined) {
      // Convex appends `_creationTime` to every index, so the date range stays
      // inside the index scan.
      let q = ctx.db
        .query("purchases")
        .withIndex("by_project_and_app_user", (inner) => {
          const scoped = inner
            .eq("projectId", args.projectId)
            .eq("appUserId", appUserId);
          if (createdFrom !== undefined && createdTo !== undefined) {
            return scoped
              .gte("_creationTime", createdFrom)
              .lte("_creationTime", createdTo);
          }
          if (createdFrom !== undefined) {
            return scoped.gte("_creationTime", createdFrom);
          }
          if (createdTo !== undefined) {
            return scoped.lte("_creationTime", createdTo);
          }
          return scoped;
        })
        .order(sortDirection);
      if (args.store !== undefined) {
        const store = args.store;
        q = q.filter((expr) => expr.eq(expr.field("store"), store));
      }
      if (args.state !== undefined) {
        const state = args.state;
        q = q.filter((expr) => expr.eq(expr.field("state"), state));
      }
      if (args.isValid !== undefined) {
        const isValid = args.isValid;
        q = q.filter((expr) => expr.eq(expr.field("isValid"), isValid));
      }
      paginated = await narrow(q, { appUser: true, created: true }).paginate(
        args.paginationOpts,
      );
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
      paginated = await narrow(q).paginate(args.paginationOpts);
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
      paginated = await narrow(q).paginate(args.paginationOpts);
    } else if (args.isValid !== undefined) {
      const isValid = args.isValid;
      paginated = await narrow(
        ctx.db
          .query("purchases")
          .withIndex("by_project_isValid", (q) =>
            q.eq("projectId", args.projectId).eq("isValid", isValid),
          )
          .order("desc"),
      ).paginate(args.paginationOpts);
    } else if (sortField === "updatedAt") {
      paginated = await narrow(
        ctx.db
          .query("purchases")
          .withIndex("by_project_updatedAt", (q) =>
            q.eq("projectId", args.projectId),
          )
          .order(sortDirection),
      ).paginate(args.paginationOpts);
    } else if (sortField === "verificationDurationMs") {
      paginated = await narrow(
        ctx.db
          .query("purchases")
          .withIndex("by_project_verificationDurationMs", (q) =>
            q.eq("projectId", args.projectId),
          )
          .order(sortDirection),
      ).paginate(args.paginationOpts);
    } else {
      paginated = await narrow(
        ctx.db
          .query("purchases")
          .withIndex("by_project", (q) => {
            const scoped = q.eq("projectId", args.projectId);
            if (createdFrom !== undefined && createdTo !== undefined) {
              return scoped
                .gte("_creationTime", createdFrom)
                .lte("_creationTime", createdTo);
            }
            if (createdFrom !== undefined) {
              return scoped.gte("_creationTime", createdFrom);
            }
            if (createdTo !== undefined) {
              return scoped.lte("_creationTime", createdTo);
            }
            return scoped;
          })
          .order(sortDirection),
        { created: true },
      ).paginate(args.paginationOpts);
    }

    // Rows from before the productId column and its backfill fall back to
    // parsing remoteResponse.
    const pageWithProductId = paginated.page.map((purchase) => {
      const row = {
        ...purchase,
        productId:
          purchase.productId ??
          extractProductIdFromRemoteResponse(
            purchase.store,
            purchase.remoteResponse,
            purchase.requestData.store === "google"
              ? purchase.requestData.expectedProductId
              : undefined,
          ),
      };
      return canReadRawStoreEvidence(membership.role)
        ? row
        : withoutRawEvidence(row);
    });

    // Read the maintained per-project counters instead of iterating every
    // receipt. Counters are kept in sync by `savePurchaseInternal`,
    // `markReceiptInvalid`, and `deleteProjectWithData`; existing rows are
    // seeded by the row-bounded `backfillPurchaseStatsFromPurchases`
    // migration.
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

    const project = await getWritableProject(ctx, purchase.projectId);
    if (!project) return null;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not authorized to view this purchase");
    }

    // An older project gets its salt with its first purchase issue; until then
    // there is no issue to match, so none is shown.
    const fingerprint = project.fingerprintSalt
      ? await evidenceFingerprint(
          project.fingerprintSalt,
          await sha256Hex(purchaseEvidence(purchase.requestData)),
        )
      : undefined;
    const withProductId = {
      ...purchase,
      productId:
        purchase.productId ??
        extractProductIdFromRemoteResponse(
          purchase.store,
          purchase.remoteResponse,
          purchase.requestData.store === "google"
            ? purchase.requestData.expectedProductId
            : undefined,
        ),
    };
    if (canReadRawStoreEvidence(membership.role)) {
      return {
        ...withProductId,
        rawEvidenceVisible: true as const,
        evidenceFingerprint: fingerprint,
      };
    }
    return {
      ...withoutRawEvidence(withProductId),
      rawEvidenceVisible: false as const,
      evidenceFingerprint: fingerprint,
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

    const totals = {
      total: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    };

    const organization = await getWritableOrganization(
      ctx,
      args.organizationId,
    );
    if (!organization) return totals;

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    const pendingProjectIds = await getPendingProjectIdsForOrganization(
      ctx,
      args.organizationId,
    );

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
      if (pendingProjectIds.has(stats.projectId)) continue;
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
        if (project.pendingDeletion) continue;
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
