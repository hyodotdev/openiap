// Purchase flow shared by every OpenIAP SDK. A confirmer (the app's backend,
// IAPKit, or any other verification service) confirms each purchase; this
// module decides when the app may finish a transaction, and makes no network
// calls of its own. The confirmers the SDKs ship live in
// purchase-flow-confirmers.ts.
// Ports in other languages run purchase-flow.vectors.json.
// Guide: https://kit.openiap.dev/docs/purchase-flow

/** Purchase fields the flow reads. Every OpenIAP `Purchase` matches. */
export interface PurchaseFlowPurchase {
  id: string;
  productId: string;
  purchaseState: string;
  purchaseToken?: string | null;
  store: string;
  storeId?: string | null;
  ids?: string[] | null;
  quantity?: number;
  isAcknowledgedAndroid?: boolean | null;
  /**
   * A requested plan change that has not applied yet: Google Play waits for
   * its payment, Amazon applies it at the next renewal.
   */
  pendingPurchaseUpdateAndroid?: { products: string[] } | null;
  /** Apple's `Sandbox` or `Production`, which a confirmer matches against its verdict. */
  environmentIOS?: string | null;
  /** The Amazon user the receipt belongs to, which Amazon RVS checks. */
  userIdAmazon?: string | null;
  revocationDateIOS?: number | null;
  isUpgradedIOS?: boolean | null;
  expirationDateIOS?: number | null;
}

/** Body the app sends its backend, which takes the user from its own session. */
export interface PurchaseConfirmationRequest {
  store: "apple" | "google";
  /** Apple JWS or Google Play purchase token, as the store issued it. */
  purchaseToken: string;
  /** The product the app expected, to compare with the store's answer. */
  productId: string;
}

/**
 * A confirmer's verdict on one purchase. Only `entitled` grants access;
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

/**
 * Gives the user what they bought, before the flow finishes (and so consumes)
 * the purchase. Must be idempotent per `purchase.id`: after a crash the same
 * purchase is confirmed again.
 */
export type PurchaseGrant<
  P extends PurchaseFlowPurchase = PurchaseFlowPurchase,
> = (purchase: P, context: { isConsumable: boolean }) => Promise<void>;

/**
 * Confirms one purchase and grants access before it resolves `entitled`: the
 * flow finishes, and so consumes, the purchase right after. A confirmer that
 * throws or times out leaves the purchase unfinished for the next delivery or
 * recovery. Any verification service plugs in here.
 */
export type PurchaseConfirmer<
  P extends PurchaseFlowPurchase = PurchaseFlowPurchase,
> = (
  purchase: P,
  context: { isConsumable: boolean },
) => Promise<PurchaseConfirmation>;

type Finishable = "entitled" | "ownership_conflict" | "test_account_restricted";

/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an `entitled` status still grants access.
 * `changePending` marks an `entitled` purchase whose requested upgrade,
 * downgrade, or prepaid top-up has not applied yet (Google Play waits for its
 * payment, Amazon applies it at the next renewal): access stays on the current
 * plan. `recovered` marks an `invalid` purchase recovery found, not one the
 * user just bought.
 */
