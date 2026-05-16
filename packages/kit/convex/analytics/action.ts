"use node";

import { v } from "convex/values";

import { internalAction } from "../_generated/server";

/**
 * Server-side Mixpanel tracking for events the SPA can't observe.
 *
 * The client already tracks page views, signups, sign-ins, and
 * creation events. This module covers the activation milestone that
 * only the receipt-verification path sees: "a project has validated
 * its first receipt." That event fires from `savePurchaseInternal`
 * via `ctx.scheduler.runAfter(0, ...)` so the mutation latency stays
 * clean and a Mixpanel outage can't fail a customer save.
 *
 * Auth: posts to Mixpanel's HTTP `/track` endpoint with the project
 * token. Server-side tracking uses the same project token as the
 * SPA — Mixpanel separates SPA vs server events by the `mp_lib`
 * property Mixpanel's own SDK sets; here we set it explicitly.
 *
 * Env: `MIXPANEL_TOKEN` on the Convex prod deployment (set via
 * `npx convex env set MIXPANEL_TOKEN ... --prod`). If unset, the
 * action no-ops so non-production Convex deployments don't shoot
 * events into the prod analytics project.
 */
const MIXPANEL_TRACK_ENDPOINT = "https://api-eu.mixpanel.com/track";

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export const trackFirstReceiptVerified = internalAction({
  args: {
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    store: v.union(
      v.literal("apple"),
      v.literal("google"),
      v.literal("horizon"),
    ),
  },
  handler: async (_ctx, args) => {
    const token = process.env.MIXPANEL_TOKEN;
    if (!token) {
      // Dev / preview deployments without the token configured — silent
      // no-op so non-prod Convex environments never phone home to the
      // prod Mixpanel project.
      return;
    }

    const payload = [
      {
        event: "first_receipt_verified",
        properties: {
          token,
          // Distinct_id by organization so the event groups with that
          // org's user profiles — every org member sees the activation
          // in their "Recent events" panel.
          distinct_id: args.organizationId,
          projectId: args.projectId,
          organizationId: args.organizationId,
          store: args.store,
          // `time` omitted intentionally: Mixpanel's /track stamps the
          // event server-side when the property is absent, which
          // avoids the "seconds vs milliseconds" unit trap (the API
          // expects seconds; `Date.now()` is ms, which would place
          // events ~55,000 years in the future and break every
          // time-based funnel).
          // Flag so Mixpanel can distinguish server-side emits from
          // the SPA's `mixpanel-browser` autocapture events.
          mp_lib: "openiap-kit-convex",
        },
      },
    ];

    try {
      const res = await fetch(MIXPANEL_TRACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error("Mixpanel /track returned non-ok status", {
          status: res.status,
        });
      }
    } catch (error) {
      // Never let analytics failure surface to the customer. Log and
      // move on — we can backfill missed events from `purchases`
      // history if we ever need to.
      console.error(
        "Mixpanel /track request failed:",
        describeErrorForLog(error),
      );
    }
  },
});
