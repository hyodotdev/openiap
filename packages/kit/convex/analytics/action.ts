"use node";

import { v } from "convex/values";

import { internalAction } from "../_generated/server";

/**
 * Server-side Mixpanel tracking for events the SPA can't observe. The SPA
 * tracks page views, signups, sign-ins and creation events; this covers the
 * activation milestone only receipt verification sees: a project's first
 * validated receipt.
 *
 * Scheduled from `savePurchaseInternal` via `ctx.scheduler.runAfter(0, ...)`,
 * so a customer save gains no latency and a Mixpanel outage can't fail it.
 *
 * Auth: posts to Mixpanel's HTTP `/track` with the SPA's project token.
 *
 * Env: `MIXPANEL_TOKEN` on the Convex prod deployment (set via
 * `npx convex env set MIXPANEL_TOKEN ... --prod`). If unset the action
 * no-ops, so non-production deployments never send events to the prod
 * analytics project.
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
      v.literal("amazon"),
    ),
  },
  handler: async (_ctx, args) => {
    const token = process.env.MIXPANEL_TOKEN;
    if (!token) {
      return;
    }

    const payload = [
      {
        event: "first_receipt_verified",
        properties: {
          token,
          // Per organization, so the event groups with the org's user
          // profiles and every member sees it under "Recent events".
          distinct_id: args.organizationId,
          projectId: args.projectId,
          organizationId: args.organizationId,
          store: args.store,
          // No `time`: /track stamps the event server-side when it is absent.
          // The API expects seconds, and `Date.now()` ms would put events
          // ~55,000 years in the future, breaking every time-based funnel.
          // Mixpanel's own SDK sets `mp_lib`; setting it here separates these
          // server-side events from the SPA's `mixpanel-browser` autocapture.
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
      // Analytics failures never reach the customer; missed events can be
      // backfilled from `purchases` history.
      console.error(
        "Mixpanel /track request failed:",
        describeErrorForLog(error),
      );
    }
  },
});
