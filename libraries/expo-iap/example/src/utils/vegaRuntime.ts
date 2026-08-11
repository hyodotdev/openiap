import {Alert, Platform} from 'react-native';
import Constants from 'expo-constants';
import type {
  Purchase,
  VerifyPurchaseResult,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from '../../../src/types';

export type IapkitVerificationPayload = NonNullable<
  VerifyPurchaseWithProviderProps['iapkit']
>;

type ExpoExtraWithIapkit = {
  amazonRvsSandbox?: string;
  iapkitApiKey?: string;
  iapkitBaseUrl?: string;
};

export type VerificationMethod =
  | 'ignore'
  | 'local'
  | 'iapkit-localhost'
  | 'iapkit';

function getConfiguredIapkitApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitApiKey ?? process.env.EXPO_PUBLIC_IAPKIT_API_KEY;
}

function getConfiguredIapkitBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitBaseUrl ?? process.env.EXPO_PUBLIC_IAPKIT_BASE_URL;
}

function isAmazonRvsSandboxEnabled(): boolean {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  const configuredValue =
    extra?.amazonRvsSandbox ?? process.env.EXPO_PUBLIC_AMAZON_RVS_SANDBOX;
  return configuredValue === 'true';
}

export function getDefaultVerificationMethod(
  apiKey: string | null | undefined = getConfiguredIapkitApiKey(),
  baseUrl: string | null | undefined = getConfiguredIapkitBaseUrl(),
): VerificationMethod {
  if (!apiKey?.trim()) {
    return 'ignore';
  }

  return baseUrl?.trim() ? 'iapkit-localhost' : 'iapkit';
}

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
  configuredBaseUrl: string | null | undefined = getConfiguredIapkitBaseUrl(),
): string | undefined {
  if (method === 'iapkit') {
    return undefined;
  }

  const baseUrl = configuredBaseUrl?.trim();
  if (!baseUrl) {
    throw new Error(
      'EXPO_PUBLIC_IAPKIT_BASE_URL not configured for Local (IAPKit) verification',
    );
  }

  return baseUrl;
}

export type TvRemoteEvent = {
  eventKeyAction?: number;
  eventType?: string;
};

export function isVegaTvShortcutEnabled(): boolean {
  return Boolean(
    (globalThis as {EXPO_IAP_ENABLE_TV_SHORTCUTS?: boolean})
      .EXPO_IAP_ENABLE_TV_SHORTCUTS,
  );
}

export function isTvKeyRelease(event: TvRemoteEvent): boolean {
  return event.eventKeyAction === undefined || event.eventKeyAction === 1;
}

export function showNativeAlert(title: string, message?: string): void {
  const shouldSuppressAlerts = Boolean(
    (globalThis as {EXPO_IAP_SUPPRESS_NATIVE_ALERTS?: boolean})
      .EXPO_IAP_SUPPRESS_NATIVE_ALERTS,
  );
  if (!shouldSuppressAlerts) {
    Alert.alert(title, message);
  }
}

function isIapkitStateReadyForFulfillment(
  verified: NonNullable<VerifyPurchaseWithProviderResult['iapkit']>,
  isConsumable: boolean,
): boolean {
  switch (verified.store) {
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
    default:
      return false;
  }
}

export function getIapkitVerificationError(
  result: VerifyPurchaseWithProviderResult,
  expectedProductId: string,
  isConsumable: boolean,
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

  if (verified.productId !== expectedProductId) {
    return `IAPKit verified ${verified.productId}, expected ${expectedProductId}`;
  }

  if (verified.store === 'amazon') {
    const expectedEnvironment = isAmazonRvsSandboxEnabled()
      ? 'Sandbox'
      : 'Production';
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

export function getDirectVerificationError(
  result: VerifyPurchaseResult,
): string | null {
  if ('isValid' in result && result.isValid === false) {
    return 'Store verification returned an invalid receipt';
  }
  if ('success' in result && result.success === false) {
    return 'Store verification rejected the entitlement';
  }
  return null;
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
  baseUrl?: string | null,
): IapkitVerificationPayload {
  const apiKey = getConfiguredIapkitApiKey()?.trim();
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_IAPKIT_API_KEY not configured');
  }

  const purchaseStore = (
    (purchase as Purchase & {store?: string | null}).store ?? ''
  ).toLowerCase();
  if (purchaseStore === 'amazon') {
    return withIapkitEndpoint(
      {
        apiKey,
        amazon: {
          expectedProductId: purchase.productId,
          receiptId: purchaseToken,
          sandbox: isAmazonRvsSandboxEnabled(),
        },
      },
      baseUrl,
    );
  }

  const isApplePurchase =
    purchaseStore === 'apple' || (!purchaseStore && Platform.OS === 'ios');

  return withIapkitEndpoint(
    isApplePurchase
      ? {
          apiKey,
          apple: {
            jws: purchaseToken,
          },
        }
      : {
          apiKey,
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
