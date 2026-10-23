import {
  confirmWithIapkit,
  createPurchaseFlow,
  describePurchaseFlowStatus,
  ErrorCode,
  confirmOnDeviceIOS,
  type Purchase,
  type PurchaseFlow,
  type PurchaseFlowGuidanceKey,
  type PurchaseFlowStatus,
} from 'expo-iap';
import {CONSUMABLE_PRODUCT_IDS} from './constants';
import {formatErrorForDisplay} from './errorUtils';
import {
  getAmazonVerificationProductId,
  getDefaultVerificationMethod,
  isAmazonRvsSandboxEnabled,
  resolveIapkitVerificationBaseUrl,
  showNativeAlert,
  type VerificationMethod,
} from './vegaRuntime';

// The selector writes it; the flow reads it for each purchase.
let verificationMethod = getDefaultVerificationMethod();

export function getVerificationMethod(): VerificationMethod {
  return verificationMethod;
}

export function setVerificationMethod(method: VerificationMethod): void {
  verificationMethod = method;
  if (method === 'ignore') return;
  // Retries receipts left unfinished under None or after a failed check.
  getReceiptPurchaseFlow()
    .recoverPurchases()
    .catch((error: unknown) => {
      console.log('[purchaseFlow] Receipt recovery failed:', error);
    });
}

// A real app keeps this set in its own store: a crash can confirm the same
// purchase again, and the flow finishes it right after the grant.
const creditedPurchaseIds = new Set<string>();

async function grant(purchase: Purchase): Promise<void> {
  if (creditedPurchaseIds.has(purchase.id)) {
    console.log('[purchaseFlow] Already credited', purchase.id);
    return;
  }
  creditedPurchaseIds.add(purchase.id);
  console.log('[purchaseFlow] Crediting', purchase.productId, purchase.id);
}

let receiptFlow: PurchaseFlow<Purchase> | null = null;

/** The app's receipt-check flow, shared by every purchase screen. */
export function getReceiptPurchaseFlow(): PurchaseFlow<Purchase> {
  receiptFlow ??= createPurchaseFlow({
    isConsumable: (productId) => CONSUMABLE_PRODUCT_IDS.includes(productId),
    confirmWithBackend: async (purchase, context) => {
      const method = verificationMethod;
      switch (method) {
        case 'ignore':
          // Valid but not granted: the purchase stays unfinished.
          return {status: 'verified'};
        case 'local':
          return confirmOnDeviceIOS({grant})(purchase, context);
        default:
          // The SDK reads the publishable key from the iapkitApiKey config.
          return confirmWithIapkit({
            baseUrl: resolveIapkitVerificationBaseUrl(method),
            amazon: {
              sandbox: isAmazonRvsSandboxEnabled(),
              verifiedProductId: getAmazonVerificationProductId,
            },
            // The educational amazon_example provider carries Amazon receipts.
            verifyAs: ({store, storeId}) =>
              store === 'unknown' && storeId === 'amazon_example'
                ? 'amazon'
                : undefined,
            grant,
          })(purchase, context);
      }
    },
  });
  return receiptFlow;
}

/** Only one flow may confirm purchases: the app-backend path stops this one. */
export function disposeReceiptPurchaseFlow(): void {
  receiptFlow?.dispose();
  receiptFlow = null;
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
    return `Purchase verification failed: ${formatErrorForDisplay(
      status.error,
      ErrorCode.PurchaseVerificationFailed,
    )}`;
  }
  const text = OUTCOME_COPY[describePurchaseFlowStatus(status).key];
  return 'finishError' in status && status.finishError !== undefined
    ? `${text} finishTransaction failed: ${formatErrorForDisplay(
        status.finishError,
        ErrorCode.PurchaseVerificationFinishFailed,
      )}`
    : text;
}

/** The alert the purchase screens show for an outcome, if any. */
export function alertPurchaseOutcome(status: PurchaseFlowStatus): void {
  if (status.status === 'failed') {
    showNativeAlert('Verification Failed', describePurchaseOutcome(status));
  } else if ('finishError' in status && status.finishError !== undefined) {
    showNativeAlert(
      'Finish Transaction Failed',
      formatErrorForDisplay(
        status.finishError,
        ErrorCode.PurchaseVerificationFinishFailed,
      ),
    );
  } else if (describePurchaseFlowStatus(status).key === 'access_granted') {
    showNativeAlert('Success', 'Purchase completed successfully!');
  }
}
