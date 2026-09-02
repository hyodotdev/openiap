"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction, type ActionCtx } from "../_generated/server";
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
  getVerificationProjectByApiKey,
  isValidState,
  receiptResponseValidator,
} from "./shared";

const AMAZON_RVS_BASE_URL = "https://appstore-sdk.amazon.com";
const AMAZON_RVS_VERSION = "1.0";
const AMAZON_SANDBOX_SHARED_SECRET = "iapkit-sandbox";
const AMAZON_RVS_FETCH_TIMEOUT_MS = 10_000;
const AMAZON_RECONCILE_MIN_REQUEST_INTERVAL_MS = 200;

type AmazonEnvironment = "Sandbox" | "Production";

export interface AmazonReceiptData {
  autoRenewing?: boolean;
  cancelDate: number | null;
  cancelReason?: number | null;
  gracePeriodEndDate?: number | null;
  productId: string;
  productType: "CONSUMABLE" | "ENTITLED" | "SUBSCRIPTION";
  purchaseDate?: number;
  quantity?: number | null;
  receiptId: string;
  renewalDate?: number | null;
  term?: string | null;
  termSku?: string | null;
  testTransaction?: boolean;
  [key: string]: unknown;
}

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

export function buildAmazonRemoteId(args: {
  userId: string;
  receiptId: string;
  sandbox: boolean;
}): string {
  return [
    args.sandbox ? "sandbox" : "production",
    encodePathSegment(args.userId),
    encodePathSegment(args.receiptId),
  ].join(":");
}

