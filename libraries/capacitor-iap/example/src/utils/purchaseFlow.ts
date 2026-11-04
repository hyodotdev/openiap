import {Capacitor} from '@capacitor/core';
import {
  confirmOnDeviceIOS,
  confirmWithIapkit,
  createPurchaseFlow,
  describePurchaseFlowStatus,
  type Purchase,
  type PurchaseFlow,
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowStatus,
} from 'capacitor-iap';
import {CONSUMABLE_PRODUCT_IDS} from './constants';
import {errorText} from './ui';

export type VerificationMethod = 'iapkit' | 'local' | 'ignore';

// Set VITE_IAPKIT_API_KEY in .env.local to verify with IAPKit.
const iapkitApiKey: string = import.meta.env.VITE_IAPKIT_API_KEY ?? '';

export const verificationMethods: VerificationMethod[] = [
  ...(iapkitApiKey ? (['iapkit'] as const) : []),
  ...(Capacitor.getPlatform() === 'ios' ? (['local'] as const) : []),
  'ignore',
];

// The selector writes it; the flow reads it for each purchase.
let verificationMethod: VerificationMethod = verificationMethods[0];

export const getVerificationMethod = (): VerificationMethod =>
  verificationMethod;

export function setVerificationMethod(method: VerificationMethod): void {
  verificationMethod = method;
  if (method === 'ignore') return;
  // Retries receipts left unfinished under None or after a failed check.
  getReceiptPurchaseFlow()
    .recoverPurchases()
    .catch((error: unknown) => console.log('Receipt recovery failed:', error));
}

// A real app keeps this set in its own store: a crash can confirm the same
// purchase again, and the flow finishes it right after the grant.
const creditedPurchaseIds = new Set<string>();

async function grant(
  purchase: Purchase,
  {isConsumable}: {isConsumable: boolean},
): Promise<void> {
  // Ownership grants everything else; only consumables are credited.
  if (!isConsumable || creditedPurchaseIds.has(purchase.id)) return;
  creditedPurchaseIds.add(purchase.id);
  console.log('Crediting', purchase.productId, purchase.id);
}

let receiptFlow: PurchaseFlow<Purchase> | null = null;

/** The app's receipt-check flow, shared by every purchase screen. */
export function getReceiptPurchaseFlow(): PurchaseFlow<Purchase> {
  receiptFlow ??= createPurchaseFlow({
    isConsumable: (productId) => CONSUMABLE_PRODUCT_IDS.includes(productId),
    confirmWithBackend: async (purchase, context) => {
      switch (verificationMethod) {
        case 'ignore':
          // Valid but not granted: the purchase stays unfinished.
          return {status: 'verified'};
        case 'local':
          return confirmOnDeviceIOS({grant})(purchase, context);
        case 'iapkit':
          return confirmWithIapkit({apiKey: iapkitApiKey, grant})(
            purchase,
            context,
          );
      }
    },
  });
  return receiptFlow;
}

const OUTCOME_COPY: Record<PurchaseFlowGuidanceKey, string> = {
  access_granted: 'Purchase verified. Access granted.',
  change_pending: 'Plan change requested.',
  access_pending:
    'Receipt retained. Choose verification to retry this receipt.',
  payment_pending: 'Payment is pending at the store.',
  verification_delayed:
    'The store has not confirmed the purchase yet. Try again later.',
  owned_by_another_account: 'This purchase belongs to another account.',
  test_purchase_not_accepted: 'Test purchases are not accepted.',
  purchase_not_valid: 'The store did not confirm this purchase.',
  try_again_later: 'Purchase verification failed.',
};

/** The status line the purchase screens show for an outcome. */
export function describePurchaseOutcome(status: PurchaseFlowStatus): string {
  if (status.status === 'failed') {
    return `Purchase verification failed: ${errorText(status.error)}`;
  }
  const text = OUTCOME_COPY[describePurchaseFlowStatus(status).key];
  return 'finishError' in status && status.finishError !== undefined
    ? `${text} finishTransaction failed: ${errorText(status.finishError)}`
    : text;
}

/** A select element bound to the verification method. */
export function verificationSelector(): HTMLSelectElement {
  const select = document.createElement('select');
  for (const method of verificationMethods) {
    select.append(
      new Option(method, method, false, method === verificationMethod),
    );
  }
  select.addEventListener('change', () =>
    setVerificationMethod(select.value as VerificationMethod),
  );
  return select;
}
