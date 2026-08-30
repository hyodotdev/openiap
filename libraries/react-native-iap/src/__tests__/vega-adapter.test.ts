import {createVegaIapModule, type VegaPurchasingService} from '../vega-adapter';
import {ErrorCode} from '../types';

const createService = (): jest.Mocked<VegaPurchasingService> =>
  ({
    getUserData: jest.fn(async () => ({
      responseCode: 1,
      userData: {
        countryCode: 'US',
        marketplace: 'US',
        userId: 'amazon-user',
      },
    })),
    getProductData: jest.fn(async () => ({
      responseCode: 1,
      productData: new Map([
        [
          'coins_100',
          {
            sku: 'coins_100',
            title: '100 Coins',
            description: 'Coin pack',
            productType: 1,
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$0.99',
              valueInMicros: 990000,
            },
          },
        ],
        [
          'premium_monthly',
          {
            sku: 'premium_monthly',
            title: 'Premium Monthly',
            description: 'Monthly plan',
            productType: 3,
            subscriptionPeriod: 'P1M',
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$4.99',
              valueInMicros: 4990000,
            },
          },
        ],
      ]),
    })),
    purchase: jest.fn(async () => ({
      responseCode: 0,
      receipt: {
        receiptId: 'receipt-1',
        sku: 'coins_100',
        productType: 1,
        purchaseDate: new Date('2026-05-11T00:00:00.000Z'),
      },
    })),
    getPurchaseUpdates: jest.fn(async () => ({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'sub-receipt',
          sku: 'premium_monthly',
          productType: 3,
          purchaseDate: new Date('2026-05-10T00:00:00.000Z'),
        },
      ],
    })),
    notifyFulfillment: jest.fn(async () => ({
      responseCode: 1,
    })),
  }) as unknown as jest.Mocked<VegaPurchasingService>;

