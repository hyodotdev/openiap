// Backend-confirmed purchase flow for react-native-iap and expo-iap. The app
// backend verifies with IAPKit and grants access; this module decides when the
// app may finish a transaction, and makes no network calls of its own.
// Guide: https://kit.openiap.dev/docs/purchase-flow

/** Purchase fields the flow reads. Every OpenIAP `Purchase` matches. */
export interface PurchaseFlowPurchase {
  id: string;
  productId: string;
  purchaseState: string;
  purchaseToken?: string | null;
  store: string;
  isAcknowledgedAndroid?: boolean | null;
}

/** Body the app sends its backend, which takes the user from its own session. */
export interface PurchaseConfirmationRequest {
  store: "apple" | "google";
  /** Apple JWS or Google Play purchase token, forwarded to IAPKit as is. */
  purchaseToken: string;
  /** The product the app expected; IAPKit rejects a store mismatch. */
  productId: string;
}

/**
 * The app backend's verdict on one purchase. Only `entitled` grants access;
 * `verified` and `linked` mean the purchase is valid but access is not granted
 * yet. `invalid` is a settled store rejection: return `verification_delayed`
 * for any answer that may still change.
 */
export type PurchaseConfirmation =
  | { status: "store_pending" }
  | { status: "verification_delayed"; retryAfterMs: number }
  | { status: "ownership_conflict" }
  | { status: "test_account_restricted" }
  | { status: "invalid"; reason?: string }
  | { status: "verified"; retryAfterMs?: number }
  | { status: "linked"; retryAfterMs?: number }
  | { status: "entitled"; alreadyGranted: boolean };

/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an `entitled` status still grants access.
 */
export type PurchaseFlowStatus =
  | Exclude<PurchaseConfirmation, { status: "entitled" | "invalid" }>
  | (Extract<PurchaseConfirmation, { status: "entitled" | "invalid" }> & {
      finishError?: unknown;
    })
  | { status: "failed"; error: unknown };

export interface PurchaseFlowOutcome<P extends PurchaseFlowPurchase> {
  purchase: P;
  status: PurchaseFlowStatus;
}

export interface PurchaseFlowOptions<P extends PurchaseFlowPurchase> {
  /** Sends the purchase to the app backend, which holds the IAPKit secret key. */
  confirmWithBackend: (purchase: P) => Promise<PurchaseConfirmation>;
  finishTransaction: (args: {
    purchase: P;
    isConsumable: boolean;
  }) => Promise<unknown>;
  /**
   * From the app's product config. On Android a wrong answer consumes a
   * non-consumable or blocks rebuying a consumable.
   */
  isConsumable: (productId: string) => boolean;
  getAvailablePurchases: () => Promise<P[]>;
  /** iOS only: unfinished StoreKit transactions, consumables included. */
  getPendingTransactionsIOS?: () => Promise<P[]>;
}

export interface RecoverPurchasesOptions {
  /** Also re-confirm purchases that were already finished, for a restore button. */
  includeFinished?: boolean;
}

export interface PurchaseFlow<P extends PurchaseFlowPurchase> {
  /**
   * Confirms one purchase with the backend. Finishes it once access is
   * granted, and an `invalid` one on iOS only: Google Play refunds an invalid
   * purchase left unacknowledged, while iOS would redeliver it forever.
   */
  processPurchase: (purchase: P) => Promise<PurchaseFlowStatus>;
  /** Runs unfinished purchases (or every owned one) through `processPurchase`, one at a time. */
  recoverPurchases: (
    options?: RecoverPurchasesOptions,
  ) => Promise<PurchaseFlowOutcome<P>[]>;
}

