// The purchase flow bound to one SDK entry point's store functions. Synced to
// expo-iap; each entry point (index, index.kepler) passes its own functions.
import {
  createPurchaseFlow,
  PURCHASE_REQUEST_CLOCK_SKEW_MS,
  type PurchaseFlow,
  type PurchaseFlowOptions,
} from '../purchase-flow-core';
import {ErrorCode, type Purchase} from '../types';

// When the app asked for each SKU, so the flow can tell the user's own
// purchase from one the store redelivers.
const requested = new Map<string, number>();
// Distinct per request, so an undo never takes another request's mark.
let lastMarkedAt = 0;

// Returns the undo for a request that fails, which keeps other requests' marks.
export function markRequested(skus: (string | null | undefined)[]): () => void {
  const now = Math.max(Date.now(), lastMarkedAt + 1);
  lastMarkedAt = now;
  const previous = new Map<string, number | undefined>();
  for (const sku of skus) {
    if (!sku) continue;
    if (!previous.has(sku)) previous.set(sku, requested.get(sku));
    requested.set(sku, now);
  }
  return () => {
    for (const [sku, askedAt] of previous) {
      if (requested.get(sku) !== now) continue;
      if (askedAt === undefined) requested.delete(sku);
      else requested.set(sku, askedAt);
    }
  };
}

function clearRequested(): void {
  requested.clear();
}

// A purchase made after the app asked for it, or a plan change to what it
// asked for; clears the mark.
function takeRequested(purchase: Purchase): boolean {
  const askedAt = requested.get(purchase.productId);
  const bought =
    askedAt !== undefined &&
    purchase.transactionDate >= askedAt - PURCHASE_REQUEST_CLOCK_SKEW_MS &&
    requested.delete(purchase.productId);
  const changed = (
    ('pendingPurchaseUpdateAndroid' in purchase &&
      purchase.pendingPurchaseUpdateAndroid?.products) ||
    []
  ).filter((id) => requested.delete(id));
  return bought || changed.length > 0;
}

type SdkPurchaseFlowFunction =
  | 'finishTransaction'
  | 'getAvailablePurchases'
  | 'getPendingTransactionsIOS'
  | 'listenForPurchases'
  | 'wasRequested';

/** `createPurchaseFlow` options; the SDK supplies any store function left out. */
export type SdkPurchaseFlowOptions = Omit<
  PurchaseFlowOptions<Purchase>,
  SdkPurchaseFlowFunction
> &
  Partial<Pick<PurchaseFlowOptions<Purchase>, SdkPurchaseFlowFunction>>;

interface Subscription {
  remove: () => void;
}

/** The store functions of one SDK entry point. */
export interface PurchaseFlowSdk {
  finishTransaction: PurchaseFlowOptions<Purchase>['finishTransaction'];
  getAvailablePurchases: () => Promise<Purchase[]>;
  getPendingTransactionsIOS: (() => Promise<Purchase[]>) | undefined;
  /** Every delivery, replays included: the flow deduplicates itself. */
  purchaseUpdatedListener: (
    listener: (purchase: Purchase) => void,
  ) => Subscription;
  purchaseErrorListener: (
    listener: (error: {code?: string}) => void,
  ) => Subscription;
}

/**
 * A flow given its own `finishTransaction` keeps 17.1's manual delivery: the
 * app calls `processPurchase`, unless it passes `listenForPurchases` too.
 */
export function createSdkPurchaseFlow(
  sdk: PurchaseFlowSdk,
  options: SdkPurchaseFlowOptions,
): PurchaseFlow<Purchase> {
  const manual = options.finishTransaction !== undefined;
  const flow = createPurchaseFlow({
    finishTransaction: sdk.finishTransaction,
    getAvailablePurchases: sdk.getAvailablePurchases,
    getPendingTransactionsIOS: sdk.getPendingTransactionsIOS,
    ...(manual
      ? {}
      : {
          listenForPurchases: (onPurchase: (purchase: Purchase) => void) =>
            sdk.purchaseUpdatedListener(onPurchase),
          wasRequested: takeRequested,
        }),
    ...options,
  });
  // Whatever listens, a failed or cancelled request ends what the user asked
  // for, and the next account's flow must not inherit requests. A refused
  // double tap ends nothing: the purchase in flight continues.
  let errors: Subscription | undefined;
  try {
    errors = manual
      ? undefined
      : sdk.purchaseErrorListener((error) => {
          if (error.code !== ErrorCode.PurchaseInProgress) clearRequested();
        });
  } catch (error) {
    flow.dispose();
    throw error;
  }
  let disposed = false;
  return {
    ...flow,
    dispose: () => {
      // A second dispose must not clear the next account's requests.
      if (disposed) return;
      disposed = true;
      flow.dispose();
      errors?.remove();
      clearRequested();
    },
  };
}
