// Transport-independent handlers for the OpenIAP Commerce Protocol operation
// surface. The REST routes and the GraphQL resolvers both call these and only
// these; business logic stays below, in the same Convex functions the
// published /v1 and /v2 surfaces already use.

import capabilitiesExample from "openiap-commerce-protocol/examples/provider-capabilities.json";

import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import { isValidSubscriptionUserId } from "../../../convex/subscriptions/limits";
import { normalizeBindUserPurchaseToken } from "../v1/subscriptions";
import { ProtocolOperationError, protocolCodeForConvexError } from "./errors";
import { admitVerification } from "./verificationAdmission";

export interface ProtocolContext {
  apiKey: string;
  requestIp?: string;
}

type SubscriptionRowV2 = {
  productId: string;
  platform: "IOS" | "Android";
  state: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: string;
  startedAt: number;
  updatedAt: number;
};

export interface SubscriptionStatusSnapshot {
  productId: string;
  state: string;
  active: boolean;
  store?: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: string;
  startedAt?: number;
  updatedAt?: number;
}

interface StoreEvidenceInput {
  store: string;
  apple?: { jws: string };
  google?: { purchaseToken: string };
  horizon?: { userId: string; sku: string };
  amazon?: { userId: string; receiptId: string; sandbox?: boolean };
}

// Fixed, safe messages per protocol code. A provider/Convex error message can
// carry diagnostic detail (identifiers, internal state), so it never crosses
// the trust boundary — the raw message is logged server-side instead.
const SAFE_MESSAGE: Record<string, string> = {
  UNAUTHORIZED: "A valid credential is required",
  FORBIDDEN: "This operation requires the server role",
  INVALID_REQUEST: "The request is invalid",
  RATE_LIMITED: "Too many requests. Retry after the indicated delay.",
  VERIFICATION_FAILED: "The provider could not obtain a verdict from the store",
  INTERNAL_ERROR: "The operation failed",
};

function safeMessage(code: string): string {
  return SAFE_MESSAGE[code] ?? "The operation failed";
}

function rethrowAsProtocolError(error: unknown, fallbackCode: string): never {
  const convexError = handleConvexError(error);
  const code =
    (convexError && protocolCodeForConvexError(convexError.code)) ??
    fallbackCode;
  // Log only the protocol code, the Convex error CODE (an enum, never the free
  // text), and the JS error class. The raw provider message can carry a
  // receipt, token, JWS, userId, upstream URL, or source path, so it never
  // reaches the log — nor the response.
  console.error(
    "[commerce] operation failed protocolCode=%s convexCode=%s errorClass=%s",
    code,
    convexError?.code ?? "none",
    error instanceof Error ? error.name : typeof error,
  );
  throw new ProtocolOperationError(
    code,
    safeMessage(code),
    code === "RATE_LIMITED" ? convexError?.retryAfterSec : undefined,
  );
}

function requireUserId(userId: unknown): string {
  if (typeof userId !== "string" || !isValidSubscriptionUserId(userId)) {
    throw new ProtocolOperationError("INVALID_REQUEST", "userId is invalid");
  }
  return userId;
}

function requireEvidence<T>(
  input: StoreEvidenceInput,
  member: T | undefined,
): T {
  if (member === undefined || member === null) {
    throw new ProtocolOperationError(
      "INVALID_REQUEST",
      `${input.store} evidence is required`,
    );
  }
  return member;
}

// The subscription rows come from the apple and google webhook lanes only, so
// the platform axis maps onto the store axis without loss today. A future
// store lane must extend this mapping before it can serve the snapshot.
function storeOf(platform: SubscriptionRowV2["platform"]): string {
  return platform === "IOS" ? "apple" : "google";
}

// The entitlement decision is not recomputed here: Convex already applied the
// SPEC.md 2.3 predicate (subscriptions/query.ts isActive), returning the
// active flag for status and only entitled rows for entitlements. Re-deriving
// it at the transport layer is exactly the drift the caller passes `active`
// in to avoid.
function toSnapshot(
  row: SubscriptionRowV2,
  active: boolean,
): SubscriptionStatusSnapshot {
  return {
    productId: row.productId,
    state: row.state,
    active,
    store: storeOf(row.platform),
    ...(row.expiresAt === undefined ? {} : { expiresAt: row.expiresAt }),
    ...(row.renewsAt === undefined ? {} : { renewsAt: row.renewsAt }),
    ...(row.willRenew === undefined ? {} : { willRenew: row.willRenew }),
    ...(row.cancellationReason === undefined
      ? {}
      : { cancellationReason: row.cancellationReason }),
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
  };
}

