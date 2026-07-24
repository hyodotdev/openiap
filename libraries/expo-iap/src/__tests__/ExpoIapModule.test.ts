describe('ExpoIapModule proxy', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadExpoIapModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../ExpoIapModule').default;
  };

  it('does not load ExpoIapOnside when Onside is not enabled', () => {
    const expoIapModule = {
      ERROR_CODES: {},
      fetchProducts: jest.fn(),
    };
    const requireNativeModule = jest.fn((name: string) => {
      if (name === 'ExpoIap') return expoIapModule;
      throw new Error(`Unexpected native module '${name}'`);
    });

    jest.doMock('../onside', () => ({
      installedFromOnside: false,
    }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule,
      UnavailabilityError: class UnavailabilityError extends Error {},
    }));

    const ExpoIapModule = loadExpoIapModule();

    expect(ExpoIapModule.USING_ONSIDE_SDK).toBe(false);
    expect(ExpoIapModule.fetchProducts).toBe(expoIapModule.fetchProducts);
    expect(requireNativeModule).toHaveBeenCalledTimes(1);
    expect(requireNativeModule).toHaveBeenCalledWith('ExpoIap');
  });

  it('re-resolves when Onside availability changes after initial access', () => {
    let installedFromOnside: boolean | null = null;
    const expoIapModule = {
      ERROR_CODES: {},
      fetchProducts: jest.fn(),
    };
    const onsideModule = {
      ERROR_CODES: {},
      fetchProducts: jest.fn(),
    };
    const requireNativeModule = jest.fn((name: string) => {
      if (name === 'ExpoIap') return expoIapModule;
      if (name === 'ExpoIapOnside') return onsideModule;
      throw new Error(`Cannot find native module '${name}'`);
    });

    jest.doMock('../onside', () => ({
      get installedFromOnside() {
        return installedFromOnside;
      },
    }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule,
      UnavailabilityError: class UnavailabilityError extends Error {},
    }));

    const ExpoIapModule = loadExpoIapModule();

    expect(ExpoIapModule.fetchProducts).toBe(expoIapModule.fetchProducts);
    installedFromOnside = true;
    expect(ExpoIapModule.USING_ONSIDE_SDK).toBe(true);
    expect(ExpoIapModule.fetchProducts).toBe(onsideModule.fetchProducts);
    expect(requireNativeModule.mock.calls.map(([name]) => name)).toEqual([
      'ExpoIap',
      'ExpoIapOnside',
    ]);
  });

  it('treats the Onside marketplace id as an Onside installation', () => {
    const onsideModule = {
      ERROR_CODES: {},
      fetchProducts: jest.fn(),
    };
    const requireNativeModule = jest.fn((name: string) => {
      if (name === 'ExpoIapOnside') return onsideModule;
      throw new Error(`Cannot find native module '${name}'`);
    });

    jest.doMock('../onside', () => ({
      installedFromOnside: 'com.onside.marketplace-app',
    }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule,
      UnavailabilityError: class UnavailabilityError extends Error {},
    }));

    const ExpoIapModule = loadExpoIapModule();

    expect(ExpoIapModule.USING_ONSIDE_SDK).toBe(true);
    expect(ExpoIapModule.fetchProducts).toBe(onsideModule.fetchProducts);
    expect(requireNativeModule).toHaveBeenCalledWith('ExpoIapOnside');
  });

  it('fails closed without repeatedly loading a missing ExpoIapOnside module', () => {
    const requireNativeModule = jest.fn((name: string) => {
      if (name === 'ExpoIapOnside') {
        throw new Error("Cannot find native module 'ExpoIapOnside'");
      }
      throw new Error(`Cannot find native module '${name}'`);
    });

    jest.doMock('../onside', () => ({
      installedFromOnside: true,
    }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule,
      UnavailabilityError: class UnavailabilityError extends Error {},
    }));

    const ExpoIapModule = loadExpoIapModule();

    expect(() => ExpoIapModule.USING_ONSIDE_SDK).toThrow();
    expect(() => ExpoIapModule.USING_ONSIDE_SDK).toThrow();
    expect(requireNativeModule.mock.calls.map(([name]) => name)).toEqual([
      'ExpoIapOnside',
    ]);
  });

  it('fails closed for methods missing from ExpoIapOnside', () => {
    const onsideModule = {
      ERROR_CODES: {},
      requestPurchase: jest.fn(),
    };
    const requireNativeModule = jest.fn((name: string) => {
      if (name === 'ExpoIapOnside') return onsideModule;
      throw new Error(`Cannot find native module '${name}'`);
    });

    jest.doMock('../onside', () => ({
      installedFromOnside: true,
    }));
    jest.doMock('expo-modules-core', () => ({
      requireNativeModule,
      UnavailabilityError: class UnavailabilityError extends Error {},
    }));

    const ExpoIapModule = loadExpoIapModule();

    expect(ExpoIapModule.USING_ONSIDE_SDK).toBe(true);
    expect(ExpoIapModule.requestPurchase).toBe(onsideModule.requestPurchase);
    expect(() => ExpoIapModule.verifyPurchase()).toThrow();
    expect(() => ExpoIapModule.getActiveSubscriptions()).toThrow();
    expect(requireNativeModule).toHaveBeenCalledTimes(1);
  });
});
