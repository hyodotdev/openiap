import {Alert} from 'react-native';
import amazonCatalog from '../../amazon.sdktester.json';
import type {Purchase} from 'react-native-iap';

const catalog: Readonly<
  Record<
    string,
    {
      itemType: string;
      subscriptionBase?: string;
      subscriptionParent?: string;
    }
  >
> = amazonCatalog;

export function getSubscriptionProductId(
  productId: string,
  currentPlanId?: string | null,
  store?: Purchase['store'],
  storeId?: string,
): string | undefined {
  if (catalog[productId]?.itemType === 'SUBSCRIPTION') return productId;
  if (
    store !== undefined &&
    store !== 'amazon' &&
    !(store === 'unknown' && storeId === 'amazon_example')
  )
    return undefined;
  const term = currentPlanId ? catalog[currentPlanId] : undefined;
  return term?.itemType === 'SUBSCRIPTION' &&
    productId === term.subscriptionBase
    ? (currentPlanId ?? undefined)
    : undefined;
}

/** Amazon RVS reports a subscription term under its catalog base SKU. */
export function getAmazonVerificationProductId(productId: string): string {
  const item = catalog[productId];
  return item?.itemType === 'SUBSCRIPTION'
    ? (item.subscriptionBase ?? item.subscriptionParent ?? productId)
    : productId;
}

export function resolveIapkitVerificationBaseUrl(
  method: 'iapkit-localhost' | 'iapkit',
  configuredBaseUrl?: string | null,
): string | undefined {
  if (method === 'iapkit') {
    return undefined;
  }

  const baseUrl = configuredBaseUrl?.trim();
  if (!baseUrl) {
    throw new Error(
      'IAPKIT_BASE_URL not configured for Local (IAPKit) verification',
    );
  }

  return baseUrl;
}

export function showNativeAlert(title: string, message?: string): void {
  const shouldSuppressAlerts = Boolean(
    (globalThis as {RN_IAP_SUPPRESS_NATIVE_ALERTS?: boolean})
      .RN_IAP_SUPPRESS_NATIVE_ALERTS,
  );
  if (!shouldSuppressAlerts) {
    Alert.alert(title, message);
  }
}

export function matchesVerifiedPendingPurchase(
  purchase: Purchase,
  pending: Purchase[],
): boolean {
  return (
    purchase.store === 'apple' &&
    purchase.storeId === 'apple' &&
    !!purchase.id &&
    pending.some(
      (candidate) =>
        candidate.store === 'apple' &&
        candidate.storeId === 'apple' &&
        candidate.id === purchase.id &&
        candidate.productId === purchase.productId &&
        !(
          'revocationDateIOS' in candidate &&
          candidate.revocationDateIOS != null
        ) &&
        !('isUpgradedIOS' in candidate && candidate.isUpgradedIOS === true) &&
        (!('expirationDateIOS' in candidate) ||
          candidate.expirationDateIOS == null ||
          candidate.expirationDateIOS > Date.now()) &&
        (!('environmentIOS' in purchase) ||
          purchase.environmentIOS == null ||
          ('environmentIOS' in candidate &&
            candidate.environmentIOS === purchase.environmentIOS)),
    )
  );
}
