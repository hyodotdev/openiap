/**
 * Debug logger for Expo IAP. log/debug/info print only when EXPO_IAP_DEV_MODE
 * is set for library development, so apps stay silent even in dev mode;
 * warn and error always print.
 */

const isLibraryDevelopment = () => {
  // Read both through a typed globalThis: a consumer type-checking this file
  // has no Node types, so a bare `process` does not compile.
  const g = globalThis as {
    process?: {env?: Record<string, string | undefined>};
    EXPO_IAP_DEV_MODE?: boolean;
  };

  return (
    g.process?.env?.EXPO_IAP_DEV_MODE === 'true' || g.EXPO_IAP_DEV_MODE === true
  );
};

const createConsole = () => ({
  log: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.log('[Expo-IAP]', ...args);
    }
  },

  debug: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.debug('[Expo-IAP Debug]', ...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn('[Expo-IAP]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[Expo-IAP]', ...args);
  },

  info: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.info('[Expo-IAP]', ...args);
    }
  },
});

export const ExpoIapConsole = createConsole();
