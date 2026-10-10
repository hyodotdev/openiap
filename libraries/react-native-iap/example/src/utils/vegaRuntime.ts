import {Alert, Platform} from 'react-native';
import amazonCatalog from '../../amazon.sdktester.json';
import type {
  Purchase,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from 'react-native-iap';

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

export function getSubscriptionQueryIds(productIds: string[]): string[] {
  return [
    ...new Set(
      productIds.flatMap((productId) => {
        const base = catalog[productId]?.subscriptionBase;
        return base ? [productId, base] : [productId];
      }),
    ),
  ];
}

function getAmazonVerificationProductId(productId: string): string {
  const item = catalog[productId];
  return item?.itemType === 'SUBSCRIPTION'
    ? (item.subscriptionBase ?? item.subscriptionParent ?? productId)
    : productId;
}

export type IapkitVerificationPayload = NonNullable<
  VerifyPurchaseWithProviderProps['iapkit']
>;

function withIapkitEndpoint(
  payload: IapkitVerificationPayload,
  baseUrl?: string | null,
): IapkitVerificationPayload {
  const trimmedBaseUrl = baseUrl?.trim();
  if (!trimmedBaseUrl) {
    return payload;
  }
  return {
    ...payload,
    baseUrl: trimmedBaseUrl,
  };
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

// This example explicitly adapts the educational provider to Amazon RVS.
function verificationStore(
  store: Purchase['store'],
  storeId?: string,
): Purchase['store'] {
  return store === 'unknown' && storeId === 'amazon_example' ? 'amazon' : store;
}

function isIapkitStateReadyForFulfillment(
  verified: NonNullable<VerifyPurchaseWithProviderResult['iapkit']>,
  isConsumable: boolean,
): boolean {
  switch (verificationStore(verified.store, verified.storeId)) {
    case 'apple':
    case 'amazon':
      return (
        verified.state === (isConsumable ? 'ready-to-consume' : 'entitled')
      );
    case 'google':
      return (
        verified.state === 'entitled' ||
        verified.state === 'pending-acknowledgment' ||
        (isConsumable && verified.state === 'ready-to-consume')
      );
    case 'horizon':
      return verified.state === 'entitled';
    default:
      return false;
  }
}

export function getIapkitVerificationError(
  result: VerifyPurchaseWithProviderResult,
  expectedProductId: string,
  isConsumable: boolean,
  amazonRvsSandbox: boolean,
  expectedStore: Purchase['store'],
  expectedStoreId?: string,
  expectedEnvironment?: string | null,
): string | null {
  const verified = result.iapkit;
  if (!verified) {
    const providerErrors = result.errors
      ?.map((error) =>
        error.code ? `[${error.code}] ${error.message}` : error.message,
      )
      .filter(Boolean);
    return providerErrors?.length
      ? providerErrors.join('\n')
      : 'IAPKit did not return a verification result';
  }

  if (!verified.isValid) {
    return `IAPKit rejected the purchase (state: ${verified.state}, store: ${verified.store})`;
  }

  if (!verified.productId) {
    return `IAPKit did not return a product ID for ${verified.store}`;
  }

  if (verified.store !== expectedStore) {
    return `IAPKit verified ${verified.store}, expected ${expectedStore}`;
  }

  if (
    (expectedStore === 'unknown' && !expectedStoreId) ||
    (expectedStoreId && verified.storeId !== expectedStoreId)
  ) {
    return 'IAPKit changed or omitted the expected provider identity';
  }
  if (
    expectedStore === 'apple' &&
    expectedEnvironment != null &&
    verified.environment !== expectedEnvironment
  ) {
    return `IAPKit verified Apple in ${verified.environment ?? 'an unknown environment'}, expected ${expectedEnvironment}`;
  }
  const store = verificationStore(verified.store, verified.storeId);

  const verificationProductId =
    store === 'amazon'
      ? getAmazonVerificationProductId(expectedProductId)
      : expectedProductId;
  if (verified.productId !== verificationProductId) {
    return `IAPKit verified ${verified.productId}, expected ${verificationProductId}`;
  }

  if (store === 'amazon') {
    const expectedEnvironment = amazonRvsSandbox ? 'Sandbox' : 'Production';
    if (verified.environment !== expectedEnvironment) {
      return `IAPKit verified Amazon in ${
        verified.environment ?? 'an unknown environment'
      }, expected ${expectedEnvironment}`;
    }
  }

  if (!isIapkitStateReadyForFulfillment(verified, isConsumable)) {
    return `IAPKit state ${verified.state} cannot fulfill this ${
      isConsumable ? 'consumable' : 'non-consumable'
    } ${verified.store} purchase`;
  }

  return null;
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

export function rememberCompletedPurchaseKey(
  completedKeys: Set<string>,
  key: string,
  maxSize = 100,
): void {
  completedKeys.delete(key);
  completedKeys.add(key);

  while (completedKeys.size > maxSize) {
    const oldestKey = completedKeys.values().next().value;
    if (typeof oldestKey !== 'string') break;
    completedKeys.delete(oldestKey);
  }
}

export function createIapkitVerificationPayload(
  purchase: Purchase,
  purchaseToken: string,
  apiKey: string,
  amazonRvsSandbox: boolean,
  baseUrl?: string | null,
): IapkitVerificationPayload {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error('IAPKIT_API_KEY not configured');
  }

  const purchaseStore = (
    (purchase as Purchase & {store?: string | null}).store ?? ''
  ).toLowerCase();
  if (
    purchaseStore === 'amazon' ||
    (purchaseStore === 'unknown' && purchase.storeId === 'amazon_example')
  ) {
    return withIapkitEndpoint(
      {
        apiKey: trimmedApiKey,
        amazon: {
          expectedProductId: getAmazonVerificationProductId(purchase.productId),
          receiptId: purchaseToken,
          sandbox: amazonRvsSandbox,
        },
      },
      baseUrl,
    );
  }
  if (purchaseStore === 'unknown') {
    throw new Error(
      `No verification adapter configured for ${purchase.storeId}`,
    );
  }
  if (purchaseStore === 'horizon') {
    return withIapkitEndpoint(
      {
        apiKey: trimmedApiKey,
        horizon: {sku: purchase.productId},
      },
      baseUrl,
    );
  }

  const isApplePurchase =
    purchaseStore === 'apple' || (!purchaseStore && Platform.OS === 'ios');

  return withIapkitEndpoint(
    isApplePurchase
      ? {
          apiKey: trimmedApiKey,
          apple: {
            jws: purchaseToken,
          },
        }
      : {
          apiKey: trimmedApiKey,
          google: {
            purchaseToken,
          },
        },
    baseUrl,
  );
}

export function getPurchaseCleanupKey(purchase: Purchase): string {
  return (
    purchase.purchaseToken ??
    purchase.id ??
    purchase.productId ??
    `${purchase.transactionDate ?? Date.now()}`
  );
}
