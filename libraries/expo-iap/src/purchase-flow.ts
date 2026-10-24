// Purchase flow shared by every OpenIAP SDK. The app's backend, or IAPKit
// directly with a publishable key, confirms each purchase; this module decides
// when the app may finish a transaction, and makes no network calls of its own.
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
  /** Apple's `Sandbox` or `Production`, matched against IAPKit's answer. */
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
   * Confirms the purchase and grants access before it resolves `entitled`:
   * the flow finishes, and so consumes, the purchase right after. Usually a
   * call to the app backend, which holds the IAPKit secret key; an app without
   * one passes the SDK's `confirmWithIapkit`.
   */
  confirmWithBackend: (
    purchase: P,
    context: { isConsumable: boolean },
  ) => Promise<PurchaseConfirmation>;
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

type IapkitStore = "apple" | "google" | "amazon" | "horizon";

/** How an app without its own backend confirms purchases with IAPKit. */
export interface IapkitConfirmationOptions<
  P extends PurchaseFlowPurchase = PurchaseFlowPurchase,
> {
  /**
   * A publishable key (`openiap-kit_pk_...`), which is safe to ship in an
   * app. Leave it out where the SDK has one configured, such as Expo's
   * `iapkitApiKey`.
   */
  apiKey?: string;
  /** A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev. */
  baseUrl?: string;
  amazon?: {
    /** Verify App Tester receipts with the Amazon RVS Cloud Sandbox. */
    sandbox?: boolean;
    /** RVS reports a subscription term under its parent SKU; maps one to the other. */
    verifiedProductId?: (productId: string) => string;
  };
  /** The IAPKit store that verifies a community store's evidence, such as an Amazon RVS adapter. */
  verifyAs?: (purchase: P) => IapkitStore | undefined;
  /**
   * Gives the user what they bought, before the flow finishes (and so
   * consumes) the purchase. Required for consumables. Must be idempotent per
   * `purchase.id`: after a crash the same purchase is confirmed again. Access
   * read from ownership, such as an active subscription, needs nothing here.
   */
  grant?: (purchase: P, context: { isConsumable: boolean }) => Promise<void>;
}

/** The SDK's `VerifyPurchaseWithProviderProps` for IAPKit. */
export interface IapkitVerificationProps {
  provider: "iapkit";
  iapkit: {
    apiKey?: string;
    baseUrl?: string;
    apple?: { jws: string };
    google?: { purchaseToken: string };
    amazon?: {
      receiptId: string;
      expectedProductId: string;
      sandbox: boolean;
      userId?: string;
    };
    horizon?: { sku: string };
  };
}

/** Fields of the SDK's `VerifyPurchaseWithProviderResult` the flow reads. */
export interface IapkitVerificationResult {
  iapkit?: {
    store: string;
    storeId: string;
    environment?: string | null;
    isValid: boolean;
    state: string;
    productId?: string | null;
  } | null;
  errors?: { code?: string | null; message: string }[] | null;
}

const IAPKIT_UNKNOWN_RETRY_MS = 30_000;

/**
 * The SDK's `confirmWithIapkit`, given its `verifyPurchaseWithProvider`:
 * verifies the purchase with IAPKit, then runs `grant` before the flow
 * finishes it.
 */
export function createIapkitConfirmation<P extends PurchaseFlowPurchase>(
  verifyPurchaseWithProvider: (
    props: IapkitVerificationProps,
  ) => Promise<IapkitVerificationResult>,
  options: IapkitConfirmationOptions<P>,
): (
  purchase: P,
  context: { isConsumable: boolean },
) => Promise<PurchaseConfirmation> {
  return async (purchase, context) => {
    requireGrant("confirmWithIapkit", purchase, context, options);
    const confirmation = readIapkitVerification(
      await verifyPurchaseWithProvider(
        toIapkitVerificationProps(purchase, options),
      ),
      purchase,
      context,
      options,
    );
    if (confirmation.status === "entitled" && !confirmation.alreadyGranted) {
      await options.grant?.(purchase, context);
    }
    return confirmation;
  };
}