export function providerCapabilities(): Record<string, unknown> {
  // The published example is this implementation's own descriptor — SPEC.md
  // 10 says so — and kit's conformance suite pins it to the internal
  // capability map, so serving it cannot drift from either side.
  const { $comment: _comment, ...descriptor } = capabilitiesExample as Record<
    string,
    unknown
  >;
  return descriptor;
}

interface StoreVerdict {
  isValid: boolean;
  state: string;
  productId?: string;
  environment?: string;
  stableRejection?: boolean;
}

// The store verification itself, without admission control. Kept separate so
// the admission layer can wrap it identically for both bindings.
async function verifyPurchaseVerdict(
  context: ProtocolContext,
  input: StoreEvidenceInput,
): Promise<StoreVerdict> {
  const common = { apiKey: context.apiKey, requestIp: context.requestIp };
  try {
    switch (input.store) {
      case "apple": {
        const apple = requireEvidence(input, input.apple);
        return await client.action(
          api.purchases.ios.verifyAppStoreReceiptInternalV1,
          { ...common, jws: apple.jws },
        );
      }
      case "google": {
        const google = requireEvidence(input, input.google);
        return await client.action(
          api.purchases.android.verifyGooglePlayReceiptInternalV1,
          { ...common, purchaseToken: google.purchaseToken },
        );
      }
      case "horizon": {
        const horizon = requireEvidence(input, input.horizon);
        return await client.action(
          api.purchases.horizon.verifyMetaHorizonReceiptInternalV1,
          { ...common, userId: horizon.userId, sku: horizon.sku },
        );
      }
      case "amazon": {
        const amazon = requireEvidence(input, input.amazon);
        return await client.action(
          api.purchases.amazon.verifyAmazonReceiptInternalV1,
          {
            ...common,
            userId: amazon.userId,
            receiptId: amazon.receiptId,
            sandbox: amazon.sandbox,
          },
        );
      }
      default:
        throw new ProtocolOperationError(
          "UNSUPPORTED_STORE",
          "This provider does not integrate the named store",
        );
    }
  } catch (error) {
    if (error instanceof ProtocolOperationError) throw error;
    rethrowAsProtocolError(error, "VERIFICATION_FAILED");
  }
}

export async function verifyPurchase(
  context: ProtocolContext,
  input: StoreEvidenceInput,
): Promise<{
  store: string;
  isValid: boolean;
  state: string;
  productId?: string;
  environment?: string;
}> {
  // Admission is shared by both bindings: the replay guard, the process-wide
  // in-flight cap, and the stable-failure cooldown apply before and after the
  // store call, exactly as the /v1 verify pipeline does.
  const admission = admitVerification({
    apiKey: context.apiKey,
    requestIp: context.requestIp,
    input,
  });
  if (!admission.admitted) {
    throw new ProtocolOperationError(
      admission.code,
      "Too many verifications. Retry after the indicated delay.",
      admission.retryAfterSec,
    );
  }
  const verdict = await admission.run(() =>
    verifyPurchaseVerdict(context, input),
  );

  return {
    store: input.store,
    isValid: verdict.isValid,
    state: verdict.state,
    ...(verdict.productId === undefined
      ? {}
      : { productId: verdict.productId }),
    // The protocol's environment space uses lowercase tokens; the store
    // verdict reports the capitalized /v1 spelling of the same values.
    ...(verdict.environment === undefined
      ? {}
      : { environment: verdict.environment.toLowerCase() }),
  };
}

