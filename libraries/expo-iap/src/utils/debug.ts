/**
 * Debug logger for Expo IAP
 * Only logs when explicitly enabled for library development
 * Silent for all library users (even in their dev mode)
 */

// Check if we're in library development mode
// This will be false for library users, even in their dev environment
const isLibraryDevelopment = () => {
  // Only show logs if explicitly enabled via environment variable
  // Library developers can set: EXPO_IAP_DEV_MODE=true

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
    // Silent for library users
  },

  debug: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.debug('[Expo-IAP Debug]', ...args);
    }
    // Silent for library users
  },

  warn: (...args: any[]) => {
    // Warnings are always shown
    console.warn('[Expo-IAP]', ...args);
  },

  error: (...args: any[]) => {
    // Errors are always shown
    console.error('[Expo-IAP]', ...args);
  },

  info: (...args: any[]) => {
    if (isLibraryDevelopment()) {
      console.info('[Expo-IAP]', ...args);
    }
    // Silent for library users
  },
});

// Export a singleton instance
export const ExpoIapConsole = createConsole();
