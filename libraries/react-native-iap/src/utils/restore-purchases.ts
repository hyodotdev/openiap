import {Platform} from 'react-native';
import {ErrorCode} from '../types';
import {isVegaOS} from '../vega';
import {getNativeIapInstance} from './native-instance';
import {createPurchaseError} from './errorMapping';

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
