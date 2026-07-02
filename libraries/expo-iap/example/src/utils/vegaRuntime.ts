import {Alert, Platform} from 'react-native';
import Constants from 'expo-constants';
import type {
  Purchase,
  VerifyPurchaseWithProviderProps,
} from '../../../src/types';

export type IapkitVerificationPayload = NonNullable<
  VerifyPurchaseWithProviderProps['iapkit']
> & {
  baseUrl?: string | null;
};

type ExpoExtraWithIapkit = {
  iapkitApiKey?: string;
  iapkitBaseUrl?: string;
};

export type VerificationMethod = 'ignore' | 'local' | 'iapkit';

function getConfiguredIapkitApiKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitApiKey ?? process.env.EXPO_PUBLIC_IAPKIT_API_KEY;
}

function getConfiguredIapkitBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExpoExtraWithIapkit | undefined;
  return extra?.iapkitBaseUrl ?? process.env.EXPO_PUBLIC_IAPKIT_BASE_URL;
}

export function getDefaultVerificationMethod(): VerificationMethod {
  return getConfiguredIapkitApiKey()?.trim() ? 'iapkit' : 'ignore';
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

export function createIapkitVerificationPayload(
  purchase: Purchase,
  purchaseToken: string,
  baseUrl: string | null | undefined = getConfiguredIapkitBaseUrl(),
): IapkitVerificationPayload {
  const apiKey = getConfiguredIapkitApiKey()?.trim();
  const purchaseStore = (
    (purchase as Purchase & {store?: string | null}).store ?? ''
  ).toLowerCase();
  if (purchaseStore === 'amazon') {
    return withIapkitEndpoint(
      {
        ...(apiKey ? {apiKey} : {}),
        amazon: {
          receiptId: purchaseToken,
          sandbox: __DEV__,
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
          ...(apiKey ? {apiKey} : {}),
          apple: {
            jws: purchaseToken,
          },
        }
      : {
          ...(apiKey ? {apiKey} : {}),
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
