import {getVegaIapModule} from './vega';
import type {
  MutationField,
  Product,
  ProductQueryType,
  ProductRequest,
  ProductSubscription,
  Purchase,
  PurchaseError,
  PurchaseUpdatedListenerOptions,
  QueryField,
  RequestPurchasePropsByPlatforms,
  RequestSubscriptionPropsByPlatforms,
} from './types';
import type {
  NitroAvailablePurchasesOptions,
  NitroFinishTransactionParams,
  NitroProduct,
  NitroPurchase,
  NitroPurchaseRequest,
} from './specs/RnIap.nitro';
import {
  convertNitroProductToProduct,
  convertNitroPurchaseToPurchase,
  convertProductToProductSubscription,
  validateNitroProduct,
  validateNitroPurchase,
} from './utils/type-bridge';

export * from './types';
export * from './utils/error';
export * from './vega';
export {useIAP, type UseIapOptions} from './hooks/useIAP';
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

/** Product type accepted by the Amazon Vega entry point. */
export type ProductTypeInput = 'in-app' | 'subs';

export interface EventSubscription {
  remove(): void;
}

type VegaModuleExtras = {
  acknowledgePurchaseAndroid(purchaseToken: string): Promise<boolean>;
  consumePurchaseAndroid(purchaseToken: string): Promise<boolean>;
  restorePurchases?: () => Promise<void>;
};

const unsupported = (feature: string): never => {
  throw new Error(`${feature} is not supported on Amazon Vega.`);
};

const getModule = () => {
  const module = getVegaIapModule();
  if (!module) {
    throw new Error(
      'Amazon Vega IAP module is unavailable. Install @amazon-devices/keplerscript-appstore-iap-lib in the Vega app target and build with the React Native for Vega kepler platform.',
    );
  }
  return module;
};

const getVegaModule = () =>
  getModule() as ReturnType<typeof getModule> & VegaModuleExtras;

const normalizeProductQueryType = (
  type?: ProductQueryType | ProductTypeInput | null,
): ProductTypeInput | 'all' => {
  if (type == null || type === 'in-app') return 'in-app';
  if (type === 'subs') return 'subs';
  if (type === 'all') return 'all';
  throw new Error(
    `Unsupported product type: ${String(type)}. Use in-app, subs, or all.`,
  );
};

const mapProducts = (
  nitroProducts: NitroProduct[],
  type: ProductTypeInput | 'all',
) => {
  const converted = nitroProducts
    .filter(validateNitroProduct)
    .map(convertNitroProductToProduct);

  if (type === 'subs') {
    return converted.map(convertProductToProductSubscription);
  }

  return converted;
};

export const isNitroReady = (): boolean => false;
export const isTVOS = (): boolean => false;
export const isMacOS = (): boolean => false;
export const isStandardIOS = (): boolean => false;

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
    type?: ProductQueryType | ProductTypeInput | null;
  },
): ReturnType<QueryField<'fetchProducts'>> => {
  const {skus, type} = request;
  const normalizedType = normalizeProductQueryType(type);
  const nitroProducts = await getModule().fetchProducts(skus, normalizedType);
  return mapProducts(nitroProducts, normalizedType) as
    Product[] | ProductSubscription[];
};

export const requestPurchase: MutationField<'requestPurchase'> = async (
  request,
) => {
  const perPlatformRequest = request.request as
    | RequestPurchasePropsByPlatforms
    | RequestSubscriptionPropsByPlatforms
    | undefined;
  const androidRequest = perPlatformRequest?.google;

  if (!androidRequest?.skus?.length) {
    throw new Error(
      'Invalid request for Amazon Vega. `request.google.skus` must be a non-empty array.',
    );
  }

  const nitroRequest: NitroPurchaseRequest = {
    google: androidRequest,
  };
  const result = await getModule().requestPurchase(nitroRequest);
  if (!Array.isArray(result)) return null;
  const purchases = result as unknown as NitroPurchase[];
  return purchases
    .filter(validateNitroPurchase)
    .map((purchase) => convertNitroPurchaseToPurchase(purchase));
};

