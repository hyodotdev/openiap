import {useSyncExternalStore} from 'react';
import {
  getPromotedProductIOS,
  promotedProductListenerIOS,
  type Product,
} from 'expo-iap';
import {Platform} from 'react-native';
import {
  DEFAULT_SUBSCRIPTION_PRODUCT_ID,
  PRODUCT_IDS,
  SUBSCRIPTION_PRODUCT_IDS,
} from './utils/constants';

export const PROMOTED_IAP_BUNDLE_ID = 'dev.hyo.martie';

export const PROMOTED_IAP_PRODUCT_IDS = [
  ...SUBSCRIPTION_PRODUCT_IDS,
  ...PRODUCT_IDS,
] as readonly string[];

export const PROMOTED_IAP_DEFAULT_PRODUCT_ID = DEFAULT_SUBSCRIPTION_PRODUCT_ID;

export type PromotedIapEventSource =
  | 'setup'
  | 'listener'
  | 'getPromotedProductIOS'
  | 'error';

export type PromotedIapEvent = {
  id: number;
  at: string;
  source: PromotedIapEventSource;
  message: string;
  productId?: string;
  product?: Product | null;
};

let didRegisterEvents = false;
let eventCounter = 0;
let events: PromotedIapEvent[] = [];
let subscription: {remove: () => void} | undefined;
const listeners = new Set<() => void>();

const isPromotedIapSupported = () => Platform.OS === 'ios';

const getProductId = (product: Product | null | undefined) => {
  if (!product) {
    return undefined;
  }

  return product.id ?? (product as Product & {productId?: string}).productId;
};

const notify = () => {
  listeners.forEach((listener) => listener());
};

const publish = (
  event: Omit<PromotedIapEvent, 'id' | 'at'>,
): PromotedIapEvent => {
  const nextEvent = {
    ...event,
    id: ++eventCounter,
    at: new Date().toISOString(),
  };
  events = [nextEvent, ...events].slice(0, 25);

  const logPayload =
    nextEvent.product === undefined
      ? ''
      : ` ${JSON.stringify(nextEvent.product)}`;
  console.log(
    `[PromotedIap] ${nextEvent.source}: ${nextEvent.message}${logPayload}`,
  );

  notify();
  return nextEvent;
};

const snapshot = () => events;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const buildPromotedIapUrl = (
  productId: string = PROMOTED_IAP_DEFAULT_PRODUCT_ID,
  bundleId: string = PROMOTED_IAP_BUNDLE_ID,
) =>
  `itms-services://?action=purchaseIntent&bundleId=${encodeURIComponent(
    bundleId,
  )}&productIdentifier=${encodeURIComponent(productId)}`;

export const refreshPromotedIapProduct = async () => {
  if (!isPromotedIapSupported()) {
    publish({
      source: 'error',
      message: 'promoted IAP is available on iOS only',
    });
    return null;
  }

  try {
    const product = await getPromotedProductIOS();
    const productId = getProductId(product);
    publish({
      source: 'getPromotedProductIOS',
      product,
      productId,
      message: productId ?? 'no pending promoted product',
    });
    return product;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    publish({
      source: 'error',
      message: `getPromotedProductIOS failed: ${message}`,
    });
    return null;
  }
};

export const registerPromotedIapEvents = () => {
  if (didRegisterEvents) {
    return;
  }
  didRegisterEvents = true;

  publish({
    source: 'setup',
    message: isPromotedIapSupported()
      ? 'root listener registered'
      : 'promoted IAP is available on iOS only',
  });

  if (!isPromotedIapSupported()) {
    return;
  }

  subscription = promotedProductListenerIOS((product) => {
    const productId = getProductId(product);
    publish({
      source: 'listener',
      product,
      productId,
      message: productId ?? 'promoted product without product id',
    });
  });

  void refreshPromotedIapProduct();
};

export const unregisterPromotedIapEvents = () => {
  subscription?.remove();
  subscription = undefined;
  didRegisterEvents = false;
};

export const resetPromotedIapEvents = () => {
  events = [];
  notify();
};

export const usePromotedIapEvents = () =>
  useSyncExternalStore(subscribe, snapshot, snapshot);