export async function subscriptionStatus(
  context: ProtocolContext,
  input: { userId: string },
): Promise<{ active: boolean; subscription?: SubscriptionStatusSnapshot }> {
  const userId = requireUserId(input.userId);
  try {
    const result = await client.query(
      api.subscriptions.query.subscriptionStatusV2,
      { apiKey: context.apiKey, userId, now: Date.now() },
    );
    return {
      active: result.active,
      // Convex returns the entitling row when active, otherwise a context row;
      // the snapshot's own gate is exactly the top-level decision.
      ...(result.subscription === null
        ? {}
        : { subscription: toSnapshot(result.subscription, result.active) }),
    };
  } catch (error) {
    rethrowAsProtocolError(error, "INTERNAL_ERROR");
  }
}

export async function entitlements(
  context: ProtocolContext,
  input: { userId: string },
): Promise<{
  userId: string;
  productIds: string[];
  subscriptions: SubscriptionStatusSnapshot[];
}> {
  const userId = requireUserId(input.userId);
  try {
    const result = await client.query(api.subscriptions.query.entitlementsV2, {
      apiKey: context.apiKey,
      userId,
      now: Date.now(),
    });
    return {
      userId: result.userId,
      productIds: result.productIds,
      // entitlementsV2 returns only entitled rows, so every snapshot is active.
      subscriptions: result.subscriptions.map((row: SubscriptionRowV2) =>
        toSnapshot(row, true),
      ),
    };
  } catch (error) {
    rethrowAsProtocolError(error, "INTERNAL_ERROR");
  }
}

/**
 * SPEC.md 5: server-role authorization precedes input validation. The edge
 * prefix check cannot classify an unknown or legacy key, so both transport
 * adapters call this before evaluating the operation input — an invalid
 * credential gets UNAUTHORIZED / FORBIDDEN and learns nothing about the
 * privileged surface (evidence shapes, member bounds, supported stores).
 */
export async function assertServerCredential(
  context: ProtocolContext,
): Promise<void> {
  try {
    await client.query(api.subscriptions.query.assertServerAccess, {
      apiKey: context.apiKey,
    });
  } catch (error) {
    rethrowAsProtocolError(error, "INTERNAL_ERROR");
  }
}

export async function bindPurchase(
  context: ProtocolContext,
  input: StoreEvidenceInput & { userId: string },
): Promise<{ bound: boolean }> {
  const userId = requireUserId(input.userId);
  let rawToken: string;
  switch (input.store) {
    case "apple":
      rawToken = requireEvidence(input, input.apple).jws;
      break;
    case "google":
      rawToken = requireEvidence(input, input.google).purchaseToken;
      break;
    case "amazon":
      rawToken = requireEvidence(input, input.amazon).receiptId;
      break;
    case "horizon":
      // Horizon exposes no transaction identity a binding could key on.
      return { bound: false };
    default:
      throw new ProtocolOperationError(
        "UNSUPPORTED_STORE",
        "This provider does not integrate the named store",
      );
  }

  const normalized = normalizeBindUserPurchaseToken(rawToken);
  if (!normalized.ok) {
    throw new ProtocolOperationError("INVALID_REQUEST", normalized.message);
  }

  try {
    // bindUserAsServer asserts admin access in Convex, where the stored key
    // type is authoritative; the edge prefix check cannot classify a legacy
    // no-prefix key. A publishable or legacy key is rejected with
    // INSUFFICIENT_SCOPE, mapped to FORBIDDEN.
    const result = await client.mutation(
      api.subscriptions.mutation.bindUserAsServer,
      {
        apiKey: context.apiKey,
        purchaseToken: normalized.purchaseToken,
        userId,
      },
    );
    return { bound: result.bound };
  } catch (error) {
    if (error instanceof ProtocolOperationError) throw error;
    rethrowAsProtocolError(error, "INTERNAL_ERROR");
  }
}

export async function eraseUser(
  context: ProtocolContext,
  input: { userId: string },
): Promise<{ accepted: boolean; jobId?: string; status?: string }> {
  const userId = requireUserId(input.userId);
  try {
    const result = await client.mutation(
      api.subscriptions.mutation.requestUserErasure,
      { apiKey: context.apiKey, userId },
    );
    return { accepted: result.ok, jobId: result.jobId, status: result.status };
  } catch (error) {
    rethrowAsProtocolError(error, "INTERNAL_ERROR");
  }
}