export const getAvailablePurchases: QueryField<
  'getAvailablePurchases'
> = async (options) => {
  const nitroOptions: NitroAvailablePurchasesOptions = {
    android: {
      includeSuspended: options?.includeSuspendedAndroid ?? false,
    },
  };
  return getModule()
    .getAvailablePurchases(nitroOptions)
    .then((purchases) =>
      purchases
        .filter(validateNitroPurchase)
        .map(convertNitroPurchaseToPurchase),
    );
};

export const finishTransaction: MutationField<'finishTransaction'> = async (
  args,
) => {
  const token = args.purchase.purchaseToken ?? undefined;
  if (!token) {
    throw new Error('purchaseToken required to finish Amazon Vega transaction');
  }

  const params: NitroFinishTransactionParams = {
    android: {
      purchaseToken: token,
      isConsumable: args.isConsumable ?? false,
    },
  };
  await getModule().finishTransaction(params);
};

export const restorePurchases: MutationField<'restorePurchases'> = async () => {
  await getVegaModule().restorePurchases?.();
};

export const getActiveSubscriptions: QueryField<
  'getActiveSubscriptions'
> = async (args) => {
  return getModule().getActiveSubscriptions(args ?? undefined);
};

export const hasActiveSubscriptions: QueryField<
  'hasActiveSubscriptions'
> = async (args) => {
  return getModule().hasActiveSubscriptions(args ?? undefined);
};

export const purchaseUpdatedListener = (
  listener: (purchase: Purchase) => void,
  options?: PurchaseUpdatedListenerOptions | null,
): EventSubscription => {
  const token = getModule().addPurchaseUpdatedListener((purchase) => {
    if (validateNitroPurchase(purchase)) {
      listener(convertNitroPurchaseToPurchase(purchase));
    }
  }, options ?? undefined);

  return {
    remove: () => {
      if (typeof token === 'number') {
        getModule().removePurchaseUpdatedListener(token);
      }
    },
  };
};

export const purchaseErrorListener = (
  listener: (error: PurchaseError) => void,
): EventSubscription => {
  const nativeListener = (error: {code?: string; message?: string}) => {
    listener({
      code: (error.code ?? 'service-error') as PurchaseError['code'],
      message: error.message ?? 'Amazon Vega purchase failed',
    });
  };

  getModule().addPurchaseErrorListener(nativeListener);
  return {
    remove: () => getModule().removePurchaseErrorListener(nativeListener),
  };
};

export const getStorefront: QueryField<'getStorefront'> = async () => {
  return getModule().getStorefront();
};

export const verifyPurchaseWithProvider: MutationField<
  'verifyPurchaseWithProvider'
> = async (params) => {
  return getModule().verifyPurchaseWithProvider(params) as ReturnType<
    MutationField<'verifyPurchaseWithProvider'>
  >;
};

export const verifyPurchase: MutationField<'verifyPurchase'> = async () =>
  unsupported('verifyPurchase');
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
> = async () => false;
export const presentExternalPurchaseLinkIOS: MutationField<
  'presentExternalPurchaseLinkIOS'
> = async () => unsupported('presentExternalPurchaseLinkIOS');
export const deepLinkToSubscriptions: MutationField<
  'deepLinkToSubscriptions'
> = async () => unsupported('deepLinkToSubscriptions');
export const promotedProductListenerIOS = (): EventSubscription => ({
  remove: () => {},
});

export const acknowledgePurchaseAndroid: MutationField<
  'acknowledgePurchaseAndroid'
> = async (purchaseToken) => {
  return getVegaModule().acknowledgePurchaseAndroid(purchaseToken);
};
export const consumePurchaseAndroid: MutationField<
  'consumePurchaseAndroid'
> = async (purchaseToken) => {
  return getVegaModule().consumePurchaseAndroid(purchaseToken);
};

export const openRedeemOfferCodeAndroid: MutationField<
  'openRedeemOfferCodeAndroid'
> = async () => false;

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
