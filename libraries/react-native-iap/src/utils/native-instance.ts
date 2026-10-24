import {NitroModules} from 'react-native-nitro-modules';
import type {RnIap} from '../specs/RnIap.nitro';
import {getVegaIapModule as getVegaAdapter, isVegaOS} from '../vega';

let iapRef: RnIap | null = null;

type ExpoGlobal = {expo?: {modules?: Record<string, unknown>}};

export const EXPO_GO_UNSUPPORTED_MESSAGE =
  'react-native-iap cannot run in Expo Go. In-app purchases need native code: use a development build (npx expo run:ios / run:android) or expo-iap.';

export const isExpoGo = (): boolean =>
  Boolean((globalThis as ExpoGlobal).expo?.modules?.ExpoGo);

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
  if (iapRef) return true;
  if (isVegaOS()) {
    iapRef = getVegaAdapter();
    return Boolean(iapRef);
  }
  try {
    iapRef = NitroModules.createHybridObject<RnIap>('RnIap');
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
    iapRef = vegaModule;
    return iapRef;
  }

  // Attempt to create the HybridObject and map common Nitro/JSI readiness errors
  try {
    iapRef = NitroModules.createHybridObject<RnIap>('RnIap');
  } catch (e) {
    if (isExpoGo()) {
      throw new Error(EXPO_GO_UNSUPPORTED_MESSAGE);
    }
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
