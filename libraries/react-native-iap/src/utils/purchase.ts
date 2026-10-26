import {createPurchaseError} from './errorMapping';
import {normalizePurchaseError} from './native-error';
import type {NitroPurchaseResult} from '../specs/RnIap.nitro';

export type PurchaseOperationContext =
  'finishTransaction' | 'acknowledgePurchaseAndroid' | 'consumePurchaseAndroid';

export const getSuccessFromPurchaseVariant = (
  variant: NitroPurchaseResult | boolean,
  context: PurchaseOperationContext,
): boolean => {
  if (typeof variant === 'boolean') {
    return variant;
  }

  if (variant.responseCode === 0) {
    return true;
  }

  throw createPurchaseError(
    normalizePurchaseError({
      ...variant,
      message: variant.message || `Failed to ${context}`,
    }),
  );
};
