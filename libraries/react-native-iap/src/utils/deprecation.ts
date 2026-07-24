import {RnIapConsole} from './debug';

const emittedLegacyWarnings = new Set<string>();

export const warnLegacyOnce = (key: string, message: string): void => {
  if (emittedLegacyWarnings.has(key)) {
    return;
  }

  emittedLegacyWarnings.add(key);
  RnIapConsole.warn(message);
};

export const resetLegacyWarningsForTesting = (): void => {
  emittedLegacyWarnings.clear();
};
