"use node";
import { assertCliScope } from "../cli/scope";

import { buildAmazonRemoteId } from "./identity";
export { buildAmazonRemoteId } from "./identity";

import { v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { readBoundedResponseText } from "../utils/httpResponse";
import {
  AmazonReceiptInvalidError,
  AmazonReceiptVerificationError,
  AmazonSandboxNotEnabledError,
  AmazonSharedSecretNotConfiguredError,
  ReceiptVerificationError,
} from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  extractHttpStatus,
  isTransientHttpError,
  retryOnTransient,
} from "./retry";
import {
  AMAZON_RECONCILE_BATCH_LIMIT,
  AMAZON_RECONCILE_INTERVAL_MS,
  AMAZON_RECONCILE_RETRY_MS,
  applyExpectedProductId,
  assertVerificationAdmission,
  getProjectByApiKey,
  receiptResponseValidator,
  type ReceiptResponse,
  type RecheckOptions,
} from "./shared";
import { verifyRecordingIssues } from "../purchaseIssues/shared";
import {
  assertVerificationSource,
  verificationSourceValidator,
} from "./verificationSource";

const AMAZON_RVS_BASE_URL = "https://appstore-sdk.amazon.com";
const AMAZON_RVS_VERSION = "1.0";
const AMAZON_SANDBOX_SHARED_SECRET = "iapkit-sandbox";
const AMAZON_RVS_FETCH_TIMEOUT_MS = 10_000;
const MAX_AMAZON_RVS_RESPONSE_BYTES = 64 * 1024;
const AMAZON_RECONCILE_MIN_REQUEST_INTERVAL_MS = 200;

type AmazonEnvironment = "Sandbox" | "Production";

export {
  mapAmazonReceiptState,
  parseAmazonReceiptResponse,
  type AmazonReceiptData,
} from "./amazonReceipt";
import {
  mapAmazonReceiptState,
  parseAmazonReceiptResponse,
  amazonReceiptEnvironment,
  type AmazonReceiptData,
} from "./amazonReceipt";

interface AmazonRequestData {
  store: "amazon";
  userId: string;
  receiptId: string;
  sandbox?: boolean;
  expectedProductId?: string;
}

interface PersistAmazonVerdictArgs {
  projectId: Id<"projects">;
  applicationId: string;
  remoteId: string;
  requestData: AmazonRequestData;
  environment: AmazonEnvironment;
  remoteResponse: string;
  state: HarmonizedPurchaseState;
  requestIp?: string;
  verificationDurationMs?: number;
  amazonRvsSequence: number;
  correlationId?: string;
}

