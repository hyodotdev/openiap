// Reference app backend for the IAPKit purchase flow. It runs on your server:
// the IAPKit secret key it uses must never ship in an app. Copy it and replace
// the ledger with your own database.
import type {
  PurchaseConfirmation,
  PurchaseConfirmationRequest,
} from "@hyodotdev/openiap-client-protocol/purchase-flow";

export type GrantResult =
  | "granted"
  | "already_granted"
  | "granted_to_other_user"
  | "deferred";

/** A one-time purchase to grant. */
export interface EntitlementGrant {
  /**
   * Stable for the purchase's lifetime: Apple originalTransactionId, Google
   * purchase token.
   */
  purchaseKey: string;
  userId: string;
  /** The store-verified product id. */
  productId: string;
  store: "apple" | "google";
  /** Apple transactionId or Google order id, when the store reports one. */
  transactionId?: string;
}

/**
 * Your record of one-time purchases; `grantOnce` must be atomic per
 * `purchaseKey`. Subscriptions are not stored here: IAPKit tracks them.
 */
export interface EntitlementLedger {
  /** The user this purchase was granted to, or null if it never was. */
  ownerOf(purchaseKey: string): Promise<string | null>;
  grantOnce(grant: EntitlementGrant): Promise<GrantResult>;
}

