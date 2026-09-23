import {
  requireNativeModule,
  UnavailabilityError,
  type EventSubscription,
} from 'expo-modules-core';
import {installedFromOnside} from './onside';
import type {
  BillingProgramAndroid,
  BillingProgramReportingDetailsAndroid,
  DeveloperBillingTypeAndroid,
  Mutation,
  MutationField,
  ProductQueryType,
  PurchaseInput,
  PurchaseOptions,
  PurchaseUpdatedListenerOptions,
  Query,
  QueryField,
  SubscriptionStatusIOS,
} from './types';
import {getVegaIapModule, isVegaOS} from './vega';

type NativeIapModuleName = 'ExpoIapVega' | 'ExpoIapOnside' | 'ExpoIap';
const ONSIDE_MARKETPLACE_ID = 'com.onside.marketplace-app';

/** Members read from the raw module; every store module provides them. */
type NativeEventModule = {
  ERROR_CODES?: Record<string, unknown>;
  addListener<T>(
    eventName: string,
    listener: (payload: T) => void,
  ): EventSubscription | undefined;
  removeListener?<T>(eventName: string, listener: (payload: T) => void): void;
  setPurchaseUpdatedListenerOptions?(
    options?: PurchaseUpdatedListenerOptions | null,
  ): Promise<void>;
};

type QueryFields<K extends keyof Query> = {[P in K]: QueryField<P>};
type MutationFields<K extends keyof Mutation> = {[P in K]: MutationField<P>};

/**
 * Native surface behind the default export. Results the wrappers decode stay
 * `unknown`; the rest match the generated operation signatures.
 */
export type ExpoIapNativeModule = NativeEventModule &
  QueryFields<
    | 'canPresentExternalPurchaseNoticeIOS'
    | 'currentEntitlementIOS'
    | 'getActiveSubscriptions'
    | 'getAppTransactionIOS'
    | 'getBillingChoiceInfoAndroid'
    | 'getExternalPurchaseCustomLinkTokenIOS'
    | 'getPromotedProductIOS'
    | 'getReceiptDataIOS'
    | 'getTransactionJwsIOS'
    | 'hasActiveSubscriptions'
    | 'isEligibleForExternalPurchaseCustomLinkIOS'
    | 'isEligibleForIntroOfferIOS'
    | 'isTransactionVerifiedIOS'
    | 'latestTransactionIOS'
  > &
  MutationFields<
    | 'beginRefundRequestIOS'
    | 'clearTransactionIOS'
    | 'endConnection'
    | 'initConnection'
    | 'isBillingProgramAvailableAndroid'
    | 'launchExternalLinkAndroid'
    | 'openRedeemOfferCodeAndroid'
    | 'presentCodeRedemptionSheetIOS'
    | 'presentExternalPurchaseLinkIOS'
    | 'presentExternalPurchaseNoticeSheetIOS'
    | 'showBillingProgramInformationDialogAndroid'
    | 'showExternalPurchaseCustomLinkNoticeIOS'
    | 'showInAppMessagesAndroid'
    | 'syncIOS'
    | 'verifyPurchase'
    | 'verifyPurchaseWithProvider'
  > & {
    USING_ONSIDE_SDK: boolean;
    USING_VEGA_SDK: boolean;
    fetchProducts(request: {
      skus: string[];
      type: ProductQueryType;
    }): Promise<unknown[]>;
    fetchProducts(type: ProductQueryType, skus: string[]): Promise<unknown[]>;
    getAvailableItems(
      alsoPublishToEventListenerIOS: boolean,
      onlyIncludeActiveItemsIOS: boolean,
    ): Promise<unknown>;
    getAvailableItems(options: PurchaseOptions): Promise<unknown>;
    getAllTransactionsIOS(): Promise<unknown>;
    getPendingTransactionsIOS(): Promise<unknown>;
    showManageSubscriptionsIOS(): Promise<unknown>;
    requestPurchase(request: object): Promise<unknown>;
    finishTransaction(
      purchase: PurchaseInput,
      isConsumable: boolean | null,
    ): Promise<boolean>;
    acknowledgePurchaseAndroid(purchaseToken: string): Promise<unknown>;
    consumePurchaseAndroid(purchaseToken: string): Promise<unknown>;
    createBillingProgramReportingDetailsAndroid(
      program: BillingProgramAndroid,
      developerBillingType: DeveloperBillingTypeAndroid | null,
    ): Promise<BillingProgramReportingDetailsAndroid>;
    subscriptionStatusIOS(sku: string): Promise<SubscriptionStatusIOS[] | null>;
    requestReceiptRefreshIOS(): Promise<string>;
    deepLinkToSubscriptionsAndroid?(options: {
      skuAndroid?: string;
      packageNameAndroid?: string;
    }): Promise<void> | void;
    getStorefront?(): Promise<string> | string;
    restorePurchases?(): Promise<boolean>;
  };