function describeError(error: unknown): string {
  if (error instanceof ReceiptVerificationError) {
    return error.errorMessage;
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

function isAmazonTransientError(error: unknown): boolean {
  return (
    isAbortError(error) ||
    error instanceof TypeError ||
    extractHttpStatus(error) === 429 ||
    isTransientHttpError(error)
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function buildAmazonRvsUrl(args: {
  sharedSecret: string;
  userId: string;
  receiptId: string;
  sandbox: boolean;
}): string {
  const sandboxSegment = args.sandbox ? "/sandbox" : "";
  return (
    `${AMAZON_RVS_BASE_URL}${sandboxSegment}/version/${AMAZON_RVS_VERSION}` +
    `/verifyReceiptId/developer/${encodePathSegment(args.sharedSecret)}` +
    `/user/${encodePathSegment(args.userId)}` +
    `/receiptId/${encodePathSegment(args.receiptId)}`
  );
}

function parseAmazonJsonBody(bodyText: string): unknown {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an empty body.",
      { responseBody: "" },
    );
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned invalid JSON.",
      {
        parseError:
          error instanceof Error ? error.message : describeError(error),
        responseBody: bodyText.slice(0, 2_048),
      },
    );
  }
}

export function resolveAmazonSharedSecret(args: {
  sandbox: boolean;
  amazonSandboxEnabled: boolean;
  amazonSharedSecret?: string | null;
}): string {
  if (args.sandbox) {
    if (!args.amazonSandboxEnabled) {
      throw new AmazonSandboxNotEnabledError();
    }
    // Cloud Sandbox ignores the value as long as it is non-empty. Never put a
    // configured production credential in the sandbox URL.
    return AMAZON_SANDBOX_SHARED_SECRET;
  }

  const sharedSecret = args.amazonSharedSecret?.trim();
  if (!sharedSecret) {
    throw new AmazonSharedSecretNotConfiguredError();
  }
  return sharedSecret;
}

export async function requestAmazonReceipt(args: {
  sharedSecret: string;
  userId: string;
  receiptId: string;
  sandbox: boolean;
  maxAttempts: number;
}): Promise<AmazonReceiptData> {
  const url = buildAmazonRvsUrl(args);
  const parsedBody = await retryOnTransient(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        AMAZON_RVS_FETCH_TIMEOUT_MS,
      );
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
          redirect: "error",
        });
        // Keep the same timeout through body consumption. Clearing it after
        // headers would let a stalled response body pin the action forever.
        const bodyText = await readBoundedResponseText(
          response,
          MAX_AMAZON_RVS_RESPONSE_BYTES,
        );

        if (response.status === 400 || response.status === 497) {
          throw new AmazonReceiptInvalidError(
            response.status,
            bodyText.slice(0, 512) ||
              (response.status === 497 ? "invalid user ID" : "invalid receipt"),
          );
        }
        if (response.status === 410) {
          throw new AmazonReceiptInvalidError(
            response.status,
            bodyText.slice(0, 512) || "receipt is no longer valid",
          );
        }
        if (response.status === 496) {
          throw new AmazonReceiptVerificationError("invalid shared secret", {
            status: 496,
          });
        }
        if (!response.ok) {
          const error = new Error(
            `Amazon RVS ${response.status}: ${bodyText.slice(0, 512)}`,
          );
          (error as { code?: number }).code = response.status;
          throw error;
        }

        return parseAmazonJsonBody(bodyText);
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxAttempts: args.maxAttempts,
      shouldRetry: isAmazonTransientError,
    },
  );

  const receipt = parseAmazonReceiptResponse(parsedBody);
  if (receipt.receiptId !== args.receiptId) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned a receiptId that does not match the request.",
    );
  }
  return receipt;
}

function environmentForSandbox(sandbox: boolean): AmazonEnvironment {
  return sandbox ? "Sandbox" : "Production";
}

function stateForAmazonInvalidError(
  error: AmazonReceiptInvalidError,
): HarmonizedPurchaseState {
  return error.errorDetails?.status === 410
    ? HarmonizedPurchaseState.CANCELED
    : HarmonizedPurchaseState.INAUTHENTIC;
}

async function persistAmazonVerdict(
  ctx: ActionCtx,
  args: PersistAmazonVerdictArgs,
): Promise<ReceiptResponse> {
  return await ctx.runMutation(internal.purchases.internal.saveAmazonVerdict, {
    projectId: args.projectId,
    applicationId: args.applicationId,
    remoteId: args.remoteId,
    requestData: args.requestData,
    remoteResponse: args.remoteResponse,
    state: args.state,
    environment: args.environment,
    requestIp: args.requestIp,
    verificationDurationMs: args.verificationDurationMs,
    amazonRvsSequence: args.amazonRvsSequence,
    correlationId: args.correlationId,
  });
}

async function rescheduleAmazonProbe(
  ctx: ActionCtx,
  probe: { purchaseId: Id<"purchases">; leaseUntil: number },
  delayMs = AMAZON_RECONCILE_RETRY_MS,
): Promise<void> {
  await ctx.runMutation(
    internal.purchases.internal.rescheduleAmazonPurchaseReconciliation,
    {
      purchaseId: probe.purchaseId,
      claimedLeaseUntil: probe.leaseUntil,
      retryAt: Date.now() + delayMs,
    },
  );
}

