import {ErrorCode, type Purchase, type PurchaseIOS} from '../types';
import {createPurchaseError} from './errorMapping';

const ANDROID_STORES = new Set(['google', 'amazon', 'horizon']);

const malformedPurchaseError = (message: string) =>
  createPurchaseError({
    code: ErrorCode.BillingResponseJsonParseError,
    message,
  });

/** Decode an authoritative native purchase list without partial success. */
export const decodeAvailablePurchases = (value: unknown): Purchase[] => {
  if (!Array.isArray(value)) {
    throw malformedPurchaseError(
      'Native bridge returned a malformed purchase list',
    );
  }

  value.forEach((item, index) => {
    if (item == null || typeof item !== 'object') {
      throw malformedPurchaseError(
        `Native bridge returned a malformed purchase at index ${index}`,
      );
    }
    const purchase = item as Partial<Purchase>;
    if (
      typeof purchase.id !== 'string' ||
      purchase.id.length === 0 ||
      typeof purchase.productId !== 'string' ||
      purchase.productId.length === 0 ||
      typeof purchase.transactionDate !== 'number' ||
      !Number.isFinite(purchase.transactionDate) ||
      typeof purchase.store !== 'string' ||
      typeof purchase.quantity !== 'number' ||
      !Number.isInteger(purchase.quantity) ||
      typeof purchase.purchaseState !== 'string' ||
      typeof purchase.isAutoRenewing !== 'boolean' ||
      (purchase.store === 'apple' &&
        (typeof purchase.transactionId !== 'string' ||
          purchase.transactionId.length === 0))
    ) {
      throw malformedPurchaseError(
        `Native bridge returned a purchase missing required fields at index ${index}`,
      );
    }
    const candidate = purchase as Record<string, unknown>;
    if (
      candidate.ids != null &&
      (!Array.isArray(candidate.ids) ||
        candidate.ids.some((id) => typeof id !== 'string'))
    ) {
      throw malformedPurchaseError(
        `Native bridge returned malformed purchase ids at index ${index}`,
      );
    }
    for (const field of [
      'pendingPurchaseUpdateAndroid',
      'offerIOS',
      'renewalInfoIOS',
      'commitmentInfoIOS',
      'advancedCommerceInfoIOS',
    ]) {
      const nested = candidate[field];
      if (
        nested != null &&
        (typeof nested !== 'object' || Array.isArray(nested))
      ) {
        throw malformedPurchaseError(
          `Native bridge returned a malformed ${field} at index ${index}`,
        );
      }
    }
  });

  return value as Purchase[];
};

/** Decode an authoritative StoreKit list without filtering foreign entries. */
export const decodeApplePurchases = (value: unknown): PurchaseIOS[] => {
  const decoded = decodeAvailablePurchases(value);
  const invalidIndex = decoded.findIndex(
    (purchase) => purchase.store !== 'apple',
  );
  if (invalidIndex !== -1) {
    throw malformedPurchaseError(
      `Native StoreKit bridge returned a non-Apple purchase at index ${invalidIndex}`,
    );
  }
  return decoded as PurchaseIOS[];
};

/** Decode an authoritative Android-family list without foreign stores. */
export const decodeAndroidPurchases = (value: unknown): Purchase[] => {
  const decoded = decodeAvailablePurchases(value);
  const invalidIndex = decoded.findIndex(
    (purchase) => !ANDROID_STORES.has(purchase.store),
  );
  if (invalidIndex !== -1) {
    throw malformedPurchaseError(
      `Native Android bridge returned a foreign purchase at index ${invalidIndex}`,
    );
  }
  return decoded;
};
