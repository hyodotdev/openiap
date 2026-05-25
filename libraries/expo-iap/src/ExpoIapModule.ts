import {requireNativeModule, UnavailabilityError} from 'expo-modules-core';
import {installedFromOnside} from './onside';
import {getVegaIapModule, isVegaOS} from './vega';

type NativeIapModuleName = 'ExpoIapVega' | 'ExpoIapOnside' | 'ExpoIap';
const ONSIDE_MARKETPLACE_ID = 'com.onside.marketplace-app';

let cached: {module: any; name: NativeIapModuleName} | null = null;
let expoIapFallback: any | null | undefined;
let onsideModuleUnavailable = false;

function getResolved(): {module: any; name: NativeIapModuleName} {
  function shouldUseOnsideModule(): boolean {
    if (installedFromOnside === true) {
      return true;
    }

    if (typeof installedFromOnside !== 'string') {
      return false;
    }

    const normalized = installedFromOnside.trim().toLowerCase();
    return normalized === 'true' || normalized === ONSIDE_MARKETPLACE_ID;
  }

  function getExpectedModuleName(): NativeIapModuleName {
    if (isVegaOS()) {
      return 'ExpoIapVega';
    }

    return shouldUseOnsideModule() && !onsideModuleUnavailable
      ? 'ExpoIapOnside'
      : 'ExpoIap';
  }

  function resolveNativeModule(): {
    module: any;
    name: NativeIapModuleName;
  } {
    if (isVegaOS()) {
      const vegaModule = getVegaIapModule();
      if (!vegaModule) {
        throw new UnavailabilityError(
          'expo-iap',
          'Amazon Vega IAP module is unavailable. Add @amazon-devices/keplerscript-appstore-iap-lib and build with the React Native Vega kepler platform.',
        );
      }
      return {module: vegaModule, name: 'ExpoIapVega'};
    }

    if (shouldUseOnsideModule()) {
      try {
        return {
          module: requireNativeModule('ExpoIapOnside'),
          name: 'ExpoIapOnside',
        };
      } catch (error) {
        if (!isMissingModuleError(error, 'ExpoIapOnside')) {
          throw error;
        }
        onsideModuleUnavailable = true;
      }
    }

    return {module: requireNativeModule('ExpoIap'), name: 'ExpoIap'};
  }

  const expectedName = getExpectedModuleName();
  if (!cached || cached.name !== expectedName) {
    cached = resolveNativeModule();
  }
  return cached;
}

function isMissingModuleError(error: unknown, moduleName: string): boolean {
  if (error instanceof UnavailabilityError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes(`Cannot find native module '${moduleName}'`);
  }

  return false;
}

function getExpoIapFallbackModule(): any | null {
  if (expoIapFallback !== undefined) {
    return expoIapFallback;
  }

  try {
    expoIapFallback = requireNativeModule('ExpoIap');
  } catch (error) {
    if (isMissingModuleError(error, 'ExpoIap')) {
      expoIapFallback = null;
    } else {
      throw error;
    }
  }

  return expoIapFallback;
}

export const NATIVE_ERROR_CODES: Record<string, unknown> = new Proxy(
  {} as Record<string, unknown>,
  {
    get(target, prop) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop);
      return (getResolved().module.ERROR_CODES || {})[prop as string];
    },
  },
);

/**
 * Returns the raw native module (not wrapped in a Proxy).
 * Use this for EventEmitter / addListener calls — JSI HostObjects
 * require the real native module as `this`; a Proxy triggers
 * "native state unsupported on Proxy" on New Architecture / Hermes.
 */
export function getNativeModule() {
  return getResolved().module;
}

export default new Proxy({} as any, {
  get(target, prop) {
    if (typeof prop === 'symbol') return Reflect.get(target, prop);
    const resolved = getResolved();
    if (prop === 'USING_ONSIDE_SDK') {
      return resolved.name === 'ExpoIapOnside';
    }
    if (prop === 'USING_VEGA_SDK') {
      return resolved.name === 'ExpoIapVega';
    }

    const value = resolved.module[prop];
    if (value !== undefined || resolved.name !== 'ExpoIapOnside') {
      return value;
    }

    return getExpoIapFallbackModule()?.[prop];
  },
});
