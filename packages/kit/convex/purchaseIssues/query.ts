import { assertCliScope } from "../cli/scope";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  resolveOperatorProject,
  resolveProjectByIdForCurrentUserFromDb,
} from "../projects/helpers";
import schema, { purchaseStoreValidator } from "../schema";
import { purchaseIssueCauseValidator } from "../utils/validation";
import { isPurchaseScopedIssue } from "./shared";

const MAX_ISSUE_PAGE_SIZE = 100;

// The stored row without the project and shard the log cap uses. Only a
// purchase-scoped row returns its fingerprint; a shared row's matches nothing.
const purchaseIssueValidator = schema
  .doc("purchaseIssues")
  .omit("projectId", "shard", "_creationTime", "fingerprint")
  .extend({ fingerprint: v.optional(v.string()) });
export type PurchaseIssue = Infer<typeof purchaseIssueValidator>;

function toPurchaseIssue({
  projectId: _projectId,
  shard: _shard,
  _creationTime,
  fingerprint,
  ...issue
}: Doc<"purchaseIssues">): PurchaseIssue {
  return isPurchaseScopedIssue(issue.cause) ? { ...issue, fingerprint } : issue;
}

/**
 * A project's purchase issues, most recently seen first, for any member or a
 * secret key. A row holds a hash of the evidence, never the evidence.
 * `from` and `to` bound `lastSeenAt` in epoch ms, inclusive; `productId`
 * matches the verified or the claimed product. The filters scan at most one
 * project's rows, which the per-project cap bounds.
 */
export const listPurchaseIssues = query({
  args: {
    projectId: v.optional(v.id("projects")),
    apiKey: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    cause: v.optional(purchaseIssueCauseValidator),
    store: v.optional(purchaseStoreValidator),
    productId: v.optional(v.string()),
    appUserId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: paginationResultValidator(purchaseIssueValidator),
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const project = await resolveOperatorProject(ctx, args, "read");
    if (args.paginationOpts.numItems > MAX_ISSUE_PAGE_SIZE) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: `A page holds at most ${MAX_ISSUE_PAGE_SIZE} issues.`,
      });
    }
    const { from, to, productId } = args;
    const rows = await ctx.db
      .query("purchaseIssues")
      .withIndex("by_project_and_lastSeenAt", (q) => {
        const scoped = q.eq("projectId", project._id);
        if (from !== undefined && to !== undefined) {
          return scoped.gte("lastSeenAt", from).lte("lastSeenAt", to);
        }
        if (from !== undefined) return scoped.gte("lastSeenAt", from);
        if (to !== undefined) return scoped.lte("lastSeenAt", to);
        return scoped;
      })
      .order("desc")
      .filter((q) =>
        q.and(
          args.cause === undefined || q.eq(q.field("cause"), args.cause),
          args.store === undefined || q.eq(q.field("store"), args.store),
          productId === undefined ||
            q.or(
              q.eq(q.field("productId"), productId),
              q.eq(q.field("claimedProductId"), productId),
            ),
          args.appUserId === undefined ||
            q.eq(q.field("appUserId"), args.appUserId),
        ),
      )
      .paginate(args.paginationOpts);
    return { ...rows, page: rows.page.map(toPurchaseIssue) };
  },
});

/**
 * One of the project's issues, or null when it is missing, malformed (the id
 * comes from the page URL) or not the caller's.
 */
export const getPurchaseIssue = query({
  args: { projectId: v.id("projects"), issueId: v.string() },
  returns: v.union(purchaseIssueValidator, v.null()),
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const issueId = ctx.db.normalizeId("purchaseIssues", args.issueId);
    const issue = issueId ? await ctx.db.get(issueId) : null;
    if (issue?.projectId !== args.projectId) return null;
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    return resolved ? toPurchaseIssue(issue) : null;
  },
});
