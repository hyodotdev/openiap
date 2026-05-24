import type {
  IapkitPurchaseState,
  NitroActiveSubscription,
  NitroProduct,
  NitroPurchase,
  NitroPurchaseResult,
  NitroVerifyPurchaseWithProviderProps,
  NitroVerifyPurchaseWithProviderResult,
  RnIap,
} from './specs/RnIap.nitro';
import {ErrorCode} from './types';

type ResponseOperation =
  | 'product-data'
  | 'purchase'
  | 'purchase-updates'
  | 'user-data'
  | 'notify-fulfillment';

interface VegaPrice {
  priceCurrencyCode?: string | null;
  priceStr?: string | null;
  valueInMicros?: bigint | number | string | null;
}

interface VegaProduct {
  description?: string | null;
  freeTrialPeriod?: string | null;
  price?: VegaPrice | null;
  productType?: unknown;
  sku?: string | null;
  subscriptionPeriod?: string | null;
  title?: string | null;
}

interface VegaReceipt {
  cancelDate?: Date | number | string | null;
  deferredDate?: Date | number | string | null;
  isCancelled?: boolean | null;
  isDeferred?: boolean | null;
  productType?: unknown;
  purchaseDate?: Date | number | string | null;
  receiptId?: string | null;
  sku?: string | null;
  termSku?: string | null;
}

interface VegaUserData {
  countryCode?: string | null;
  marketplace?: string | null;
  userId?: string | null;
}

interface VegaResponse {
  responseCode?: unknown;
}

interface VegaProductDataResponse extends VegaResponse {
  productData?: Map<string, VegaProduct> | Record<string, VegaProduct> | null;
  unavailableSkus?: string[] | null;
}

interface VegaPurchaseResponse extends VegaResponse {
  receipt?: VegaReceipt | null;
  userData?: VegaUserData | null;
}

interface VegaPurchaseUpdatesResponse extends VegaResponse {
  hasMore?: boolean | null;
  receiptList?: VegaReceipt[] | null;
  userData?: VegaUserData | null;
}

interface VegaUserDataResponse extends VegaResponse {
  userData?: VegaUserData | null;
}

export interface VegaPurchasingService {
  getProductData(request: {skus: string[]}): Promise<VegaProductDataResponse>;
  getPurchaseUpdates(request: {
    reset: boolean;
  }): Promise<VegaPurchaseUpdatesResponse>;
  getUserData(request: Record<string, never>): Promise<VegaUserDataResponse>;
  notifyFulfillment(request: {
    fulfillmentResult: number;
    receiptId: string;
  }): Promise<VegaResponse>;
  purchase(request: {sku: string}): Promise<VegaPurchaseResponse>;
}

const PRODUCT_TYPE_SUBSCRIPTION = 3;
const FULFILLMENT_RESULT_FULFILLED = 1;
const RESPONSE_SUCCESS = 1;
const PURCHASE_RESPONSE_SUCCESS = 0;
const PURCHASE_STATE_PURCHASED = 1;
const PURCHASE_STATE_PENDING = 2;
const IAPKIT_VERIFY_URL = 'https://kit.openiap.dev/v1/purchase/verify';

function createVegaError(
  code: ErrorCode,
  message: string,
  responseCode?: unknown,
  productId?: string,
): Error {
  return new Error(
    JSON.stringify({
      code,
      message,
      responseCode: typeof responseCode === 'number' ? responseCode : undefined,
      debugMessage: message,
      productId,
      platform: 'android',
    }),
  );
}

