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

  // Handle both Node.js and React Native environments
  if (
    typeof process !== 'undefined' &&
    process.env?.EXPO_IAP_DEV_MODE === 'true'
  ) {
    return true;
  }

  // Check global object (works in both environments)
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as any).EXPO_IAP_DEV_MODE === true
  ) {
    return true;
  }

  return false;
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