describe('Amazon Vega adapter', () => {
  it('initializes without fetching Amazon user data', async () => {
    const service = createService();
    const module = createVegaIapModule(service);

    await expect(module.initConnection()).resolves.toBe(true);

    expect(service.getUserData).not.toHaveBeenCalled();
  });

  it('returns the store-authoritative Amazon marketplace', async () => {
    const service = createService();
    const module = createVegaIapModule(service);

    await expect(module.getStorefront()).resolves.toBe('US');
    expect(service.getUserData).toHaveBeenCalledWith({
      fetchUserProfileAccessConsentStatus: false,
    });
  });

  it.each([
    {responseCode: 1, userData: null},
    {responseCode: 1, userData: {countryCode: ' ', marketplace: ''}},
  ])('rejects missing Amazon storefront data', async (response) => {
    const service = createService();
    service.getUserData.mockResolvedValueOnce(response);
    const module = createVegaIapModule(service);

    await expect(module.getStorefront()).rejects.toMatchObject({
      code: ErrorCode.ServiceError,
      message: expect.stringContaining('no country code'),
    });
  });

  it('maps Amazon user-data parser failures to a storefront error', async () => {
    const service = createService();
    service.getUserData.mockRejectedValueOnce(
      new Error(
        '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
      ),
    );
    const module = createVegaIapModule(service);

    await expect(module.getStorefront()).rejects.toMatchObject({
      code: ErrorCode.ServiceError,
      message: expect.stringContaining('no country code'),
    });
  });

  it('normalizes non-OpenIAP coded user-data errors', async () => {
    const service = createService();
    service.getUserData.mockRejectedValueOnce(
      Object.assign(new Error('request timed out'), {code: 'ETIMEDOUT'}),
    );
    const module = createVegaIapModule(service);

    await expect(module.getStorefront()).rejects.toMatchObject({
      code: ErrorCode.ServiceError,
      message: expect.stringContaining('request timed out'),
    });
  });

  it('maps Vega products to Nitro Android products', async () => {
    const service = createService();
    const module = createVegaIapModule(service);

    const products = await module.fetchProducts(
      ['coins_100', 'premium_monthly'],
      'all',
    );

    expect(service.getProductData).toHaveBeenCalledWith({
      skus: ['coins_100', 'premium_monthly'],
    });
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'coins_100',
          type: 'in-app',
          platform: 'android',
        }),
        expect.objectContaining({
          id: 'premium_monthly',
          type: 'subs',
          platform: 'android',
          subscriptionOffers: expect.any(String),
        }),
      ]),
    );
  });

  it('accepts Amazon Vega string success response codes', async () => {
    const service = createService();
    service.getProductData.mockResolvedValueOnce({
      responseCode: 'SUCCESSFUL',
      productData: {
        coins_100: {
          sku: 'coins_100',
          title: '100 Coins',
          description: 'Coin pack',
          productType: 1,
          price: {
            priceCurrencyCode: 'USD',
            priceStr: '$0.99',
            valueInMicros: '990000',
          },
        },
      },
    });
    const module = createVegaIapModule(service);

    await expect(module.fetchProducts(['coins_100'], 'all')).resolves.toEqual([
      expect.objectContaining({
        id: 'coins_100',
        price: 0.99,
      }),
    ]);
  });

  it('maps App Tester catalog-shaped product data', async () => {
    const service = createService();
    service.getProductData.mockResolvedValueOnce({
      responseCode: 1,
      productData: {
        'dev.hyo.martie.10bulbs': {
          itemType: 'CONSUMABLE',
          price: 0.99,
          title: '10 Bulbs',
          description: 'A small pack of bulbs',
        },
        'dev.hyo.martie.premium': {
          itemType: 'SUBSCRIPTION',
          price: 4.99,
          term: 'Monthly',
          title: 'Premium Monthly',
          description: 'Monthly premium access',
        },
      },
    });
    const module = createVegaIapModule(service);

    await expect(
      module.fetchProducts(
        ['dev.hyo.martie.10bulbs', 'dev.hyo.martie.premium'],
        'all',
      ),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dev.hyo.martie.10bulbs',
          type: 'in-app',
          price: 0.99,
        }),
        expect.objectContaining({
          id: 'dev.hyo.martie.premium',
          type: 'subs',
          price: 4.99,
          subscriptionPeriodAndroid: 'P1M',
        }),
      ]),
    );
  });

  it('emits a purchase update and finishes with notifyFulfillment', async () => {
    const service = createService();
    const module = createVegaIapModule(service);
    const listener = jest.fn();

    module.addPurchaseUpdatedListener(listener);
    const result = await module.requestPurchase({
      google: {skus: ['coins_100']},
    });

    expect(result).toEqual([
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'receipt-1',
        currentPlanId: null,
        store: 'amazon',
        transactionId: 'receipt-1',
      }),
    ]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'receipt-1',
        transactionId: 'receipt-1',
      }),
    );

    await expect(
      module.finishTransaction({
        android: {purchaseToken: 'receipt-1', isConsumable: true},
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        responseCode: 0,
        purchaseToken: 'receipt-1',
      }),
    );
    expect(service.notifyFulfillment).toHaveBeenCalledWith({
      fulfillmentResult: 1,
      receiptId: 'receipt-1',
    });
  });

  it('retries transient Amazon Vega fulfillment failures', async () => {
    jest.useFakeTimers();
    const service = createService();
    service.notifyFulfillment
      .mockResolvedValueOnce({responseCode: 'FAILED'})
      .mockResolvedValueOnce({responseCode: 1});
    const module = createVegaIapModule(service);

    try {
      const result = module.finishTransaction({
        android: {purchaseToken: 'receipt-1', isConsumable: true},
      });
      await jest.advanceTimersByTimeAsync(1_000);

      await expect(result).resolves.toEqual(
        expect.objectContaining({
          responseCode: 0,
          purchaseToken: 'receipt-1',
        }),
      );
      expect(service.notifyFulfillment).toHaveBeenCalledTimes(2);
      expect(service.notifyFulfillment).toHaveBeenNthCalledWith(2, {
        fulfillmentResult: 1,
        receiptId: 'receipt-1',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('times out Amazon Vega fulfillment without duplicating the request', async () => {
    jest.useFakeTimers();
    const service = createService();
    service.notifyFulfillment.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    const module = createVegaIapModule(service);

    try {
      const result = module.finishTransaction({
        android: {purchaseToken: 'receipt-1', isConsumable: true},
      });
      const expectation = expect(result).rejects.toMatchObject({
        code: 'service-timeout',
      });
      await jest.advanceTimersByTimeAsync(2_000);

      await expectation;
      expect(service.notifyFulfillment).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('recovers fulfillable receipts after Amazon Vega purchase failures', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 'FAILED',
      receipt: null,
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'recovered-receipt',
          sku: 'coins_100',
          productType: 1,
          purchaseDate: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);
    const listener = jest.fn();
    const errorListener = jest.fn();
    module.addPurchaseUpdatedListener(listener);
    module.addPurchaseErrorListener(errorListener);

    await expect(
      module.requestPurchase({
        google: {skus: ['coins_100']},
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'recovered-receipt',
        store: 'amazon',
      }),
    ]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'recovered-receipt',
      }),
    );
    expect(service.notifyFulfillment).not.toHaveBeenCalled();
    expect(errorListener).not.toHaveBeenCalled();
  });

  it('recovers fulfillable receipts after parser-only purchase errors', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
    const service = createService();
    try {
      service.purchase.mockRejectedValueOnce(
        new Error(
          '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
        ),
      );
      service.getPurchaseUpdates.mockResolvedValueOnce({
        responseCode: 1,
        receiptList: [
          {
            receiptId: 'recovered-receipt',
            sku: 'coins_100',
            productType: 1,
            purchaseDate: new Date('2026-06-10T00:00:01.000Z'),
          },
        ],
      });
      const module = createVegaIapModule(service);
      const listener = jest.fn();
      const errorListener = jest.fn();
      module.addPurchaseUpdatedListener(listener);
      module.addPurchaseErrorListener(errorListener);

      await expect(
        module.requestPurchase({
          google: {skus: ['coins_100']},
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          productId: 'coins_100',
          purchaseToken: 'recovered-receipt',
          store: 'amazon',
        }),
      ]);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'coins_100',
          purchaseToken: 'recovered-receipt',
        }),
      );
      expect(service.notifyFulfillment).not.toHaveBeenCalled();
      expect(errorListener).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not recover old receipts after parser-only purchase errors', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
    const service = createService();
    const parserError = new Error(
      '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
    );
    try {
      service.purchase.mockRejectedValueOnce(parserError);
      service.getPurchaseUpdates.mockResolvedValueOnce({
        responseCode: 1,
        receiptList: [
          {
            receiptId: 'old-receipt',
            sku: 'coins_100',
            productType: 1,
            purchaseDate: new Date('2026-06-09T23:00:00.000Z'),
          },
        ],
      });
      const module = createVegaIapModule(service);
      const listener = jest.fn();
      const errorListener = jest.fn();
      module.addPurchaseUpdatedListener(listener);
      module.addPurchaseErrorListener(errorListener);

      await expect(
        module.requestPurchase({
          google: {skus: ['coins_100']},
        }),
      ).rejects.toBe(parserError);
      expect(listener).not.toHaveBeenCalled();
      expect(service.notifyFulfillment).not.toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PurchaseError,
          productId: 'coins_100',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves structured purchase diagnostics in Vega error events', async () => {
    const service = createService();
    const purchaseError = Object.assign(new Error('query failed'), {
      code: ErrorCode.QueryProduct,
      debugMessage: 'store query failed',
      isEmptyProductList: false,
      productId: 'coins_100',
      productIds: ['coins_100', 'coins_200'],
      productType: 'in-app',
      responseCode: 7,
      subResponseCodeAndroid: 'user-ineligible' as const,
    });
    service.purchase.mockRejectedValueOnce(purchaseError);
    const module = createVegaIapModule(service);
    const errorListener = jest.fn();
    module.addPurchaseErrorListener(errorListener);

    await expect(
      module.requestPurchase({google: {skus: ['coins_100']}}),
    ).rejects.toBe(purchaseError);
    expect(errorListener).toHaveBeenCalledWith({
      code: ErrorCode.QueryProduct,
      debugMessage: 'store query failed',
      isEmptyProductList: false,
      message: 'query failed',
      productId: 'coins_100',
      productIds: ['coins_100', 'coins_200'],
      productType: 'in-app',
      purchaseToken: undefined,
      responseCode: 7,
      subResponseCodeAndroid: 'user-ineligible',
    });
  });

  it('does not fulfill recovered purchases before the app finishes them', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 'FAILED',
      receipt: null,
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'recovered-receipt',
          sku: 'coins_100',
          productType: 1,
          purchaseDate: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);

    await expect(
      module.requestPurchase({
        google: {skus: ['coins_100']},
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'recovered-receipt',
      }),
    ]);
    expect(service.notifyFulfillment).not.toHaveBeenCalled();
  });

  it('emits other recovered receipts while preserving the original purchase failure', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 'FAILED',
      receipt: null,
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'previous-sub-receipt',
          sku: 'premium_monthly',
          productType: 3,
          purchaseDate: new Date('2026-06-09T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);
    const listener = jest.fn();
    module.addPurchaseUpdatedListener(listener);

    await expect(
      module.requestPurchase({
        google: {skus: ['coins_100']},
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.UserCancelled,
    });
    expect(service.notifyFulfillment).not.toHaveBeenCalled();
    expect(service.purchase).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'premium_monthly',
        purchaseToken: 'previous-sub-receipt',
      }),
    );
  });

  it('treats subscription base receipts as the requested subscription purchase', async () => {
    const service = createService();
    service.getProductData.mockResolvedValueOnce({
      responseCode: 1,
      productData: new Map([
        [
          'premium_monthly',
          {
            sku: 'premium_monthly',
            title: 'Premium Monthly',
            description: 'Monthly plan',
            productType: 3,
            subscriptionBase: 'premium_monthly.base',
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$4.99',
              valueInMicros: 4990000,
            },
          },
        ],
      ]),
    });
    service.purchase.mockResolvedValueOnce({
      responseCode: 4,
      receipt: null,
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'base-receipt',
          sku: 'premium_monthly.base',
          productType: 3,
          purchaseDate: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);

    await module.fetchProducts(['premium_monthly'], 'subs');

    await expect(
      module.requestPurchase({
        google: {
          skus: ['premium_monthly'],
          subscriptionOffers: [
            {sku: 'premium_monthly', offerToken: 'offer-token'},
          ],
        },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        purchaseToken: 'base-receipt',
      }),
    ]);
    expect(service.notifyFulfillment).not.toHaveBeenCalled();
    expect(service.purchase).toHaveBeenCalledTimes(1);
  });

  it('normalizes subscription base receipts in active subscription queries', async () => {
    const service = createService();
    service.getProductData.mockResolvedValueOnce({
      responseCode: 1,
      productData: new Map([
        [
          'premium_monthly',
          {
            sku: 'premium_monthly',
            title: 'Premium Monthly',
            description: 'Monthly plan',
            productType: 3,
            subscriptionBase: 'premium_monthly.base',
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$4.99',
              valueInMicros: 4990000,
            },
          },
        ],
      ]),
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'base-receipt',
          sku: 'premium_monthly.base',
          productType: 3,
          purchaseDate: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);

    await module.fetchProducts(['premium_monthly'], 'subs');

    await expect(
      module.getActiveSubscriptions(['premium_monthly']),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        basePlanIdAndroid: 'premium_monthly',
        currentPlanId: 'premium_monthly',
        purchaseToken: 'base-receipt',
      }),
    ]);
  });

  it('keeps original purchase failure when recovery parsing fails', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 'FAILED',
      receipt: null,
    });
    service.getPurchaseUpdates.mockRejectedValueOnce(
      new Error(
        '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
      ),
    );
    const module = createVegaIapModule(service);
    const errorListener = jest.fn();
    module.addPurchaseErrorListener(errorListener);

    await expect(
      module.requestPurchase({
        google: {skus: ['coins_100']},
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.UserCancelled,
    });
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.UserCancelled,
      }),
    );
  });

  it('maps Amazon invalid SKU purchase failures to OpenIAP errors', async () => {
    const service = createService();
    service.purchase.mockResolvedValue({
      responseCode: 2,
      receipt: null,
    });
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [],
    });
    const module = createVegaIapModule(service);
    const errorListener = jest.fn();
    module.addPurchaseErrorListener(errorListener);

    await expect(
      module.requestPurchase({
        google: {skus: ['missing_sku']},
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.SkuNotFound,
      responseCode: 2,
    });
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.SkuNotFound,
        responseCode: 2,
      }),
    );
  });

  it('returns active subscriptions from purchase updates', async () => {
    const service = createService();
    const module = createVegaIapModule(service);

    const subscriptions = await module.getActiveSubscriptions([
      'premium_monthly',
    ]);

    expect(service.getPurchaseUpdates).toHaveBeenCalledWith({reset: true});
    expect(subscriptions).toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isActive: true,
        basePlanIdAndroid: 'premium_monthly',
        currentPlanId: 'premium_monthly',
        purchaseToken: 'sub-receipt',
      }),
    ]);
  });

  it('uses cached product types when purchase updates omit productType', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'sub-receipt',
          sku: 'premium_monthly',
          purchaseDate: new Date('2026-05-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);

    await module.fetchProducts(['premium_monthly'], 'subs');

    await expect(
      module.getActiveSubscriptions(['premium_monthly']),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isActive: true,
        basePlanIdAndroid: 'premium_monthly',
        currentPlanId: 'premium_monthly',
        purchaseToken: 'sub-receipt',
      }),
    ]);
  });

  it('hydrates product types when purchase updates omit productType before fetchProducts', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'sub-receipt',
          sku: 'premium_monthly',
          purchaseDate: new Date('2026-05-10T00:00:00.000Z'),
        },
      ],
    });
    const module = createVegaIapModule(service);

    await expect(
      module.getActiveSubscriptions(['premium_monthly']),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isActive: true,
        basePlanIdAndroid: 'premium_monthly',
        currentPlanId: 'premium_monthly',
        purchaseToken: 'sub-receipt',
      }),
    ]);
    expect(service.getProductData).toHaveBeenCalledWith({
      skus: ['premium_monthly'],
    });
  });

  it('uses subscription request context when purchase receipts omit productType', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 0,
      receipt: {
        receiptId: 'sub-purchase',
        sku: 'premium_monthly',
      },
    });
    const module = createVegaIapModule(service);

    await expect(
      module.requestPurchase({
        google: {skus: ['premium_monthly'], subscriptionOffers: []},
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isAutoRenewing: true,
        autoRenewingAndroid: true,
      }),
    ]);
  });

  it('uses the explicit request type when purchase metadata is unavailable', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 0,
      receipt: {
        receiptId: 'sub-purchase',
        sku: 'premium_monthly',
      },
    });
    const module = createVegaIapModule(service);

    await expect(
      module.requestPurchase({
        type: 'subs',
        google: {skus: ['premium_monthly']},
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isAutoRenewing: true,
        autoRenewingAndroid: true,
      }),
    ]);

    expect(service.getProductData).not.toHaveBeenCalled();
  });

  it('uses serialized subscription request context for direct Nitro calls', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 0,
      receipt: {
        receiptId: 'sub-purchase',
        sku: 'premium_monthly',
      },
    });
    const module = createVegaIapModule(service);

    await expect(
      module.requestPurchase({
        google: {
          skus: ['premium_monthly'],
          subscriptionOffers: '[]' as any,
        },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isAutoRenewing: true,
        autoRenewingAndroid: true,
      }),
    ]);
  });

  it('exposes direct finish helpers and unsupported stubs on Vega', async () => {
    const service = createService();
    const module = createVegaIapModule(service) as ReturnType<
      typeof createVegaIapModule
    > & {
      acknowledgePurchaseAndroid(purchaseToken: string): Promise<boolean>;
      addSubscriptionBillingIssueListener(listener?: unknown): void;
      consumePurchaseAndroid(purchaseToken: string): Promise<boolean>;
      deepLinkToSubscriptionsAndroid(options: unknown): Promise<void>;
      restorePurchases(): Promise<void>;
    };

    await expect(module.acknowledgePurchaseAndroid('receipt-1')).resolves.toBe(
      true,
    );
    await expect(module.consumePurchaseAndroid('receipt-2')).resolves.toBe(
      true,
    );
    const listener = jest.fn();
    module.addPurchaseUpdatedListener(listener);
    await expect(module.restorePurchases()).resolves.toBeUndefined();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'premium_monthly',
        purchaseToken: 'sub-receipt',
      }),
    );
    expect(module.addSubscriptionBillingIssueListener).not.toThrow();
    await expect(module.openRedeemOfferCodeAndroid()).resolves.toBe(false);
    await expect(
      module.deepLinkToSubscriptionsAndroid({
        packageNameAndroid: 'dev.hyo.openiap',
        skuAndroid: 'premium_monthly',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FeatureNotSupported,
    });
    expect(service.notifyFulfillment).toHaveBeenCalledWith({
      fulfillmentResult: 1,
      receiptId: 'receipt-1',
    });
    expect(service.notifyFulfillment).toHaveBeenCalledWith({
      fulfillmentResult: 1,
      receiptId: 'receipt-2',
    });
  });

  it('loads all paginated Amazon purchase updates', async () => {
    const service = createService();
    service.getPurchaseUpdates
      .mockResolvedValueOnce({
        responseCode: 1,
        hasMore: true,
        receiptList: [
          {
            receiptId: 'receipt-page-1',
            sku: 'coins_100',
            productType: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        responseCode: 1,
        hasMore: false,
        receiptList: [
          {
            receiptId: 'receipt-page-2',
            sku: 'premium_monthly',
            productType: 3,
          },
        ],
      });
    const module = createVegaIapModule(service);

    const purchases = await module.getAvailablePurchases();

    expect(service.getPurchaseUpdates).toHaveBeenNthCalledWith(1, {
      reset: true,
    });
    expect(service.getPurchaseUpdates).toHaveBeenNthCalledWith(2, {
      reset: false,
    });
    expect(purchases.map((purchase) => purchase.id)).toEqual([
      'receipt-page-1',
      'receipt-page-2',
    ]);
    expect(purchases.map((purchase) => purchase.transactionId)).toEqual([
      'receipt-page-1',
      'receipt-page-2',
    ]);
  });

  it('rejects Amazon parser-only purchase update errors atomically', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockRejectedValueOnce(
      new Error(
        '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
      ),
    );
    const module = createVegaIapModule(service);

    await expect(module.getAvailablePurchases()).rejects.toMatchObject({
      code: ErrorCode.BillingResponseJsonParseError,
    });
  });

  it('rejects all pages when a later Amazon purchase update page is malformed', async () => {
    const service = createService();
    service.getPurchaseUpdates
      .mockResolvedValueOnce({
        responseCode: 1,
        hasMore: true,
        receiptList: [
          {
            receiptId: 'receipt-page-1',
            sku: 'coins_100',
            productType: 1,
          },
        ],
      })
      .mockRejectedValueOnce(
        new Error(
          '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
        ),
      );
    const module = createVegaIapModule(service);

    await expect(module.getAvailablePurchases()).rejects.toMatchObject({
      code: ErrorCode.BillingResponseJsonParseError,
    });
  });

  it('retries failed Amazon purchase update responses', async () => {
    jest.useFakeTimers();
    const service = createService();
    service.getPurchaseUpdates
      .mockResolvedValueOnce({
        responseCode: 3,
        receiptList: [],
      })
      .mockResolvedValueOnce({
        responseCode: 1,
        receiptList: [
          {
            receiptId: 'recovered-receipt',
            sku: 'coins_100',
            productType: 1,
          },
        ],
      });
    const module = createVegaIapModule(service);

    try {
      const result = module.getAvailablePurchases();
      await Promise.resolve();
      jest.advanceTimersByTime(1_000);

      await expect(result).resolves.toEqual([
        expect.objectContaining({
          productId: 'coins_100',
          purchaseToken: 'recovered-receipt',
        }),
      ]);
      expect(service.getPurchaseUpdates).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects parser-only product type hydration errors for purchase updates', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValueOnce({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'base-receipt',
          sku: 'premium_monthly.base',
          purchaseDate: new Date('2026-06-10T00:00:00.000Z'),
        },
      ],
    });
    service.getProductData.mockRejectedValueOnce(
      new Error(
        '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
      ),
    );
    const module = createVegaIapModule(service);

    await expect(
      module.getActiveSubscriptions(['premium_monthly']),
    ).rejects.toMatchObject({
      code: ErrorCode.BillingResponseJsonParseError,
    });
  });

  it('chunks Vega product data requests', async () => {
    const service = createService();
    const skus = Array.from({length: 101}, (_, index) => `sku_${index}`);
    service.getProductData.mockImplementation(async ({skus: batch}) => ({
      responseCode: 1,
      productData: Object.fromEntries(
        batch.map((sku) => [
          sku,
          {
            sku,
            title: sku,
            description: 'Product',
            productType: 1,
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$0.99',
              valueInMicros: 990000,
            },
          },
        ]),
      ),
    }));
    const module = createVegaIapModule(service);

    const products = await module.fetchProducts(skus, 'all');

    expect(products).toHaveLength(101);
    expect(service.getProductData).toHaveBeenCalledTimes(2);
    expect(service.getProductData.mock.calls[0]?.[0].skus).toHaveLength(100);
    expect(service.getProductData.mock.calls[1]?.[0].skus).toHaveLength(1);
  });

  it('chunks product type hydration for purchase updates', async () => {
    const service = createService();
    const skus = Array.from({length: 101}, (_, index) => `sub_${index}`);
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: skus.map((sku) => ({
        receiptId: `receipt_${sku}`,
        sku,
      })),
    });
    service.getProductData.mockImplementation(async ({skus: batch}) => ({
      responseCode: 1,
      productData: Object.fromEntries(
        batch.map((sku) => [
          sku,
          {
            sku,
            title: sku,
            description: 'Subscription',
            productType: 3,
            subscriptionPeriod: 'P1M',
            price: {
              priceCurrencyCode: 'USD',
              priceStr: '$4.99',
              valueInMicros: 4990000,
            },
          },
        ]),
      ),
    }));
    const module = createVegaIapModule(service);

    const purchases = await module.getAvailablePurchases();

    expect(purchases).toHaveLength(101);
    expect(purchases[0]).toMatchObject({
      isAutoRenewing: true,
      productId: 'sub_0',
    });
    expect(service.getProductData).toHaveBeenCalledTimes(2);
    expect(service.getProductData.mock.calls[0]?.[0].skus).toHaveLength(100);
    expect(service.getProductData.mock.calls[1]?.[0].skus).toHaveLength(1);
  });

  it('keeps deferred subscription changes active and exposes the upcoming plan', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'deferred-sub',
          sku: 'premium',
          termSku: 'premium_monthly',
          deferredSku: 'premium_yearly',
          productType: 3,
          isDeferred: true,
        },
      ],
    });
    const module = createVegaIapModule(service) as ReturnType<
      typeof createVegaIapModule
    > & {
      restorePurchases(): Promise<void>;
    };
    const listener = jest.fn();
    module.addPurchaseUpdatedListener(listener);

    await expect(
      module.getAvailablePurchases({android: {type: 'subs'}}),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'deferred-sub',
        productId: 'premium',
        currentPlanId: 'premium_monthly',
        isAutoRenewing: true,
        isSuspendedAndroid: false,
        pendingPurchaseUpdateAndroid: {
          products: ['premium_yearly'],
          purchaseToken: 'deferred-sub',
        },
        purchaseState: 'purchased',
      }),
    ]);
    await expect(module.restorePurchases()).resolves.toBeUndefined();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'deferred-sub',
        isSuspendedAndroid: false,
        pendingPurchaseUpdateAndroid: {
          products: ['premium_yearly'],
          purchaseToken: 'deferred-sub',
        },
      }),
    );
  });

  it('ignores blank Vega subscription identifiers', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: [
        {
          receiptId: ' receipt-token-with-spaces ',
          sku: '  ',
          termSku: 'premium_monthly',
          deferredSku: '  ',
          productType: 3,
          isDeferred: true,
        },
      ],
    });
    const module = createVegaIapModule(service);

    await expect(module.getAvailablePurchases()).resolves.toEqual([
      expect.objectContaining({
        id: ' receipt-token-with-spaces ',
        productId: 'premium_monthly',
        purchaseToken: ' receipt-token-with-spaces ',
        currentPlanId: 'premium_monthly',
        pendingPurchaseUpdateAndroid: null,
      }),
    ]);
  });

  it('verifies Vega receipts through IAPKit Amazon payload', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          environment: 'Sandbox',
          isValid: true,
          state: 'READY_TO_CONSUME',
          store: 'amazon',
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'kit-key',
            amazon: {
              expectedProductId: 'amazon.premium.monthly',
              receiptId: 'receipt-vega-1',
              sandbox: true,
            },
          },
        }),
      ).resolves.toEqual({
        provider: 'iapkit',
        iapkit: {
          environment: 'Sandbox',
          isValid: true,
          state: 'ready-to-consume',
          store: 'amazon',
        },
      });

      expect(service.getUserData).toHaveBeenCalledWith({
        fetchUserProfileAccessConsentStatus: false,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://kit.openiap.dev/v1/purchase/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer kit-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        store: 'amazon',
        userId: 'amazon-user',
        receiptId: 'receipt-vega-1',
        expectedProductId: 'amazon.premium.monthly',
        sandbox: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not request or expose Apple/Google-only client payloads on Vega', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () =>
      Response.json({
        isValid: true,
        state: 'ENTITLED',
        store: 'amazon',
        productId: 'premium.monthly',
        clientPayload: {
          format: 'toml',
          body: 'tier = "gold"',
          version: 2,
          updatedAt: 1720000000000,
        },
      }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);
      const result = await module.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          includeClientPayload: true,
          amazon: {
            userId: 'amazon-user',
            receiptId: 'receipt-vega-1',
          },
        },
      });

      expect(result.iapkit).toEqual({
        isValid: true,
        productId: 'premium.monthly',
        state: 'entitled',
        store: 'amazon',
      });
      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
        store: 'amazon',
        userId: 'amazon-user',
        receiptId: 'receipt-vega-1',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    ['http://localhost:3100/', 'http://localhost:3100/v1/purchase/verify'],
    ['http://192.168.0.4:3100', 'http://192.168.0.4:3100/v1/purchase/verify'],
    ['http://[::1]:3100', 'http://[::1]:3100/v1/purchase/verify'],
    [
      'https://[2001:db8::1]:65535///',
      'https://[2001:db8::1]:65535/v1/purchase/verify',
    ],
  ])('supports custom IAPKit base URL %s', async (baseUrl, expectedUrl) => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const originalUrl = globalThis.URL;
    class KeplerUrl {
      get protocol(): never {
        throw new Error('URL.protocol is not implemented on Kepler');
      }
    }
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          isValid: true,
          state: 'ENTITLED',
          store: 'amazon',
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;
    globalThis.URL = KeplerUrl as unknown as typeof URL;

    try {
      const module = createVegaIapModule(service);

      await module.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'kit-key',
          baseUrl,
          amazon: {
            userId: 'amazon-user',
            receiptId: 'receipt-vega-1',
          },
        },
      });

      expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.URL = originalUrl;
    }
  });

  it.each([
    'ftp://localhost:3100',
    'http://user:pass@localhost:3100',
    'http://localhost:3100/path',
    'http://localhost:3100?debug=1',
    'http://localhost:3100\\path',
    'http://localhost:0',
    'http://localhost:99999',
    'http://[]:3100',
    'http://[garbage]:3100',
    'http://[:::]:3100',
    'http://[deadbeef]:3100',
    'http://[1::2::3]:3100',
    'http://[1:2:3:4:5:6:7:8:9]:3100',
    'http://[::ffff:999.1.1.1]:3100',
    'http://[::1',
    'http://::1:3100',
    'http://127.00.0.1:3100',
    'http://0x7f.0.0.1:3100',
    'http://0x7f000001:3100',
    'http://0x7f.0.0.1.:3100',
    'http://example.123:3100',
    'http://example.0x7f:3100',
    'http://[::ffff:192.168.001.1]:3100',
    'http://999.999.999.999:3100',
    'http://%:3100',
  ])('rejects non-origin IAPKit base URL %s', async (baseUrl) => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            baseUrl,
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.DeveloperError,
        message: 'IAPKit baseUrl must be a valid HTTP(S) origin',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects mixed IAPKit payloads on the Amazon Vega adapter', async () => {
    const service = createService();
    const module = createVegaIapModule(service);

    await expect(
      module.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          amazon: {
            userId: 'amazon-user',
            receiptId: 'receipt-vega-1',
          },
          google: {
            purchaseToken: 'google-token',
          },
        },
      }),
    ).rejects.toThrow(
      'Amazon Vega IAPKit verification requires exactly one amazon payload.',
    );
  });

  it('wraps non-JSON IAPKit failures as receipt errors', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('<html>bad gateway</html>', {status: 502}),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('HTTP 502');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('extracts nested JSON IAPKit failure messages', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(
          {
            message: JSON.stringify({
              error: 'receipt no longer valid',
            }),
          },
          {status: 400},
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('receipt no longer valid');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('extracts string entries from IAPKit error arrays', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(
          {
            errors: ['receipt array failure'],
          },
          {status: 400},
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('receipt array failure');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects empty successful IAPKit responses as receipt errors', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('', {status: 200}),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('IAPKit returned non-JSON response (HTTP 200).');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('treats successful IAPKit error payloads as receipt errors', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(
          {
            errors: [
              {
                code: 'BAD_RECEIPT',
                message: 'bad receipt',
              },
            ],
          },
          {status: 200},
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('bad receipt');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects malformed successful IAPKit payloads', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(['not', 'an', 'object'], {status: 200}),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('IAPKit returned malformed response (HTTP 200).');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects successful IAPKit payloads missing required fields', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(
          {
            state: 'ENTITLED',
            store: 'amazon',
          },
          {status: 200},
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('IAPKit returned malformed response (HTTP 200).');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Forwarded opaquely; only a non-string is dropped. Neither fails.
  it.each([
    {environment: 'Xcode', expected: 'Xcode'},
    {environment: 'LocalTesting', expected: 'LocalTesting'},
    {environment: 'Staging', expected: 'Staging'},
    {environment: 42, expected: undefined},
    {environment: '', expected: undefined},
  ])(
    'never fails a receipt over the IAPKit environment: $environment',
    async ({environment, expected}) => {
      const service = createService();
      const originalFetch = globalThis.fetch;
      const fetchMock = jest.fn(async () =>
        Response.json({
          environment,
          isValid: true,
          state: 'ENTITLED',
          store: 'amazon',
        }),
      ) as unknown as jest.MockedFunction<typeof fetch>;
      globalThis.fetch = fetchMock;

      try {
        const module = createVegaIapModule(service);

        const result = await module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        });

        expect(result.iapkit?.isValid).toBe(true);
        expect(result.iapkit?.environment).toBe(expected);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );

  it('rejects successful IAPKit payloads for another store', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(
          {
            isValid: true,
            state: 'ENTITLED',
            store: 'apple',
          },
          {status: 200},
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toThrow('IAPKit returned malformed response (HTTP 200).');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('wraps IAPKit network failures as network errors', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () => {
      throw new TypeError('network offline');
    }) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.NetworkError,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('wraps IAPKit response body read failures as network errors', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new TypeError('body stream failed');
      },
    })) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createVegaIapModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            amazon: {
              userId: 'amazon-user',
              receiptId: 'receipt-vega-1',
            },
          },
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.NetworkError,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
