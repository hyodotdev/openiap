/* eslint-disable @typescript-eslint/no-require-imports */
const EXPO_GO_MESSAGE = 'react-native-iap cannot run in Expo Go';

const loadWithoutNitro = () => {
  jest.resetModules();
  jest.doMock('react-native-nitro-modules', () => ({
    NitroModules: {
      createHybridObject: jest.fn(() => {
        throw new Error(
          'Failed to get NitroModules: The native "NitroModules" Turbo/Native-Module could not be found.',
        );
      }),
    },
  }));
  return require('../index');
};

describe('Expo Go', () => {
  afterEach(() => {
    delete (globalThis as {expo?: unknown}).expo;
  });

  describe('when running in Expo Go', () => {
    beforeEach(() => {
      (globalThis as {expo?: unknown}).expo = {modules: {ExpoGo: {}}};
    });

    it('detects Expo Go', () => {
      expect(loadWithoutNitro().isExpoGo()).toBe(true);
    });

    it('rejects initConnection with an Expo Go message', async () => {
      await expect(loadWithoutNitro().initConnection()).rejects.toThrow(
        EXPO_GO_MESSAGE,
      );
    });

    it('keeps listener registration from throwing', () => {
      const IAP = loadWithoutNitro();
      expect(() => IAP.purchaseUpdatedListener(jest.fn())).not.toThrow();
      expect(() => IAP.purchaseErrorListener(jest.fn())).not.toThrow();
    });
  });

  describe('outside Expo Go', () => {
    it('does not detect Expo Go', () => {
      expect(loadWithoutNitro().isExpoGo()).toBe(false);
    });

    it('does not mention Expo Go in the init error', async () => {
      await expect(loadWithoutNitro().initConnection()).rejects.not.toThrow(
        EXPO_GO_MESSAGE,
      );
    });
  });
});
