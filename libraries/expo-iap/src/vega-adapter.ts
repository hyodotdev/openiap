import {ErrorCode} from './types';
import type {
  ActiveSubscription,
  IapkitPurchaseState,
  Product,
  ProductSubscription,
  Purchase,
  PurchaseOptions,
  RequestVerifyPurchaseWithIapkitResult,
  SubResponseCodeAndroid,
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from './types';

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
const NOTIFY_FULFILLMENT_ATTEMPT_TIMEOUT_MS = 2_000;
const NOTIFY_FULFILLMENT_MAX_ATTEMPTS = 15;
const NOTIFY_FULFILLMENT_RETRY_DELAY_MS = 1_000;
const PURCHASE_UPDATES_MAX_ATTEMPTS = 5;
const PURCHASE_UPDATES_RETRY_DELAY_MS = 1_000;
const PURCHASE_RECOVERY_CLOCK_SKEW_MS = 5_000;

type VegaListener = (payload: any) => void;

interface VegaPurchaseErrorPayload {
  code: ErrorCode;
  debugMessage?: string;
  isEmptyProductList?: boolean;
  message: string;
  productId?: string;
  productIds?: string[];
  productType?: string;
  responseCode?: number;
  subResponseCodeAndroid?: SubResponseCodeAndroid;
}

interface RecoverPurchasesOptions {
  minPurchaseDateMs?: number;
}

interface VegaPrice {
  priceCurrencyCode?: string | null;
  priceStr?: string | null;
  valueInMicros?: bigint | number | string | null;
}

interface VegaProduct {
  description?: string | null;
  freeTrialPeriod?: string | null;
  itemType?: unknown;
  price?: VegaPrice | number | string | null;
  productType?: unknown;
  sku?: string | null;
  subscriptionBase?: string | null;
  subscriptionParent?: string | null;
  subscriptionPeriod?: string | null;
  term?: string | null;
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

interface VegaUserDataRequest {
  fetchUserProfileAccessConsentStatus: boolean;
}

export interface VegaPurchasingService {
  getProductData(request: {skus: string[]}): Promise<VegaProductDataResponse>;
  getPurchaseUpdates(request: {
    reset: boolean;
  }): Promise<VegaPurchaseUpdatesResponse>;
  getUserData(request: VegaUserDataRequest): Promise<VegaUserDataResponse>;
  notifyFulfillment(request: {
    fulfillmentResult: number;
    receiptId: string;
  }): Promise<VegaResponse>;
  purchase(request: {sku: string}): Promise<VegaPurchaseResponse>;
}

export interface ExpoIapVegaModule {
  ERROR_CODES: Record<string, string>;
  acknowledgePurchaseAndroid(purchaseToken: string): Promise<void>;
  addListener(eventName: string, listener: VegaListener): {remove: () => void};
  consumePurchaseAndroid(purchaseToken: string): Promise<void>;
  endConnection(): Promise<boolean>;
  fetchProducts(
    type: string,
    skus: string[],
  ): Promise<(Product | ProductSubscription)[]>;
  getActiveSubscriptions(
    subscriptionIds?: string[] | null,
  ): Promise<ActiveSubscription[]>;
  getAvailableItems(options?: PurchaseOptions): Promise<Purchase[]>;
  getStorefront(): Promise<string>;
  hasActiveSubscriptions(subscriptionIds?: string[] | null): Promise<boolean>;
  initConnection(config?: unknown): Promise<boolean>;
  removeListener(eventName: string, listener: VegaListener): void;
  requestPurchase(params: {
    skuArr?: string[];
    type?: string;
  }): Promise<Purchase[]>;
  verifyPurchaseWithProvider(
    options: VerifyPurchaseWithProviderProps,
  ): Promise<VerifyPurchaseWithProviderResult>;
}

const PRODUCT_TYPE_SUBSCRIPTION = 3;
const FULFILLMENT_RESULT_FULFILLED = 1;
const RESPONSE_SUCCESS = 1;
const PURCHASE_RESPONSE_SUCCESS = 0;
const IAPKIT_DEFAULT_BASE_URL = 'https://kit.openiap.dev';
const IAPKIT_VERIFY_PATH = '/v1/purchase/verify';
const VEGA_PARSER_ERROR_MESSAGES = [
  'Cannot convert undefined value to object',
  'userId is not found while parsing Json',
];

function createVegaError(
  code: ErrorCode,
  message: string,
  responseCode?: unknown,
  productId?: string,
): Error {
  const error = new Error(message) as Error & {
    code?: ErrorCode;
    debugMessage?: string;
    isEmptyProductList?: boolean;
    productId?: string;
    productIds?: string[];
    productType?: string;
    responseCode?: number;
    subResponseCodeAndroid?: SubResponseCodeAndroid;
  };
  error.code = code;
  error.debugMessage = message;
  error.productId = productId;
  if (typeof responseCode === 'number') {
    error.responseCode = responseCode;
  }
  return error;
}

function isValidIpv4Address(address: string): boolean {
  const octets = address.split('.');
  return (
    octets.length === 4 &&
    octets.every(
      (octet) => /^(?:0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255,
    )
  );
}

function isValidIpv6Address(address: string): boolean {
  let ipv6Part = address;
  let ipv4GroupCount = 0;

  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    if (lastColon < 0 || !isValidIpv4Address(address.slice(lastColon + 1))) {
      return false;
    }
    const ipv6Prefix = address.slice(0, lastColon);
    ipv6Part = ipv6Prefix.endsWith(':') ? `${ipv6Prefix}:` : ipv6Prefix;
    ipv4GroupCount = 2;
  }

  if (
    !ipv6Part.includes(':') ||
    !/^[0-9a-f:]+$/i.test(ipv6Part) ||
    ipv6Part.includes(':::')
  ) {
    return false;
  }

  const compressionIndex = ipv6Part.indexOf('::');
  const hasCompression = compressionIndex >= 0;
  if (
    (hasCompression && ipv6Part.indexOf('::', compressionIndex + 2) >= 0) ||
    (!hasCompression && (ipv6Part.startsWith(':') || ipv6Part.endsWith(':')))
  ) {
    return false;
  }

  const sections = hasCompression ? ipv6Part.split('::') : [ipv6Part];
  const groups: string[] = [];
  for (const section of sections) {
    if (section.length > 0) groups.push(...section.split(':'));
  }
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) {
    return false;
  }

  const groupCount = groups.length + ipv4GroupCount;
  return hasCompression ? groupCount < 8 : groupCount === 8;
}

function isValidHostname(hostname: string): boolean {
  if (/^[0-9.]+$/.test(hostname)) {
    return isValidIpv4Address(hostname);
  }

  const normalizedHostname = hostname.endsWith('.')
    ? hostname.slice(0, -1)
    : hostname;
  if (normalizedHostname.length === 0 || normalizedHostname.length > 253) {
    return false;
  }
  const hostnameLabels = normalizedHostname.split('.');
  const lastLabel = hostnameLabels[hostnameLabels.length - 1]!;
  if (/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(lastLabel)) {
    return false;
  }

  return normalizedHostname
    .split('.')
    .every(
      (label) =>
        label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
}

function getIapkitVerifyUrl(baseUrl?: string | null): string {
  const requestedBaseUrl =
    typeof baseUrl === 'string' && baseUrl.trim().length > 0
      ? baseUrl.trim()
      : IAPKIT_DEFAULT_BASE_URL;
  const normalizedBaseUrl = requestedBaseUrl.replace(/\/+$/, '');
  // Kepler's URL polyfill throws for standard getters such as protocol,
  // host, and pathname. Parse the small origin-only contract directly.
  const originMatch = /^(https?):\/\/([^/?#@\s\\]+)$/i.exec(normalizedBaseUrl);
  if (!originMatch) {
    throw createVegaError(
      ErrorCode.DeveloperError,
      'IAPKit baseUrl must be a valid HTTP(S) origin',
    );
  }

  const authority = originMatch[2]!;
  const isBracketedIpv6 = authority.startsWith('[');
  const authorityMatch = isBracketedIpv6
    ? /^\[([^\]]+)\](?::([0-9]+))?$/.exec(authority)
    : /^([^:]+)(?::([0-9]+))?$/.exec(authority);
  const host = authorityMatch?.[1];
  const requestedPort = authorityMatch?.[2];
  const portNumber = requestedPort ? Number(requestedPort) : null;
  const hasValidHost =
    typeof host === 'string' &&
    (isBracketedIpv6 ? isValidIpv6Address(host) : isValidHostname(host));
  const hasValidPort =
    portNumber === null ||
    (Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535);
  if (!authorityMatch || !hasValidHost || !hasValidPort) {
    throw createVegaError(
      ErrorCode.DeveloperError,
      'IAPKit baseUrl must be a valid HTTP(S) origin',
    );
  }

  const scheme = originMatch[1]!.toLowerCase();
  const serializedHost = isBracketedIpv6 ? `[${host!}]` : host!;
  const port = requestedPort ? `:${requestedPort}` : '';
  return `${scheme}://${serializedHost}${port}${IAPKIT_VERIFY_PATH}`;
}

function toPurchaseErrorPayload(
  error: unknown,
  fallbackMessage: string,
  productId?: string,
): VegaPurchaseErrorPayload {
  if (error instanceof Error) {
    const errorWithFields = error as Error & {
      code?: ErrorCode;
      debugMessage?: string;
      isEmptyProductList?: boolean;
      productId?: string;
      productIds?: string[];
      productType?: string;
      responseCode?: number;
      subResponseCodeAndroid?: SubResponseCodeAndroid;
    };
    return {
      code: errorWithFields.code ?? ErrorCode.PurchaseError,
      debugMessage: errorWithFields.debugMessage,
      isEmptyProductList: errorWithFields.isEmptyProductList,
      message: error.message || fallbackMessage,
      productId: errorWithFields.productId ?? productId,
      productIds: errorWithFields.productIds,
      productType: errorWithFields.productType,
      responseCode: errorWithFields.responseCode,
      subResponseCodeAndroid: errorWithFields.subResponseCodeAndroid,
    };
  }

  return {
    code: ErrorCode.PurchaseError,
    message: fallbackMessage,
    productId,
  };
}

function responseCodeName(responseCode: unknown): string {
  return typeof responseCode === 'string' ? responseCode.toUpperCase() : '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
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
  if (name.includes('FAILED')) {
    return operation === 'purchase'
      ? ErrorCode.UserCancelled
      : ErrorCode.ServiceError;
  }

  if (typeof responseCode === 'number') {
    if (operation === 'purchase') {
      if (responseCode === 1) return ErrorCode.AlreadyOwned;
      if (responseCode === 2) return ErrorCode.SkuNotFound;
      if (responseCode === 3) return ErrorCode.FeatureNotSupported;
      if (responseCode === 4) return ErrorCode.UserCancelled;
    }
    if (operation !== 'purchase' && responseCode === 2) {
      return ErrorCode.FeatureNotSupported;
    }
    if (operation !== 'purchase' && responseCode === 3) {
      return ErrorCode.ServiceError;
    }
    if (operation !== 'purchase' && responseCode === 4) {
      return ErrorCode.ServiceError;
    }
  }

  if (operation === 'product-data') return ErrorCode.QueryProduct;
  if (operation === 'user-data') return ErrorCode.InitConnection;
  return ErrorCode.PurchaseError;
}

function shouldRetryResponse(
  operation: ResponseOperation,
  responseCode: unknown,
): boolean {
  if (isSuccess(operation, responseCode)) return false;
  if (operation === 'purchase') return false;
  if (typeof responseCode === 'number') return responseCode === 3;
  return responseCodeName(responseCode).includes('FAILED');
}

function shouldRecoverPurchaseResponse(responseCode: unknown): boolean {
  if (typeof responseCode === 'number') {
    return responseCode === 1 || responseCode === 4;
  }
  const name = responseCodeName(responseCode);
  return name.includes('ALREADY_PURCHASED') || name.includes('FAILED');
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

function toTimestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
}

function priceNumberToMicros(value: number): number {
  return Math.trunc(Math.abs(value) < 10_000 ? value * 1_000_000 : value);
}

function toPriceAmountMicros(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return '0';
}

function getPriceObject(product: VegaProduct): VegaPrice {
  return product.price != null &&
    typeof product.price === 'object' &&
    !Array.isArray(product.price)
    ? product.price
    : {};
}

function getPriceAmountMicros(product: VegaProduct): unknown {
  if (typeof product.price === 'number' && Number.isFinite(product.price)) {
    return priceNumberToMicros(product.price);
  }
  return getPriceObject(product).valueInMicros;
}

function microsToPrice(value: unknown): number | null {
  const micros =
    typeof value === 'bigint' ? Number(value) : Number(value ?? Number.NaN);
  if (!Number.isFinite(micros)) return null;
  return micros / 1_000_000;
}

function getPrice(product: VegaProduct): number | null {
  if (typeof product.price === 'number' && Number.isFinite(product.price)) {
    return Math.abs(product.price) < 10_000
      ? product.price
      : product.price / 1_000_000;
  }
  return microsToPrice(getPriceObject(product).valueInMicros);
}

function getDisplayPrice(product: VegaProduct): string {
  const price = product.price;
  if (typeof price === 'number' && Number.isFinite(price)) {
    const value = Math.abs(price) < 10_000 ? price : price / 1_000_000;
    return value.toFixed(2);
  }
  if (typeof price === 'string') return price;
  return getPriceObject(product).priceStr ?? '';
}

function getCurrency(product: VegaProduct): string {
  return getPriceObject(product).priceCurrencyCode ?? '';
}

function isSubscription(productType: unknown): boolean {
  if (typeof productType === 'number')
    return productType === PRODUCT_TYPE_SUBSCRIPTION;
  if (typeof productType === 'string') {
    return productType.toUpperCase().includes('SUBSCRIPTION');
  }
  return false;
}

function productTypeToOpenIap(productType: unknown): 'in-app' | 'subs' {
  return isSubscription(productType) ? 'subs' : 'in-app';
}

function getProductType(product: VegaProduct): unknown {
  return product.productType ?? product.itemType;
}

function getSubscriptionPeriod(product: VegaProduct): string {
  if (product.subscriptionPeriod) return product.subscriptionPeriod;

  const term = product.term?.toLowerCase() ?? '';
  if (term.includes('year')) return 'P1Y';
  if (term.includes('month')) return 'P1M';
  if (term.includes('week')) return 'P1W';
  if (term.includes('day')) return 'P1D';
  return '';
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
  if (productData instanceof Map) {
    return Array.from(productData.entries()).map(([sku, product]) => ({
      ...product,
      sku: product.sku ?? sku,
    }));
  }
  return Object.entries(productData).map(([sku, product]) => ({
    ...product,
    sku: product.sku ?? sku,
  }));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createUserDataRequest(): VegaUserDataRequest {
  return {
    fetchUserProfileAccessConsentStatus: false,
  };
}

function isVegaParserError(error: unknown): boolean {
  return (
    error instanceof Error &&
    VEGA_PARSER_ERROR_MESSAGES.some((message) =>
      error.message.includes(message),
    )
  );
}

function createPricingPhase(product: VegaProduct) {
  return {
    billingCycleCount: 0,
    billingPeriod: getSubscriptionPeriod(product),
    formattedPrice: getDisplayPrice(product),
    priceAmountMicros: toPriceAmountMicros(getPriceAmountMicros(product)),
    priceCurrencyCode: getCurrency(product),
    recurrenceMode: 1,
  };
}

function createSubscriptionOffer(product: VegaProduct) {
  const sku = product.sku ?? '';
  const pricingPhase = createPricingPhase(product);
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
    currency: getCurrency(product),
    displayPrice: getDisplayPrice(product),
    id: sku,
    offerTagsAndroid: [],
    offerTokenAndroid: '',
    paymentMode: 'pay-as-you-go' as const,
    period: null,
    price: getPrice(product) ?? 0,
    pricingPhasesAndroid: {
      pricingPhaseList: [pricingPhase],
    },
    type: 'introductory' as const,
  };
}

function mapProduct(product: VegaProduct): Product | ProductSubscription {
  const sku = product.sku ?? '';
  const type = productTypeToOpenIap(getProductType(product));
  const base = {
    id: sku,
    title: product.title ?? sku,
    description: product.description ?? '',
    displayName: product.title ?? sku,
    displayPrice: getDisplayPrice(product),
    currency: getCurrency(product),
    price: getPrice(product),
    debugDescription: null,
    platform: 'android' as const,
    nameAndroid: product.title ?? sku,
    oneTimePurchaseOfferDetailsAndroid: null,
    productStatusAndroid: 'ok' as const,
    discountOffers: null,
  };

  if (type === 'subs') {
    return {
      ...base,
      type,
      subscriptionOfferDetailsAndroid: [createSubscriptionOffer(product)],
      subscriptionOffers: [createStandardizedSubscriptionOffer(product)],
    };
  }

  return {
    ...base,
    type,
    subscriptionOfferDetailsAndroid: null,
    subscriptionOffers: null,
  };
}

function mapReceipt(
  receipt: VegaReceipt,
  fallbackProductType?: unknown,
  productIdOverride?: string,
): Purchase {
  const receiptId = receipt.receiptId ?? '';
  const productId = productIdOverride ?? getReceiptSku(receipt);
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
    transactionId: receiptId,
    autoRenewingAndroid: type === 'subs' && isActive,
    dataAndroid: JSON.stringify(receipt),
    signatureAndroid: null,
    isAcknowledgedAndroid: false,
    packageNameAndroid: null,
    obfuscatedAccountIdAndroid: null,
    obfuscatedProfileIdAndroid: null,
    developerPayloadAndroid: null,
    isSuspendedAndroid: Boolean(receipt.isDeferred),
  };
}

export function createExpoIapVegaModule(
  service: VegaPurchasingService,
): ExpoIapVegaModule {
  const productTypesBySku = new Map<string, unknown>();
  const subscriptionBasesBySku = new Map<string, string>();
  const subscriptionParentsBySku = new Map<string, string>();
  const listenersByEventName = new Map<string, Set<VegaListener>>();
  let cachedUserData: VegaUserData | null = null;

  const emit = (eventName: string, payload: unknown): void => {
    for (const listener of listenersByEventName.get(eventName) ?? []) {
      listener(payload);
    }
  };

  const cacheProductMetadata = (product: VegaProduct): void => {
    if (!product.sku) return;

    const productType = getProductType(product);
    productTypesBySku.set(product.sku, productType);

    if (product.subscriptionBase) {
      subscriptionBasesBySku.set(product.sku, product.subscriptionBase);
      productTypesBySku.set(product.subscriptionBase, productType);
    }
    if (product.subscriptionParent) {
      subscriptionParentsBySku.set(product.sku, product.subscriptionParent);
      productTypesBySku.set(product.subscriptionParent, productType);
    }
  };

  const receiptMatchesRequestedSku = (
    receipt: VegaReceipt,
    sku: string,
  ): boolean => {
    const receiptSku = getReceiptSku(receipt);
    if (!receiptSku) return false;
    if (receiptSku === sku || receipt.termSku === sku) return true;
    if (receiptSku === subscriptionBasesBySku.get(sku)) return true;
    if (receiptSku === subscriptionParentsBySku.get(sku)) return true;
    return receiptSku === `${sku}.base`;
  };

  const resolveReceiptProductId = (
    receipt: VegaReceipt,
    productIdOverride?: string,
  ): string => {
    if (productIdOverride) return productIdOverride;

    const receiptSku = getReceiptSku(receipt);
    if (!receiptSku) return '';

    for (const [productSku, subscriptionBase] of subscriptionBasesBySku) {
      if (receiptSku === subscriptionBase) return productSku;
    }

    for (const [productSku, subscriptionParent] of subscriptionParentsBySku) {
      if (receiptSku === subscriptionParent) return productSku;
    }

    if (receiptSku.endsWith('.base')) {
      const parentSku = receiptSku.slice(0, -'.base'.length);
      if (productTypesBySku.has(parentSku)) return parentSku;
    }

    return receiptSku;
  };

  const getUserData = async (): Promise<VegaUserData | null> => {
    let response: VegaUserDataResponse;
    try {
      response = await service.getUserData(createUserDataRequest());
    } catch (error) {
      if (isVegaParserError(error)) {
        return null;
      }
      throw error;
    }
    ensureSuccessful('user-data', response, 'Failed to fetch Amazon user data');
    cachedUserData = response.userData ?? null;
    return cachedUserData;
  };

  const getStorefront = async (): Promise<string> => {
    try {
      const userData = await getUserData();
      const storefront = userData?.marketplace ?? userData?.countryCode;
      if (typeof storefront !== 'string' || storefront.trim().length === 0) {
        throw createVegaError(
          ErrorCode.ServiceError,
          'Amazon Vega storefront lookup returned no country code.',
        );
      }
      return storefront;
    } catch (error) {
      const errorCode =
        error instanceof Error
          ? (error as Error & {code?: unknown}).code
          : undefined;
      if (
        typeof errorCode === 'string' &&
        Object.values(ErrorCode).includes(errorCode as ErrorCode)
      ) {
        throw error;
      }
      throw createVegaError(
        ErrorCode.ServiceError,
        `Failed to get Amazon Vega storefront: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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

      let response: VegaPurchaseUpdatesResponse | null = null;
      for (
        let attempt = 1;
        attempt <= PURCHASE_UPDATES_MAX_ATTEMPTS;
        attempt += 1
      ) {
        try {
          response = await service.getPurchaseUpdates({reset});
        } catch (error) {
          if (isVegaParserError(error)) {
            return receipts;
          }
          throw error;
        }

        if (
          !response ||
          !shouldRetryResponse('purchase-updates', response.responseCode) ||
          attempt === PURCHASE_UPDATES_MAX_ATTEMPTS
        ) {
          break;
        }
        await delay(PURCHASE_UPDATES_RETRY_DELAY_MS);
      }
      if (!response) {
        throw createVegaError(
          ErrorCode.ServiceError,
          'Amazon Vega purchase updates returned no response.',
        );
      }
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
        continue;
      }

      const resolvedSku = resolveReceiptProductId(receipt);
      const resolvedProductType = productTypesBySku.get(resolvedSku);
      if (resolvedProductType != null) {
        productTypesBySku.set(sku, resolvedProductType);
      } else if (!productTypesBySku.has(sku)) {
        missingSkus.add(sku);
      }
    }

    if (missingSkus.size === 0) return;

    let products: VegaProduct[];
    try {
      products = await getProductData(
        Array.from(missingSkus),
        'Failed to fetch Amazon Vega product data for purchase updates',
      );
    } catch (error) {
      if (isVegaParserError(error)) {
        return;
      }
      throw error;
    }

    for (const product of products) {
      cacheProductMetadata(product);
    }
  };

  const getAvailableItems = async (
    options?: PurchaseOptions,
  ): Promise<Purchase[]> => {
    const includeSuspended = Boolean(options?.includeSuspendedAndroid ?? false);
    const receipts = await getPurchaseUpdateReceipts();
    await hydrateProductTypesForReceipts(receipts);
    return receipts
      .filter((receipt) => {
        const isCanceled = Boolean(receipt.isCancelled || receipt.cancelDate);
        if (isCanceled) return false;
        return includeSuspended || !receipt.isDeferred;
      })
      .map((receipt) =>
        mapReceipt(
          receipt,
          getCachedProductType(receipt, productTypesBySku),
          resolveReceiptProductId(receipt),
        ),
      );
  };

  const finishReceipt = async (purchaseToken: string): Promise<void> => {
    if (!purchaseToken) {
      throw createVegaError(
        ErrorCode.DeveloperError,
        'purchaseToken is required to finish an Amazon Vega transaction.',
      );
    }

    let lastResponse: VegaResponse | null = null;
    for (
      let attempt = 1;
      attempt <= NOTIFY_FULFILLMENT_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const response = await withTimeout(
        service.notifyFulfillment({
          fulfillmentResult: FULFILLMENT_RESULT_FULFILLED,
          receiptId: purchaseToken,
        }),
        NOTIFY_FULFILLMENT_ATTEMPT_TIMEOUT_MS,
        createVegaError(
          ErrorCode.ServiceTimeout,
          'Amazon Vega notifyFulfillment timed out.',
        ),
      );
      if (isSuccess('notify-fulfillment', response?.responseCode)) return;
      lastResponse = response;
      if (attempt < NOTIFY_FULFILLMENT_MAX_ATTEMPTS) {
        await delay(NOTIFY_FULFILLMENT_RETRY_DELAY_MS);
      }
    }

    ensureSuccessful(
      'notify-fulfillment',
      lastResponse,
      'Failed to notify Amazon Vega fulfillment',
    );
  };

  const recoverFulfillablePurchases = async (
    sku: string,
    fallbackProductType?: unknown,
    options?: RecoverPurchasesOptions,
  ): Promise<{requestedPurchases: Purchase[]}> => {
    const receipts = await getPurchaseUpdateReceipts();
    await hydrateProductTypesForReceipts(receipts);
    const requestedPurchases: Purchase[] = [];

    for (const receipt of receipts) {
      const isCanceled = Boolean(receipt.isCancelled || receipt.cancelDate);
      if (isCanceled || receipt.isDeferred) continue;

      const purchaseTimestamp = toTimestamp(receipt.purchaseDate);
      if (
        options?.minPurchaseDateMs != null &&
        (purchaseTimestamp === 0 ||
          purchaseTimestamp < options.minPurchaseDateMs)
      ) {
        continue;
      }

      const matchesRequestedSku = receiptMatchesRequestedSku(receipt, sku);
      if (!matchesRequestedSku) {
        continue;
      }

      const purchase = mapReceipt(
        receipt,
        receipt.productType ??
          getCachedProductType(receipt, productTypesBySku, sku) ??
          fallbackProductType,
        resolveReceiptProductId(receipt, sku),
      );
      requestedPurchases.push(purchase);
      emit('purchase-updated', purchase);
    }

    return {requestedPurchases};
  };

  const verifyWithIapkit = async (
    options: VerifyPurchaseWithProviderProps,
  ): Promise<VerifyPurchaseWithProviderResult> => {
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
    ): RequestVerifyPurchaseWithIapkitResult {
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

      const productId = json.productId;
      if (productId != null && typeof productId !== 'string') {
        throw createVegaError(
          ErrorCode.ReceiptFailed,
          `IAPKit returned malformed response (HTTP ${status}).`,
        );
      }

      return {
        isValid: json.isValid,
        ...(productId == null ? {} : {productId}),
        state: normalizeIapkitState(json.state),
        store: 'amazon',
      };
    }

    if (options.provider !== 'iapkit') {
      throw createVegaError(
        ErrorCode.FeatureNotSupported,
        `Unsupported purchase verification provider: ${options.provider}.`,
      );
    }

    const iapkit = options.iapkit;
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
      await getUserData();
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
    const verificationUrl = getIapkitVerifyUrl(iapkit?.baseUrl);
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        IAPKIT_VERIFY_TIMEOUT_MS,
      );
      response = await fetch(verificationUrl, {
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
      iapkit: result,
    };
  };

  const vegaModule: ExpoIapVegaModule = {
    ERROR_CODES: ErrorCode,
    async initConnection(): Promise<boolean> {
      return true;
    },
    async endConnection(): Promise<boolean> {
      productTypesBySku.clear();
      subscriptionBasesBySku.clear();
      subscriptionParentsBySku.clear();
      cachedUserData = null;
      return true;
    },
    async fetchProducts(
      type: string,
      skus: string[],
    ): Promise<(Product | ProductSubscription)[]> {
      if (!Array.isArray(skus) || skus.length === 0) {
        throw createVegaError(ErrorCode.EmptySkuList, 'No SKUs provided');
      }

      const products = await getProductData(
        skus,
        'Failed to fetch Amazon Vega products',
      );

      return products
        .filter((product) => {
          cacheProductMetadata(product);
          const openIapType = productTypeToOpenIap(getProductType(product));
          if (type === 'all') return true;
          if (type === 'subs') return openIapType === 'subs';
          return openIapType === 'in-app';
        })
        .map(mapProduct);
    },
    async requestPurchase(params): Promise<Purchase[]> {
      let sku: string | undefined;
      try {
        const skus = params.skuArr ?? [];
        if (skus.length !== 1) {
          throw createVegaError(
            ErrorCode.DeveloperError,
            'Amazon Vega purchase expects exactly one SKU per request.',
          );
        }

        sku = skus[0]!;
        const fallbackProductType =
          params.type === 'subs'
            ? PRODUCT_TYPE_SUBSCRIPTION
            : productTypesBySku.get(sku);
        if (fallbackProductType != null) {
          productTypesBySku.set(sku, fallbackProductType);
        }
        let response: VegaPurchaseResponse;
        const purchaseStartedAtMs =
          Date.now() - PURCHASE_RECOVERY_CLOCK_SKEW_MS;
        try {
          response = await service.purchase({sku});
        } catch (error) {
          if (isVegaParserError(error)) {
            try {
              const recovered = await recoverFulfillablePurchases(
                sku,
                fallbackProductType,
                {minPurchaseDateMs: purchaseStartedAtMs},
              );
              if (recovered.requestedPurchases.length > 0) {
                return recovered.requestedPurchases;
              }
            } catch {
              // Keep the original parser error as the source of truth.
            }
          }
          throw error;
        }

        if (
          !isSuccess('purchase', response.responseCode) &&
          shouldRecoverPurchaseResponse(response.responseCode)
        ) {
          try {
            const recovered = await recoverFulfillablePurchases(
              sku,
              fallbackProductType,
            );
            if (recovered.requestedPurchases.length > 0) {
              return recovered.requestedPurchases;
            }
          } catch {
            // Keep the original purchase response as the source of truth.
          }
        }

        ensureSuccessful(
          'purchase',
          response,
          'Failed to complete Amazon Vega purchase',
          sku,
        );
        cachedUserData = response.userData ?? cachedUserData;

        if (!response.receipt) return [];
        const purchase = mapReceipt(response.receipt, fallbackProductType, sku);
        emit('purchase-updated', purchase);
        return [purchase];
      } catch (error) {
        emit(
          'purchase-error',
          toPurchaseErrorPayload(
            error,
            'Failed to complete Amazon Vega purchase',
            sku,
          ),
        );
        throw error;
      }
    },
    getAvailableItems,
    async getActiveSubscriptions(
      subscriptionIds?: string[] | null,
    ): Promise<ActiveSubscription[]> {
      const requestedIds = new Set(subscriptionIds ?? []);
      const purchases = await getAvailableItems({
        includeSuspendedAndroid: false,
      });
      return purchases
        .filter(
          (purchase) =>
            purchase.isAutoRenewing &&
            (requestedIds.size === 0 || requestedIds.has(purchase.productId)),
        )
        .map((purchase) => ({
          productId: purchase.productId,
          isActive: true,
          transactionId: purchase.transactionId ?? purchase.id,
          purchaseToken: purchase.purchaseToken ?? null,
          transactionDate: purchase.transactionDate,
          expirationDateIOS: null,
          environmentIOS: null,
          willExpireSoon: null,
          daysUntilExpirationIOS: null,
          renewalInfoIOS: null,
          autoRenewingAndroid:
            purchase.platform === 'android'
              ? ((
                  purchase as Purchase & {
                    autoRenewingAndroid?: boolean | null;
                  }
                ).autoRenewingAndroid ?? null)
              : null,
          basePlanIdAndroid: purchase.productId,
          currentPlanId: purchase.productId,
          purchaseTokenAndroid: purchase.purchaseToken ?? null,
        }));
    },
    async hasActiveSubscriptions(
      subscriptionIds?: string[] | null,
    ): Promise<boolean> {
      const subscriptions =
        await vegaModule.getActiveSubscriptions(subscriptionIds);
      return subscriptions.length > 0;
    },
    async acknowledgePurchaseAndroid(purchaseToken): Promise<void> {
      await finishReceipt(purchaseToken);
    },
    async consumePurchaseAndroid(purchaseToken): Promise<void> {
      await finishReceipt(purchaseToken);
    },
    async getStorefront(): Promise<string> {
      return getStorefront();
    },
    async verifyPurchaseWithProvider(options) {
      return verifyWithIapkit(options);
    },
    addListener(eventName, listener) {
      const listeners = listenersByEventName.get(eventName) ?? new Set();
      listeners.add(listener);
      listenersByEventName.set(eventName, listeners);
      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
    removeListener(eventName, listener): void {
      listenersByEventName.get(eventName)?.delete(listener);
    },
  };

  return vegaModule;
}