/** Apple App Store and Google Play purchases only; other stores end as `failed`. */
export function createPurchaseFlow<P extends PurchaseFlowPurchase>(
  options: PurchaseFlowOptions<P>,
): PurchaseFlow<P> {
  // A listener and a recovery pass can deliver the same transaction at once.
  const inFlight = new Map<string, Promise<PurchaseFlowStatus>>();

  function processPurchase(purchase: P): Promise<PurchaseFlowStatus> {
    // Payment is not complete; the store delivers the purchase again once it is.
    if (purchase.purchaseState === "pending") {
      return Promise.resolve({ status: "store_pending" });
    }
    const running = inFlight.get(purchase.id);
    if (running) return running;
    const task = confirmAndFinish().finally(() => {
      inFlight.delete(purchase.id);
    });
    inFlight.set(purchase.id, task);
    return task;

    async function confirmAndFinish(): Promise<PurchaseFlowStatus> {
      let confirmation: PurchaseConfirmation | null;
      try {
        confirmation = readConfirmation(
          await options.confirmWithBackend(purchase),
        );
      } catch (error) {
        return { status: "failed", error };
      }
      if (!confirmation) {
        return {
          status: "failed",
          error: new Error(
            "Unrecognized purchase confirmation from the backend",
          ),
        };
      }
      if (
        confirmation.status === "entitled" ||
        (confirmation.status === "invalid" && purchase.store === "apple")
      ) {
        try {
          await options.finishTransaction({
            purchase,
            isConsumable: options.isConsumable(purchase.productId),
          });
          return confirmation;
        } catch (finishError) {
          return { ...confirmation, finishError };
        }
      }
      return confirmation;
    }
  }

  async function recoverPurchases(
    recoverOptions: RecoverPurchasesOptions = {},
  ): Promise<PurchaseFlowOutcome<P>[]> {
    const { includeFinished = false } = recoverOptions;
    // Finished means settled: granted, or invalid on iOS. iOS lists unfinished
    // transactions directly; Android marks finished ones acknowledged and
    // stops listing consumed ones.
    const [pendingIOS = [], available] = await Promise.all([
      options.getPendingTransactionsIOS?.(),
      includeFinished || !options.getPendingTransactionsIOS
        ? options.getAvailablePurchases()
        : [],
    ]);
    const unfinished = includeFinished
      ? available
      : available.filter(
          (purchase) => purchase.isAcknowledgedAndroid === false,
        );
    const purchases = new Map<string, P>();
    for (const purchase of [...pendingIOS, ...unfinished]) {
      if (!purchases.has(purchase.id)) purchases.set(purchase.id, purchase);
    }
    const outcomes: PurchaseFlowOutcome<P>[] = [];
    for (const purchase of purchases.values()) {
      outcomes.push({ purchase, status: await processPurchase(purchase) });
    }
    return outcomes;
  }

  return { processPurchase, recoverPurchases };
}

/** Builds the backend request body; throws for a purchase without Apple or Google evidence. */
export function toPurchaseConfirmationRequest(
  purchase: PurchaseFlowPurchase,
): PurchaseConfirmationRequest {
  const { store, purchaseToken, productId } = purchase;
  if ((store !== "apple" && store !== "google") || !purchaseToken) {
    throw new Error(
      `Purchase ${productId} has no Apple or Google purchase token to confirm`,
    );
  }
  return { store, purchaseToken, productId };
}

export type PurchaseFlowGuidanceKey =
  | "payment_pending"
  | "verification_delayed"
  | "owned_by_another_account"
  | "test_purchase_not_accepted"
  | "purchase_not_valid"
  | "access_pending"
  | "access_granted"
  | "try_again_later";

/** Neutral guidance an app maps to its own copy. */
export interface PurchaseFlowGuidance {
  key: PurchaseFlowGuidanceKey;
  /** False whenever the user may already have paid: never ask them to buy again. */
  offerPurchase: boolean;
  /** Earliest time to run the purchase through the flow again. */
  retryAfterMs?: number;
}

export function describePurchaseFlowStatus(
  status: PurchaseFlowStatus,
): PurchaseFlowGuidance {
  switch (status.status) {
    case "store_pending":
      return { key: "payment_pending", offerPurchase: false };
    case "verification_delayed":
      return {
        key: "verification_delayed",
        offerPurchase: false,
        retryAfterMs: status.retryAfterMs,
      };
    case "ownership_conflict":
      return { key: "owned_by_another_account", offerPurchase: false };
    case "test_account_restricted":
      return { key: "test_purchase_not_accepted", offerPurchase: false };
    case "invalid":
      return { key: "purchase_not_valid", offerPurchase: true };
    case "verified":
    case "linked":
      return status.retryAfterMs === undefined
        ? { key: "access_pending", offerPurchase: false }
        : {
            key: "access_pending",
            offerPurchase: false,
            retryAfterMs: status.retryAfterMs,
          };
    case "entitled":
      return { key: "access_granted", offerPurchase: false };
    case "failed":
      return { key: "try_again_later", offerPurchase: false };
  }
}

// Backend JSON is untrusted: anything off-contract becomes `failed`, so a
// malformed body can never finish a transaction.
function readConfirmation(value: unknown): PurchaseConfirmation | null {
  if (typeof value !== "object" || value === null) return null;
  const { status, retryAfterMs, alreadyGranted, reason } = value as Record<
    string,
    unknown
  >;
  const retry =
    typeof retryAfterMs === "number" &&
    Number.isFinite(retryAfterMs) &&
    retryAfterMs >= 0
      ? retryAfterMs
      : undefined;
  switch (status) {
    case "store_pending":
    case "ownership_conflict":
    case "test_account_restricted":
      return { status };
    case "invalid":
      return typeof reason === "string" ? { status, reason } : { status };
    case "verification_delayed":
      return retry === undefined ? null : { status, retryAfterMs: retry };
    case "verified":
    case "linked":
      return retry === undefined ? { status } : { status, retryAfterMs: retry };
    case "entitled":
      return typeof alreadyGranted === "boolean"
        ? { status, alreadyGranted }
        : null;
    default:
      return null;
  }
}
