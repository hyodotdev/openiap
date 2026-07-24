import {getVegaIapModule} from './vega';
import {ErrorCode} from './types';
import type {
  MutationField,
  ProductQueryType,
  ProductRequest,
  Purchase,
  PurchaseError,
  PurchaseOptions,
  PurchaseUpdatedListenerOptions,
  QueryField,
  RequestPurchasePropsByPlatforms,
  RequestSubscriptionPropsByPlatforms,
} from './types';
import {warnLegacyOnce} from './utils/deprecation';

export * from './types';
export * from './vega';
export * from './useIAP';
export {kitApi, KitApiError} from './kit-api';
export type {
  EntitlementsResponse,
  KitApiOptions,
  KitClientPayloadResponse,
  KitProduct,
  KitProductClientPayload,
  KitProductOffer,
  KitProductPlatform,
  KitProductsOptions,
  KitProductsResponse,
  KitSubscription,
  StatusResponse,
} from './kit-api';
export {connectWebhookStream, parseWebhookEventData} from './webhook-client';

export enum OpenIapEvent {
  PurchaseUpdated = 'purchase-updated',
  PurchaseError = 'purchase-error',
  PromotedProductIOS = 'promoted-product-ios',
  UserChoiceBillingAndroid = 'user-choice-billing-android',
  DeveloperProvidedBillingAndroid = 'developer-provided-billing-android',
  SubscriptionBillingIssue = 'subscription-billing-issue',
}

/**
 * Product type accepted by the Amazon Vega entry point.
 *
 * Compatibility note: the `'inapp'` member is deprecated. Use `'in-app'`
 * instead; the alias will be removed in expo-iap 5.0.0.
 */
export type ProductTypeInput = ProductQueryType | 'inapp';

const LEGACY_INAPP_WARNING =
  "'inapp' product type is deprecated and will be removed in expo-iap 5.0.0. Use 'in-app' instead.";

export interface EventSubscription {
  remove(): void;
}

const getModule = () => {
  const module = getVegaIapModule();
  if (!module) {
    throw new Error(
      'Amazon Vega IAP module is unavailable. Install @amazon-devices/keplerscript-appstore-iap-lib in the Vega app target and build with the React Native for Vega kepler platform.',
    );
  }
  return module;
};

const unsupported = (feature: string): never => {
  throw new Error(`${feature} is not supported on Amazon Vega.`);
};

const normalizeProductType = (
  type?: ProductTypeInput | null,
): ProductQueryType => {
  if (type === 'subs' || type === 'all') return type;
  if (type === 'inapp') {
    warnLegacyOnce('product-type.inapp', LEGACY_INAPP_WARNING);
  }
  return 'in-app';
};

const normalizePurchaseArray = (purchases: Purchase[]): Purchase[] =>
  purchases.map((purchase) => {
    const platform = String(purchase.platform).toLowerCase();
    if (platform === purchase.platform) return purchase;
    if (platform === 'android' || platform === 'ios') {
      return {...purchase, platform};
    }
    return purchase;
  });

const getAndroidRequest = (
  request?:
    | RequestPurchasePropsByPlatforms
    | RequestSubscriptionPropsByPlatforms
    | null,
) => {
  if (
    request != null &&
    Object.prototype.hasOwnProperty.call(request, 'google')
  ) {
    return request.google;
  }
  if (
    request != null &&
    Object.prototype.hasOwnProperty.call(request, 'android')
  ) {
    warnLegacyOnce(
      'request-purchase.android',
      '`request.android` is deprecated and will be removed in expo-iap 5.0.0. Use `request.google` instead.',
    );
    return request.android;
  }
  return undefined;
};

const createPurchaseTokenError = (purchase: Purchase): Error => {
  const error = new Error(
    'Purchase token is required to finish Amazon Vega transaction',
  ) as Error & PurchaseError;
  error.code = ErrorCode.DeveloperError;
  error.productId = purchase.productId;
  return error;
};

