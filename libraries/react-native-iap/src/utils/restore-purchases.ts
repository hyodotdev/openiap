import {Platform} from 'react-native';
import {ErrorCode} from '../types';
import {isVegaOS} from '../vega';
import {getNativeIapInstance} from './native-instance';
import {parseErrorStringToJsonObj} from './error';
import {
  createPurchaseError,
  type PurchaseError as PurchaseErrorInstance,
} from './errorMapping';

// Shared by the root API and useIAP so a native JSON error keeps its code.
export const toRestorePurchaseError = (
  error: unknown,
): PurchaseErrorInstance => {
  const parsedError = parseErrorStringToJsonObj(error);
  return createPurchaseError({
    code: parsedError.code,
    message: parsedError.message,
    responseCode: parsedError.responseCode,
    debugMessage: parsedError.debugMessage,
  });
};

export const restorePurchasesNative = async (): Promise<void> => {
  if (isVegaOS()) return;
  const restored = await getNativeIapInstance().restorePurchases();
  if (restored !== true) {
    throw createPurchaseError({
      code: ErrorCode.SyncError,
      message: 'Store purchase restore did not complete',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  }
};