export function mapAmazonReceiptState(
  receipt: AmazonReceiptData,
): HarmonizedPurchaseState {
  // Amazon defines cancelDate as the moment access was lost: it is set when
  // a purchase is canceled or a subscription expires and stays null while a
  // subscription is valid. renewalDate is only the next renewal date, so a
  // past renewalDate must never be treated as an expiry signal.
  if (receipt.cancelDate !== null) {
    return HarmonizedPurchaseState.CANCELED;
  }

  switch (receipt.productType.toUpperCase()) {
    case "CONSUMABLE":
      return HarmonizedPurchaseState.READY_TO_CONSUME;
    case "ENTITLED":
    case "SUBSCRIPTION":
      return HarmonizedPurchaseState.ENTITLED;
    default:
      return HarmonizedPurchaseState.UNKNOWN;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertOptionalBoolean(
  value: Record<string, unknown>,
  field: string,
): void {
  if (field in value && typeof value[field] !== "boolean") {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a boolean.`,
    );
  }
}

function assertOptionalNumber(
  value: Record<string, unknown>,
  field: string,
  nullable: boolean,
): void {
  if (!(field in value)) return;
  const fieldValue = value[field];
  if (nullable && fieldValue === null) return;
  if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a finite number${nullable ? " or null" : ""}.`,
    );
  }
}

function assertOptionalString(
  value: Record<string, unknown>,
  field: string,
  nullable: boolean,
): void {
  if (!(field in value)) return;
  const fieldValue = value[field];
  if (nullable && fieldValue === null) return;
  if (typeof fieldValue !== "string") {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a string${nullable ? " or null" : ""}.`,
    );
  }
}

export function parseAmazonReceiptResponse(raw: unknown): AmazonReceiptData {
  if (!isRecord(raw)) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an unparseable body.",
    );
  }

  if (typeof raw.productId !== "string" || raw.productId.trim().length === 0) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned no usable productId.",
    );
  }
  if (
    raw.productType !== "CONSUMABLE" &&
    raw.productType !== "ENTITLED" &&
    raw.productType !== "SUBSCRIPTION"
  ) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an unsupported productType.",
    );
  }
  if (
    !("cancelDate" in raw) ||
    (raw.cancelDate !== null &&
      (typeof raw.cancelDate !== "number" || !Number.isFinite(raw.cancelDate)))
  ) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS field cancelDate must be a finite number or null.",
    );
  }
  if (typeof raw.receiptId !== "string" || raw.receiptId.trim().length === 0) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned no usable receiptId.",
    );
  }

  assertOptionalBoolean(raw, "autoRenewing");
  assertOptionalBoolean(raw, "testTransaction");
  assertOptionalNumber(raw, "cancelReason", true);
  assertOptionalNumber(raw, "gracePeriodEndDate", true);
  assertOptionalNumber(raw, "purchaseDate", false);
  assertOptionalNumber(raw, "quantity", true);
  assertOptionalNumber(raw, "renewalDate", true);
  assertOptionalString(raw, "term", true);
  assertOptionalString(raw, "termSku", true);

  return raw as AmazonReceiptData;
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

function resolveAmazonSharedSecret(args: {
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

async function requestAmazonReceipt(args: {
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
        });
        // Keep the same timeout through body consumption. Clearing it after
        // headers would let a stalled response body pin the action forever.
        const bodyText = await response.text();

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
): Promise<void> {
  await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
    projectId: args.projectId,
    store: "amazon",
    applicationId: args.applicationId,
    remoteId: args.remoteId,
    requestData: args.requestData,
    remoteResponse: args.remoteResponse,
    state: args.state,
    isValid: isValidState(args.state),
    environment: args.environment,
    requestIp: args.requestIp,
    verificationDurationMs: args.verificationDurationMs,
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
  },
): Promise<boolean> {
  return await ctx.runMutation(
    internal.purchases.internal.applyAmazonReconciliationVerdict,
    {
      purchaseId: probe.purchaseId,
      claimedLeaseUntil: probe.leaseUntil,
      remoteResponse: args.remoteResponse,
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

export const verifyAmazonReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    userId: v.string(),
    receiptId: v.string(),
    sandbox: v.optional(v.boolean()),
    expectedProductId: v.optional(v.string()),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getVerificationProjectByApiKey(ctx, args.apiKey);
    const sandbox = args.sandbox === true;
    const environment = environmentForSandbox(sandbox);
    const sharedSecret = resolveAmazonSharedSecret({
      sandbox,
      amazonSandboxEnabled: project.amazonSandboxEnabled === true,
      amazonSharedSecret: project.amazonSharedSecret,
    });
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
        await persistAmazonVerdict(ctx, {
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
        });
        return { isValid: false, state, environment };
      }

      // Network, timeout, throttling, configuration, and protocol failures are
      // not store verdicts. Never replace a previously valid snapshot with an
      // UNKNOWN row just because this attempt could not reach/parse RVS.
      if (error instanceof ReceiptVerificationError) throw error;
      throw new AmazonReceiptVerificationError(describeError(error));
    }

    const state = mapAmazonReceiptState(receiptData);
    const storeReceiptResponse = {
      isValid: isValidState(state),
      state,
      productId: receiptData.productId,
      environment,
    };
    const receiptResponse = applyExpectedProductId(
      storeReceiptResponse,
      args.expectedProductId,
    );

    // Persist Amazon's verdict, not the caller-scoped expectedProductId check.
    // This mirrors Apple/Google and keeps a typo from corrupting the row that
    // the background reconciler will refresh later.
    await persistAmazonVerdict(ctx, {
      projectId: project._id,
      applicationId,
      remoteId,
      requestData,
      environment,
      remoteResponse: JSON.stringify(receiptData),
      state,
      requestIp: args.requestIp,
      verificationDurationMs: Date.now() - verificationStart,
    });

    return receiptResponse;
  },
});

/**
 * Reconcile active Amazon purchase snapshots without inventing subscription
 * semantics. One attempt per claimed row plus the 10-second request timeout
 * caps the 20-row worst case near 200 seconds, below the five-minute cron
 * interval so independent workers do not overlap their per-worker TPS budget.
 * Starts are spaced by 200ms (at most 5 TPS), reserving half of Amazon's
 * documented 10 TPS ceiling for foreground verification traffic.
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

      try {
        const receiptData = await requestAmazonReceipt({
          sharedSecret,
          userId: probe.requestData.userId,
          receiptId: probe.requestData.receiptId,
          sandbox,
          maxAttempts: 1,
        });
        const state = mapAmazonReceiptState(receiptData);
        const applied = await applyAmazonReconciliationVerdict(ctx, probe, {
          remoteResponse: JSON.stringify(receiptData),
          state,
          verificationDurationMs: Date.now() - verificationStart,
        });
        if (applied) updated += 1;
      } catch (error) {
        if (error instanceof AmazonReceiptInvalidError) {
          const state = stateForAmazonInvalidError(error);
          const applied = await applyAmazonReconciliationVerdict(ctx, probe, {
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
