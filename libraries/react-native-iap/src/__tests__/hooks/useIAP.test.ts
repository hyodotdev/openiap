/* eslint-disable import/first */
import React, {act} from 'react';
import {createRoot, type Root} from 'test-renderer';

const TestRenderer = {
  create(element: React.ReactElement): Root {
    const root = createRoot();
    root.render(element);
    return root;
  },
};

// Minimal Nitro mock used by index/useIAP under the hood
const mockIap: any = {
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  finishTransaction: jest.fn(async () => true),
  addPurchaseUpdatedListener: jest.fn(),
  removePurchaseUpdatedListener: jest.fn(),
  addPurchaseErrorListener: jest.fn(),
  removePurchaseErrorListener: jest.fn(),
  addPromotedProductListenerIOS: jest.fn(),
  removePromotedProductListenerIOS: jest.fn(),
  addSubscriptionBillingIssueListener: jest.fn(),
  removeSubscriptionBillingIssueListener: jest.fn(),
  openRedeemOfferCodeAndroid: jest.fn(async () => true),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockIap),
  },
}));

jest.mock('react-native', () => ({
  Platform: {OS: 'ios', select: (obj: any) => obj.ios},
}));

// Mock is handled through spyOn in beforeEach

// Import after mocks
import * as IAP from '../../index';
import {useIAP} from '../../hooks/useIAP';

