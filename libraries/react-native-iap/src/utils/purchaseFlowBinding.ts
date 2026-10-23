// The purchase flow bound to one SDK entry point's store functions. Synced to
// expo-iap; each entry point (index, index.kepler) passes its own functions.
import {
  createPurchaseFlow,
  PURCHASE_REQUEST_CLOCK_SKEW_MS,
  type PurchaseFlow,
  type PurchaseFlowOptions,
} from '../purchase-flow';
import type {Purchase} from '../types';

// When the app asked for each SKU, so the flow can tell the user's own
// purchase from one the store redelivers.
const requested = new Map<string, number>();

export function markRequested(skus: (string | null | undefined)[]): void {
  const now = Date.now();
  for (const sku of skus) if (sku) requested.set(sku, now);
}

export function clearRequested(): void {
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
  // Only that an error arrived matters here.
  purchaseErrorListener: (listener: () => void) => Subscription;
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
  // Whatever listens, a failed or cancelled request ends what the user asked
  // for, and the next account's flow must not inherit requests.
  const errors = manual ? undefined : sdk.purchaseErrorListener(clearRequested);
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
  return {
    ...flow,
    dispose: () => {
      flow.dispose();
      errors?.remove();
      clearRequested();
    },
  };
}