type ResolvedNativeModule = {
  module: NativeEventModule;
  name: NativeIapModuleName;
};

let cached: ResolvedNativeModule | null = null;
let onsideModuleUnavailable = false;

function getResolved(): ResolvedNativeModule {
  function shouldUseOnsideModule(): boolean {
    if (installedFromOnside === true) {
      return true;
    }

    if (typeof installedFromOnside !== 'string') {
      return false;
    }

    const normalized = installedFromOnside.trim().toLowerCase();
    return normalized === 'true' || normalized === ONSIDE_MARKETPLACE_ID;
  }

  function getExpectedModuleName(): NativeIapModuleName {
    if (isVegaOS()) {
      return 'ExpoIapVega';
    }

    return shouldUseOnsideModule() ? 'ExpoIapOnside' : 'ExpoIap';
  }

  function resolveNativeModule(): ResolvedNativeModule {
    if (isVegaOS()) {
      const vegaModule = getVegaIapModule();
      if (!vegaModule) {
        throw new UnavailabilityError(
          'expo-iap',
          'Amazon Vega IAP module is unavailable. Install @amazon-devices/keplerscript-appstore-iap-lib in the Vega app target and build with the React Native for Vega kepler platform.',
        );
      }
      return {module: vegaModule, name: 'ExpoIapVega'};
    }

    if (shouldUseOnsideModule()) {
      if (onsideModuleUnavailable) {
        throw new UnavailabilityError(
          'expo-iap',
          'The Onside marketplace build does not contain ExpoIapOnside. Rebuild with ios.onside.enabled instead of routing purchases through Apple StoreKit.',
        );
      }
      try {
        return {
          module: requireNativeModule<NativeEventModule>('ExpoIapOnside'),
          name: 'ExpoIapOnside',
        };
      } catch (error) {
        if (!isMissingModuleError(error, 'ExpoIapOnside')) {
          throw error;
        }
        onsideModuleUnavailable = true;
        throw new UnavailabilityError(
          'expo-iap',
          'The Onside marketplace build does not contain ExpoIapOnside. Rebuild with ios.onside.enabled instead of routing purchases through Apple StoreKit.',
        );
      }
    }

    return {
      module: requireNativeModule<NativeEventModule>('ExpoIap'),
      name: 'ExpoIap',
    };
  }

  const expectedName = getExpectedModuleName();
  if (!cached || cached.name !== expectedName) {
    cached = resolveNativeModule();
  }
  return cached;
}

function isMissingModuleError(error: unknown, moduleName: string): boolean {
  if (error instanceof UnavailabilityError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes(`Cannot find native module '${moduleName}'`);
  }

  return false;
}

export const NATIVE_ERROR_CODES: Record<string, unknown> = new Proxy(
  {} as Record<string, unknown>,
  {
    get(target, prop) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop);
      const errorCodes: Record<string, unknown> =
        getResolved().module.ERROR_CODES || {};
      return errorCodes[prop];
    },
  },
);

/**
 * Returns the raw native module (not wrapped in a Proxy).
 * Use this for EventEmitter / addListener calls — JSI HostObjects
 * require the real native module as `this`; a Proxy triggers
 * "native state unsupported on Proxy" on New Architecture / Hermes.
 */
export function getNativeModule(): NativeEventModule {
  return getResolved().module;
}

// The Proxy forwards every member to the lazily resolved store module.
export default new Proxy({} as ExpoIapNativeModule, {
  get(target, prop) {
    if (typeof prop === 'symbol') return Reflect.get(target, prop);
    const resolved = getResolved();
    if (prop === 'USING_ONSIDE_SDK') {
      return resolved.name === 'ExpoIapOnside';
    }
    if (prop === 'USING_VEGA_SDK') {
      return resolved.name === 'ExpoIapVega';
    }

    const value: unknown = Reflect.get(resolved.module, prop);
    if (value !== undefined || resolved.name !== 'ExpoIapOnside') {
      return value;
    }

    return () => {
      throw new UnavailabilityError(
        'expo-iap',
        `The Onside marketplace does not support ${String(
          prop,
        )}. The call was not routed through Apple StoreKit.`,
      );
    };
  },
});