export interface IapkitOptions {
  /** IAPKit secret key, `openiap-kit_sk_...`. */
  secretKey: string;
  baseUrl?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

export interface ConfirmPurchaseOptions extends IapkitOptions {
  ledger: EntitlementLedger;
  /**
   * Whether `userId` may get sandbox and test purchases; everyone may by
   * default. App Review and TestFlight buy in the Apple sandbox against your
   * production backend, so limit testers with an allow-list that includes your
   * App Review demo account instead of refusing the sandbox.
   */
  acceptSandbox?: (userId: string) => boolean | Promise<boolean>;
}

/** The `/v1/purchase/verify` fields this backend reads. */
export interface VerifyResult {
  isValid: boolean;
  state: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  expiresAt?: number;
  commerceEnvironment?: string;
  /** Whether a rejection is settled; absent from older IAPKit responses. */
  finalVerdict?: boolean;
}

export type BindReason =
  | "bound"
  | "already_bound"
  | "bound_to_other_user"
  | "not_found"
  | "not_bindable";

interface BindResult {
  bound: boolean;
  /** Returned to secret keys only. */
  reason?: BindReason;
}

/** The body is not `{ store, purchaseToken, productId }`: answer 400. */
export class InvalidConfirmationRequestError extends Error {}

const DEFAULT_RETRY_MS = 30_000;

// Verify errors no retry changes: a receipt IAPKit rejected moments ago (429)
// and evidence this project can never verify (400). Other 400s are
// configuration, such as missing credentials or an App Store Server API key
// Apple refuses (a forged signature shares that code), so they throw: fixing
// them makes the same purchase valid.
const SETTLED_VERIFY_ERRORS = new Set([
  "REPEATED_FAILURE",
  "INVALID_INPUT",
  "APP_STORE_INVALID_JWS_FORMAT",
  "APP_STORE_BUNDLE_ID_MISMATCH",
]);

/**
 * Verifies a purchase with IAPKit and links it to `userId`. A one-time
 * purchase is then granted once in your ledger; a subscription's access is
 * IAPKit's, read with `activeSubscriptionProductIds`. Take `userId` from your
 * authenticated session, never from the body. Throws
 * `InvalidConfirmationRequestError` for a malformed body (answer 400) and
 * other errors for unexpected IAPKit answers (answer 502).
 */
export async function confirmPurchase(
  userId: string,
  body: unknown,
  options: ConfirmPurchaseOptions,
): Promise<PurchaseConfirmation> {
  const request = readRequest();

  const verifyPath = "/v1/purchase/verify";
  const verify = await callIapkit<VerifyResult>(options, verifyPath, {
    store: request.store,
    ...(request.store === "apple"
      ? { jws: request.purchaseToken }
      : { purchaseToken: request.purchaseToken }),
    expectedProductId: request.productId,
    includeTransactionDetails: true,
  });
  if ("failure" in verify) {
    const { code, retryAfterMs } = verify.failure;
    if (code !== undefined && SETTLED_VERIFY_ERRORS.has(code)) {
      return { status: "invalid", reason: code };
    }
    if (retryAfterMs === undefined)
      throw unexpected(verifyPath, verify.failure);
    return { status: "verification_delayed", retryAfterMs };
  }
  const result = verify.body;
  if (!result.isValid) {
    if (result.state === "PENDING") return { status: "store_pending" };
    // finalVerdict marks a settled rejection, such as a revoked Google token
    // reported as UNKNOWN. Without it, UNKNOWN means the store gave no usable
    // answer: retry instead of rejecting a payment.
    const settled = result.finalVerdict ?? result.state !== "UNKNOWN";
    if (!settled) {
      return { status: "verification_delayed", retryAfterMs: DEFAULT_RETRY_MS };
    }
    return { status: "invalid", reason: result.state };
  }
  const acceptSandbox = options.acceptSandbox ?? (() => true);
  // A missing or unknown environment counts as a test purchase.
  if (
    result.commerceEnvironment !== "production" &&
    !(await acceptSandbox(userId))
  ) {
    return { status: "test_account_restricted" };
  }
  // IAPKit follows a subscription through renewals (Google's keep the same
  // token and never reach the app again), plan changes, and refunds, so the
  // link is its grant. A one-time purchase is granted once in your ledger.
  const subscription = result.expiresAt !== undefined;
  // Google assigns an order id only after acknowledgement, so it cannot key a
  // grant.
  const purchaseKey =
    request.store === "google"
      ? request.purchaseToken
      : (result.originalTransactionId ?? result.transactionId);
  if (!purchaseKey || !result.productId) {
    throw new Error("IAPKit returned no transaction details");
  }
  // A bind is permanent, so check your own owner record before linking.
  const owner = subscription ? null : await options.ledger.ownerOf(purchaseKey);
  if (owner !== null && owner !== userId) {
    return { status: "ownership_conflict", alreadyGranted: true };
  }

  const bindPath = "/v1/subscriptions/bind-user";
  const bind = await callIapkit<BindResult>(options, bindPath, {
    purchaseToken: request.purchaseToken,
    userId,
  });
  if ("failure" in bind) {
    const { retryAfterMs } = bind.failure;
    if (retryAfterMs === undefined) throw unexpected(bindPath, bind.failure);
    return { status: "verified", retryAfterMs };
  }
  const { reason } = bind.body;
  switch (reason) {
    case "bound":
    case "already_bound":
      break;
    // A bind never moves an owner, and neither does this handler.
    case "bound_to_other_user":
      // IAPKit keeps the subscription's access with its owner.
      if (subscription) {
        return { status: "ownership_conflict", alreadyGranted: true };
      }
      // Your ledger owns one-time purchases: a grant to this user stands.
      if (owner === null) {
        return { status: "ownership_conflict", alreadyGranted: false };
      }
      break;
    // A user whose data erasure you requested, for example: IAPKit keeps no
    // link, so it cannot give this user the subscription.
    case "not_found":
    case "not_bindable":
      if (subscription) {
        return { status: "verified", retryAfterMs: DEFAULT_RETRY_MS };
      }
      break;
    // Publishable keys get no reason; an unknown one may be a new refusal.
    default:
      throw new Error(
        reason === undefined
          ? "bind-user returned no reason; call it with a secret key"
          : `bind-user returned an unknown reason: ${String(reason)}`,
      );
  }
  if (subscription) {
    return { status: "entitled", alreadyGranted: reason === "already_bound" };
  }

  const linked = reason === "bound" || reason === "already_bound";
  const grant = await options.ledger.grantOnce({
    purchaseKey,
    userId,
    productId: result.productId,
    store: request.store,
    ...(result.transactionId ? { transactionId: result.transactionId } : {}),
  });
  switch (grant) {
    case "granted_to_other_user":
      return { status: "ownership_conflict", alreadyGranted: true };
    case "deferred":
      return {
        status: linked ? "linked" : "verified",
        retryAfterMs: DEFAULT_RETRY_MS,
      };
    case "granted":
    case "already_granted":
      return {
        status: "entitled",
        alreadyGranted: grant === "already_granted",
      };
  }

  function readRequest(): PurchaseConfirmationRequest {
    const { store, purchaseToken, productId } = (body ?? {}) as Record<
      string,
      unknown
    >;
    if (
      (store === "apple" || store === "google") &&
      typeof purchaseToken === "string" &&
      purchaseToken &&
      typeof productId === "string" &&
      productId
    ) {
      return { store, purchaseToken, productId };
    }
    throw new InvalidConfirmationRequestError(
      "Expected { store, purchaseToken, productId }",
    );
  }
}

/**
 * Product ids of `userId`'s active subscriptions. IAPKit keeps them current
 * from App Store and Google Play server notifications, so gate subscription
 * access on this, or on commerce events, instead of a period you stored.
 */
export async function activeSubscriptionProductIds(
  userId: string,
  options: IapkitOptions,
): Promise<string[]> {
  const path = "/v2/subscriptions/entitlements";
  const reply = await callIapkit<{ productIds: string[] }>(
    options,
    `${path}?userId=${encodeURIComponent(userId)}`,
  );
  if ("failure" in reply) throw unexpected(path, reply.failure);
  return reply.body.productIds;
}

interface IapkitFailure {
  status: number;
  code?: string;
  /** Set for 429 and 503: a rate limit, or IAPKit or the store could not answer yet. */
  retryAfterMs?: number;
}

async function callIapkit<T>(
  options: IapkitOptions,
  path: string,
  payload?: object,
): Promise<{ body: T } | { failure: IapkitFailure }> {
  const baseUrl = (options.baseUrl ?? "https://kit.openiap.dev").replace(
    /\/$/,
    "",
  );
  const response = await (options.fetch ?? fetch)(`${baseUrl}${path}`, {
    method: payload ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${options.secretKey}`,
      "content-type": "application/json",
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (response.ok) return { body: (await response.json()) as T };
  const error = (await response.json().catch(() => null)) as {
    errors?: { code?: unknown }[];
  } | null;
  const code = error?.errors?.[0]?.code;
  const seconds = Number(response.headers.get("retry-after"));
  return {
    failure: {
      status: response.status,
      ...(typeof code === "string" ? { code } : {}),
      ...(response.status === 429 || response.status === 503
        ? {
            retryAfterMs:
              Number.isFinite(seconds) && seconds > 0
                ? seconds * 1000
                : DEFAULT_RETRY_MS,
          }
        : {}),
    },
  };
}

function unexpected(path: string, failure: IapkitFailure): Error {
  return new Error(
    `IAPKit ${path} returned ${failure.status}${failure.code ? ` ${failure.code}` : ""}`,
  );
}