export const emitter = {
  addListener(
    eventName: OpenIapEvent,
    listener: (payload: Purchase | PurchaseError) => void,
  ): EventSubscription {
    return getModule().addListener(eventName, listener);
  },
  removeListener(
    eventName: OpenIapEvent,
    listener: (payload: Purchase | PurchaseError) => void,
  ): void {
    return getModule().removeListener(eventName, listener);
  },
};

export const purchaseUpdatedListener = (
  listener: (event: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
): EventSubscription => {
  return getModule().addListener(OpenIapEvent.PurchaseUpdated, (purchase) => {
    listener(purchase as Purchase);
  });
};

export const purchaseErrorListener = (
  listener: (error: PurchaseError) => void,
): EventSubscription => {
  return getModule().addListener(OpenIapEvent.PurchaseError, (error) => {
    listener(error as PurchaseError);
  });
};

export const initConnection: MutationField<'initConnection'> = async (
  config,
) => {
  return getModule().initConnection(config ?? null);
};

export const endConnection: MutationField<'endConnection'> = async () => {
  return getModule().endConnection();
};

export const fetchProducts = async (
  request: Omit<ProductRequest, 'type'> & {
    type?: ProductTypeInput | null;
  },
): ReturnType<QueryField<'fetchProducts'>> => {
  const {skus, type} = request;
  return getModule().fetchProducts(normalizeProductType(type), skus);
};

export const requestPurchase: MutationField<'requestPurchase'> = async (
  args,
) => {
  const androidRequest = getAndroidRequest(args.request);
  if (!androidRequest?.skus?.length) {
    throw new Error(
      'Invalid request for Amazon Vega. The `request.google.skus` or `request.android.skus` property is required and must be a non-empty array.',
    );
  }

  return normalizePurchaseArray(
    await getModule().requestPurchase({
      skuArr: androidRequest.skus,
      type: normalizeProductType(args.type),
    }),
  );
};

export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  return normalizePurchaseArray(
    await getModule().getAvailableItems((options ?? {}) as PurchaseOptions),
  );
};

export const finishTransaction: MutationField<'finishTransaction'> = async ({
  purchase,
  isConsumable = false,
}) => {
  const token = purchase.purchaseToken ?? undefined;
  if (!token) {
    throw createPurchaseTokenError(purchase);
  }

  if (isConsumable) {
    await getModule().consumePurchaseAndroid(token);
    return;
  }

  await getModule().acknowledgePurchaseAndroid(token);
};

export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  await getAvailablePurchases({
    includeSuspendedAndroid: false,
  });
};

export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (subscriptionIds) => {
  return getModule().getActiveSubscriptions(subscriptionIds ?? null);
};

export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (subscriptionIds) => {
  return getModule().hasActiveSubscriptions(subscriptionIds ?? null);
};

export const getStorefront: QueryField<'getStorefront'> = async () => {
  return getModule().getStorefront();
};

export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (options) => {
  return getModule().verifyPurchaseWithProvider(options);
};

/**
 * @deprecated Use `verifyPurchase` instead. This compatibility operation will
 * be removed in expo-iap 5.0.0.
 */
export const validateReceipt: MutationField<'validateReceipt'> = async () =>
  unsupported('validateReceipt');

export const verifyPurchase: MutationField<'verifyPurchase'> = validateReceipt;

export const acknowledgePurchaseAndroid: MutationField<
  'acknowledgePurchaseAndroid'
> = async (purchaseToken) => {
  await getModule().acknowledgePurchaseAndroid(purchaseToken);
  return true;
};

export const consumePurchaseAndroid: MutationField<
  'consumePurchaseAndroid'
> = async (purchaseToken) => {
  await getModule().consumePurchaseAndroid(purchaseToken);
  return true;
};

/**
 * @deprecated Use `acknowledgePurchaseAndroid` instead. This alias will be
 * removed in expo-iap 5.0.0.
 */
export const acknowledgePurchase = acknowledgePurchaseAndroid;

/**
 * @deprecated Use `consumePurchaseAndroid` instead. This alias will be removed
 * in expo-iap 5.0.0.
 */
