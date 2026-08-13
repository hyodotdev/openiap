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
import {decodeAndroidPurchases} from './utils/availablePurchases';

export * from './types';
export * from './vega';
export * from './useIAP';
export {kitApi, KitApiError} from './kit-api';
export type {
  EntitlementsResponse,
  KitApiOptions,
  KitClientPayloadCache,
  KitClientPayloadOptions,
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

export enum OpenIapEvent {
  PurchaseUpdated = 'purchase-updated',
  PurchaseError = 'purchase-error',
  PromotedProductIOS = 'promoted-product-ios',
  UserChoiceBillingAndroid = 'user-choice-billing-android',
  DeveloperProvidedBillingAndroid = 'developer-provided-billing-android',
  SubscriptionBillingIssue = 'subscription-billing-issue',
}

export type ProductTypeInput = ProductQueryType;

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
  if (type == null || type === 'in-app') return 'in-app';
  if (type === 'subs' || type === 'all') return type;
  throw new Error(
    `Unsupported product type: ${String(type)}. Use in-app, subs, or all.`,
  );
};

const normalizePurchaseArray = (purchases: Purchase[]): Purchase[] =>
  decodeAndroidPurchases(purchases);

const getAndroidRequest = (
  request?:
    | RequestPurchasePropsByPlatforms
    | RequestSubscriptionPropsByPlatforms
    | null,
) => {
  return request?.google;
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
  const type = normalizeProductType(args.type);
  if (type === 'all') {
    throw new Error('Product type all is only supported for product queries.');
  }
  const androidRequest = getAndroidRequest(args.request);
  if (!androidRequest?.skus?.length) {
    throw new Error(
      'Invalid request for Amazon Vega. The `request.google.skus` property is required and must be a non-empty array.',
    );
  }

  return normalizePurchaseArray(
    await getModule().requestPurchase({
      skus: androidRequest.skus,
      type,
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

export const verifyPurchase: MutationField<'verifyPurchase'> = async () =>
  unsupported('verifyPurchase');

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

export const syncIOS: MutationField<'syncIOS'> = async () =>
  unsupported('syncIOS');
export const getAppTransactionIOS: QueryField<
  'getAppTransactionIOS'
> = async () => null;
export const getPromotedProductIOS: QueryField<
  'getPromotedProductIOS'
> = async () => null;

export const showManageSubscriptionsIOS: MutationField<
  'showManageSubscriptionsIOS'
> = async () => [];
export const presentCodeRedemptionSheetIOS: MutationField<
  'presentCodeRedemptionSheetIOS'
> = async () => null;
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
