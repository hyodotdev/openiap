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
  /** End of subscription access, epoch milliseconds. */
  expiresAt?: number;
}

/** Your entitlement store. `grantOnce` must be atomic per `purchaseKey`. */
export interface EntitlementLedger {
  /** The user this purchase was granted to, or null if it never was. */
  ownerOf(purchaseKey: string): Promise<string | null>;
  grantOnce(grant: EntitlementGrant): Promise<GrantResult>;
}

export interface ConfirmPurchaseOptions {
  /** IAPKit secret key, `openiap-kit_sk_...`. */
  secretKey: string;
  ledger: EntitlementLedger;
  /**
   * Whether `userId` may get sandbox and test purchases; everyone may by
   * default. App Review and TestFlight buy in the Apple sandbox against your
   * production backend, so limit testers with an allow-list that includes your
   * App Review demo account instead of refusing the sandbox.
   */
  acceptSandbox?: (userId: string) => boolean | Promise<boolean>;
  baseUrl?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
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

const DEFAULT_RETRY_MS = 30_000;

/**
 * Verifies a purchase with IAPKit, links it to `userId`, and grants it once.
 * Take `userId` from your authenticated session, never from the body. Throws
 * on a malformed body (answer 400) and on unexpected IAPKit errors (answer 5xx).
 */
export async function confirmPurchase(
  userId: string,
  body: unknown,
  options: ConfirmPurchaseOptions,
): Promise<PurchaseConfirmation> {
  const request = readRequest();
  const baseUrl = (options.baseUrl ?? "https://kit.openiap.dev").replace(
    /\/$/,
    "",
  );
  const fetchImpl = options.fetch ?? fetch;

  const verify = await post<VerifyResult>("/v1/purchase/verify", {
    store: request.store,
    ...(request.store === "apple"
      ? { jws: request.purchaseToken }
      : { purchaseToken: request.purchaseToken }),
    expectedProductId: request.productId,
    includeTransactionDetails: true,
  });
  if ("retryAfterMs" in verify) {
    // IAPKit rejected this exact receipt moments ago and replays that verdict.
    if (verify.code === "REPEATED_FAILURE") {
      return { status: "invalid", reason: "REPEATED_FAILURE" };
    }
    return {
      status: "verification_delayed",
      retryAfterMs: verify.retryAfterMs,
    };
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
  if (
    result.commerceEnvironment === "sandbox" &&
    !(await acceptSandbox(userId))
  ) {
    return { status: "test_account_restricted" };
  }
  // Google assigns an order id only after acknowledgement, and every Apple
  // renewal gets a new transaction id, so neither keys a grant.
  const purchaseKey =
    request.store === "google"
      ? request.purchaseToken
      : (result.originalTransactionId ?? result.transactionId);
  if (!purchaseKey || !result.productId) {
    throw new Error("IAPKit returned no transaction details");
  }
  // A bind is permanent, so check your own owner record before linking.
  const owner = await options.ledger.ownerOf(purchaseKey);
  if (owner !== null && owner !== userId) {
    return { status: "ownership_conflict" };
  }

  const bind = await post<BindResult>("/v1/subscriptions/bind-user", {
    purchaseToken: request.purchaseToken,
    userId,
  });
  if ("retryAfterMs" in bind) {
    return { status: "verified", retryAfterMs: bind.retryAfterMs };
  }
  const { reason } = bind.body;
  // Publishable keys get no reason, so they cannot see another owner.
  if (reason === undefined) {
    throw new Error("bind-user returned no reason; call it with a secret key");
  }
  // A bind never moves an owner, and neither does this handler.
  if (reason === "bound_to_other_user") return { status: "ownership_conflict" };
  // not_found or not_bindable (say, a user at the link limit): IAPKit keeps no
  // link and the ledger alone holds the owner.
  const linked = reason === "bound" || reason === "already_bound";

  const grant = await options.ledger.grantOnce({
    purchaseKey,
    userId,
    productId: result.productId,
    store: request.store,
    ...(result.transactionId ? { transactionId: result.transactionId } : {}),
    ...(result.expiresAt === undefined ? {} : { expiresAt: result.expiresAt }),
  });
  switch (grant) {
    case "granted_to_other_user":
      return { status: "ownership_conflict" };
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
    throw new TypeError("Expected { store, purchaseToken, productId }");
  }

  async function post<T>(
    path: string,
    payload: object,
  ): Promise<{ body: T } | { retryAfterMs: number; code: unknown }> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    // A rate limit, or IAPKit or the store could not answer yet.
    if (response.status === 429 || response.status === 503) {
      const seconds = Number(response.headers.get("retry-after"));
      const error = (await response.json().catch(() => null)) as {
        errors?: { code?: unknown }[];
      } | null;
      return {
        retryAfterMs:
          Number.isFinite(seconds) && seconds > 0
            ? seconds * 1000
            : DEFAULT_RETRY_MS,
        code: error?.errors?.[0]?.code,
      };
    }
    if (!response.ok) {
      throw new Error(`IAPKit ${path} returned ${response.status}`);
    }
    return { body: (await response.json()) as T };
  }
}
