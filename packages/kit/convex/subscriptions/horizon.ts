"use node";
import { v } from "convex/values";

import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mapWithConcurrency } from "../utils/concurrency";

// Horizon polling reconciler.
//
// Meta Horizon Store has no webhook / push notification system —
// `developers.meta.com/horizon/documentation/native/ps-iap` only
// exposes the synchronous `verify_entitlement` Graph API. So unlike
// Apple ASN v2 / Google RTDN, kit cannot ingest "subscription
// renewed" or "refunded" events the moment they happen on Meta's
// side; we have to re-check entitlement on a schedule.
//
// This cron action walks every Horizon `subscriptions` row that
// might have changed (state in {Active, InGracePeriod, Paused}),
// hits Meta Graph for each (userId, sku), and feeds the result
// through the same `applySubscriptionEvent` pipeline Apple/Google
// use. Net effect: subscriptions table converges to Meta's
// authoritative answer within one cron tick.
//
// Cadence: 6h (registered in `crons.ts`). Every project's Horizon
// subs run in one tick because the population is small per project.
// If a single project grows past ~1000 active Horizon subs we'll
// want to paginate.

const META_GRAPH_BASE = "https://graph.oculus.com";

type HorizonProbe = {
  userId: string;
  sku: string;
  purchaseToken: string;
  state: string;
};

export const reconcileHorizonEntitlements = internalAction({
  args: {},
  returns: v.object({
    checked: v.number(),
    transitioned: v.number(),
    failures: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    checked: number;
    transitioned: number;
    failures: number;
  }> => {
    const projects = await ctx.runQuery(
      internal.subscriptions.horizonInternal.listHorizonProjects,
      {},
    );
    let checked = 0;
    let transitioned = 0;
    let failures = 0;

    for (const project of projects) {
      if (
        !project.horizonEnabled ||
        !project.horizonAppId ||
        !project.horizonAppSecret
      ) {
        continue;
      }
      const probes = await ctx.runQuery(
        internal.subscriptions.horizonInternal.listHorizonSubscriptions,
        { projectId: project._id },
      );
      const appAccessToken = `OC|${project.horizonAppId}|${project.horizonAppSecret}`;

      // Parallelize Meta Graph API checks per project. Meta's
      // verify_entitlement endpoint isn't tightly throttled — App
      // Access Tokens get the standard Graph rate limit (~200 calls
      // per app per hour per user, but our user is the App ID
      // itself), so concurrency=8 keeps the cron tick fast for
      // projects with many subs without tripping 429s. The runMutation
      // calls inside still serialize per probe to keep the
      // recordHorizonStatus state-transitions atomic.
      const HORIZON_PROBE_CONCURRENCY = 8;
      checked += probes.length;
      const probeResults = await mapWithConcurrency(
        probes,
        HORIZON_PROBE_CONCURRENCY,
        async (probe) => {
          try {
            const granted = await checkHorizonEntitlement({
              appId: project.horizonAppId!,
              appAccessToken,
              userId: probe.userId,
              sku: probe.sku,
            });
            return { probe, granted, error: null as unknown };
          } catch (error) {
            return { probe, granted: null as boolean | null, error };
          }
        },
      );
      for (const result of probeResults) {
        const { probe, granted, error } = result;
        if (error) {
          failures += 1;
          console.warn(
            "[horizon-reconciler] check failed",
            project._id,
            probe.userId,
            probe.sku,
            error instanceof Error ? error.message : error,
          );
          continue;
        }
        // Meta's response is binary: `granted: true` means the user
        // currently holds the entitlement. Map to the same event
        // types Apple/Google emit so the state machine / entitlements
        // query don't need a Horizon-specific branch.
        if (granted && probe.state !== "Active") {
          await ctx.runMutation(
            internal.subscriptions.horizonInternal.recordHorizonStatus,
            {
              projectId: project._id,
              purchaseToken: probe.purchaseToken,
              userId: probe.userId,
              productId: probe.sku,
              eventType: "SubscriptionRenewed",
            },
          );
          transitioned += 1;
        } else if (!granted && probe.state === "Active") {
          await ctx.runMutation(
            internal.subscriptions.horizonInternal.recordHorizonStatus,
            {
              projectId: project._id,
              purchaseToken: probe.purchaseToken,
              userId: probe.userId,
              productId: probe.sku,
              eventType: "SubscriptionExpired",
            },
          );
          transitioned += 1;
        }
      }
    }

    return { checked, transitioned, failures };
  },
});

// Manual one-off run trigger from the dashboard "Reconcile now" button
// or the MCP `openiap_troubleshoot` tool. Same handler as the cron
// path; just exposed under a public action for convenience.
export const reconcileHorizonNow = action({
  args: { apiKey: v.string() },
  returns: v.object({
    checked: v.number(),
    transitioned: v.number(),
    failures: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    checked: number;
    transitioned: number;
    failures: number;
  }> => {
    const project = await ctx.runQuery(
      internal.subscriptions.horizonInternal.getProjectByApiKey,
      { apiKey: args.apiKey },
    );
    if (!project) throw new Error("Invalid API key");
    if (
      !project.horizonEnabled ||
      !project.horizonAppId ||
      !project.horizonAppSecret
    ) {
      throw new Error(
        "Horizon is not configured for this project (set horizonEnabled + horizonAppId + horizonAppSecret in Settings).",
      );
    }
    const probes = await ctx.runQuery(
      internal.subscriptions.horizonInternal.listHorizonSubscriptions,
      { projectId: project._id },
    );
    const appAccessToken = `OC|${project.horizonAppId}|${project.horizonAppSecret}`;

    let checked = 0;
    let transitioned = 0;
    let failures = 0;
    for (const probe of probes) {
      checked += 1;
      try {
        const granted = await checkHorizonEntitlement({
          appId: project.horizonAppId,
          appAccessToken,
          userId: probe.userId,
          sku: probe.sku,
        });
        if (granted && probe.state !== "Active") {
          await ctx.runMutation(
            internal.subscriptions.horizonInternal.recordHorizonStatus,
            {
              projectId: project._id,
              purchaseToken: probe.purchaseToken,
              userId: probe.userId,
              productId: probe.sku,
              eventType: "SubscriptionRenewed",
            },
          );
          transitioned += 1;
        } else if (!granted && probe.state === "Active") {
          await ctx.runMutation(
            internal.subscriptions.horizonInternal.recordHorizonStatus,
            {
              projectId: project._id,
              purchaseToken: probe.purchaseToken,
              userId: probe.userId,
              productId: probe.sku,
              eventType: "SubscriptionExpired",
            },
          );
          transitioned += 1;
        }
      } catch (error) {
        failures += 1;
        console.warn("[horizon-reconciler] check failed", error);
      }
    }
    return { checked, transitioned, failures };
  },
});

async function checkHorizonEntitlement(args: {
  appId: string;
  appAccessToken: string;
  userId: string;
  sku: string;
}): Promise<boolean> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(args.appId)}/verify_entitlement`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: args.appAccessToken,
      user_id: args.userId,
      sku: args.sku,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta Graph API ${res.status}: ${text.slice(0, 256)}`);
  }
  const body = (await res.json()) as { success?: boolean };
  return body.success === true;
}

// Re-export with proper Id type usage so consumers in the same module
// graph compile cleanly even though we pass `Id<"projects">` around.
export type HorizonProjectId = Id<"projects">;
export type HorizonProbeRow = HorizonProbe;
