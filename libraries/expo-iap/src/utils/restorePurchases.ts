import ExpoIapModule from '../ExpoIapModule';
import {syncIOS} from '../modules/ios';
import {ErrorCode} from '../types';
import {createPurchaseError} from './errorMapping';

/**
 * Run the native iOS restore/sync phase without querying purchases.
 *
 * Both native implementations promise an authoritative boolean. A rejection
 * or false result must reach the caller so restore cannot report success from
 * a subsequent empty purchase query.
 */
export const restorePurchasesIOSNative = async (): Promise<void> => {
  const nativeModule = ExpoIapModule as any;
  const usingOnside =
    nativeModule.USING_ONSIDE_SDK &&
    typeof nativeModule.restorePurchases === 'function';
  const restored = usingOnside
    ? await nativeModule.restorePurchases()
    : await syncIOS();

  if (restored !== true) {
    throw createPurchaseError({
      code: ErrorCode.SyncError,
      message: usingOnside
        ? 'Onside purchase restore did not complete'
        : 'App Store purchase sync did not complete',
      platform: 'ios',
    });
  }
};
