import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import { query } from "../_generated/server";
import { resolveProjectByIdForCurrentUserFromDb } from "../projects/helpers";
import schema, { purchaseStoreValidator } from "../schema";
import { createError, ErrorCode } from "../utils/errors";
import { purchaseIssueCauseValidator } from "../utils/validation";

const purchaseIssueDoc = schema.doc("purchaseIssues");

/**
 * A project's purchase issues, most recently seen first. Any organization
 * member may read them: a row holds a hash of the evidence, never the evidence.
 * `from` and `to` bound `lastSeenAt` in epoch ms, inclusive. The other filters
 * scan at most one project's rows, which the per-project cap bounds.
 */
export const listPurchaseIssues = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
    cause: v.optional(purchaseIssueCauseValidator),
    store: v.optional(purchaseStoreValidator),
    productId: v.optional(v.string()),
    appUserId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: paginationResultValidator(purchaseIssueDoc),
  handler: async (ctx, args) => {
    if (!(await resolveProjectByIdForCurrentUserFromDb(ctx, args.projectId))) {
      throw createError(ErrorCode.NOT_AUTHORIZED);
    }
    const { from, to } = args;
    return await ctx.db
      .query("purchaseIssues")
      .withIndex("by_project_and_lastSeenAt", (q) => {
        const project = q.eq("projectId", args.projectId);
        if (from !== undefined && to !== undefined) {
          return project.gte("lastSeenAt", from).lte("lastSeenAt", to);
        }
        if (from !== undefined) return project.gte("lastSeenAt", from);
        if (to !== undefined) return project.lte("lastSeenAt", to);
        return project;
      })
      .order("desc")
      .filter((q) =>
        q.and(
          args.cause === undefined || q.eq(q.field("cause"), args.cause),
          args.store === undefined || q.eq(q.field("store"), args.store),
          args.productId === undefined ||
            q.eq(q.field("productId"), args.productId),
          args.appUserId === undefined ||
            q.eq(q.field("appUserId"), args.appUserId),
        ),
      )
      .paginate(args.paginationOpts);
  },
});

/** One purchase issue, or null when it is missing or not the caller's. */
export const getPurchaseIssue = query({
  args: { issueId: v.id("purchaseIssues") },
  returns: v.union(purchaseIssueDoc, v.null()),
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return null;
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      issue.projectId,
    );
    return resolved ? issue : null;
  },
});