async function applyAmazonReconciliationVerdict(
  ctx: ActionCtx,
  probe: { purchaseId: Id<"purchases">; leaseUntil: number },
  args: {
    remoteResponse: string;
    state: HarmonizedPurchaseState;
    verificationDurationMs: number;
    amazonRvsSequence: number;
    environment?: AmazonEnvironment;
  },
): Promise<boolean> {
  return await ctx.runMutation(
    internal.purchases.internal.applyAmazonReconciliationVerdict,
    {
      purchaseId: probe.purchaseId,
      claimedLeaseUntil: probe.leaseUntil,
      remoteResponse: args.remoteResponse,
      amazonRvsSequence: args.amazonRvsSequence,
      environment: args.environment,
      state: args.state,
      verificationDurationMs: args.verificationDurationMs,
    },
  );
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForAmazonRateSlot(args: {
  lastStartedAt?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<number> {
  const now = args.now ?? Date.now;
  const sleep = args.sleep ?? realSleep;
  if (args.lastStartedAt !== undefined) {
    const waitMs = Math.max(
      0,
      args.lastStartedAt + AMAZON_RECONCILE_MIN_REQUEST_INTERVAL_MS - now(),
    );
    if (waitMs > 0) await sleep(waitMs);
  }
  return now();
}

const amazonVerificationArgs = v.object({
  apiKey: v.string(),
  userId: v.string(),
  receiptId: v.string(),
  sandbox: v.optional(v.boolean()),
  expectedProductId: v.optional(v.string()),
  requestIp: v.optional(v.string()),
  correlationId: v.optional(v.string()),
});

export const verifyAmazonReceiptInternalV1 = action({
  args: {
    ...amazonVerificationArgs.fields,
    sourceAuth: verificationSourceValidator,
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "write");
    const { sourceAuth, ...request } = args;
    assertVerificationSource("amazon", request, sourceAuth);
    return verifyRecordingIssues(
      ctx,
      {
        apiKey: request.apiKey,
        evidence: {
          store: "amazon",
          userId: request.userId,
          receiptId: request.receiptId,
          sandbox: request.sandbox,
        },
        expectedProductId: request.expectedProductId,
        correlationId: request.correlationId,
      },
      () => verifyAmazonReceipt(ctx, request),
    );
  },
});

export async function verifyAmazonReceipt(
  ctx: ActionCtx,
  args: Infer<typeof amazonVerificationArgs>,
  options: RecheckOptions = {},
): Promise<ReceiptResponse> {
  const verificationStart = Date.now();
  const project = await getProjectByApiKey(ctx, args.apiKey);
  const sandbox = args.sandbox === true;
  const environment = environmentForSandbox(sandbox);
  const sharedSecret = resolveAmazonSharedSecret({
    sandbox,
    amazonSandboxEnabled: project.amazonSandboxEnabled === true,
    amazonSharedSecret: project.amazonSharedSecret,
  });
  if (!options.recheck) await assertVerificationAdmission(ctx, project._id);
  const requestData: AmazonRequestData = {
    store: "amazon",
    userId: args.userId,
    receiptId: args.receiptId,
    sandbox,
    ...(args.expectedProductId !== undefined
      ? { expectedProductId: args.expectedProductId }
      : {}),
  };
  const applicationId = project.androidPackageName ?? `amazon:${project._id}`;
  const remoteId = buildAmazonRemoteId({
    userId: args.userId,
    receiptId: args.receiptId,
    sandbox,
  });

  const amazonRvsSequence = await ctx.runMutation(
    internal.purchases.internal.reserveAmazonRvsSequence,
    { projectId: project._id },
  );
  let receiptData: AmazonReceiptData;
  try {
    receiptData = await requestAmazonReceipt({
      sharedSecret,
      userId: args.userId,
      receiptId: args.receiptId,
      sandbox,
      maxAttempts: 3,
    });
  } catch (error) {
    if (error instanceof AmazonReceiptInvalidError) {
      const state = stateForAmazonInvalidError(error);
      const verdict = await persistAmazonVerdict(ctx, {
        amazonRvsSequence,
        projectId: project._id,
        applicationId,
        remoteId,
        requestData,
        environment,
        remoteResponse: JSON.stringify({
          error: error.errorCode,
          message: error.errorMessage,
          details: error.errorDetails ?? null,
        }),
        state,
        requestIp: args.requestIp,
        verificationDurationMs: Date.now() - verificationStart,
        correlationId: args.correlationId,
      });
      return applyExpectedProductId(verdict, args.expectedProductId);
    }

    // Network, timeout, throttling, configuration, and protocol failures are
    // not store verdicts. Never replace a previously valid snapshot with an
    // UNKNOWN row just because this attempt could not reach/parse RVS.
    if (error instanceof ReceiptVerificationError) throw error;
    // `outage` only labels the purchase issue; /v1 still answers 400 here.
    throw new AmazonReceiptVerificationError(
      describeError(error),
      isAmazonTransientError(error) ? { outage: true } : undefined,
    );
  }

  const state = mapAmazonReceiptState(receiptData);
  const verdict = await persistAmazonVerdict(ctx, {
    projectId: project._id,
    applicationId,
    remoteId,
    requestData,
    environment: amazonReceiptEnvironment(sandbox, receiptData),
    remoteResponse: JSON.stringify(receiptData),
    state,
    amazonRvsSequence,
    requestIp: args.requestIp,
    verificationDurationMs: Date.now() - verificationStart,
    correlationId: args.correlationId,
  });
  return applyExpectedProductId(verdict, args.expectedProductId);
}

/**
 * Reconciles active Amazon purchase snapshots without inventing subscription
 * semantics. One attempt per claimed row with a 10s timeout keeps 20 rows near
 * 200s, inside the five-minute cron interval, so workers do not overlap.
 * Starts are 200ms apart (at most 5 TPS), leaving half of Amazon's documented
 * 10 TPS for receipt verification and entitlement rechecks, which have their
 * own admission bucket.
 */
export const reconcileAmazonPurchases = internalAction({
  args: {},
  returns: v.object({
    claimed: v.number(),
    checked: v.number(),
    updated: v.number(),
    failures: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    claimed: number;
    checked: number;
    updated: number;
    failures: number;
  }> => {
    const probes = await ctx.runMutation(
      internal.purchases.internal.claimAmazonPurchasesForReconciliation,
      { limit: AMAZON_RECONCILE_BATCH_LIMIT },
    );
    let checked = 0;
    let updated = 0;
    let failures = 0;
    let lastRequestStartedAt: number | undefined;

    for (const probe of probes) {
      const sandbox = probe.requestData.sandbox === true;
      let sharedSecret: string;
      try {
        sharedSecret = resolveAmazonSharedSecret({
          sandbox,
          amazonSandboxEnabled: probe.amazonSandboxEnabled,
          amazonSharedSecret: probe.amazonSharedSecret,
        });
      } catch (error) {
        failures += 1;
        // Missing credentials or a disabled sandbox cannot recover through a
        // rapid retry. Put the row back on the normal cadence so one
        // misconfigured project cannot monopolize the global due queue.
        await rescheduleAmazonProbe(ctx, probe, AMAZON_RECONCILE_INTERVAL_MS);
        console.warn("[amazon-reconciler] configuration unavailable", {
          purchaseId: probe.purchaseId,
          error: error instanceof Error ? error.name : typeof error,
        });
        continue;
      }

      lastRequestStartedAt = await waitForAmazonRateSlot({
        lastStartedAt: lastRequestStartedAt,
      });
      checked += 1;
      const verificationStart = Date.now();
      let amazonRvsSequence: number | undefined;
      try {
        amazonRvsSequence = await ctx.runMutation(
          internal.purchases.internal.reserveAmazonRvsSequence,
          { projectId: probe.projectId },
        );
        const receiptData = await requestAmazonReceipt({
          sharedSecret,
          userId: probe.requestData.userId,
          receiptId: probe.requestData.receiptId,
          sandbox,
          maxAttempts: 1,
        });
        const state = mapAmazonReceiptState(receiptData);
        const applied = await applyAmazonReconciliationVerdict(ctx, probe, {
          amazonRvsSequence,
          environment: amazonReceiptEnvironment(sandbox, receiptData),
          remoteResponse: JSON.stringify(receiptData),
          state,
          verificationDurationMs: Date.now() - verificationStart,
        });
        if (applied) updated += 1;
      } catch (error) {
        if (
          error instanceof AmazonReceiptInvalidError &&
          amazonRvsSequence !== undefined
        ) {
          const state = stateForAmazonInvalidError(error);
          const applied = await applyAmazonReconciliationVerdict(ctx, probe, {
            amazonRvsSequence,
            remoteResponse: JSON.stringify({
              error: error.errorCode,
              message: error.errorMessage,
              details: error.errorDetails ?? null,
            }),
            state,
            verificationDurationMs: Date.now() - verificationStart,
          });
          if (applied) updated += 1;
          continue;
        }

        failures += 1;
        const retryDelayMs =
          error instanceof AmazonReceiptVerificationError &&
          error.errorDetails?.status === 496
            ? AMAZON_RECONCILE_INTERVAL_MS
            : AMAZON_RECONCILE_RETRY_MS;
        await rescheduleAmazonProbe(ctx, probe, retryDelayMs);
        console.warn("[amazon-reconciler] RVS check failed", {
          purchaseId: probe.purchaseId,
          error: error instanceof Error ? error.name : typeof error,
        });
      }
    }

    return { claimed: probes.length, checked, updated, failures };
  },
});

export { ReceiptVerificationError };
