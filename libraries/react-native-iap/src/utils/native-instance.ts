/* eslint-disable @typescript-eslint/no-require-imports */
import {
  createLegacyIap,
  createNormalizedIap,
  createProtocolIap,
} from './native-protocol';
import type {RnIapProtocol} from '../specs/RnIapProtocol.nitro';
import type {RnIap} from '../specs/RnIap.nitro';
import {getVegaIapModule as getVegaAdapter, isVegaOS} from '../vega';

let iapRef: RnIap | null = null;

interface ExpoGlobal {
  expo?: {modules?: {ExpoGo?: unknown}};
}

export const EXPO_GO_UNSUPPORTED_MESSAGE =
  'react-native-iap cannot run in Expo Go. For Expo projects, use expo-iap in a native development build instead.';

export const toErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    (error as {message?: unknown}).message != null
  ) {
    return String((error as {message?: unknown}).message);
  }
  return String(error ?? '');
};

export const isNativeIapReady = (): boolean => {
  try {
    getNativeIapInstance();
    return true;
  } catch {
    return false;
  }
};

export function getNativeIapInstance(): RnIap {
  if (iapRef) return iapRef;

  if (isVegaOS()) {
    const vegaModule = getVegaAdapter();
    if (!vegaModule) {
      throw new Error(
        'Amazon Vega IAP module is unavailable. Install @amazon-devices/keplerscript-appstore-iap-lib in the Vega app target and build with the React Native for Vega kepler platform.',
      );
    }
    iapRef = createNormalizedIap(vegaModule);
    return iapRef;
  }

  if ((globalThis as ExpoGlobal).expo?.modules?.ExpoGo) {
    throw new Error(EXPO_GO_UNSUPPORTED_MESSAGE);
  }

  try {
    // Nitro's import itself installs native bindings, which Expo Go cannot load.
    const {
      NitroModules,
    }: typeof import('react-native-nitro-modules') = require('react-native-nitro-modules');
    // The older-binary fallback is removed in the next major release (18.0.0).
    iapRef =
      typeof NitroModules.hasHybridObject === 'function' &&
      NitroModules.hasHybridObject('RnIapProtocol')
        ? createProtocolIap(
            NitroModules.createHybridObject<RnIapProtocol>('RnIapProtocol'),
          )
        : createLegacyIap(NitroModules.createHybridObject<RnIap>('RnIap'));
  } catch (e) {
    const msg = toErrorMessage(e);
    if (
      msg.includes('Nitro') ||
      msg.includes('JSI') ||
      msg.includes('dispatcher') ||
      msg.includes('HybridObject')
    ) {
      throw new Error(
        'Nitro runtime not installed yet. Ensure react-native-nitro-modules is initialized before calling IAP.',
      );
    }
    throw e;
  }
  return iapRef;
}

export const hasNativeIapInstance = (): boolean => iapRef !== null;
