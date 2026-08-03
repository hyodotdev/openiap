import {ErrorCode} from '../types';
import type {Purchase, PurchaseIOS} from '../types';
import {createPurchaseError} from './errorMapping';
import {
  convertNitroPurchaseToPurchase,
  validateNitroPurchase,
} from './type-bridge';

const ANDROID_STORES = new Set(['google', 'amazon', 'horizon']);

/** Decode an authoritative native purchase list atomically. */
export const convertAvailablePurchasesOrThrow = (
  purchases: unknown,
): Purchase[] => {
  if (!Array.isArray(purchases)) {
    throw createPurchaseError({
      code: ErrorCode.BillingResponseJsonParseError,
      message: 'Malformed purchase list returned by the native bridge',
    });
  }

  return purchases.map((purchase, index) => {
    if (!validateNitroPurchase(purchase)) {
      throw createPurchaseError({
        code: ErrorCode.BillingResponseJsonParseError,
        message: `Malformed purchase payload returned by the native bridge at index ${index}`,
      });
    }

    try {
      return convertNitroPurchaseToPurchase(purchase);
    } catch {
      throw createPurchaseError({
        code: ErrorCode.BillingResponseJsonParseError,
        message: `Failed to decode native purchase payload at index ${index}`,
      });
    }
  });
};

/** Decode an authoritative StoreKit purchase list without filtering entries. */
export const convertApplePurchasesOrThrow = (
  purchases: unknown,
): PurchaseIOS[] => {
  const decoded = convertAvailablePurchasesOrThrow(purchases);
  const invalidIndex = decoded.findIndex(
    (purchase) => purchase.store !== 'apple',
  );
  if (invalidIndex !== -1) {
    throw createPurchaseError({
      code: ErrorCode.BillingResponseJsonParseError,
      message: `Native StoreKit bridge returned a non-Apple purchase at index ${invalidIndex}`,
    });
  }
  return decoded as PurchaseIOS[];
};

/** Decode an authoritative Android-family purchase list without foreign stores. */
export const convertAndroidPurchasesOrThrow = (
  purchases: unknown,
): Purchase[] => {
  const decoded = convertAvailablePurchasesOrThrow(purchases);
  const invalidIndex = decoded.findIndex(
    (purchase) => !ANDROID_STORES.has(purchase.store),
  );
  if (invalidIndex !== -1) {
    throw createPurchaseError({
      code: ErrorCode.BillingResponseJsonParseError,
      message: `Native Android bridge returned a foreign purchase at index ${invalidIndex}`,
    });
  }
  return decoded;
};
