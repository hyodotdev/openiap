// The purchase flow bound to one SDK entry point's store functions. Synced to
// expo-iap; each entry point (index, index.kepler) passes its own functions.
import {
  createPurchaseFlow,
  PURCHASE_REQUEST_CLOCK_SKEW_MS,
  type PurchaseFlow,
  type PurchaseFlowOptions,
} from '../purchase-flow-core';
import {ErrorCode, type Purchase} from '../types';

// When each live request asked for each SKU, oldest first, so the flow can
// tell the user's own purchase from one the store redelivers.
const requested = new Map<string, number[]>();

// Returns the undo for a request that fails, which keeps other requests' marks.
export function markRequested(skus: (string | null | undefined)[]): () => void {
  const marked = new Set(skus.filter((sku): sku is string => !!sku));
  // Distinct among the marks it joins, so the undo removes only its own.
  let now = Date.now();
  while ([...marked].some((sku) => requested.get(sku)?.includes(now))) now += 1;
  for (const sku of marked) {
    requested.set(sku, [...(requested.get(sku) ?? []), now]);
  }
  return () => {
    for (const sku of marked) {
      const live = requested.get(sku)?.filter((askedAt) => askedAt !== now);
      if (live?.length) requested.set(sku, live);
      else requested.delete(sku);
    }
  };
}

function clearRequested(): void {
  requested.clear();
}

// Removes the oldest live mark for the SKU, which the matching purchase answers.
function takeMark(sku: string): boolean {
  const live = requested.get(sku);
  if (!live) return false;
  if (live.length > 1) requested.set(sku, live.slice(1));
  else requested.delete(sku);
  return true;
}

// A purchase made after the app asked for it, or a plan change to what it
// asked for; clears that request's mark.
function takeRequested(purchase: Purchase): boolean {
  const askedAt = requested.get(purchase.productId)?.[0];
  const bought =
    askedAt !== undefined &&
    purchase.transactionDate >= askedAt - PURCHASE_REQUEST_CLOCK_SKEW_MS &&
    takeMark(purchase.productId);
  // A plan change within the same product answers one request, not two.
  const changeTargets = new Set(
    ('pendingPurchaseUpdateAndroid' in purchase &&
      purchase.pendingPurchaseUpdateAndroid?.products) ||
      [],
  );
  if (bought) changeTargets.delete(purchase.productId);
  const changed = [...changeTargets].filter(takeMark);
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
