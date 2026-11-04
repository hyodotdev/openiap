import {Capacitor} from '@capacitor/core';
import {ErrorCode, type IapPlatform} from '../types';
import {createPurchaseError, type PurchaseError} from './errorMapping';

export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

export const isStorePlatform = (): boolean => isIOS() || isAndroid();

// Platform tag for PurchaseErrors built from native rejections.
export const nativePlatform = (): IapPlatform => (isIOS() ? 'ios' : 'android');

export const unsupportedPlatformError = (): PurchaseError =>
  createPurchaseError({
    code: ErrorCode.FeatureNotSupported,
    message: `capacitor-iap does not support the ${Capacitor.getPlatform()} platform`,
  });

export const requireStorePlatform = (): void => {
  if (!isStorePlatform()) throw unsupportedPlatformError();
};

/** Throws the documented error when an iOS-only API runs elsewhere. */
export const requireIOS = (methodName: string): void => {
  if (!isIOS()) {
    throw createPurchaseError({
      code: ErrorCode.FeatureNotSupported,
      message: `${methodName} is only available on iOS`,
    });
  }
};

/** Throws the documented error when an Android-only API runs elsewhere. */
export const requireAndroid = (methodName: string): void => {
  if (!isAndroid()) {
    throw createPurchaseError({
      code: ErrorCode.FeatureNotSupported,
      message: `${methodName} is only available on Android`,
    });
  }
};