/**
 * The SDK's `confirmOnDeviceIOS`, given its `getPendingTransactionsIOS`, for an
 * app with neither a backend nor IAPKit. StoreKit verified the transaction if
 * it is still unfinished, unrevoked, not upgraded, unexpired, and from the
 * purchase's environment; `grant` then runs before the flow finishes it.
 */
export function createDeviceConfirmationIOS<P extends PurchaseFlowPurchase>(
  getPendingTransactionsIOS: () => Promise<P[]>,
  options: Pick<IapkitConfirmationOptions<P>, "grant"> = {},
): (
  purchase: P,
  context: { isConsumable: boolean },
) => Promise<PurchaseConfirmation> {
  return async (purchase, context) => {
    requireGrant("confirmOnDeviceIOS", purchase, context, options);
    // A community provider may report store "apple" under its own storeId.
    if (
      purchase.store !== "apple" ||
      (purchase.storeId ?? "apple") !== "apple"
    ) {
      throw new Error(
        `Device confirmation covers App Store purchases, not ${purchase.storeId ?? purchase.store}`,
      );
    }
    const pending = await getPendingTransactionsIOS();
    // After the query: a transaction can expire while StoreKit answers.
    const now = Date.now();
    const verified = pending.some(
      (candidate) =>
        candidate.store === "apple" &&
        purchase.id !== "" &&
        candidate.id === purchase.id &&
        candidate.productId === purchase.productId &&
        candidate.revocationDateIOS == null &&
        candidate.isUpgradedIOS !== true &&
        (candidate.expirationDateIOS == null ||
          candidate.expirationDateIOS > now) &&
        (purchase.environmentIOS == null ||
          candidate.environmentIOS === purchase.environmentIOS),
    );
    if (!verified) {
      throw new Error(
        `StoreKit lists no valid unfinished transaction for ${purchase.productId}`,
      );
    }
    await options.grant?.(purchase, context);
    return { status: "entitled", alreadyGranted: false };
  };
}

// Checked before verifying: a consumable must never pass without a way to credit it.
function requireGrant<P extends PurchaseFlowPurchase>(
  name: string,
  purchase: P,
  context: { isConsumable: boolean },
  options: Pick<IapkitConfirmationOptions<P>, "grant">,
): void {
  if (context.isConsumable && !options.grant) {
    throw new Error(
      `${name} needs grant to credit consumable ${purchase.productId} before it is consumed`,
    );
  }
}

