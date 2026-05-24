import {Platform} from 'react-native';
import type {ExpoIapVegaModule} from './vega-adapter';

export const isVegaOS = (): boolean => {
  return String(Platform.OS).toLowerCase() === 'kepler';
};

export const getVegaIapModule = (): ExpoIapVegaModule | null => {
  return null;
};
