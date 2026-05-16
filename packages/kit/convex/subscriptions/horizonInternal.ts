import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import {
  applySubscriptionTransition,
  type CurrentSubscription,
} from "./stateMachine";
import { applyStatsTransition, statsContributionFor } from "./stats";

// Convex-runtime helpers used by the Horizon polling reconciler in
// `horizon.ts`. Kept separate so the action's "use node" boundary
// doesn't drag node-only imports into the regular Convex bundle.

export const listHorizonProjects = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      horizonEnabled: v.optional(v.boolean()),
      horizonAppId: v.optional(v.union(v.string(), v.null())),
      horizonAppSecret: v.optional(v.union(v.string(), v.null())),
    }),
  ),
  handler: async (ctx) => {
    // Use the by_horizon_enabled index instead of a full-table scan.
    // Most projects don't opt into Meta Horizon, so this skips the
    // bulk of the table on every cron tick.
    const enabled = await ctx.db
      .query("projects")
      .withIndex("by_horizon_enabled", (q) => q.eq("horizonEnabled", true))
      .collect();
    return enabled.map((project) => ({
      _id: project._id,
      horizonEnabled: project.horizonEnabled,
      horizonAppId: project.horizonAppId,
      horizonAppSecret: project.horizonAppSecret,
    }));
  },
});

export const getProjectByApiKey = internalQuery({
  args: { apiKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("projects"),
      horizonEnabled: v.optional(v.boolean()),
      horizonAppId: v.optional(v.union(v.string(), v.null())),
      horizonAppSecret: v.optional(v.union(v.string(), v.null())),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    const project = resolved?.project ?? null;
    if (!project) return null;
    return {
      _id: project._id,
      horizonEnabled: project.horizonEnabled,
      horizonAppId: project.horizonAppId,
      horizonAppSecret: project.horizonAppSecret,
    };
  },
});

// All subscriptions for a Horizon project that might still mutate.
// Refunded/Revoked/Expired-with-no-renewal rows are excluded so the
// cron stays cheap as the historical archive grows.
export const listHorizonSubscriptions = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      userId: v.string(),
      sku: v.string(),
      purchaseToken: v.string(),
      state: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // Hit by_project_and_state for each mutable state in parallel
    // instead of full-scanning the project via by_project_and_updated
    // and filtering in memory. The Refunded / Revoked / Expired
    // historical archive is the bulk of any long-lived project — the
    // index path skips it entirely.
    // All states that can still mutate via Meta's verify_entitlement
    // result. The historical archive (Refunded / Revoked / Expired
    // with no auto-renew) is excluded so the cron stays cheap as the
    // archive grows, but every live + transient state is included
    // so a recovery (InBillingRetry → Active) or a Paused → expiry
    // doesn't get stuck.
    const STATES = [
      "Active",
      "InGracePeriod",
      "InBillingRetry",
      "Paused",
      "Unknown",
    ] as const;
    // Per-state cap with self-paginating, oldest-first ordering.
    //
    // Bounded for two reasons: (1) Convex's 40k document-read limit
    // per query — 5 states × 6_000 = 30k reads, leaving ~10k for
    // downstream filtering; (2) the action that consumes this list
    // calls Meta `verify_entitlement` once per row, which has its
    // own per-cron-tick budget.
    //
    // Pagination strategy: order by `updatedAt` ASC via the
    // `by_project_and_state_and_updated` composite index. The
    // staleest subs per state surface first; once
    // `recordHorizonStatus` runs and writes a fresh `updatedAt`,
    // those rows move to the back of the queue so the next tick
    // picks up the never-reconciled tail. Time-to-fully-reconcile
    // for population N is ~ceil(N / PER_STATE_CAP) ticks. A
    // pathological 100k-sub project converges in ~17 ticks instead
    // of "tail forever stale" (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    //
    // No external continuation cursor is needed because the cursor is
    // implicit in `updatedAt` itself.
    const PER_STATE_CAP = 6_000;
    const perState = await Promise.all(
      STATES.map((state) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_project_and_state_and_updated", (q) =>
            q.eq("projectId", args.projectId).eq("state", state),
          )
          .order("asc")
          .take(PER_STATE_CAP),
      ),
    );
    // Operator visibility: log when a state bucket fully fills the
    // per-tick cap. The reconciler still completes correctly because
    // the tail surfaces next tick, but a sustained cap-hit signals
    // that the cron interval may be too sparse for the population.
    STATES.forEach((state, i) => {
      if (perState[i].length === PER_STATE_CAP) {
        console.info(
          `[horizon-reconciler] project=${args.projectId} state=${state} filled PER_STATE_CAP=${PER_STATE_CAP}; remaining tail will reconcile on subsequent ticks via updatedAt cursor.`,
        );
      }
    });
    return perState
      .flat()
      .filter((sub) => sub.platform === "Android")
      .filter((sub) => !!sub.userId)
      .map((sub) => ({
        userId: sub.userId!,
        sku: sub.productId,
        purchaseToken: sub.purchaseToken,
        state: sub.state,
      }));
  },
});

