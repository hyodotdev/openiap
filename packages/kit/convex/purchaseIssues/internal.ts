import { v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { getWritableProject } from "../projects/writable";
import { purchaseStoreValidator } from "../schema";
import { isUserErasureRequested } from "../subscriptions/erasure";
import type { BindOutcome } from "../subscriptions/internal";
import { isValidSubscriptionUserId } from "../subscriptions/limits";
import { correlationIdOrUndefined } from "../utils/correlationId";
import {
  purchaseIssueCauseValidator,
  receiptEnvironmentValidator,
} from "../utils/validation";
import {
  evidenceFingerprint,
  fingerprintSalt,
  isSha256Hex,
  purchaseDigest,
} from "./evidence";

// A project's rows split into 16 shards by the fingerprint's first hex digit,
// each capped at 64 rows (1,024 in all). A new row reads only its own shard,
// so concurrent failures rarely contend and no counter document exists.
export const PURCHASE_ISSUE_ROWS_PER_SHARD = 64;
export const PURCHASE_ISSUE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const PRUNE_BATCH_SIZE = 200;
const MAX_PRODUCT_ID_LENGTH = 256;

export const purchaseIssueInputValidator = v.object({
  cause: purchaseIssueCauseValidator,
  store: purchaseStoreValidator,
  // `purchaseDigest` or `projectIssueDigest`; the row stores it salted.
  digest: v.string(),
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

export function purchaseIssueShard(fingerprint: string): number {
  return Number.parseInt(fingerprint[0], 16);
}

/**
 * Records one failure. A repeat of the same (fingerprint, cause) bumps its
 * count; a new row in a full shard replaces that shard's least recently seen.
 */
export async function recordPurchaseIssue(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  input: PurchaseIssueInput,
): Promise<void> {
  if (!isSha256Hex(input.digest)) return;
  const project = await getWritableProject(ctx, projectId);
  if (!project) return;
  const now = Date.now();
  const fingerprint = await evidenceFingerprint(
    await fingerprintSalt(ctx, project),
    input.digest,
  );
  const fields = storedFields(input);
  // A user whose erasure was requested is never named again.
  if (
    fields.appUserId &&
    (await isUserErasureRequested(ctx, project, fields.appUserId))
  )
    delete fields.appUserId;

  const existing = await ctx.db
    .query("purchaseIssues")
    .withIndex("by_project_and_fingerprint_and_cause", (q) =>
      q
        .eq("projectId", projectId)
        .eq("fingerprint", fingerprint)
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

  const shard = purchaseIssueShard(fingerprint);
  const shardRows = await ctx.db
    .query("purchaseIssues")
    .withIndex("by_project_and_shard_and_lastSeenAt", (q) =>
      q.eq("projectId", projectId).eq("shard", shard),
    )
    .take(PURCHASE_ISSUE_ROWS_PER_SHARD);
  if (shardRows.length >= PURCHASE_ISSUE_ROWS_PER_SHARD) {
    await ctx.db.delete(shardRows[0]._id);
  }

  await ctx.db.insert("purchaseIssues", {
    projectId,
    cause: input.cause,
    store: input.store,
    fingerprint,
    shard,
    ...fields,
    count: 1,
    firstSeenAt: now,
    lastSeenAt: now,
  });
}

/**
 * Schedules the record of a failed secret-key link, so it can neither fail the
 * bind nor slow it. It fingerprints the purchase the bind matched, as the
 * purchase page does; `evidence`, the bind's token, only when none is named.
 */
export async function recordBindIssue(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  outcome: BindOutcome,
  request: { evidence: string; userId: string; correlationId?: string },
): Promise<void> {
  const cause =
    outcome.reason === "bound_to_other_user"
      ? "OWNERSHIP_CONFLICT"
      : outcome.limitReached
        ? "BIND_LIMIT_REACHED"
        : null;
  const { store, remoteId } = outcome;
  if (!cause || !store) return;
  await ctx.scheduler.runAfter(0, internal.purchaseIssues.internal.record, {
    projectId,
    issue: {
      cause,
      store,
      digest: await purchaseDigest(store, remoteId ?? request.evidence),
      ...(outcome.productId ? { productId: outcome.productId } : {}),
      appUserId: request.userId,
      ...(request.correlationId
        ? { correlationId: request.correlationId }
        : {}),
    },
  });
}

/**
 * The project a verification issue records against, or null to record
 * nothing: an unknown key, or a project-wide row seen after
 * `projectScoped.seenSince`. That throttle makes a flood of one rejection cost
 * a read per request instead of a write to one shared row.
 */
export const issueRecordTarget = internalQuery({
  args: {
    apiKey: v.string(),
    projectScoped: v.optional(
      v.object({
        digest: v.string(),
        cause: purchaseIssueCauseValidator,
        seenSince: v.number(),
      }),
    ),
  },
  returns: v.union(v.id("projects"), v.null()),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (!resolved) return null;
    const { project } = resolved;
    const scoped = args.projectScoped;
    if (scoped && project.fingerprintSalt) {
      const fingerprint = await evidenceFingerprint(
        project.fingerprintSalt,
        scoped.digest,
      );
      const row = await ctx.db
        .query("purchaseIssues")
        .withIndex("by_project_and_fingerprint_and_cause", (q) =>
          q
            .eq("projectId", project._id)
            .eq("fingerprint", fingerprint)
            .eq("cause", scoped.cause),
        )
        .unique();
      if (row && row.lastSeenAt > scoped.seenSince) return null;
    }
    return project._id;
  },
});

// Scheduled by verification actions and bind mutations, off their response
// path. The arguments carry a project id, never the caller's API key.
export const record = internalMutation({
  args: { projectId: v.id("projects"), issue: purchaseIssueInputValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordPurchaseIssue(ctx, args.projectId, args.issue);
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

  for (const issue of expired) {
    await ctx.db.delete(issue._id);
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
