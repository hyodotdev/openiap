import {Platform} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import {PurchasingService} from '@amazon-devices/keplerscript-appstore-iap-lib';
import {
  createExpoIapVegaModule,
  type ExpoIapVegaModule,
  type VegaPurchasingService,
} from './vega-adapter';

let cachedVegaModule: ExpoIapVegaModule | null = null;

/**
 * Returns true when the current React Native platform is Amazon Vega/Kepler.
 */
export const isVegaOS = (): boolean => {
  return String(Platform.OS).toLowerCase() === 'kepler';
};

/**
 * Lazily creates the Vega IAP adapter backed by Amazon's Kepler Appstore IAP service.
 */
export const getVegaIapModule = (): ExpoIapVegaModule | null => {
  if (!isVegaOS()) return null;
  if (!cachedVegaModule) {
    cachedVegaModule = createExpoIapVegaModule(
      PurchasingService as unknown as VegaPurchasingService,
    );
  }
  return cachedVegaModule;
};
