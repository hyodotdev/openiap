import {Alert} from 'react-native';
import amazonCatalog from '../../amazon.sdktester.json';
import Constants from 'expo-constants';
import type {Purchase} from 'expo-iap';

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
    ? currentPlanId ?? undefined
    : undefined;
}

/** Amazon RVS reports a subscription term under its catalog base SKU. */
export function getAmazonVerificationProductId(productId: string): string {
  const item = catalog[productId];
  return item?.itemType === 'SUBSCRIPTION'
    ? item.subscriptionBase ?? item.subscriptionParent ?? productId
    : productId;
}

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

export function getConfiguredIapkitApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitApiKey ?? process.env.EXPO_PUBLIC_IAPKIT_API_KEY;
}

function getConfiguredIapkitBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitBaseUrl ?? process.env.EXPO_PUBLIC_IAPKIT_BASE_URL;
}

export function isAmazonRvsSandboxEnabled(): boolean {
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