// The reconciler hands us a synthetic "event" describing what Meta
// just told us. We funnel it through the same state-machine the
// webhook receivers use so transition semantics stay consistent.
export const recordHorizonStatus = internalMutation({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.string(),
    productId: v.string(),
    eventType: v.union(
      v.literal("SubscriptionRenewed"),
      v.literal("SubscriptionExpired"),
    ),
  },
  returns: v.union(v.null(), v.id("subscriptions")),
  handler: async (ctx, args) => {
    const existing: Doc<"subscriptions"> | null = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_token", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("purchaseToken", args.purchaseToken),
      )
      .unique();
    if (!existing) return null;

    const current: CurrentSubscription = {
      state: existing.state,
      productId: existing.productId,
      expiresAt: existing.expiresAt,
      renewsAt: existing.renewsAt,
      willRenew: existing.willRenew,
      cancellationReason: existing.cancellationReason,
      currency: existing.currency,
      priceAmountMicros: existing.priceAmountMicros,
    };
    const transition = applySubscriptionTransition(current, {
      type: args.eventType,
      productId: args.productId,
    });
    if (!transition.next) return existing._id;
    const now = Date.now();

    // Synthesize a webhookEvents row so the SSE stream re-broadcasts
    // this Horizon transition to connected SDK clients. Without this
    // the polling reconciler updated the subscription row but never
    // surfaced the change on `/v1/webhooks/stream/{apiKey}` — Horizon
    // listeners would silently miss every renewal / expiry until the
    // next state-driven HTTP query.
    //
    // Source is `MetaHorizonReconciler` (synthetic; Horizon has no
    // upstream webhook) and `sourceNotificationId` is a deterministic
    // hash of (purchaseToken, eventType, productId) so re-running the
    // cron with the same Meta Graph response doesn't double-emit.
    const sourceNotificationId = `meta-horizon-${args.eventType}-${args.purchaseToken}-${args.productId}`;

    // Dedup by (projectId, source, sourceNotificationId) — re-running
    // the same Horizon poll result (cron retries, manual reconcile)
    // would otherwise insert another webhookEvents row and re-broadcast
    // the same SSE event, bypassing the first-seen-wins contract the
    // Apple/Google webhook receivers honor. Reuse the existing event
    // when one is already on file.
    const existingEvent = await ctx.db
      .query("webhookEvents")
      .withIndex("by_project_and_notification_id", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("sourceNotificationId", sourceNotificationId),
      )
      .unique();
    const eventId = existingEvent
      ? existingEvent._id
      : await ctx.db.insert("webhookEvents", {
          projectId: args.projectId,
          type: args.eventType,
          source: "MetaHorizonReconciler",
          platform: "Android",
          environment: "Production",
          purchaseToken: args.purchaseToken,
          sourceNotificationId,
          productId: args.productId,
          subscriptionState: transition.next.state,
          occurredAt: now,
          receivedAt: now,
        });
    // If we found an existing event AND the existing subscription row
    // already references it, the rest of this mutation is a no-op —
    // the prior cron tick already applied this transition. Bump
    // `updatedAt` so the row moves to the back of the
    // `by_project_and_state_and_updated` queue used by
    // `listHorizonSubscriptions` for paginated reconciliation;
    // otherwise steady-state rows whose deterministic event id
    // doesn't change would stay pinned at the front of the cursor and
    // anything past PER_STATE_CAP would never be revisited (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    if (existing.lastEventId === eventId) {
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }

    // Capture stats contribution before patching so the delta below
    // subtracts what the row used to count for and adds the new state.
    // Horizon doesn't track billingPeriod (Meta doesn't expose one in
    // verify_entitlement), so MRR contribution is 0 — matches the
    // existing read-path semantics for Horizon-backed subs.
    const beforeContribution = statsContributionFor(existing, undefined, now);

    // Horizon-specific expiresAt handling. Meta's verify_entitlement
    // is binary (granted / not granted) — there's no upstream expiry
    // we can copy onto the row. The state machine's CurrentSubscription
    // path carries the OLD expiresAt forward, which means a renewed-
    // upstream sub whose previous expiresAt is now in the past would
    // be patched back to "Active" with a stale (already-expired)
    // timestamp; the entitlement read path's `isActive` check then
    // immediately treats it as inactive again. Set a forward-looking
    // expiry that comfortably outlasts the next poll cycle (cron runs
    // every 6h) so an `Active` Horizon row stays entitled until either
    // the next reconcile flips it or the operator pauses the cron for
    // an extended outage.
    //
    // For SubscriptionExpired we let the state-machine's transition
    // handle the timestamp; the row is moving to a non-active state
    // so the stale expiresAt is irrelevant.
    const HORIZON_RENEWAL_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
    const horizonExpiresAt =
      args.eventType === "SubscriptionRenewed"
        ? now + HORIZON_RENEWAL_VALIDITY_MS
        : transition.next.expiresAt;

    await ctx.db.patch(existing._id, {
      state: transition.next.state,
      willRenew: transition.next.willRenew,
      cancellationReason: transition.next.cancellationReason,
      expiresAt: horizonExpiresAt,
      updatedAt: now,
      lastEventId: eventId,
    });

    const updatedRow = (await ctx.db.get(existing._id))!;
    const afterContribution = statsContributionFor(updatedRow, undefined, now);
    await applyStatsTransition(
      ctx,
      args.projectId,
      beforeContribution,
      afterContribution,
    );

    return existing._id;
  },
});
