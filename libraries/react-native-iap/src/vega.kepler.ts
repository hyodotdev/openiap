import {Platform} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import {PurchasingService} from '@amazon-devices/keplerscript-appstore-iap-lib';
import type {RnIap} from './specs/RnIap.nitro';
import {createVegaIapModule, type VegaPurchasingService} from './vega-adapter';

let cachedVegaModule: RnIap | null = null;

export const isVegaOS = (): boolean => {
  return String(Platform.OS).toLowerCase() === 'kepler';
};

export const getVegaIapModule = (): RnIap | null => {
  if (!isVegaOS()) return null;
  if (!cachedVegaModule) {
    cachedVegaModule = createVegaIapModule(
      PurchasingService as unknown as VegaPurchasingService,
    );
  }
  return cachedVegaModule;
};