export type PurchaseFlowStatus =
  | Exclude<PurchaseConfirmation, { status: Finishable | "invalid" }>
  | (Extract<PurchaseConfirmation, { status: "entitled" }> & {
      finishError?: unknown;
      changePending?: true;
    })
  | (Extract<
      PurchaseConfirmation,
      { status: "ownership_conflict" | "test_account_restricted" }
    > & {
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
  /**
   * Usually a call to the app backend. An app without one passes the SDK's
   * `confirmWithIapkit`, `confirmOnDeviceIOS`, or another service's confirmer.
   */
  confirmWithBackend: PurchaseConfirmer<P>;
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
  /**
   * Registers for the store's purchase deliveries; the flow processes each one
   * until `dispose`. SDKs pass their purchase listener.
   */
  listenForPurchases?: (onPurchase: (purchase: P) => void) => {
    remove: () => void;
  };
  /**
   * Whether the user's own request produced a delivered purchase. Only then
   * may an `invalid` delivery offer buying again; without this, no delivery
   * the flow listened for does.
   */
  wasRequested?: (purchase: P) => boolean;
}

export interface RecoverPurchasesOptions {
  /** Also re-confirm purchases that were already finished, for a restore button. */
  includeFinished?: boolean;
}

export interface PurchaseFlow<P extends PurchaseFlowPurchase> {
  /**
   * Confirms one purchase the user just bought. Finishes it once access is
   * granted to this or another account, and a settled rejection on iOS only:
   * Google Play refunds a rejected purchase left unacknowledged, while iOS
   * would redeliver it forever.
   */
  processPurchase: (purchase: P) => Promise<PurchaseFlowStatus>;
  /**
   * Runs unfinished purchases (or every owned one) through the flow, one at a
   * time; a call made while a pass runs shares it. Throws if it meets an
   * Apple purchase without `getPendingTransactionsIOS`.
   */
  recoverPurchases: (
    options?: RecoverPurchasesOptions,
  ) => Promise<PurchaseFlowOutcome<P>[]>;
  /**
   * Calls `listener` with every outcome: once per confirmation, however many
   * deliveries shared it, and once per delivery of an already settled
   * purchase. Returns the function that unsubscribes it.
   */
  subscribe: (
    listener: (outcome: PurchaseFlowOutcome<P>) => void,
  ) => () => void;
  /**
   * Stops listening and publishing, and stops a recovery pass from confirming
   * anything more; confirmations already running still finish. Call it when
   * the signed-in account changes, then create the next account's flow.
   */
  dispose: () => void;
}

/**
 * How far a store's purchase time may trail the moment the app asked for it
 * and still count as that request: device clocks run ahead. A redelivered
 * receipt is far older.
 */
export const PURCHASE_REQUEST_CLOCK_SKEW_MS = 600_000;

interface PurchaseRun<P> {
  task: Promise<PurchaseFlowStatus>;
  latest: P;
  requested: boolean;
}

/**
 * Single-product, single-unit purchases only. Create one flow per
 * authenticated app account. Capture that session in confirmWithBackend and
 * dispose the flow after switching accounts.
 */
export function createPurchaseFlow<P extends PurchaseFlowPurchase>(
  options: PurchaseFlowOptions<P>,
): PurchaseFlow<P> {
  // A listener and a recovery pass can deliver the same transaction at once.
  const runs = new Map<string, PurchaseRun<P>>();
  // Finished purchases, and rejections the store settles on its own. A
  // recovery pass can hold a store list read before the listener settled one.
  const settled = new Map<string, PurchaseFlowStatus>();
  const recoveries = new Map<boolean, Promise<PurchaseFlowOutcome<P>[]>>();
  const listeners = new Set<(outcome: PurchaseFlowOutcome<P>) => void>();
  let disposed = false;
  // setTimeout runs a delay past 2^31 - 1 ms, Infinity included, at once.
  const confirmTimeoutMs = Math.min(
    options.confirmTimeoutMs ?? 30_000,
    2_147_483_647,
  );
  const subscription = options.listenForPurchases?.((purchase) => {
    // A pending delivery leaves the mark for the completed one that follows.
    const requested =
      purchase.purchaseState !== "pending" &&
      (options.wasRequested?.(purchase) ?? false);
    void deliver(purchase, requested);
  });

  function publish(outcome: PurchaseFlowOutcome<P>): void {
    if (disposed) return;
    for (const listener of listeners) {
      try {
        listener(outcome);
      } catch {
        // One subscriber's error must not keep the outcome from the others.
      }
    }
  }

  // Marked per delivery: a shared run may have started from an older copy of
  // the purchase, before Play attached the pending change.
  function forDelivery(
    purchase: P,
    status: PurchaseFlowStatus,
    requested: boolean,
  ): PurchaseFlowStatus {
    if (status.status === "entitled" && purchase.pendingPurchaseUpdateAndroid) {
      return { ...status, changePending: true };
    }
    // An old expired renewal must not ask a subscriber to buy again.
    if (status.status === "invalid" && !requested) {
      return { ...status, recovered: true };
    }
    return status;
  }

  function processPurchase(purchase: P): Promise<PurchaseFlowStatus> {
    return deliver(purchase, true);
  }

  function deliver(
    purchase: P,
    requested: boolean,
    reconfirm = false,
  ): Promise<PurchaseFlowStatus> {
    const immediate = immediateStatus(purchase, reconfirm);
    if (immediate) {
      const status = forDelivery(purchase, immediate, requested);
      publish({ purchase, status });
      return Promise.resolve(status);
    }
    let run = runs.get(purchase.id);
    if (run) {
      run.latest = purchase;
      run.requested ||= requested;
    } else {
      const started: PurchaseRun<P> = {
        latest: purchase,
        requested,
        task: confirmAndFinish(purchase).then((status) => {
          runs.delete(purchase.id);
          if (isSettled(status)) settled.set(purchase.id, status);
          publish({
            purchase: started.latest,
            status: forDelivery(started.latest, status, started.requested),
          });
          return status;
        }),
      };
      runs.set(purchase.id, started);
      run = started;
    }
    return run.task.then((status) => forDelivery(purchase, status, requested));
  }

  function immediateStatus(
    purchase: P,
    reconfirm: boolean,
  ): PurchaseFlowStatus | undefined {
    try {
      assertSupportedPurchase(purchase);
    } catch (error) {
      return { status: "failed", error };
    }
    // Payment is not complete; the store delivers the purchase again once it is.
    if (purchase.purchaseState === "pending")
      return { status: "store_pending" };
    return reconfirm || runs.has(purchase.id)
      ? undefined
      : settled.get(purchase.id);
  }

  async function confirmAndFinish(purchase: P): Promise<PurchaseFlowStatus> {
    let confirmation: PurchaseConfirmation | null;
    let isConsumable: boolean;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Read once: finishing must consume exactly what confirmation granted.
      isConsumable = options.isConsumable(purchase.productId);
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
        await Promise.race([
          options.confirmWithBackend(purchase, { isConsumable }),
          timeout,
        ]),
      );
    } catch (error) {
      return { status: "failed", error };
    } finally {
      clearTimeout(timer);
    }
    if (!confirmation) {
      return {
        status: "failed",
        error: new Error("Unrecognized purchase confirmation from the backend"),
      };
    }
    // Finishing settles a purchase for good, so only a settled verdict does.
    switch (confirmation.status) {
      case "entitled":
        return await finish(purchase, isConsumable, confirmation);
      case "ownership_conflict":
        return confirmation.alreadyGranted
          ? await finish(purchase, isConsumable, confirmation)
          : confirmation;
      case "invalid":
      case "test_account_restricted":
        return purchase.store === "apple"
          ? await finish(purchase, isConsumable, confirmation)
          : confirmation;
      default:
        return confirmation;
    }
  }

  async function finish(
    purchase: P,
    isConsumable: boolean,
    confirmation: Extract<
      PurchaseConfirmation,
      { status: Finishable | "invalid" }
    >,
  ): Promise<PurchaseFlowStatus> {
    try {
      // Play keeps an acknowledged purchase finished; a restore need not redo it.
      if (purchase.isAcknowledgedAndroid === true && !isConsumable) {
        return confirmation;
      }
      await options.finishTransaction({ purchase, isConsumable });
      return confirmation;
    } catch (finishError) {
      return { ...confirmation, finishError };
    }
  }

  function recoverPurchases(
    recoverOptions: RecoverPurchasesOptions = {},
  ): Promise<PurchaseFlowOutcome<P>[]> {
    const includeFinished = recoverOptions.includeFinished ?? false;
    let pass = recoveries.get(includeFinished);
    if (!pass) {
      pass = recover(includeFinished).finally(() => {
        recoveries.delete(includeFinished);
      });
      recoveries.set(includeFinished, pass);
    }
    return pass;
  }

  async function recover(
    includeFinished: boolean,
  ): Promise<PurchaseFlowOutcome<P>[]> {
    const { getPendingTransactionsIOS } = options;
    // iOS lists unfinished transactions directly; other stores list owned
    // purchases, and isUnfinished picks the ones still to settle.
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
        (purchase.store === "apple"
          ? pendingIOSFailed
          : isUnfinished(purchase)),
    );
    const purchases = new Map<string, P>();
    for (const purchase of [...(pendingIOS ?? []), ...unfinished]) {
      if (!purchases.has(purchase.id)) purchases.set(purchase.id, purchase);
    }
    const outcomes: PurchaseFlowOutcome<P>[] = [];
    for (const purchase of purchases.values()) {
      // The next account's flow confirms the rest with its own session.
      if (disposed) break;
      if (!includeFinished && settled.has(purchase.id)) continue;
      const status = await deliver(purchase, false, includeFinished);
      outcomes.push({ purchase, status });
    }
    return outcomes;
  }

  function isUnfinished(purchase: P): boolean {
    // Amazon and most community stores report no acknowledgment, and Amazon
    // approves a Kids purchase later; a listed consumable is unconsumed.
    return (
      purchase.isAcknowledgedAndroid !== true ||
      options.isConsumable(purchase.productId)
    );
  }

  return {
    processPurchase,
    recoverPurchases,
    subscribe(listener) {
      const entry = (outcome: PurchaseFlowOutcome<P>) => listener(outcome);
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      subscription?.remove();
    },
  };
}

// A settled purchase is finished, or rejected for good where the store
// settles it, so the same delivery need not be confirmed again.
function isSettled(status: PurchaseFlowStatus): boolean {
  switch (status.status) {
    case "entitled":
    case "invalid":
    case "test_account_restricted":
      return status.finishError === undefined;
    case "ownership_conflict":
      return status.alreadyGranted && status.finishError === undefined;
    default:
      return false;
  }
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
  assertSupportedPurchase(purchase);
  return { store, purchaseToken, productId };
}

function assertSupportedPurchase(purchase: PurchaseFlowPurchase): void {
  if (purchase.quantity !== undefined && purchase.quantity !== 1) {
    throw new Error("Purchase flow supports only single-unit purchases");
  }
  if (new Set(purchase.ids ?? []).size > 1) {
    throw new Error(
      "Purchase flow cannot finish a multi-product purchase before every product is granted",
    );
  }
}

export type PurchaseFlowGuidanceKey =
  | "payment_pending"
  | "change_pending"
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
      return {
        key: status.changePending ? "change_pending" : "access_granted",
        offerPurchase: false,
      };
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
