import {Platform} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import {PurchasingService} from '@amazon-devices/keplerscript-appstore-iap-lib';
import {
  createExpoIapVegaModule,
  type ExpoIapVegaModule,
  type VegaPurchasingService,
} from './vega-adapter';

let cachedVegaModule: ExpoIapVegaModule | null = null;

export const isVegaOS = (): boolean => {
  return String(Platform.OS).toLowerCase() === 'kepler';
};

export const getVegaIapModule = (): ExpoIapVegaModule | null => {
  if (!isVegaOS()) return null;
  if (!cachedVegaModule) {
    cachedVegaModule = createExpoIapVegaModule(
      PurchasingService as unknown as VegaPurchasingService,
    );
  }
  return cachedVegaModule;
};
