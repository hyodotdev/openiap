import { v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { getWritableProject } from "../projects/writable";
import { purchaseStoreValidator, receiptEnvironmentValidator } from "../schema";
import type { BindOutcome } from "../subscriptions/internal";
import { isValidSubscriptionUserId } from "../subscriptions/limits";
import { correlationIdOrUndefined } from "../utils/correlationId";
import { sha256Hex } from "../utils/sha256";
import { purchaseIssueCauseValidator } from "../utils/validation";
import { isEvidenceFingerprint } from "./evidence";

export const PURCHASE_ISSUE_CAP_PER_PROJECT = 1_000;
export const PURCHASE_ISSUE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const PRUNE_BATCH_SIZE = 200;
const MAX_PRODUCT_ID_LENGTH = 256;

export const purchaseIssueInputValidator = v.object({
  cause: purchaseIssueCauseValidator,
  store: purchaseStoreValidator,
  fingerprint: v.string(),
  productId: v.optional(v.string()),
  claimedProductId: v.optional(v.string()),
  appUserId: v.optional(v.string()),
  environment: v.optional(receiptEnvironmentValidator),
  retryAfterSec: v.optional(v.number()),
  correlationId: v.optional(v.string()),
});

export type PurchaseIssueInput = Infer<typeof purchaseIssueInputValidator>;

function boundedProductId(value: string | undefined): string | undefined {
  return value && value.length <= MAX_PRODUCT_ID_LENGTH ? value : undefined;
}

// Callers reach this through public functions, so every caller-influenced
// string is bounded here and an unrecognised one is dropped, never stored.
function storedFields(
  input: PurchaseIssueInput,
): Partial<
  Pick<
    Doc<"purchaseIssues">,
    | "productId"
    | "claimedProductId"
    | "appUserId"
    | "environment"
    | "retryAfterSec"
    | "correlationId"
  >
> {
  const productId = boundedProductId(input.productId);
  const claimedProductId = boundedProductId(input.claimedProductId);
  const appUserId =
    input.appUserId !== undefined && isValidSubscriptionUserId(input.appUserId)
      ? input.appUserId
      : undefined;
  const correlationId = correlationIdOrUndefined(input.correlationId);
  const retryAfterSec =
    input.retryAfterSec !== undefined &&
    Number.isFinite(input.retryAfterSec) &&
    input.retryAfterSec > 0
      ? Math.ceil(input.retryAfterSec)
      : undefined;
  return {
    ...(productId ? { productId } : {}),
    ...(claimedProductId ? { claimedProductId } : {}),
    ...(appUserId ? { appUserId } : {}),
    ...(input.environment ? { environment: input.environment } : {}),
    ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}

/**
 * Records one failure. A repeat of the same (fingerprint, cause) bumps its
 * count; a new row past the project cap replaces the least recently seen one.
 */
export async function recordPurchaseIssue(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  input: PurchaseIssueInput,
): Promise<void> {
  if (!isEvidenceFingerprint(input.fingerprint)) return;
  if (!(await getWritableProject(ctx, projectId))) return;
  const now = Date.now();
  const fields = storedFields(input);

  const existing = await ctx.db
    .query("purchaseIssues")
    .withIndex("by_project_and_fingerprint_and_cause", (q) =>
      q
        .eq("projectId", projectId)
        .eq("fingerprint", input.fingerprint)
        .eq("cause", input.cause),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...fields,
      count: existing.count + 1,
      lastSeenAt: now,
    });
    return;
  }

  const counter = await ctx.db
    .query("purchaseIssueCounts")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
  let rows = counter?.rows ?? 0;
  if (rows >= PURCHASE_ISSUE_CAP_PER_PROJECT) {
    const oldest = await ctx.db
      .query("purchaseIssues")
      .withIndex("by_project_and_lastSeenAt", (q) =>
        q.eq("projectId", projectId),
      )
      .order("asc")
      .first();
    if (oldest) {
      await ctx.db.delete(oldest._id);
      rows -= 1;
    } else {
      rows = 0;
    }
  }

  await ctx.db.insert("purchaseIssues", {
    projectId,
    cause: input.cause,
    store: input.store,
    fingerprint: input.fingerprint,
    ...fields,
    count: 1,
    firstSeenAt: now,
    lastSeenAt: now,
  });
  if (counter) {
    await ctx.db.patch(counter._id, { rows: rows + 1 });
  } else {
    await ctx.db.insert("purchaseIssueCounts", { projectId, rows: rows + 1 });
  }
}

/**
 * Records a failed link. `evidenceFingerprint` is the hash the edge took of
 * the evidence the caller sent; without it the bind token is hashed.
 */
export async function recordBindIssue(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  outcome: BindOutcome,
  request: {
    purchaseToken: string;
    userId: string;
    evidenceFingerprint?: string;
    correlationId?: string;
  },
): Promise<void> {
  const cause =
    outcome.reason === "bound_to_other_user"
      ? "OWNERSHIP_CONFLICT"
      : outcome.limitReached
        ? "BIND_LIMIT_REACHED"
        : null;
  if (!cause || !outcome.store) return;
  await recordPurchaseIssue(ctx, projectId, {
    cause,
    store: outcome.store,
    fingerprint:
      request.evidenceFingerprint &&
      isEvidenceFingerprint(request.evidenceFingerprint)
        ? request.evidenceFingerprint
        : await sha256Hex(request.purchaseToken),
    ...(outcome.productId ? { productId: outcome.productId } : {}),
    appUserId: request.userId,
    ...(request.correlationId ? { correlationId: request.correlationId } : {}),
  });
}

// Verification actions record here after the store call; the key resolves the
// project so a request with an unknown key records nothing.
export const record = internalMutation({
  args: { apiKey: v.string(), issue: purchaseIssueInputValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (resolved)
      await recordPurchaseIssue(ctx, resolved.project._id, args.issue);
    return null;
  },
});

export async function prunePurchaseIssuesHandler(
  ctx: MutationCtx,
  olderThanMs: number,
  batchSize: number,
): Promise<{ deleted: number }> {
  const cutoff = Date.now() - olderThanMs;
  const expired = await ctx.db
    .query("purchaseIssues")
    .withIndex("by_lastSeenAt", (q) => q.lt("lastSeenAt", cutoff))
    .take(batchSize);

  const removedByProject = new Map<Id<"projects">, number>();
  for (const issue of expired) {
    await ctx.db.delete(issue._id);
    removedByProject.set(
      issue.projectId,
      (removedByProject.get(issue.projectId) ?? 0) + 1,
    );
  }
  for (const [projectId, removed] of removedByProject) {
    const counter = await ctx.db
      .query("purchaseIssueCounts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    if (counter) {
      await ctx.db.patch(counter._id, {
        rows: Math.max(0, counter.rows - removed),
      });
    }
  }

  if (expired.length === batchSize) {
    await ctx.scheduler.runAfter(
      0,
      internal.purchaseIssues.internal.prunePurchaseIssues,
      { olderThanMs, batchSize },
    );
  }
  return { deleted: expired.length };
}

export const prunePurchaseIssues = internalMutation({
  args: { olderThanMs: v.number(), batchSize: v.optional(v.number()) },
  returns: v.object({ deleted: v.number() }),
  handler: (ctx, args) =>
    prunePurchaseIssuesHandler(
      ctx,
      args.olderThanMs,
      args.batchSize ?? PRUNE_BATCH_SIZE,
    ),
});
