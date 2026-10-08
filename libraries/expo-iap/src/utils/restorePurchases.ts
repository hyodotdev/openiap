import ExpoIapModule from '../ExpoIapModule';
import {Platform} from 'react-native';
import {isVegaOS} from '../vega';
import {syncIOS} from '../modules/ios';
import {ErrorCode} from '../types';
import {createPurchaseError} from './errorMapping';

/** Restore through the selected provider before querying ownership. */
export const restorePurchasesNative = async (): Promise<void> => {
  if (isVegaOS()) return;
  const usingNativeRestore =
    typeof ExpoIapModule.restorePurchases === 'function';
  const restored = usingNativeRestore
    ? await ExpoIapModule.restorePurchases?.()
    : Platform.OS === 'ios'
      ? await syncIOS()
      : true;

  if (restored !== true) {
    throw createPurchaseError({
      code: ErrorCode.SyncError,
      message: usingNativeRestore
        ? 'Store purchase restore did not complete'
        : 'App Store purchase sync did not complete',
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  }
};