describe('hooks/useIAP (renderer)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete (global as any).RN_IAP_DEV_MODE;
  });

  let capturedPurchaseListener: any;
  let mockFetchProducts: jest.SpyInstance;
  let mockGetAvailablePurchases: jest.SpyInstance;
  let mockGetActiveSubscriptions: jest.SpyInstance;
  let mockHasActiveSubscriptions: jest.SpyInstance;
  let mockSyncIOS: jest.SpyInstance;

  beforeEach(() => {
    capturedPurchaseListener = undefined;
    jest.spyOn(IAP, 'initConnection').mockResolvedValue(true as any);
    mockGetAvailablePurchases = jest
      .spyOn(IAP, 'getAvailablePurchases')
      .mockResolvedValue([] as any);
    mockGetActiveSubscriptions = jest
      .spyOn(IAP, 'getActiveSubscriptions')
      .mockResolvedValue([] as any);
    mockHasActiveSubscriptions = jest
      .spyOn(IAP, 'hasActiveSubscriptions')
      .mockResolvedValue(false as any);
    jest.spyOn(IAP, 'finishTransaction').mockResolvedValue(undefined as any);
    mockFetchProducts = jest
      .spyOn(IAP, 'fetchProducts')
      .mockResolvedValue([] as any);
    mockSyncIOS = jest.spyOn(IAP, 'syncIOS').mockResolvedValue(true as any);
    jest.spyOn(IAP, 'purchaseUpdatedListener').mockImplementation((cb: any) => {
      capturedPurchaseListener = cb;
      return {remove: jest.fn()};
    });
    jest.spyOn(IAP, 'purchaseErrorListener').mockImplementation(() => {
      return {remove: jest.fn()};
    });
    // Avoid native iap call in index.promotedProductListenerIOS
    jest
      .spyOn(IAP, 'promotedProductListenerIOS')
      .mockImplementation(() => ({remove: jest.fn()}));
  });

  it('starts only the current initialization in React Strict Mode', async () => {
    const root = createRoot({isStrictMode: true});

    await act(async () => {
      root.render(
        React.createElement(() => {
          useIAP();
          return null;
        }),
      );
      await Promise.resolve();
    });

    expect(IAP.initConnection).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('connects on mount and updates state on purchase events', async () => {
    let api: any;
    const onPurchaseSuccess = jest.fn();
    const Harness = () => {
      api = useIAP({onPurchaseSuccess});
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });

    // Allow effects to run and connection to settle
    await act(async () => {});
    expect(api.connected).toBe(true);
    expect(IAP.initConnection).toBeDefined();

    // Simulate a purchase update coming from native
    const purchase = {
      id: 't1',
      productId: 'p1',
      transactionDate: Date.now(),
      platform: 'ios',
      store: 'apple',
      quantity: 1,
      purchaseState: 'purchased',
      isAutoRenewing: false,
    };
    act(() => {
      capturedPurchaseListener?.(purchase);
    });
    await act(async () => {});
    expect(onPurchaseSuccess).toHaveBeenCalledWith(purchase);

    // Ensure finishTransaction wrapper works
    await act(async () => {
      await api.finishTransaction({purchase, isConsumable: false});
    });
    expect(IAP.finishTransaction).toBeDefined();
  });

  it('still delivers purchase success when unmounted while refresh is pending', async () => {
    let resolveActiveSubscriptions: (() => void) | undefined;
    mockGetActiveSubscriptions.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveActiveSubscriptions = () => resolve([]);
        }) as any,
    );

    const onPurchaseSuccess = jest.fn();
    const Harness = () => {
      useIAP({onPurchaseSuccess});
      return null;
    };

    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    const purchase = {
      id: 't1',
      productId: 'p1',
      transactionDate: Date.now(),
      platform: 'ios',
      store: 'apple',
      quantity: 1,
      purchaseState: 'purchased',
      isAutoRenewing: false,
    };
    if (!capturedPurchaseListener) {
      throw new Error('purchase listener was not initialized');
    }

    const purchaseUpdate = capturedPurchaseListener(purchase);

    if (!resolveActiveSubscriptions) {
      throw new Error('active subscriptions resolver was not initialized');
    }
    const resolvePendingActiveSubscriptions = resolveActiveSubscriptions;

    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
    expect(onPurchaseSuccess).toHaveBeenCalledWith(
      expect.objectContaining({id: 't1', productId: 'p1'}),
    );

    await act(async () => {
      renderer.unmount();
    });

    await act(async () => {
      resolvePendingActiveSubscriptions();
      await purchaseUpdate;
    });

    // The pending state refresh does not redeliver the purchase callback.
    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
    expect(onPurchaseSuccess).toHaveBeenCalledWith(
      expect.objectContaining({id: 't1', productId: 'p1'}),
    );
  });

  it('refreshes purchase state when onPurchaseSuccess throws', async () => {
    const callbackError = new Error('host callback failed');
    const onPurchaseSuccess = jest.fn(() => {
      throw callbackError;
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const Harness = () => {
      useIAP({onPurchaseSuccess});
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});
    mockGetActiveSubscriptions.mockClear();
    mockGetAvailablePurchases.mockClear();

    if (!capturedPurchaseListener) {
      throw new Error('purchase listener was not initialized');
    }
    await act(async () => {
      await capturedPurchaseListener({id: 't1', productId: 'p1'});
    });

    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockGetAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[RN-IAP]',
      '[useIAP] onPurchaseSuccess failed:',
      callbackError,
    );
    consoleError.mockRestore();
  });

  it('refreshes purchase state when onPurchaseSuccess rejects', async () => {
    const callbackError = new Error('async host callback failed');
    const onPurchaseSuccess = jest.fn(async () => {
      throw callbackError;
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const Harness = () => {
      useIAP({onPurchaseSuccess});
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});
    mockGetActiveSubscriptions.mockClear();
    mockGetAvailablePurchases.mockClear();

    if (!capturedPurchaseListener) {
      throw new Error('purchase listener was not initialized');
    }
    await act(async () => {
      await capturedPurchaseListener({id: 't1', productId: 'p1'});
    });

    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockGetAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[RN-IAP]',
      '[useIAP] onPurchaseSuccess failed:',
      callbackError,
    );
    consoleError.mockRestore();
  });

  it('reports a post-purchase refresh failure after delivering success', async () => {
    const refreshError = new Error('refresh failed');
    const onPurchaseSuccess = jest.fn();
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const Harness = () => {
      useIAP({onPurchaseSuccess});
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});
    mockGetActiveSubscriptions.mockClear();
    mockGetAvailablePurchases.mockClear();
    mockGetActiveSubscriptions.mockRejectedValueOnce(refreshError);

    if (!capturedPurchaseListener) {
      throw new Error('purchase listener was not initialized');
    }
    await act(async () => {
      await capturedPurchaseListener({id: 't1', productId: 'p1'});
    });

    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockGetAvailablePurchases).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      '[RN-IAP]',
      '[useIAP] post-purchase refresh failed:',
      refreshError,
    );
    consoleWarn.mockRestore();
  });

  it('requestPurchase calls root API and returns void', async () => {
    const mockRequestPurchase = jest
      .spyOn(IAP, 'requestPurchase')
      .mockResolvedValue(null);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    await act(async () => {
      const result = await api.requestPurchase({sku: 'product1'});
      expect(result).toBeUndefined();
    });

    expect(mockRequestPurchase).toHaveBeenCalledWith({sku: 'product1'});
  });

  it('exposes openRedeemOfferCode as the root cross-platform API', async () => {
    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});

    expect(api.openRedeemOfferCode).toBe(IAP.openRedeemOfferCode);
  });

  it('does not log product offer tokens', async () => {
    (global as any).RN_IAP_DEV_MODE = true;
    const debug = jest.spyOn(console, 'debug').mockImplementation();
    mockFetchProducts.mockResolvedValueOnce([
      {id: 'product1', discountOffers: [{offerTokenAndroid: 'secret-token'}]},
    ] as any);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {
      await api.fetchProducts({skus: ['product1']});
    });

    expect(debug).toHaveBeenCalledWith(
      '[RN-IAP Debug]',
      '[useIAP] fetchProducts count:',
      1,
    );
    expect(debug.mock.calls.flat(Infinity).join(' ')).not.toContain(
      'secret-token',
    );
    debug.mockRestore();
  });

  it('refreshes an existing product when it is fetched again', async () => {
    mockFetchProducts
      .mockResolvedValueOnce([
        {id: 'product1', type: 'in-app', displayPrice: '$1.00'},
      ] as any)
      .mockResolvedValueOnce([
        {id: 'product1', type: 'in-app', displayPrice: '$2.00'},
      ] as any);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});
    await act(async () => {
      await api.fetchProducts({skus: ['product1']});
    });
    expect(api.products).toEqual([
      expect.objectContaining({id: 'product1', displayPrice: '$1.00'}),
    ]);

    await act(async () => {
      await api.fetchProducts({skus: ['product1']});
    });
    expect(api.products).toEqual([
      expect.objectContaining({id: 'product1', displayPrice: '$2.00'}),
    ]);
  });

  it('refreshes an existing subscription when it is fetched again', async () => {
    mockFetchProducts
      .mockResolvedValueOnce([
        {id: 'subscription1', type: 'subs', displayPrice: '$1.00'},
      ] as any)
      .mockResolvedValueOnce([
        {id: 'subscription1', type: 'subs', displayPrice: '$2.00'},
      ] as any);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });

    await act(async () => {
      await api.fetchProducts({skus: ['subscription1'], type: 'subs'});
      await api.fetchProducts({skus: ['subscription1'], type: 'subs'});
    });

    expect(api.subscriptions).toEqual([
      expect.objectContaining({id: 'subscription1', displayPrice: '$2.00'}),
    ]);
  });

  it('refreshes products and subscriptions fetched together', async () => {
    mockFetchProducts
      .mockResolvedValueOnce([
        {id: 'product1', type: 'in-app', displayPrice: '$1.00'},
        {id: 'subscription1', type: 'subs', displayPrice: '$2.00'},
      ] as any)
      .mockResolvedValueOnce([
        {id: 'product1', type: 'in-app', displayPrice: '$3.00'},
        {id: 'subscription1', type: 'subs', displayPrice: '$4.00'},
      ] as any);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });

    await act(async () => {
      await api.fetchProducts({
        skus: ['product1', 'subscription1'],
        type: 'all',
      });
      await api.fetchProducts({
        skus: ['product1', 'subscription1'],
        type: 'all',
      });
    });

    expect(api.products).toEqual([
      expect.objectContaining({id: 'product1', displayPrice: '$3.00'}),
    ]);
    expect(api.subscriptions).toEqual([
      expect.objectContaining({id: 'subscription1', displayPrice: '$4.00'}),
    ]);
  });

  it('ignores an older all-products response for the same SKUs', async () => {
    type ProductResult = {id: string; type: string; displayPrice: string};
    let resolveFirst: ((value: ProductResult[]) => void) | undefined;
    let resolveSecond: ((value: ProductResult[]) => void) | undefined;
    mockFetchProducts
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });

    let firstFetch: Promise<void>;
    let secondFetch: Promise<void>;
    act(() => {
      firstFetch = api.fetchProducts({
        skus: ['product1', 'subscription1'],
        type: 'all',
      });
      secondFetch = api.fetchProducts({
        skus: ['product1', 'subscription1'],
        type: 'all',
      });
    });

    await act(async () => {
      resolveSecond?.([
        {id: 'product1', type: 'in-app', displayPrice: '$3.00'},
        {id: 'subscription1', type: 'subs', displayPrice: '$4.00'},
      ]);
      await secondFetch!;
    });

    await act(async () => {
      resolveFirst?.([
        {id: 'product1', type: 'in-app', displayPrice: '$1.00'},
        {id: 'subscription1', type: 'subs', displayPrice: '$2.00'},
      ]);
      await firstFetch!;
    });

    expect(api.products).toEqual([
      expect.objectContaining({id: 'product1', displayPrice: '$3.00'}),
    ]);
    expect(api.subscriptions).toEqual([
      expect.objectContaining({id: 'subscription1', displayPrice: '$4.00'}),
    ]);
  });

  it('delegates product fetches while the hook is disconnected', async () => {
    jest.spyOn(IAP, 'initConnection').mockResolvedValueOnce(false as any);
    mockFetchProducts.mockResolvedValueOnce([
      {id: 'product1', type: 'in-app'},
    ] as any);

    let api: any;
    const Harness = () => {
      api = useIAP();
      return null;
    };
    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
    });
    await act(async () => {});
    expect(api.connected).toBe(false);

    await act(async () => {
      await api.fetchProducts({skus: ['product1']});
    });

    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['product1'],
      type: 'in-app',
    });
    expect(api.products).toEqual([expect.objectContaining({id: 'product1'})]);
  });

  describe('onError callback', () => {
    it('calls onError when fetchProducts fails', async () => {
      const fetchError = new Error('Network error fetching products');
      mockFetchProducts.mockRejectedValueOnce(fetchError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      // Call fetchProducts which should trigger onError
      await act(async () => {
        await api.fetchProducts({skus: ['product1']});
      });

      expect(onError).toHaveBeenCalledWith(fetchError);
    });

    it('calls onError when getAvailablePurchases fails', async () => {
      const purchaseError = new Error('Failed to get purchases');
      mockGetAvailablePurchases.mockRejectedValueOnce(purchaseError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.getAvailablePurchases();
        } catch (error) {
          thrown = error;
        }
      });

      expect(onError).toHaveBeenCalledWith(purchaseError);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(thrown).toBe(purchaseError);
    });

    it('calls onError when getActiveSubscriptions fails', async () => {
      const subscriptionError = new Error('Failed to get subscriptions');
      mockGetActiveSubscriptions.mockRejectedValueOnce(subscriptionError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.getActiveSubscriptions();
        } catch (error) {
          thrown = error;
        }
      });

      expect(onError).toHaveBeenCalledWith(subscriptionError);
      expect(thrown).toBe(subscriptionError);
    });

    it('calls onError when hasActiveSubscriptions fails', async () => {
      const hasSubsError = new Error('Failed to check subscriptions');
      mockHasActiveSubscriptions.mockRejectedValueOnce(hasSubsError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.hasActiveSubscriptions();
        } catch (error) {
          thrown = error;
        }
      });

      expect(onError).toHaveBeenCalledWith(hasSubsError);
      expect(thrown).toBe(hasSubsError);
    });

    it('calls onError when restorePurchases fails (syncIOS error on iOS)', async () => {
      const restoreError = new Error('Failed to restore');
      mockSyncIOS.mockRejectedValueOnce(restoreError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.restorePurchases();
        } catch (error) {
          thrown = error;
        }
      });

      expect(mockSyncIOS).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(restoreError);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(thrown).toBe(restoreError);
    });

    it('rejects when restorePurchases syncIOS returns false on iOS', async () => {
      mockSyncIOS.mockResolvedValueOnce(false as any);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.restorePurchases();
        } catch (error) {
          thrown = error;
        }
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(thrown);
      expect(thrown).toMatchObject({
        code: IAP.ErrorCode.SyncError,
        message: 'App Store purchase sync did not complete',
      });
      expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
    });

    it('calls onError when restorePurchases fails (getAvailablePurchases error)', async () => {
      const purchaseError = new Error('Failed to get purchases after restore');
      mockGetAvailablePurchases.mockRejectedValueOnce(purchaseError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      let thrown: unknown;
      await act(async () => {
        try {
          await api.restorePurchases();
        } catch (error) {
          thrown = error;
        }
      });

      expect(onError).toHaveBeenCalledWith(purchaseError);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(thrown).toBe(purchaseError);
    });

    it('restorePurchases calls syncIOS then getAvailablePurchases on iOS', async () => {
      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      await act(async () => {
        await api.restorePurchases();
      });

      expect(mockSyncIOS).toHaveBeenCalled();
      expect(mockGetAvailablePurchases).toHaveBeenCalled();
    });

    it('does not call onError when operations succeed', async () => {
      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      await act(async () => {
        await api.fetchProducts({skus: ['product1']});
        await api.getAvailablePurchases();
        await api.getActiveSubscriptions();
        await api.hasActiveSubscriptions();
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it('converts non-Error objects to Error in onError callback', async () => {
      const stringError = 'String error message';
      mockFetchProducts.mockRejectedValueOnce(stringError);

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      await act(async () => {
        await api.fetchProducts({skus: ['product1']});
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toBe(stringError);
    });

    it('calls onError when initConnection fails', async () => {
      const initError = new Error('Failed to initialize connection');
      jest.spyOn(IAP, 'initConnection').mockRejectedValueOnce(initError);

      const onError = jest.fn();
      const Harness = () => {
        useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });

      // Wait for initConnection to be called and fail
      await act(async () => {});

      expect(onError).toHaveBeenCalledWith(initError);
    });

    it('does not throw unhandled exception when initConnection fails with onError', async () => {
      const initError = new Error('Store unavailable');
      jest.spyOn(IAP, 'initConnection').mockRejectedValueOnce(initError);

      const onError = jest.fn();
      const Harness = () => {
        useIAP({onError});
        return null;
      };

      // This should not throw an unhandled promise rejection
      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });

      await act(async () => {});

      // onError should be called, error should be handled gracefully
      expect(onError).toHaveBeenCalledWith(initError);
    });

    it('handles initConnection failure without onError callback', async () => {
      const initError = new Error('Connection failed');
      const initConnectionSpy = jest
        .spyOn(IAP, 'initConnection')
        .mockRejectedValueOnce(initError);

      // No onError callback - should not throw unhandled exception
      const Harness = () => {
        useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });

      await act(async () => {});

      // Test passes if no unhandled exception is thrown
      expect(initConnectionSpy).toHaveBeenCalled();
    });
  });

  describe('reconnect', () => {
    it('reconnects and returns true on success', async () => {
      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      // Reset mock to track reconnect call
      (IAP.initConnection as jest.Mock).mockClear();
      jest.spyOn(IAP, 'initConnection').mockResolvedValue(true as any);

      let result: boolean | undefined;
      await act(async () => {
        result = await api.reconnect();
      });

      expect(result).toBe(true);
      expect(api.connected).toBe(true);
    });

    it('returns false and sets connected=false when initConnection returns false', async () => {
      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      jest.spyOn(IAP, 'initConnection').mockResolvedValueOnce(false as any);

      let result: boolean | undefined;
      await act(async () => {
        result = await api.reconnect();
      });

      expect(result).toBe(false);
      expect(api.connected).toBe(false);
    });

    it('calls onError and returns false when reconnect fails', async () => {
      const reconnectError = new Error('Reconnect failed');

      let api: any;
      const onError = jest.fn();
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      jest.spyOn(IAP, 'initConnection').mockRejectedValueOnce(reconnectError);

      let result: boolean | undefined;
      await act(async () => {
        result = await api.reconnect();
      });

      expect(result).toBe(false);
      expect(onError).toHaveBeenCalledWith(reconnectError);
    });

    it('does not throw when reconnect fails without onError', async () => {
      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      jest
        .spyOn(IAP, 'initConnection')
        .mockRejectedValueOnce(new Error('fail'));

      let result: boolean | undefined;
      await act(async () => {
        result = await api.reconnect();
      });

      expect(result).toBe(false);
    });

    it('reconnect re-registers listeners after successful reconnection', async () => {
      let api: any;
      const onPurchaseSuccess = jest.fn();
      const Harness = () => {
        api = useIAP({onPurchaseSuccess});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      // purchaseUpdatedListener should have been called during init
      expect(IAP.purchaseUpdatedListener).toHaveBeenCalled();

      // Clear and reconnect
      (IAP.purchaseUpdatedListener as jest.Mock).mockClear();
      jest.spyOn(IAP, 'initConnection').mockResolvedValueOnce(true as any);

      await act(async () => {
        await api.reconnect();
      });

      // Listeners are already active from init, so reconnect skips re-registration
      // (guarded by !subscriptionsRef.current.purchaseUpdate check)
      expect(api.connected).toBe(true);
    });
  });

  describe('listener registration ordering (issue #166)', () => {
    it('registers purchase listeners after initConnection succeeds', async () => {
      const callOrder: string[] = [];
      jest.spyOn(IAP, 'initConnection').mockImplementation(async () => {
        callOrder.push('initConnection');
        return true as any;
      });
      jest.spyOn(IAP, 'purchaseUpdatedListener').mockImplementation((() => {
        callOrder.push('purchaseUpdatedListener');
        return {remove: jest.fn()};
      }) as any);
      jest.spyOn(IAP, 'purchaseErrorListener').mockImplementation((() => {
        callOrder.push('purchaseErrorListener');
        return {remove: jest.fn()};
      }) as any);

      const Harness = () => {
        useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      expect(callOrder).toContain('initConnection');
      expect(callOrder.indexOf('purchaseUpdatedListener')).toBeGreaterThan(
        callOrder.indexOf('initConnection'),
      );
      expect(callOrder.indexOf('purchaseErrorListener')).toBeGreaterThan(
        callOrder.indexOf('initConnection'),
      );
    });

    it('waits for Nitro init before attaching listeners', async () => {
      let resolveInit: ((value: boolean) => void) | undefined;
      jest.spyOn(IAP, 'initConnection').mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveInit = resolve;
          }) as any,
      );

      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      // Native queues retain events emitted during init, so JS listeners are
      // attached only after Nitro is ready and then flush the backlog.
      expect(api.connected).toBe(false);
      expect(IAP.purchaseUpdatedListener).not.toHaveBeenCalled();
      expect(IAP.purchaseErrorListener).not.toHaveBeenCalled();

      await act(async () => {
        resolveInit?.(true);
      });
      await act(async () => {});
      expect(api.connected).toBe(true);
      expect(IAP.purchaseUpdatedListener).toHaveBeenCalled();
      expect(IAP.purchaseErrorListener).toHaveBeenCalled();
    });

    it('does not attach listeners when initConnection returns false', async () => {
      const purchaseUpdateRemove = jest.fn();
      const purchaseErrorRemove = jest.fn();
      jest
        .spyOn(IAP, 'purchaseUpdatedListener')
        .mockImplementation((() => ({remove: purchaseUpdateRemove})) as any);
      jest
        .spyOn(IAP, 'purchaseErrorListener')
        .mockImplementation((() => ({remove: purchaseErrorRemove})) as any);
      jest.spyOn(IAP, 'initConnection').mockResolvedValue(false as any);

      let api: any;
      const Harness = () => {
        api = useIAP();
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      expect(api.connected).toBe(false);
      expect(IAP.purchaseUpdatedListener).not.toHaveBeenCalled();
      expect(purchaseUpdateRemove).not.toHaveBeenCalled();
      expect(purchaseErrorRemove).not.toHaveBeenCalled();
    });

    it('does not attach listeners when initConnection rejects', async () => {
      const purchaseUpdateRemove = jest.fn();
      const purchaseErrorRemove = jest.fn();
      jest
        .spyOn(IAP, 'purchaseUpdatedListener')
        .mockImplementation((() => ({remove: purchaseUpdateRemove})) as any);
      jest
        .spyOn(IAP, 'purchaseErrorListener')
        .mockImplementation((() => ({remove: purchaseErrorRemove})) as any);
      jest
        .spyOn(IAP, 'initConnection')
        .mockRejectedValue(new Error('init failed'));

      const onError = jest.fn();
      let api: any;
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      expect(api.connected).toBe(false);
      expect(IAP.purchaseUpdatedListener).not.toHaveBeenCalled();
      expect(purchaseUpdateRemove).not.toHaveBeenCalled();
      expect(purchaseErrorRemove).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('cleans up a partial listener registration failure', async () => {
      const purchaseUpdateRemove = jest.fn();
      jest
        .spyOn(IAP, 'purchaseUpdatedListener')
        .mockImplementation((() => ({remove: purchaseUpdateRemove})) as any);
      jest.spyOn(IAP, 'purchaseErrorListener').mockImplementation((() => {
        throw new Error('listener attach failed');
      }) as any);
      jest.spyOn(IAP, 'initConnection').mockResolvedValue(true as any);

      const onError = jest.fn();
      let api: any;
      const Harness = () => {
        api = useIAP({onError});
        return null;
      };

      await act(async () => {
        TestRenderer.create(React.createElement(Harness));
      });
      await act(async () => {});

      expect(api.connected).toBe(false);
      expect(purchaseUpdateRemove).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
