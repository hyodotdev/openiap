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

const IAPKIT_VERIFY_TIMEOUT_MS = 10_000;
const MAX_IAPKIT_ERROR_DEPTH = 5;
const MAX_PRODUCT_DATA_BATCH_SIZE = 100;
const MAX_PURCHASE_UPDATE_PAGES = 100;

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

interface VegaError extends Error {
  code?: ErrorCode;
  debugMessage?: string;
  platform?: 'android';
  productId?: string;
  responseCode?: number;
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
const IAPKIT_DEFAULT_BASE_URL = 'https://kit.openiap.dev';
const IAPKIT_VERIFY_PATH = '/v1/purchase/verify';

function createVegaError(
  code: ErrorCode,
  message: string,
  responseCode?: unknown,
  productId?: string,
): Error {
  const error = new Error(message) as VegaError;
  error.code = code;
  error.debugMessage = message;
  error.platform = 'android';
  error.productId = productId;
  if (typeof responseCode === 'number') {
    error.responseCode = responseCode;
  }
  return error;
}

function parseVegaErrorPayload(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return {};
  const vegaError = error as VegaError;
  if (
    vegaError.code != null ||
    vegaError.debugMessage != null ||
    vegaError.productId != null ||
    vegaError.responseCode != null
  ) {
    return {
      code: vegaError.code,
      message: error.message,
      responseCode: vegaError.responseCode,
      debugMessage: vegaError.debugMessage,
      productId: vegaError.productId,
      platform: vegaError.platform,
    };
  }
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
  const responseCode = response?.responseCode;
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function hasSubscriptionRequestContext(subscriptionOffers: unknown): boolean {
  if (Array.isArray(subscriptionOffers)) return true;
  if (typeof subscriptionOffers === 'string') {
    return subscriptionOffers.trim().length > 0;
  }
  return subscriptionOffers != null;
}

function throwUnsupportedFeature(feature: string): never {
  throw createVegaError(
    ErrorCode.FeatureNotSupported,
    `${feature} is not supported on Amazon Vega.`,
  );
}

type VegaRnIapModule = Partial<RnIap> & {
  acknowledgePurchaseAndroid(purchaseToken: string): Promise<boolean>;
  consumePurchaseAndroid(purchaseToken: string): Promise<boolean>;
  restorePurchases(): Promise<void>;
};

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
    let pageCount = 0;

    do {
      if (pageCount >= MAX_PURCHASE_UPDATE_PAGES) {
        throw createVegaError(
          ErrorCode.ServiceError,
          'Amazon Vega purchase updates exceeded the pagination limit.',
        );
      }
      pageCount++;

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

  const getProductData = async (
    skus: string[],
    message: string,
  ): Promise<VegaProduct[]> => {
    const products: VegaProduct[] = [];
    for (const batch of chunkArray(skus, MAX_PRODUCT_DATA_BATCH_SIZE)) {
      const response = await service.getProductData({skus: batch});
      ensureSuccessful('product-data', response, message);
      products.push(...productDataToArray(response.productData));
    }
    return products;
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

    const products = await getProductData(
      Array.from(missingSkus),
      'Failed to fetch Amazon Vega product data for purchase updates',
    );

    for (const product of products) {
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
        if (receipt.isCancelled || receipt.cancelDate) return false;
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
    type IapkitEndpointOptions = NonNullable<
      NitroVerifyPurchaseWithProviderProps['iapkit']
    > & {
      baseUrl?: string | null;
    };

    function iapkitVerifyUrl(
      iapkit: NitroVerifyPurchaseWithProviderProps['iapkit'],
    ): string {
      const endpointOptions = iapkit as
        | IapkitEndpointOptions
        | null
        | undefined;
      const baseUrl =
        typeof endpointOptions?.baseUrl === 'string' &&
        endpointOptions.baseUrl.trim().length > 0
          ? endpointOptions.baseUrl.trim()
          : IAPKIT_DEFAULT_BASE_URL;
      return `${baseUrl.replace(/\/+$/, '')}${IAPKIT_VERIFY_PATH}`;
    }

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

    function extractIapkitErrorMessage(
      json: unknown,
      depth = 0,
    ): string | null {
      if (depth > MAX_IAPKIT_ERROR_DEPTH) return null;
      if (!json || typeof json !== 'object') return null;
      const record = json as Record<string, unknown>;
      function extractStringMessage(value: string): string {
        if (depth >= MAX_IAPKIT_ERROR_DEPTH) return value;
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === 'object'
            ? (extractIapkitErrorMessage(parsed, depth + 1) ?? value)
            : value;
        } catch {
          return value;
        }
      }

      const details = record.details;
      if (details && typeof details === 'object') {
        const originalError = (details as Record<string, unknown>)
          .originalError;
        if (typeof originalError === 'string') {
          return extractStringMessage(originalError);
        }
      }

      const errors = record.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const firstError = errors[0];
        return typeof firstError === 'string'
          ? extractStringMessage(firstError)
          : extractIapkitErrorMessage(firstError, depth + 1);
      }

      if (typeof record.message === 'string') {
        return extractStringMessage(record.message);
      }
      if (typeof record.error === 'string') {
        return extractStringMessage(record.error);
      }
      return null;
    }

    function parseIapkitJsonResponse(text: string): unknown | null {
      if (!text.trim()) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    function isIapkitResultObject(
      json: unknown,
    ): json is Record<string, unknown> {
      return Boolean(json) && typeof json === 'object' && !Array.isArray(json);
    }

    function hasIapkitErrors(json: unknown): boolean {
      if (!isIapkitResultObject(json)) return false;
      const errors = json.errors;
      return Array.isArray(errors) && errors.length > 0;
    }

    function readIapkitResult(
      json: Record<string, unknown>,
      status: number,
    ): {
      isValid: boolean;
      state: IapkitPurchaseState;
    } {
      if (
        typeof json.isValid !== 'boolean' ||
        typeof json.state !== 'string' ||
        json.store !== 'amazon'
      ) {
        throw createVegaError(
          ErrorCode.ReceiptFailed,
          `IAPKit returned malformed response (HTTP ${status}).`,
        );
      }

      return {
        isValid: json.isValid,
        state: normalizeIapkitState(json.state),
      };
    }

    if (params.provider !== 'iapkit') {
      throw createVegaError(
        ErrorCode.FeatureNotSupported,
        `Unsupported purchase verification provider: ${params.provider}.`,
      );
    }

    const iapkit = params.iapkit;
    const payloadCount =
      Number(Boolean(iapkit?.amazon)) +
      Number(Boolean(iapkit?.apple)) +
      Number(Boolean(iapkit?.google));
    const amazon = iapkit?.amazon;
    if (payloadCount !== 1 || !amazon) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'Amazon Vega IAPKit verification requires exactly one amazon payload.',
      );
    }

    const receiptId =
      typeof amazon.receiptId === 'string' ? amazon.receiptId.trim() : '';
    if (!receiptId) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'Amazon Vega IAPKit verification requires amazon.receiptId.',
      );
    }

    let userId = typeof amazon.userId === 'string' ? amazon.userId.trim() : '';
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

    const apiKey =
      typeof iapkit?.apiKey === 'string' ? iapkit.apiKey.trim() : '';
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        IAPKIT_VERIFY_TIMEOUT_MS,
      );
      response = await fetch(iapkitVerifyUrl(iapkit), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? {Authorization: `Bearer ${apiKey}`} : {}),
        },
        body: JSON.stringify({
          store: 'amazon',
          userId,
          receiptId,
          ...(amazon.sandbox == null ? {} : {sandbox: amazon.sandbox}),
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch (error) {
      throw createVegaError(
        ErrorCode.NetworkError,
        error instanceof Error
          ? error.message
          : 'Failed to reach IAPKit verification endpoint.',
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw createVegaError(
        ErrorCode.NetworkError,
        error instanceof Error
          ? error.message
          : 'Failed to read IAPKit verification response.',
      );
    }
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

    if (!isIapkitResultObject(json)) {
      throw createVegaError(
        ErrorCode.ReceiptFailed,
        `IAPKit returned malformed response (HTTP ${response.status}).`,
      );
    }

    if (hasIapkitErrors(json)) {
      throw createVegaError(
        ErrorCode.ReceiptFailed,
        extractIapkitErrorMessage(json) ?? 'IAPKit verification failed.',
      );
    }

    const result = readIapkitResult(json, response.status);
    return {
      provider: 'iapkit',
      iapkit: {
        isValid: result.isValid,
        state: result.state,
        store: 'amazon',
      },
    };
  };

  const module: VegaRnIapModule = {
    async initConnection(): Promise<boolean> {
      await getStorefront();
      return true;
    },
    async endConnection(): Promise<boolean> {
      productTypesBySku.clear();
      cachedUserData = null;
      return true;
    },
    async fetchProducts(skus: string[], type: string): Promise<NitroProduct[]> {
      if (!Array.isArray(skus) || skus.length === 0) {
        throw createVegaError(ErrorCode.EmptySkuList, 'No SKUs provided');
      }

      const products = await getProductData(
        skus,
        'Failed to fetch Amazon Vega products',
      );

      return products
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
        const fallbackProductType = hasSubscriptionRequestContext(
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
          basePlanIdAndroid: purchase.productId,
          currentPlanId: purchase.productId,
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
    async acknowledgePurchaseAndroid(purchaseToken): Promise<boolean> {
      await finishReceipt(purchaseToken);
      return true;
    },
    async consumePurchaseAndroid(purchaseToken): Promise<boolean> {
      await finishReceipt(purchaseToken);
      return true;
    },
    async restorePurchases(): Promise<void> {
      const purchases = await getAvailablePurchases({
        android: {includeSuspended: false},
      });
      purchases.forEach(emitPurchaseUpdated);
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
    async getAppTransactionIOS(): Promise<null> {
      return throwUnsupportedFeature('getAppTransactionIOS');
    },
    async requestPromotedProductIOS(): Promise<null> {
      return throwUnsupportedFeature('requestPromotedProductIOS');
    },
    async getPromotedProductIOS(): Promise<null> {
      return throwUnsupportedFeature('getPromotedProductIOS');
    },
    async buyPromotedProductIOS(): Promise<void> {
      return throwUnsupportedFeature('buyPromotedProductIOS');
    },
    async presentCodeRedemptionSheetIOS(): Promise<boolean> {
      return throwUnsupportedFeature('presentCodeRedemptionSheetIOS');
    },
    async clearTransactionIOS(): Promise<void> {
      return throwUnsupportedFeature('clearTransactionIOS');
    },
    async beginRefundRequestIOS(): Promise<null> {
      return throwUnsupportedFeature('beginRefundRequestIOS');
    },
    async subscriptionStatusIOS(): Promise<null> {
      return throwUnsupportedFeature('subscriptionStatusIOS');
    },
    async currentEntitlementIOS(): Promise<null> {
      return throwUnsupportedFeature('currentEntitlementIOS');
    },
    async latestTransactionIOS(): Promise<null> {
      return throwUnsupportedFeature('latestTransactionIOS');
    },
    async getPendingTransactionsIOS(): Promise<NitroPurchase[]> {
      return throwUnsupportedFeature('getPendingTransactionsIOS');
    },
    async getAllTransactionsIOS(): Promise<NitroPurchase[]> {
      return throwUnsupportedFeature('getAllTransactionsIOS');
    },
    async syncIOS(): Promise<boolean> {
      return throwUnsupportedFeature('syncIOS');
    },
    async showManageSubscriptionsIOS(): Promise<NitroPurchase[]> {
      return throwUnsupportedFeature('showManageSubscriptionsIOS');
    },
    async deepLinkToSubscriptionsIOS(): Promise<boolean> {
      return throwUnsupportedFeature('deepLinkToSubscriptionsIOS');
    },
    async isEligibleForIntroOfferIOS(): Promise<boolean> {
      return throwUnsupportedFeature('isEligibleForIntroOfferIOS');
    },
    async getReceiptDataIOS(): Promise<string> {
      return throwUnsupportedFeature('getReceiptDataIOS');
    },
    async getReceiptIOS(): Promise<string> {
      return throwUnsupportedFeature('getReceiptIOS');
    },
    async requestReceiptRefreshIOS(): Promise<string> {
      return throwUnsupportedFeature('requestReceiptRefreshIOS');
    },
    async isTransactionVerifiedIOS(): Promise<boolean> {
      return throwUnsupportedFeature('isTransactionVerifiedIOS');
    },
    async getTransactionJwsIOS(): Promise<null> {
      return throwUnsupportedFeature('getTransactionJwsIOS');
    },
    async validateReceipt(): Promise<never> {
      return throwUnsupportedFeature('validateReceipt');
    },
    async getStorefront(): Promise<string> {
      return getStorefront();
    },
    async getStorefrontIOS(): Promise<string> {
      return getStorefront();
    },
    async verifyPurchaseWithProvider(params) {
      return verifyWithIapkit(params);
    },
    async deepLinkToSubscriptionsAndroid(): Promise<void> {
      return throwUnsupportedFeature('deepLinkToSubscriptionsAndroid');
    },
    async checkAlternativeBillingAvailabilityAndroid(): Promise<boolean> {
      return throwUnsupportedFeature(
        'checkAlternativeBillingAvailabilityAndroid',
      );
    },
    async showAlternativeBillingDialogAndroid(): Promise<boolean> {
      return throwUnsupportedFeature('showAlternativeBillingDialogAndroid');
    },
    async createAlternativeBillingTokenAndroid(): Promise<null> {
      return throwUnsupportedFeature('createAlternativeBillingTokenAndroid');
    },
    addUserChoiceBillingListenerAndroid(): void {},
    removeUserChoiceBillingListenerAndroid(): void {},
    addDeveloperProvidedBillingListenerAndroid(): void {},
    removeDeveloperProvidedBillingListenerAndroid(): void {},
    addSubscriptionBillingIssueListener(): void {},
    removeSubscriptionBillingIssueListener(): void {},
    enableBillingProgramAndroid(): void {
      throwUnsupportedFeature('enableBillingProgramAndroid');
    },
    async isBillingProgramAvailableAndroid(): Promise<never> {
      return throwUnsupportedFeature('isBillingProgramAvailableAndroid');
    },
    async createBillingProgramReportingDetailsAndroid(): Promise<never> {
      return throwUnsupportedFeature(
        'createBillingProgramReportingDetailsAndroid',
      );
    },
    async launchExternalLinkAndroid(): Promise<boolean> {
      return throwUnsupportedFeature('launchExternalLinkAndroid');
    },
    async canPresentExternalPurchaseNoticeIOS(): Promise<boolean> {
      return throwUnsupportedFeature('canPresentExternalPurchaseNoticeIOS');
    },
    async presentExternalPurchaseNoticeSheetIOS(): Promise<never> {
      return throwUnsupportedFeature('presentExternalPurchaseNoticeSheetIOS');
    },
    async presentExternalPurchaseLinkIOS(): Promise<never> {
      return throwUnsupportedFeature('presentExternalPurchaseLinkIOS');
    },
    async isEligibleForExternalPurchaseCustomLinkIOS(): Promise<boolean> {
      return throwUnsupportedFeature(
        'isEligibleForExternalPurchaseCustomLinkIOS',
      );
    },
    async getExternalPurchaseCustomLinkTokenIOS(): Promise<never> {
      return throwUnsupportedFeature('getExternalPurchaseCustomLinkTokenIOS');
    },
    async showExternalPurchaseCustomLinkNoticeIOS(): Promise<never> {
      return throwUnsupportedFeature('showExternalPurchaseCustomLinkNoticeIOS');
    },
  };

  return module as RnIap;
}
