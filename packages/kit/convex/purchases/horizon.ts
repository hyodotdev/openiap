"use node";
import { v } from "convex/values";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  MetaHorizonVerificationError,
  ProjectMetaHorizonAppIdNotConfiguredError,
  ProjectMetaHorizonAppSecretNotConfiguredError,
  ProjectMetaHorizonNotEnabledError,
  ReceiptVerificationError,
} from "./errors";
import {
  getProjectByApiKey,
  isValidState,
  receiptResponseValidator,
} from "./shared";
import { retryOnTransient } from "./retry";

// Meta's S2S entitlement endpoint. Follows the exact shape the
// client SDK uses for its own direct-to-Meta fallback — IAPKit just
// swaps in the server-held App Access Token so the client never sees
// the App Secret.
//
// Endpoint: POST https://graph.oculus.com/{APP_ID}/verify_entitlement
// Body (x-www-form-urlencoded):
//   access_token  = OC|{APP_ID}|{APP_SECRET}
//   user_id       = Oculus user id from the client
//   sku           = add-on SKU configured in Meta Developer Dashboard
// Response JSON: { success: boolean, grant_time?: number }
//
// Docs: https://developers.meta.com/horizon/documentation/native/ps-iap
const META_GRAPH_BASE = "https://graph.oculus.com";

export const verifyMetaHorizonReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    userId: v.string(),
    sku: v.string(),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getProjectByApiKey(ctx, args.apiKey);

    if (project.horizonEnabled !== true) {
      throw new ProjectMetaHorizonNotEnabledError();
    }
    if (!project.horizonAppId) {
      throw new ProjectMetaHorizonAppIdNotConfiguredError();
    }
    if (!project.horizonAppSecret) {
      throw new ProjectMetaHorizonAppSecretNotConfiguredError();
    }

    const requestData = {
      store: "horizon" as const,
      userId: args.userId,
      sku: args.sku,
    };

    // `OC|$APP_ID|$APP_SECRET` is Meta's App Access Token format for
    // server-to-server calls. Never logged, never returned to the
    // caller — only sent in the outgoing request body.
    const appAccessToken = `OC|${project.horizonAppId}|${project.horizonAppSecret}`;
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(project.horizonAppId)}/verify_entitlement`;

    let parsedBody: unknown;
    try {
      parsedBody = await retryOnTransient(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            access_token: appAccessToken,
            user_id: args.userId,
            sku: args.sku,
          }).toString(),
        });

        if (!res.ok) {
          // Attach the status as `code` so retryOnTransient can
          // decide whether to retry: 5xx yes, 4xx no. This matches
          // the gaxios / googleapis error shape the retry helper
          // already understands.
          const text = await res.text().catch(() => "");
          const err = new Error(
            `Meta Graph API ${res.status}: ${text.slice(0, 512)}`,
          );
          (err as { code?: number }).code = res.status;
          throw err;
        }

        return (await res.json()) as unknown;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Persist the failure so it shows up in the dashboard, mirroring
      // Apple / Google paths.
      await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
        projectId: project._id,
        store: "horizon",
        applicationId: project.horizonAppId,
        remoteId: buildHorizonRemoteId(args.userId, args.sku),
        requestData,
        remoteResponse: JSON.stringify({
          error: "META_HORIZON_VERIFICATION_ERROR",
          message,
          sku: args.sku,
        }),
        state: HarmonizedPurchaseState.INAUTHENTIC,
        isValid: false,
        requestIp: args.requestIp,
        verificationDurationMs: Date.now() - verificationStart,
      });
      throw new MetaHorizonVerificationError(message);
    }

    const verified = parseHorizonResponse(parsedBody);
    const state = verified.success
      ? HarmonizedPurchaseState.ENTITLED
      : HarmonizedPurchaseState.INAUTHENTIC;

    await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
      projectId: project._id,
      store: "horizon",
      applicationId: project.horizonAppId,
      // `{userId}:{sku}` is deterministic per entitlement so the
      // `by_project_and_remote` index de-dupes repeat verifications
      // into one row — same pattern Apple uses with
      // originalTransactionId and Google uses with purchaseToken.
      remoteId: buildHorizonRemoteId(args.userId, args.sku),
      requestData,
      // Pack the sku alongside Meta's fields so
      // extractProductIdFromRemoteResponse can surface the product
      // id from persisted rows without also needing requestData.
      // `grantTimeMs` is renamed from Meta's wire field `grant_time`
      // because we've already normalized the unit — storing it with
      // the original name would invite `new Date(grant_time)` misuse
      // downstream.
      remoteResponse: JSON.stringify({
        success: verified.success,
        grantTimeMs: verified.grantTime,
        sku: args.sku,
      }),
      state,
      isValid: isValidState(state),
      requestIp: args.requestIp,
      verificationDurationMs: Date.now() - verificationStart,
    });

    return { isValid: isValidState(state), state };
  },
});

interface HorizonVerifyResult {
  success: boolean;
  grantTime?: number;
}

/**
 * Build a deduplication key for the (userId, sku) pair that's safe to
 * collide-check against. A naive `"${userId}:${sku}"` would alias
 * distinct entitlements when either field contains a colon (e.g.
 * `a:b` + `c` vs. `a` + `b:c`). URL-encoding each part restores an
 * unambiguous mapping from the pair to the remoteId — the colon is
 * never produced by `encodeURIComponent`, so it remains a safe
 * separator.
 */
export function buildHorizonRemoteId(userId: string, sku: string): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(sku)}`;
}

function parseHorizonResponse(raw: unknown): HorizonVerifyResult {
  if (!raw || typeof raw !== "object") {
    throw new MetaHorizonVerificationError(
      "Meta Graph API returned an unparseable body.",
    );
  }
  const record = raw as Record<string, unknown>;
  const success = record.success === true;
  const grantTimeRaw = record.grant_time;
  // Meta's `grant_time` is a Unix timestamp in **seconds**. The rest
  // of IAPKit (persisted purchase rows, dashboards, anything that
  // might compare against `Date.now()`) standardizes on
  // milliseconds — match Apple's `purchaseDate` and Google's
  // `purchaseDate` so cross-store analytics don't need per-store
  // unit handling. Convert here at the ingestion boundary.
  const grantTime =
    typeof grantTimeRaw === "number" && Number.isFinite(grantTimeRaw)
      ? grantTimeRaw * 1000
      : undefined;
  return { success, grantTime };
}

// Re-exported for tests so they can assert instanceof without
// pulling in the full errors module surface.
export { ReceiptVerificationError };
