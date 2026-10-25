/* eslint-disable @typescript-eslint/no-require-imports */
const EXPO_GO_MESSAGE = 'react-native-iap cannot run in Expo Go';
const NITRO_IMPORT_ERROR = 'The native NitroModules module could not be found.';

const loadWithoutNitro = (): typeof import('../index') => {
  jest.resetModules();
  jest.doMock('react-native-nitro-modules', () => ({
    NitroModules: {
      createHybridObject: jest.fn(() => {
        throw new Error(NITRO_IMPORT_ERROR);
      }),
    },
  }));
  return require('../index');
};

const loadWithNitroImportFailure = (): typeof import('../index') => {
  jest.resetModules();
  jest.doMock('react-native-nitro-modules', () => {
    throw new Error(NITRO_IMPORT_ERROR);
  });
  return require('../index');
};

describe('Expo Go', () => {
  const originalExpo = Object.getOwnPropertyDescriptor(globalThis, 'expo');

  afterEach(() => {
    if (originalExpo) {
      Object.defineProperty(globalThis, 'expo', originalExpo);
    } else {
      delete (globalThis as {expo?: unknown}).expo;
    }
    jest.restoreAllMocks();
  });

  describe('when running in Expo Go', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'expo', {
        configurable: true,
        value: {modules: {ExpoGo: {}}},
      });
    });

    it('reports the native runtime as unavailable', () => {
      expect(loadWithoutNitro().isNitroReady()).toBe(false);
    });

    it('rejects initConnection with an Expo Go message', async () => {
      await expect(loadWithoutNitro().initConnection()).rejects.toThrow(
        EXPO_GO_MESSAGE,
      );
    });

    it('allows early listener registration and cleanup with a warning', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const IAP = loadWithoutNitro();
      const updated = IAP.purchaseUpdatedListener(jest.fn());
      const failed = IAP.purchaseErrorListener(jest.fn());

      expect(() => updated.remove()).not.toThrow();
      expect(() => failed.remove()).not.toThrow();
      expect(warn).toHaveBeenCalledWith(
        '[RN-IAP]',
        expect.stringContaining(EXPO_GO_MESSAGE),
      );
    });

    it('loads and explains the unsupported runtime before importing Nitro', async () => {
      const IAP = loadWithNitroImportFailure();

      expect(IAP.isNitroReady()).toBe(false);
      await expect(IAP.initConnection()).rejects.toThrow(EXPO_GO_MESSAGE);
    });

    it('keeps listeners safe when Nitro itself cannot be imported', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const IAP = loadWithNitroImportFailure();

      expect(() =>
        IAP.purchaseUpdatedListener(jest.fn()).remove(),
      ).not.toThrow();
      expect(() => IAP.purchaseErrorListener(jest.fn()).remove()).not.toThrow();
    });
  });

  describe('outside Expo Go', () => {
    it('preserves the native runtime initialization error', async () => {
      const IAP = loadWithoutNitro();

      expect(IAP.isNitroReady()).toBe(false);
      await expect(IAP.initConnection()).rejects.toThrow(
        'Nitro runtime not installed yet',
      );
    });

    it('defers a failed Nitro import until a native operation', async () => {
      const IAP = loadWithNitroImportFailure();

      expect(IAP.isNitroReady()).toBe(false);
      await expect(IAP.initConnection()).rejects.toThrow(
        'Nitro runtime not installed yet',
      );
    });

    it('does not mistake a development build for Expo Go', async () => {
      Object.defineProperty(globalThis, 'expo', {
        configurable: true,
        value: {modules: {}},
      });

      await expect(loadWithoutNitro().initConnection()).rejects.toThrow(
        'Nitro runtime not installed yet',
      );
    });
  });
});
