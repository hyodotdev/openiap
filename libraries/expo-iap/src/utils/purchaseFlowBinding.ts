// The purchase flow bound to one SDK entry point's store functions. Synced to
// expo-iap; each entry point (index, index.kepler) passes its own functions.
import {
  createPurchaseFlow,
  type PurchaseFlow,
  type PurchaseFlowOptions,
} from '../purchase-flow';
import type {Purchase} from '../types';

// SKUs the app asked to buy, so the flow can tell the user's own purchase from
// one the store redelivers.
const requested = new Set<string>();

export function markRequested(skus: (string | null | undefined)[]): void {
  for (const sku of skus) if (sku) requested.add(sku);
}

export function clearRequested(): void {
  requested.clear();
}

// A purchase the app asked for, or the plan it changes to; clears the mark.
function takeRequested(purchase: Purchase): boolean {
  const ids = [
    purchase.productId,
    ...(('pendingPurchaseUpdateAndroid' in purchase &&
      purchase.pendingPurchaseUpdateAndroid?.products) ||
      []),
  ];
  return ids.filter((id) => requested.delete(id)).length > 0;
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
  purchaseUpdatedListener: (
    listener: (purchase: Purchase) => void,
  ) => Subscription;
  // Only that an error arrived matters here.
  purchaseErrorListener: (listener: () => void) => Subscription;
}

export function createSdkPurchaseFlow(
  sdk: PurchaseFlowSdk,
  options: SdkPurchaseFlowOptions,
): PurchaseFlow<Purchase> {
  return createPurchaseFlow({
    finishTransaction: sdk.finishTransaction,
    getAvailablePurchases: sdk.getAvailablePurchases,
    getPendingTransactionsIOS: sdk.getPendingTransactionsIOS,
    listenForPurchases: (onPurchase) => {
      const updates = sdk.purchaseUpdatedListener(onPurchase);
      // A failed or cancelled request ends what the user asked for.
      const errors = sdk.purchaseErrorListener(clearRequested);
      return {
        remove: () => {
          updates.remove();
          errors.remove();
        },
      };
    },
    wasRequested: takeRequested,
    ...options,
  });
}
