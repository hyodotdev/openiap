/**
 * Debug logger for React Native IAP.
 * log/debug/info print only when library developers set RN_IAP_DEV_MODE=true,
 * so apps stay silent even in their dev builds. warn/error always print.
 */

const isLibraryDevelopment = () => {
  const g = globalThis as {
    process?: {env?: Record<string, string | undefined>};
    RN_IAP_DEV_MODE?: boolean;
  };
  return (
    g.process?.env?.RN_IAP_DEV_MODE === 'true' || g.RN_IAP_DEV_MODE === true
  );
};

export const RnIapConsole = {
  log: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.log('[RN-IAP]', ...args);
    }
  },

  debug: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.debug('[RN-IAP Debug]', ...args);
    }
  },

  warn: (...args: any[]) => {
    console.warn('[RN-IAP]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[RN-IAP]', ...args);
  },

  info: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.info('[RN-IAP]', ...args);
    }
  },
};
