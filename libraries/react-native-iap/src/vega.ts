import {Platform} from 'react-native';
import type {RnIap} from './specs/RnIap.nitro';

export const isVegaOS = (): boolean => {
  return String(Platform.OS).toLowerCase() === 'kepler';
};

export const getVegaIapModule = (): RnIap | null => {
  return null;
};