function parseVegaErrorPayload(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return {};
  try {
    const parsed = JSON.parse(error.message);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toPurchaseErrorResult(
  error: unknown,
  fallbackMessage: string,
): NitroPurchaseResult {
  const parsed = parseVegaErrorPayload(error);
  const responseCode = parsed.responseCode;
  return {
    responseCode: typeof responseCode === 'number' ? responseCode : -1,
    code:
      typeof parsed.code === 'string' ? parsed.code : ErrorCode.PurchaseError,
    message:
      typeof parsed.message === 'string'
        ? parsed.message
        : error instanceof Error
          ? error.message
          : fallbackMessage,
    debugMessage:
      typeof parsed.debugMessage === 'string' ? parsed.debugMessage : undefined,
    purchaseToken: undefined,
  };
}

function getResponseCode(response?: VegaResponse | null): unknown {
  return response?.responseCode;
}

function responseCodeName(responseCode: unknown): string {
  if (typeof responseCode === 'string') {
    return responseCode.toUpperCase();
  }
  return '';
}

function isSuccess(
  operation: ResponseOperation,
  responseCode: unknown,
): boolean {
  if (typeof responseCode === 'number') {
    return operation === 'purchase'
      ? responseCode === PURCHASE_RESPONSE_SUCCESS
      : responseCode === RESPONSE_SUCCESS;
  }

  const name = responseCodeName(responseCode);
  return name === 'SUCCESSFUL' || name === 'SUCCESS' || name === 'OK';
}

function mapErrorCode(
  operation: ResponseOperation,
  responseCode: unknown,
): ErrorCode {
  const name = responseCodeName(responseCode);
  if (name.includes('ALREADY_PURCHASED')) return ErrorCode.AlreadyOwned;
  if (name.includes('INVALID_SKU')) return ErrorCode.SkuNotFound;
  if (name.includes('NOT_SUPPORTED')) return ErrorCode.FeatureNotSupported;
  if (name.includes('PENDING')) return ErrorCode.Pending;
  if (operation === 'purchase' && name.includes('FAILED')) {
    return ErrorCode.UserCancelled;
  }

  if (typeof responseCode === 'number') {
    if (operation === 'purchase') {
      if (responseCode === 1) return ErrorCode.AlreadyOwned;
      if (responseCode === 2) return ErrorCode.SkuNotFound;
      if (responseCode === 3) return ErrorCode.FeatureNotSupported;
      if (responseCode === 4) return ErrorCode.UserCancelled;
    }
    if (responseCode === 2 && operation !== 'purchase') {
      return ErrorCode.FeatureNotSupported;
    }
  }

  if (operation === 'product-data') return ErrorCode.QueryProduct;
  if (operation === 'user-data') return ErrorCode.InitConnection;
  return ErrorCode.PurchaseError;
}

function ensureSuccessful(
  operation: ResponseOperation,
  response: VegaResponse | null | undefined,
  message: string,
  productId?: string,
): void {
  const responseCode = getResponseCode(response);
  if (isSuccess(operation, responseCode)) return;

  throw createVegaError(
    mapErrorCode(operation, responseCode),
    `${message}. Amazon Vega responseCode=${String(responseCode ?? 'unknown')}`,
    responseCode,
    productId,
  );
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
}

function toPriceAmountMicros(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return '0';
}

function microsToPrice(value: unknown): number | null {
  const micros =
    typeof value === 'bigint' ? Number(value) : Number(value ?? Number.NaN);
  if (!Number.isFinite(micros)) return null;
  return micros / 1_000_000;
}

function isSubscription(productType: unknown): boolean {
  if (typeof productType === 'number') {
    return productType === PRODUCT_TYPE_SUBSCRIPTION;
  }

  if (typeof productType === 'string') {
    return productType.toUpperCase().includes('SUBSCRIPTION');
  }

  return false;
}

function productTypeToOpenIap(productType: unknown): 'in-app' | 'subs' {
  return isSubscription(productType) ? 'subs' : 'in-app';
}

function getReceiptSku(receipt: VegaReceipt): string {
  return receipt.sku ?? receipt.termSku ?? '';
}

function getCachedProductType(
  receipt: VegaReceipt,
  productTypesBySku: Map<string, unknown>,
  fallbackSku?: string,
): unknown {
  const sku = getReceiptSku(receipt) || fallbackSku || '';
  return sku ? productTypesBySku.get(sku) : undefined;
}

function productDataToArray(
  productData?: Map<string, VegaProduct> | Record<string, VegaProduct> | null,
): VegaProduct[] {
  if (!productData) return [];
  if (productData instanceof Map) return Array.from(productData.values());
  return Object.values(productData);
}

function createPricingPhase(product: VegaProduct) {
  const price = product.price ?? {};
  return {
    billingCycleCount: 0,
    billingPeriod: product.subscriptionPeriod ?? '',
    formattedPrice: price.priceStr ?? '',
    priceAmountMicros: toPriceAmountMicros(price.valueInMicros),
    priceCurrencyCode: price.priceCurrencyCode ?? '',
    recurrenceMode: 1,
  };
}

function createSubscriptionOffer(product: VegaProduct) {
  const pricingPhase = createPricingPhase(product);
  const sku = product.sku ?? '';
  return {
    basePlanId: sku,
    offerId: null,
    offerTags: [],
    offerToken: '',
    pricingPhases: {
      pricingPhaseList: [pricingPhase],
    },
  };
}

function createStandardizedSubscriptionOffer(product: VegaProduct) {
  const pricingPhase = createPricingPhase(product);
  const sku = product.sku ?? '';
  return {
    basePlanIdAndroid: sku,
    currency: product.price?.priceCurrencyCode ?? '',
    displayPrice: product.price?.priceStr ?? '',
    id: sku,
    offerTagsAndroid: [],
    offerTokenAndroid: '',
    paymentMode: 'pay-as-you-go',
    period: null,
    price: microsToPrice(product.price?.valueInMicros) ?? 0,
    pricingPhasesAndroid: {
      pricingPhaseList: [pricingPhase],
    },
    type: 'introductory',
  };
}

function mapProduct(product: VegaProduct): NitroProduct {
  const sku = product.sku ?? '';
  const type = productTypeToOpenIap(product.productType);
  const subscriptionOfferDetails =
    type === 'subs' ? [createSubscriptionOffer(product)] : null;
  const subscriptionOffers =
    type === 'subs' ? [createStandardizedSubscriptionOffer(product)] : null;

  return {
    id: sku,
    title: product.title ?? sku,
    description: product.description ?? '',
    type,
    displayName: product.title ?? sku,
    displayPrice: product.price?.priceStr ?? '',
    currency: product.price?.priceCurrencyCode ?? '',
    price: microsToPrice(product.price?.valueInMicros),
    platform: 'android',
    introductoryPricePaymentModeIOS: 'empty',
    nameAndroid: product.title ?? sku,
    subscriptionPeriodAndroid: product.subscriptionPeriod ?? null,
    freeTrialPeriodAndroid: product.freeTrialPeriod ?? null,
    subscriptionOfferDetailsAndroid: subscriptionOfferDetails
      ? stringifyJson(subscriptionOfferDetails)
      : null,
    subscriptionOffers: subscriptionOffers
      ? stringifyJson(subscriptionOffers)
      : null,
    productStatusAndroid: 'ok',
  };
}

function mapReceipt(
  receipt: VegaReceipt,
  fallbackProductType?: unknown,
): NitroPurchase {
  const receiptId = receipt.receiptId ?? '';
  const productId = getReceiptSku(receipt);
  const type = productTypeToOpenIap(receipt.productType ?? fallbackProductType);
  const isPending = Boolean(receipt.isDeferred);
  const isCanceled = Boolean(receipt.isCancelled || receipt.cancelDate);
  const isActive = !isCanceled && !isPending;

  return {
    id: receiptId,
    productId,
    transactionDate: toTimestamp(receipt.purchaseDate),
    purchaseToken: receiptId,
    platform: 'android',
    store: 'amazon',
    quantity: 1,
    purchaseState: isPending ? 'pending' : isActive ? 'purchased' : 'unknown',
    isAutoRenewing: type === 'subs' && isActive,
    purchaseTokenAndroid: receiptId,
    dataAndroid: stringifyJson(receipt),
    signatureAndroid: null,
    autoRenewingAndroid: type === 'subs' && isActive,
    purchaseStateAndroid: isPending
      ? PURCHASE_STATE_PENDING
      : isActive
        ? PURCHASE_STATE_PURCHASED
        : 0,
    isAcknowledgedAndroid: false,
    isSuspendedAndroid: Boolean(receipt.isDeferred),
  };
}

function getSkuFromRequest(request: Parameters<RnIap['requestPurchase']>[0]) {
  const androidRequest = request.google ?? request.android;
  const skus = androidRequest?.skus ?? [];
  if (skus.length !== 1) {
    throw createVegaError(
      ErrorCode.DeveloperError,
      'Amazon Vega purchase expects exactly one SKU per request.',
    );
  }
  return skus[0]!;
}

export function createVegaIapModule(service: VegaPurchasingService): RnIap {
  const productTypesBySku = new Map<string, unknown>();
  const purchaseUpdateListeners = new Map<
    number,
    (purchase: NitroPurchase) => void
  >();
  const purchaseErrorListeners = new Set<
    (error: NitroPurchaseResult) => void
  >();
  let cachedUserData: VegaUserData | null = null;
  let nextPurchaseUpdateListenerToken = 1;

  const emitPurchaseUpdated = (purchase: NitroPurchase): void => {
    for (const listener of purchaseUpdateListeners.values()) {
      listener(purchase);
    }
  };

  const emitPurchaseError = (error: NitroPurchaseResult): void => {
    for (const listener of purchaseErrorListeners) {
      listener(error);
    }
  };

  const getStorefront = async (): Promise<string> => {
    const response = await service.getUserData({});
    ensureSuccessful('user-data', response, 'Failed to fetch Amazon user data');
    cachedUserData = response.userData ?? null;
    return cachedUserData?.marketplace ?? cachedUserData?.countryCode ?? '';
  };

  const getPurchaseUpdateReceipts = async (): Promise<VegaReceipt[]> => {
    const receipts: VegaReceipt[] = [];
    let reset = true;
    let hasMore = false;

    do {
      const response = await service.getPurchaseUpdates({reset});
      ensureSuccessful(
        'purchase-updates',
        response,
        'Failed to fetch Amazon purchase updates',
      );
      cachedUserData = response.userData ?? cachedUserData;
      receipts.push(...(response.receiptList ?? []));
      hasMore = Boolean(response.hasMore);
      reset = false;
    } while (hasMore);

    return receipts;
  };

  const hydrateProductTypesForReceipts = async (
    receipts: VegaReceipt[],
  ): Promise<void> => {
    const missingSkus = new Set<string>();

    for (const receipt of receipts) {
      const sku = getReceiptSku(receipt);
      if (!sku) continue;
      if (receipt.productType != null) {
        productTypesBySku.set(sku, receipt.productType);
      } else if (!productTypesBySku.has(sku)) {
        missingSkus.add(sku);
      }
    }

    if (missingSkus.size === 0) return;

    const response = await service.getProductData({
      skus: Array.from(missingSkus),
    });
    ensureSuccessful(
      'product-data',
      response,
      'Failed to fetch Amazon Vega product data for purchase updates',
    );

    for (const product of productDataToArray(response.productData)) {
      if (product.sku) {
        productTypesBySku.set(product.sku, product.productType);
      }
    }
  };

  const getAvailablePurchases = async (
    options?: Parameters<RnIap['getAvailablePurchases']>[0],
  ): Promise<NitroPurchase[]> => {
    const requestedType = options?.android?.type;
    const includeSuspended = Boolean(options?.android?.includeSuspended);
    const receipts = await getPurchaseUpdateReceipts();
    await hydrateProductTypesForReceipts(receipts);
    return receipts
      .filter((receipt) => {
        if (!includeSuspended && receipt.isDeferred) return false;
        const openIapType = productTypeToOpenIap(
          receipt.productType ??
            getCachedProductType(receipt, productTypesBySku),
        );
        if (requestedType === 'subs') return openIapType === 'subs';
        if (requestedType === 'inapp') return openIapType === 'in-app';
        return true;
      })
      .map((receipt) =>
        mapReceipt(receipt, getCachedProductType(receipt, productTypesBySku)),
      );
  };

  const finishReceipt = async (
    purchaseToken: string,
  ): Promise<NitroPurchaseResult> => {
    if (!purchaseToken) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'purchaseToken is required to finish an Amazon Vega transaction.',
      );
    }

    const response = await service.notifyFulfillment({
      fulfillmentResult: FULFILLMENT_RESULT_FULFILLED,
      receiptId: purchaseToken,
    });
    ensureSuccessful(
      'notify-fulfillment',
      response,
      'Failed to notify Amazon Vega fulfillment',
    );
    return {
      responseCode: 0,
      code: '',
      message: '',
      purchaseToken,
    };
  };

  const verifyWithIapkit = async (
    params: NitroVerifyPurchaseWithProviderProps,
  ): Promise<NitroVerifyPurchaseWithProviderResult> => {
    function normalizeIapkitState(state: unknown): IapkitPurchaseState {
      const normalized =
        typeof state === 'string'
          ? state.toLowerCase().replace(/_/g, '-')
          : 'unknown';
      const states = new Set<IapkitPurchaseState>([
        'entitled',
        'pending-acknowledgment',
        'pending',
        'canceled',
        'expired',
        'ready-to-consume',
        'consumed',
        'unknown',
        'inauthentic',
      ]);
      return states.has(normalized as IapkitPurchaseState)
        ? (normalized as IapkitPurchaseState)
        : 'unknown';
    }

    function extractIapkitErrorMessage(json: unknown): string | null {
      if (!json || typeof json !== 'object') return null;
      const record = json as Record<string, unknown>;
      const details = record.details;
      if (details && typeof details === 'object') {
        const originalError = (details as Record<string, unknown>)
          .originalError;
        if (typeof originalError === 'string') {
          try {
            return (
              extractIapkitErrorMessage(JSON.parse(originalError)) ??
              originalError
            );
          } catch {
            return originalError;
          }
        }
      }

      const errors = record.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        return extractIapkitErrorMessage(errors[0]);
      }

      return typeof record.message === 'string'
        ? record.message
        : typeof record.error === 'string'
          ? record.error
          : null;
    }

    function parseIapkitJsonResponse(text: string): unknown | null {
      if (!text.trim()) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    if (params.provider !== 'iapkit') {
      throw createVegaError(
        ErrorCode.FeatureNotSupported,
        `Unsupported purchase verification provider: ${params.provider}.`,
      );
    }

    const iapkit = params.iapkit;
    const amazon = iapkit?.amazon;
    if (!amazon) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'Amazon Vega IAPKit verification requires amazon parameters.',
      );
    }

    const receiptId = amazon.receiptId.trim();
    if (!receiptId) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'Amazon Vega IAPKit verification requires amazon.receiptId.',
      );
    }

    let userId = amazon.userId?.trim() ?? '';
    if (!userId) {
      const response = await service.getUserData({});
      ensureSuccessful(
        'user-data',
        response,
        'Failed to fetch Amazon user data for IAPKit verification',
      );
      cachedUserData = response.userData ?? cachedUserData;
      userId = cachedUserData?.userId?.trim() ?? '';
    }
    if (!userId) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'Amazon Vega IAPKit verification could not resolve userId.',
      );
    }

    let response: Response;
    try {
      response = await fetch(IAPKIT_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(iapkit?.apiKey
            ? {Authorization: `Bearer ${iapkit.apiKey}`}
            : {}),
        },
        body: JSON.stringify({
          store: 'amazon',
          userId,
          receiptId,
          ...(amazon.sandbox == null ? {} : {sandbox: amazon.sandbox}),
        }),
      });
    } catch (error) {
      throw createVegaError(
        ErrorCode.NetworkError,
        error instanceof Error
          ? error.message
          : 'Failed to reach IAPKit verification endpoint.',
      );
    }
    const text = await response.text();
    const json = parseIapkitJsonResponse(text);

    if (!response.ok) {
      throw createVegaError(
        ErrorCode.ReceiptFailed,
        extractIapkitErrorMessage(json) ?? `HTTP ${response.status}`,
      );
    }

    if (json === null) {
      throw createVegaError(
        ErrorCode.ReceiptFailed,
        `IAPKit returned non-JSON response (HTTP ${response.status}).`,
      );
    }

    const result = json as {
      isValid?: unknown;
      state?: unknown;
      store?: unknown;
    };
    return {
      provider: 'iapkit',
      iapkit: {
        isValid: result.isValid === true,
        state: normalizeIapkitState(result.state),
        store: 'amazon',
      },
    };
  };

  const module: Partial<RnIap> = {
    async initConnection(): Promise<boolean> {
      await getStorefront();
      return true;
    },
    async endConnection(): Promise<boolean> {
      productTypesBySku.clear();
      cachedUserData = null;
      purchaseUpdateListeners.clear();
      purchaseErrorListeners.clear();
      return true;
    },
    async fetchProducts(skus: string[], type: string): Promise<NitroProduct[]> {
      if (!Array.isArray(skus) || skus.length === 0) {
        throw createVegaError(ErrorCode.EmptySkuList, 'No SKUs provided');
      }

      const response = await service.getProductData({skus});
      ensureSuccessful(
        'product-data',
        response,
        'Failed to fetch Amazon Vega products',
      );

      return productDataToArray(response.productData)
        .filter((product) => {
          if (product.sku) {
            productTypesBySku.set(product.sku, product.productType);
          }
          const openIapType = productTypeToOpenIap(product.productType);
          if (type === 'all') return true;
          if (type === 'subs') return openIapType === 'subs';
          return openIapType === 'in-app';
        })
        .map(mapProduct);
    },
    async requestPurchase(
      request: Parameters<RnIap['requestPurchase']>[0],
    ): Promise<Awaited<ReturnType<RnIap['requestPurchase']>>> {
      let sku: string | undefined;
      try {
        sku = getSkuFromRequest(request);
        const androidRequest = request.google ?? request.android;
        const fallbackProductType = Array.isArray(
          androidRequest?.subscriptionOffers,
        )
          ? PRODUCT_TYPE_SUBSCRIPTION
          : productTypesBySku.get(sku);
        if (fallbackProductType != null) {
          productTypesBySku.set(sku, fallbackProductType);
        }
        const response = await service.purchase({sku});
        ensureSuccessful(
          'purchase',
          response,
          'Failed to complete Amazon Vega purchase',
          sku,
        );

        if (!response.receipt) return [];

        cachedUserData = response.userData ?? cachedUserData;
        const purchase = mapReceipt(response.receipt, fallbackProductType);
        emitPurchaseUpdated(purchase);
        return [purchase];
      } catch (error) {
        emitPurchaseError(
          toPurchaseErrorResult(
            error,
            'Failed to complete Amazon Vega purchase',
          ),
        );
        throw error;
      }
    },
    getAvailablePurchases,
    async getActiveSubscriptions(
      subscriptionIds?: string[],
    ): Promise<NitroActiveSubscription[]> {
      const requestedIds = new Set(subscriptionIds ?? []);
      const purchases = await getAvailablePurchases({android: {type: 'subs'}});
      return purchases
        .filter(
          (purchase) =>
            purchase.isAutoRenewing &&
            (requestedIds.size === 0 || requestedIds.has(purchase.productId)),
        )
        .map((purchase) => ({
          productId: purchase.productId,
          isActive: true,
          transactionId: purchase.id,
          purchaseToken: purchase.purchaseToken ?? null,
          transactionDate: purchase.transactionDate,
          autoRenewingAndroid: purchase.autoRenewingAndroid ?? true,
          purchaseTokenAndroid: purchase.purchaseTokenAndroid ?? null,
        }));
    },
    async hasActiveSubscriptions(subscriptionIds?: string[]): Promise<boolean> {
      const subscriptions =
        await module.getActiveSubscriptions?.(subscriptionIds);
      return Boolean(subscriptions?.length);
    },
    async finishTransaction(
      params: Parameters<RnIap['finishTransaction']>[0],
    ): Promise<NitroPurchaseResult> {
      const token = params.android?.purchaseToken;
      return finishReceipt(token ?? '');
    },
    addPurchaseUpdatedListener(listener): number {
      const token = nextPurchaseUpdateListenerToken++;
      purchaseUpdateListeners.set(token, listener);
      return token;
    },
    addPurchaseErrorListener(listener): void {
      purchaseErrorListeners.add(listener);
    },
    removePurchaseUpdatedListener(token): void {
      purchaseUpdateListeners.delete(token);
    },
    removePurchaseErrorListener(listener): void {
      purchaseErrorListeners.delete(listener);
    },
    addPromotedProductListenerIOS(): void {},
    removePromotedProductListenerIOS(): void {},
    async getStorefront(): Promise<string> {
      return getStorefront();
    },
    async getStorefrontIOS(): Promise<string> {
      return getStorefront();
    },
    async verifyPurchaseWithProvider(params) {
      return verifyWithIapkit(params);
    },
  };

  return module as RnIap;
}