export const consumePurchase = consumePurchaseAndroid;

export const syncIOS: MutationField<'syncIOS'> = async () =>
  unsupported('syncIOS');
export const getAppTransactionIOS: QueryField<
  'getAppTransactionIOS'
> = async () => null;
export const getPromotedProductIOS: QueryField<
  'getPromotedProductIOS'
> = async () => null;

/**
 * @deprecated Use `promotedProductListenerIOS` followed by `requestPurchase`
 * instead. This compatibility operation will be removed in expo-iap 5.0.0.
 */
export const requestPurchaseOnPromotedProductIOS = async (): Promise<boolean> =>
  unsupported('requestPurchaseOnPromotedProductIOS');
export const showManageSubscriptionsIOS: MutationField<
  'showManageSubscriptionsIOS'
> = async () => [];
export const presentCodeRedemptionSheetIOS: MutationField<
  'presentCodeRedemptionSheetIOS'
> = async () => false;
export const presentExternalPurchaseLinkIOS: MutationField<
  'presentExternalPurchaseLinkIOS'
> = async () => unsupported('presentExternalPurchaseLinkIOS');

export const deepLinkToSubscriptions: MutationField<
  'deepLinkToSubscriptions'
> = async () => unsupported('deepLinkToSubscriptions');
export const openRedeemOfferCodeAndroid: MutationField<
  'openRedeemOfferCodeAndroid'
> = async () => false;

export const promotedProductListenerIOS = (): EventSubscription => ({
  remove: () => {},
});
export const userChoiceBillingListenerAndroid = (): EventSubscription => ({
  remove: () => {},
});
export const developerProvidedBillingListenerAndroid =
  (): EventSubscription => ({
    remove: () => {},
  });
export const subscriptionBillingIssueListener = (): EventSubscription => ({
  remove: () => {},
});

/**
 * @deprecated Use `isBillingProgramAvailableAndroid('external-offer')`
 * instead. Scheduled for removal in expo-iap 5.0.0.
 */
export const checkAlternativeBillingAvailabilityAndroid: MutationField<
  'checkAlternativeBillingAvailabilityAndroid'
> = async () => unsupported('checkAlternativeBillingAvailabilityAndroid');

/**
 * @deprecated Use `launchExternalLinkAndroid` instead. Scheduled for removal
 * in expo-iap 5.0.0.
 */
export const showAlternativeBillingDialogAndroid: MutationField<
  'showAlternativeBillingDialogAndroid'
> = async () => unsupported('showAlternativeBillingDialogAndroid');

/**
 * @deprecated Use `createBillingProgramReportingDetailsAndroid` with the
 * external-offer program instead. Scheduled for removal in expo-iap 5.0.0.
 */
export const createAlternativeBillingTokenAndroid: MutationField<
  'createAlternativeBillingTokenAndroid'
> = async () => unsupported('createAlternativeBillingTokenAndroid');
export const isBillingProgramAvailableAndroid: MutationField<
  'isBillingProgramAvailableAndroid'
> = async () => unsupported('isBillingProgramAvailableAndroid');
export const getBillingChoiceInfoAndroid: QueryField<
  'getBillingChoiceInfoAndroid'
> = async () => unsupported('getBillingChoiceInfoAndroid');
export const launchExternalLinkAndroid: MutationField<
  'launchExternalLinkAndroid'
> = async () => unsupported('launchExternalLinkAndroid');
export const createBillingProgramReportingDetailsAndroid: MutationField<
  'createBillingProgramReportingDetailsAndroid'
> = async () => unsupported('createBillingProgramReportingDetailsAndroid');
export const showBillingProgramInformationDialogAndroid: MutationField<
  'showBillingProgramInformationDialogAndroid'
> = async () => unsupported('showBillingProgramInformationDialogAndroid');
export const showInAppMessagesAndroid: MutationField<
  'showInAppMessagesAndroid'
> = async () => unsupported('showInAppMessagesAndroid');
