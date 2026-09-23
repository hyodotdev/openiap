"use node";

import { buildHorizonRemoteId } from "./identity";
export { buildHorizonRemoteId } from "./identity";
import { v, type Infer } from "convex/values";

import { action, type ActionCtx } from "../_generated/server";
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
  getVerificationProjectByApiKey,
  isValidState,
  receiptResponseValidator,
  type ReceiptResponse,
  type RecheckOptions,
} from "./shared";
import {
  extractHttpStatus,
  isTransientHttpError,
  retryOnTransient,
} from "./retry";

// Meta's S2S entitlement check: the call the client SDK makes directly, but
// with the server-held App Access Token so the app never sees the secret.
//   POST https://graph.oculus.com/{APP_ID}/verify_entitlement
//   form body: access_token=OC|{APP_ID}|{APP_SECRET}, user_id, sku
//   response: { success: boolean, grant_time?: number }
// https://developers.meta.com/horizon/documentation/native/ps-iap-s2s/
const META_GRAPH_BASE = "https://graph.oculus.com";
const META_REQUEST_TIMEOUT_MS = 10_000;

class InvalidHorizonResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHorizonResponseError";
  }
}

function describeError(error: unknown): string {
  if (error instanceof InvalidHorizonResponseError) {
    return error.message;
  }
  const status = (error as { code?: unknown })?.code;
  const type = error instanceof Error ? error.name : typeof error;
  return typeof status === "number" ? `${type} ${status}` : type;
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function hasTransientCause(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const seen = new Set<unknown>([error]);
  let cause = (error as { cause?: unknown }).cause;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    if (
      isAbortError(cause) ||
      isTransientHttpError(cause) ||
      cause instanceof TypeError
    ) {
      return true;
    }
    seen.add(cause);
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}

function shouldRetryHorizonError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (status === 429) return true;
  if (isAbortError(error) || isTransientHttpError(error)) return true;

  // Node's fetch reports transport failures as `TypeError: fetch failed`,
  // often with the useful network code nested under `cause`. All TypeErrors
  // raised in this block originate at the fetch boundary, so they are safe to
  // retry; JSON parsing failures are converted to InvalidHorizonResponseError.
  return error instanceof TypeError || hasTransientCause(error);
}

async function requestHorizonVerification(
  url: string,
  body: string,
): Promise<HorizonVerifyResult> {
  return await retryOnTransient(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        META_REQUEST_TIMEOUT_MS,
      );

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          // We intentionally do not read error bodies because they can contain
          // upstream details or stall indefinitely. Dispose the stream before
          // retrying so undici can release the connection; cancellation is
          // best-effort and must not replace the authoritative HTTP status.
          try {
            await response.body?.cancel();
          } catch {
            // The status below still determines retryability.
          }
          // Keep upstream response bodies out of logs and Convex errors. The
          // status is enough to classify retryability and diagnose the call.
          const error = new Error(
            `Meta Graph API returned HTTP ${response.status}`,
          );
          (error as { code?: number }).code = response.status;
          throw error;
        }

        let responseBody: unknown;
        try {
          responseBody = (await response.json()) as unknown;
        } catch (error) {
          // `Response.json()` can fail transiently like the fetch (a peer
          // disconnect, a body stalled until the abort), so those retry; only a
          // JSON syntax error is a protocol error.
          if (shouldRetryHorizonError(error)) throw error;
          throw new InvalidHorizonResponseError(
            "Meta Graph API returned invalid JSON.",
          );
        }
        return parseHorizonResponse(responseBody);
      } finally {
        clearTimeout(timeout);
      }
    },
    { shouldRetry: shouldRetryHorizonError },
  );
}

const horizonVerificationArgs = v.object({
  apiKey: v.string(),
  userId: v.string(),
  sku: v.string(),
  requestIp: v.optional(v.string()),
});

export const verifyMetaHorizonReceiptInternalV1 = action({
  args: horizonVerificationArgs.fields,
  returns: receiptResponseValidator,
  handler: verifyHorizonReceipt,
});

export async function verifyHorizonReceipt(
  ctx: ActionCtx,
  args: Infer<typeof horizonVerificationArgs>,
  options: RecheckOptions = {},
): Promise<ReceiptResponse> {
  const verificationStart = Date.now();
  const project = options.recheck
    ? await getProjectByApiKey(ctx, args.apiKey)
    : await getVerificationProjectByApiKey(ctx, args.apiKey);

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

  let verified: HorizonVerifyResult;
  try {
    verified = await requestHorizonVerification(
      url,
      new URLSearchParams({
        access_token: appAccessToken,
        user_id: args.userId,
        sku: args.sku,
      }).toString(),
    );
  } catch (error) {
    // An HTTP error, timeout, network failure, or malformed body is not a
    // negative entitlement verdict. Preserve the last confirmed result
    // instead of replacing it with INAUTHENTIC.
    throw new MetaHorizonVerificationError(describeError(error));
  }

  const state = verified.success
    ? HarmonizedPurchaseState.ENTITLED
    : HarmonizedPurchaseState.INAUTHENTIC;

  await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
    projectId: project._id,
    store: "horizon",
    applicationId: project.horizonAppId,
    // `{userId}:{sku}` is stable per entitlement, so `by_project_and_remote`
    // dedups repeat verifications, like Apple's originalTransactionId and
    // Google's purchaseToken.
    remoteId: buildHorizonRemoteId(args.userId, args.sku),
    requestData,
    // `sku` lets extractProductIdFromRemoteResponse read the product.
    // `grantTimeMs` is renamed because it is already in ms; `grant_time` would
    // invite unit mistakes.
    remoteResponse: JSON.stringify({
      success: verified.success,
      grantTimeMs: verified.grantTime,
      sku: args.sku,
    }),
    state,
    isValid: isValidState(state),
    requestIp: args.requestIp,
    verificationDurationMs: Date.now() - verificationStart,
    persistIfChanged: options.recheck,
  });

  return { isValid: isValidState(state), state, productId: args.sku };
}

interface HorizonVerifyResult {
  success: boolean;
  grantTime?: number;
}

export function parseHorizonResponse(raw: unknown): HorizonVerifyResult {
  if (!raw || typeof raw !== "object") {
    throw new InvalidHorizonResponseError(
      "Meta Graph API returned an unparseable body.",
    );
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.success !== "boolean") {
    throw new InvalidHorizonResponseError(
      "Meta Graph API response is missing a boolean success field.",
    );
  }
  const success = record.success;
  const grantTimeRaw = record.grant_time;
  // Meta's `grant_time` is in seconds; IAPKit uses ms everywhere, like Apple's
  // and Google's purchaseDate.
  const grantTime =
    typeof grantTimeRaw === "number" && Number.isFinite(grantTimeRaw)
      ? grantTimeRaw * 1000
      : undefined;
  return { success, grantTime };
}

// Re-exported for tests so they can assert instanceof without
// pulling in the full errors module surface.
export { ReceiptVerificationError };
