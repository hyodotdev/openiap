import type {RnIap} from '../specs/RnIap.nitro';
import type {RnIapProtocol} from '../specs/RnIapProtocol.nitro';
import {createPurchaseError, type PurchaseErrorProps} from './errorMapping';
import {normalizePurchaseError} from './native-error';
import {parseNativePurchaseError} from './legacy-native-error';

// The value marks void methods, whose successful outcome omits value.
const operations = {
  initConnection: false,
  endConnection: false,
  fetchProducts: false,
  requestPurchase: false,
  getAvailablePurchases: false,
  getActiveSubscriptions: false,
  hasActiveSubscriptions: false,
  finishTransaction: false,
  getAppTransactionIOS: false,
  getPromotedProductIOS: false,
  verifyAppOwnership: false,
  openRedeemOfferCode: false,
  clearTransactionIOS: true,
  beginRefundRequestIOS: false,
  subscriptionStatusIOS: false,
  currentEntitlementIOS: false,
  latestTransactionIOS: false,
  getPendingTransactionsIOS: false,
  getAllTransactionsIOS: false,
  restorePurchases: false,
  syncIOS: false,
  showManageSubscriptionsIOS: false,
  deepLinkToSubscriptionsIOS: false,
  isEligibleForIntroOfferIOS: false,
  getReceiptDataIOS: false,
  requestReceiptRefreshIOS: false,
  isTransactionVerifiedIOS: false,
  getTransactionJwsIOS: false,
  verifyPurchase: false,
  verifyPurchaseWithProvider: false,
  getStorefront: false,
  deepLinkToSubscriptionsAndroid: true,
  enableBillingProgramAndroid: true,
  isBillingProgramAvailableAndroid: false,
  getBillingChoiceInfoAndroid: false,
  createBillingProgramReportingDetailsAndroid: false,
  showBillingProgramInformationDialogAndroid: false,
  showInAppMessagesAndroid: false,
  launchExternalLinkAndroid: false,
  canPresentExternalPurchaseNoticeIOS: false,
  presentExternalPurchaseNoticeSheetIOS: false,
  presentExternalPurchaseLinkIOS: false,
  isEligibleForExternalPurchaseCustomLinkIOS: false,
  getExternalPurchaseCustomLinkTokenIOS: false,
  showExternalPurchaseCustomLinkNoticeIOS: false,
} satisfies Record<
  Exclude<
    keyof RnIapProtocol,
    | keyof import('react-native-nitro-modules').HybridObject<{
        ios: 'swift';
        android: 'kotlin';
      }>
    | 'core'
  >,
  boolean
>;

const isOperation = (key: PropertyKey): key is keyof typeof operations =>
  Object.prototype.hasOwnProperty.call(operations, key);

const unwrap = (result: unknown, isVoid: boolean): unknown => {
  if (typeof result !== 'object' || result === null) {
    throw createPurchaseError({
      code: 'unknown',
      message: 'Invalid native IAP outcome',
    });
  }
  if ('error' in result && result.error != null) {
    throw createPurchaseError(normalizePurchaseError(result.error));
  }
  if ('value' in result && result.value !== undefined) return result.value;
  if (isVoid) return undefined;
  throw createPurchaseError({
    code: 'unknown',
    message: 'Missing native IAP outcome value',
  });
};

export const createProtocolIap = (protocol: RnIapProtocol): RnIap => {
  const core = protocol.core;
  return new Proxy(core, {
    get(target, key) {
      if (!isOperation(key)) {
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      const operation: unknown = Reflect.get(protocol, key, protocol);
      return (...args: unknown[]) => {
        try {
          if (typeof operation !== 'function')
            throw new Error('Native IAP operation is unavailable');
          const result: unknown = Reflect.apply(operation, protocol, args);
          if (key === 'enableBillingProgramAndroid')
            return unwrap(result, operations[key]);
          return Promise.resolve(result).then(
            (value) => unwrap(value, operations[key]),
            (error) => {
              throw createPurchaseError(normalizePurchaseError(error));
            },
          );
        } catch (error) {
          const normalized = createPurchaseError(normalizePurchaseError(error));
          if (key === 'enableBillingProgramAndroid') throw normalized;
          return Promise.reject(normalized);
        }
      };
    },
  });
};

export const createNormalizedIap = (
  core: RnIap,
  normalizeError: (
    error: unknown,
  ) => PurchaseErrorProps = normalizePurchaseError,
): RnIap =>
  new Proxy(core, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!isOperation(key)) return value.bind(target);
      return (...args: unknown[]) => {
        try {
          const result: unknown = Reflect.apply(value, target, args);
          if (key === 'enableBillingProgramAndroid') return result;
          return Promise.resolve(result).catch((error) => {
            throw createPurchaseError(normalizeError(error));
          });
        } catch (error) {
          const normalized = createPurchaseError(normalizeError(error));
          if (key === 'enableBillingProgramAndroid') throw normalized;
          return Promise.reject(normalized);
        }
      };
    },
  });

/** @deprecated Removed in the next major release (18.0.0); rebuild iOS/Android apps for typed outcomes. */
export const createLegacyIap = (core: RnIap): RnIap =>
  createNormalizedIap(core, parseNativePurchaseError);
