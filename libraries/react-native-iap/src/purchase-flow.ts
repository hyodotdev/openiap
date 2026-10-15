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
 * yet. `ownership_conflict` sets `alreadyGranted` when another account already
 * got access, which lets the app finish it. `invalid` and
 * `test_account_restricted` are settled rejections: return
 * `verification_delayed` for any answer that may still change.
 */
export type PurchaseConfirmation =
  | { status: "store_pending" }
  | { status: "verification_delayed"; retryAfterMs: number }
  | { status: "ownership_conflict"; alreadyGranted: boolean }
  | { status: "test_account_restricted" }
  | { status: "invalid"; reason?: string }
  | { status: "verified"; retryAfterMs?: number }
  | { status: "linked"; retryAfterMs?: number }
  | { status: "entitled"; alreadyGranted: boolean };

type Finishable = "entitled" | "ownership_conflict" | "test_account_restricted";

/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an `entitled` status still grants access.
 * `recovered` marks an `invalid` purchase recovery found, not one the user
 * just bought.
 */
export type PurchaseFlowStatus =
  | Exclude<PurchaseConfirmation, { status: Finishable | "invalid" }>
  | (Extract<PurchaseConfirmation, { status: Finishable }> & {
      finishError?: unknown;
    })
  | (Extract<PurchaseConfirmation, { status: "invalid" }> & {
      finishError?: unknown;
      recovered?: true;
    })
  | { status: "failed"; error: unknown };

export interface PurchaseFlowOutcome<P extends PurchaseFlowPurchase> {
  purchase: P;
  status: PurchaseFlowStatus;
}

export interface PurchaseFlowOptions<P extends PurchaseFlowPurchase> {
  /** Sends the purchase to the app backend, which holds the IAPKit secret key. */
  confirmWithBackend: (purchase: P) => Promise<PurchaseConfirmation>;
  /**
   * Milliseconds `confirmWithBackend` may take before the purchase ends as
   * `failed`, so a hung call cannot hold it for the session. Default 30000.
   */
  confirmTimeoutMs?: number;
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
  /**
   * The SDK's `getPendingTransactionsIOS` on iOS, `undefined` elsewhere: off
   * iOS an SDK may answer `[]`, which would hide unacknowledged Android
   * purchases.
   * Recovery reads unfinished StoreKit transactions, consumables included,
   * from it. If it throws, recovery confirms every Apple purchase
   * `getAvailablePurchases` lists instead.
   */
  getPendingTransactionsIOS: (() => Promise<P[]>) | undefined;
}

export interface RecoverPurchasesOptions {
  /** Also re-confirm purchases that were already finished, for a restore button. */
  includeFinished?: boolean;
}

export interface PurchaseFlow<P extends PurchaseFlowPurchase> {
  /**
   * Confirms one purchase with the backend. Finishes it once access is granted
   * to this or another account, and a settled rejection on iOS only: Google
   * Play refunds a rejected purchase left unacknowledged, while iOS would
   * redeliver it forever.
   */
  processPurchase: (purchase: P) => Promise<PurchaseFlowStatus>;
  /**
   * Runs unfinished purchases (or every owned one) through `processPurchase`,
   * one at a time. Throws if it meets an Apple purchase without
   * `getPendingTransactionsIOS`.
   */
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
  // setTimeout runs a delay past 2^31 - 1 ms, Infinity included, at once.
  const confirmTimeoutMs = Math.min(
    options.confirmTimeoutMs ?? 30_000,
    2_147_483_647,
  );

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
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `confirmWithBackend did not answer within ${confirmTimeoutMs} ms`,
              ),
            );
          }, confirmTimeoutMs);
        });
        confirmation = readConfirmation(
          await Promise.race([options.confirmWithBackend(purchase), timeout]),
        );
      } catch (error) {
        return { status: "failed", error };
      } finally {
        clearTimeout(timer);
      }
      if (!confirmation) {
        return {
          status: "failed",
          error: new Error(
            "Unrecognized purchase confirmation from the backend",
          ),
        };
      }
      // Finishing settles a purchase for good, so only a settled verdict does.
      switch (confirmation.status) {
        case "entitled":
          return await finish(confirmation);
        case "ownership_conflict":
          return confirmation.alreadyGranted
            ? await finish(confirmation)
            : confirmation;
        case "invalid":
        case "test_account_restricted":
          return purchase.store === "apple"
            ? await finish(confirmation)
            : confirmation;
        default:
          return confirmation;
      }
    }

    async function finish(
      confirmation: Extract<
        PurchaseConfirmation,
        { status: Finishable | "invalid" }
      >,
    ): Promise<PurchaseFlowStatus> {
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
  }

  async function recoverPurchases(
    recoverOptions: RecoverPurchasesOptions = {},
  ): Promise<PurchaseFlowOutcome<P>[]> {
    const { includeFinished = false } = recoverOptions;
    const { getPendingTransactionsIOS } = options;
    // Finished means settled. iOS lists unfinished transactions directly;
    // Android marks finished ones acknowledged and stops listing consumed ones.
    let pendingIOS: P[] | undefined;
    let pendingIOSFailed = false;
    try {
      pendingIOS = await getPendingTransactionsIOS?.();
    } catch {
      // One unverified transaction fails the whole list. Re-confirming a
      // finished purchase is safe, so every owned Apple purchase stands in.
      pendingIOSFailed = true;
    }
    const available =
      includeFinished || !pendingIOS
        ? await options.getAvailablePurchases()
        : [];
    if (
      !getPendingTransactionsIOS &&
      available.some((purchase) => purchase.store === "apple")
    ) {
      throw new Error(
        "recoverPurchases needs getPendingTransactionsIOS on iOS to find unfinished transactions",
      );
    }
    const unfinished = available.filter(
      (purchase) =>
        includeFinished ||
        purchase.isAcknowledgedAndroid === false ||
        (pendingIOSFailed && purchase.store === "apple"),
    );
    const purchases = new Map<string, P>();
    for (const purchase of [...(pendingIOS ?? []), ...unfinished]) {
      if (!purchases.has(purchase.id)) purchases.set(purchase.id, purchase);
    }
    const outcomes: PurchaseFlowOutcome<P>[] = [];
    for (const purchase of purchases.values()) {
      const status = await processPurchase(purchase);
      outcomes.push({
        purchase,
        // An old expired renewal must not ask a subscriber to buy again.
        status:
          status.status === "invalid" ? { ...status, recovered: true } : status,
      });
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
  /**
   * True only for an `invalid` purchase the user just made. False whenever the
   * user may already have paid: never ask them to buy again.
   */
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
      return {
        key: "purchase_not_valid",
        offerPurchase: status.recovered !== true,
      };
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
    case "test_account_restricted":
      return { status };
    case "invalid":
      return typeof reason === "string" ? { status, reason } : { status };
    case "verification_delayed":
      return retry === undefined ? null : { status, retryAfterMs: retry };
    case "verified":
    case "linked":
      return retry === undefined ? { status } : { status, retryAfterMs: retry };
    case "ownership_conflict":
    case "entitled":
      return typeof alreadyGranted === "boolean"
        ? { status, alreadyGranted }
        : null;
    default:
      return null;
  }
}