/** Builds the IAPKit request for a purchase; throws for a store IAPKit cannot verify. */
export function toIapkitVerificationProps<P extends PurchaseFlowPurchase>(
  purchase: P,
  options: IapkitConfirmationOptions<P>,
): IapkitVerificationProps {
  const apiKey = options.apiKey?.trim();
  // An unset environment variable, not a deliberate fallback to the SDK's key.
  if (apiKey === "") throw new Error("IAPKit apiKey is empty");
  const baseUrl = options.baseUrl?.trim();
  const base = {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
  const token = (): string => {
    if (!purchase.purchaseToken) {
      throw new Error(
        `Purchase ${purchase.productId} has no purchase token to verify`,
      );
    }
    return purchase.purchaseToken;
  };
  const store = verifyingStore(purchase, options);
  switch (store) {
    case "apple":
      return {
        provider: "iapkit",
        iapkit: { ...base, apple: { jws: token() } },
      };
    case "google":
      return {
        provider: "iapkit",
        iapkit: { ...base, google: { purchaseToken: token() } },
      };
    case "amazon":
      return {
        provider: "iapkit",
        iapkit: {
          ...base,
          amazon: {
            receiptId: token(),
            expectedProductId: amazonProductId(purchase, options),
            sandbox: options.amazon?.sandbox ?? false,
            ...(purchase.userIdAmazon ? { userId: purchase.userIdAmazon } : {}),
          },
        },
      };
    case "horizon":
      return {
        provider: "iapkit",
        iapkit: { ...base, horizon: { sku: purchase.productId } },
      };
    default:
      throw new Error(`IAPKit cannot verify store ${purchase.store}`);
  }
}

/**
 * Turns IAPKit's answer into the flow's confirmation. Anything that may be a
 * configuration error rather than a rejected payment throws, so the flow
 * reports `failed` and leaves the purchase unfinished: evidence for another
 * store, product, or environment, `inauthentic` (IAPKit's answer to a product
 * or package mismatch, and to every Horizon rejection), and a valid state this
 * product type cannot be granted from.
 */
export function readIapkitVerification<P extends PurchaseFlowPurchase>(
  result: IapkitVerificationResult,
  purchase: P,
  context: { isConsumable: boolean },
  options: Omit<IapkitConfirmationOptions<P>, "apiKey"> = {},
): PurchaseConfirmation {
  const verified = result.iapkit;
  if (!verified) {
    const errors = (result.errors ?? []).map((error) =>
      error.code ? `[${error.code}] ${error.message}` : error.message,
    );
    throw new Error(
      errors.join("\n") || "IAPKit returned no verification result",
    );
  }
  switch (verified.state) {
    case "pending":
      return { status: "store_pending" };
    // The store gave no usable answer: retry instead of rejecting a payment.
    case "unknown":
      return {
        status: "verification_delayed",
        retryAfterMs: IAPKIT_UNKNOWN_RETRY_MS,
      };
  }
  const store = verifyingStore(purchase, options);
  const expectedProductId =
    store === "amazon"
      ? amazonProductId(purchase, options)
      : purchase.productId;
  const mismatch =
    verified.store !== purchase.store
      ? `store ${verified.store}, expected ${purchase.store}`
      : purchase.storeId && verified.storeId !== purchase.storeId
        ? `store id ${verified.storeId}, expected ${purchase.storeId}`
        : verified.productId !== expectedProductId
          ? `product ${verified.productId ?? "(none)"}, expected ${expectedProductId}`
          : environmentMismatch(verified.environment, store, purchase, options);
  if (mismatch) throw new Error(`IAPKit verified ${mismatch}`);
  if (!verified.isValid) {
    switch (verified.state) {
      case "canceled":
      case "expired":
        return { status: "invalid", reason: verified.state };
      // Only a granted purchase is consumed; the flow grants before finishing.
      case "consumed":
        return { status: "entitled", alreadyGranted: true };
      default:
        throw new Error(`IAPKit rejected the purchase: ${verified.state}`);
    }
  }
  if (!grantsAccess(store, verified.state, context.isConsumable)) {
    throw new Error(
      `IAPKit state ${verified.state} cannot grant this ${
        context.isConsumable ? "consumable" : "non-consumable"
      } ${purchase.store} purchase`,
    );
  }
  return { status: "entitled", alreadyGranted: false };
}

function verifyingStore<P extends PurchaseFlowPurchase>(
  purchase: P,
  options: Pick<IapkitConfirmationOptions<P>, "verifyAs">,
): string {
  return options.verifyAs?.(purchase) ?? purchase.store;
}

function amazonProductId(
  purchase: PurchaseFlowPurchase,
  options: Pick<IapkitConfirmationOptions, "amazon">,
): string {
  return (
    options.amazon?.verifiedProductId?.(purchase.productId) ??
    purchase.productId
  );
}

function environmentMismatch(
  environment: string | null | undefined,
  store: string,
  purchase: PurchaseFlowPurchase,
  options: Pick<IapkitConfirmationOptions, "amazon">,
): string | null {
  const expected =
    store === "amazon"
      ? options.amazon?.sandbox
        ? "Sandbox"
        : "Production"
      : store === "apple"
        ? purchase.environmentIOS
        : null;
  return expected && environment !== expected
    ? `environment ${environment ?? "(none)"}, expected ${expected}`
    : null;
}

// Apple and Amazon keep a consumable at ready-to-consume until it is finished;
// Google reports a granted purchase as pending-acknowledgment until then.
function grantsAccess(
  store: string,
  state: string,
  isConsumable: boolean,
): boolean {
  switch (store) {
    case "apple":
    case "amazon":
      return state === (isConsumable ? "ready-to-consume" : "entitled");
    case "google":
      return (
        state === "entitled" ||
        state === "pending-acknowledgment" ||
        (isConsumable && state === "ready-to-consume")
      );
    case "horizon":
      return state === "entitled";
    default:
      return false;
  }
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
