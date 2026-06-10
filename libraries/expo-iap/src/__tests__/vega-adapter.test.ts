import {
  createExpoIapVegaModule,
  type VegaPurchasingService,
} from '../vega-adapter';
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
      productData: {
        coins_100: {
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
        premium_monthly: {
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
      },
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

describe('Amazon Vega Expo adapter', () => {
  it('initializes without fetching Amazon user data', async () => {
    const service = createService();
    const module = createExpoIapVegaModule(service);

    await expect(module.initConnection()).resolves.toBe(true);

    expect(service.getUserData).not.toHaveBeenCalled();
  });

  it('maps Vega product data to OpenIAP Android products', async () => {
    const service = createService();
    const module = createExpoIapVegaModule(service);

    const products = await module.fetchProducts('all', [
      'coins_100',
      'premium_monthly',
    ]);

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
          subscriptionOfferDetailsAndroid: expect.any(Array),
        }),
      ]),
    );
  });

  it('accepts Amazon Vega string success response codes', async () => {
    const service = createService();
    service.getProductData.mockResolvedValueOnce({
      responseCode: 'SUCCESSFUL',
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
              valueInMicros: '990000',
            },
          },
        ],
      ]),
    });
    const module = createExpoIapVegaModule(service);

    await expect(module.fetchProducts('all', ['coins_100'])).resolves.toEqual([
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
    const module = createExpoIapVegaModule(service);

    await expect(
      module.fetchProducts('all', [
        'dev.hyo.martie.10bulbs',
        'dev.hyo.martie.premium',
      ]),
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
        }),
      ]),
    );
  });

  it('emits purchase updates and acknowledges receipts', async () => {
    const service = createService();
    const module = createExpoIapVegaModule(service);
    const listener = jest.fn();

    module.addListener('purchase-updated', listener);
    const result = await module.requestPurchase({
      skuArr: ['coins_100'],
      type: 'in-app',
    });

    expect(result).toEqual([
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'receipt-1',
        store: 'amazon',
      }),
    ]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'coins_100',
        purchaseToken: 'receipt-1',
      }),
    );

    await module.acknowledgePurchaseAndroid('receipt-1');

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
    const module = createExpoIapVegaModule(service);

    try {
      const result = module.acknowledgePurchaseAndroid('receipt-1');
      await Promise.resolve();
      jest.advanceTimersByTime(1_000);

      await expect(result).resolves.toBeUndefined();
      expect(service.notifyFulfillment).toHaveBeenCalledTimes(2);
      expect(service.notifyFulfillment).toHaveBeenNthCalledWith(2, {
        fulfillmentResult: 1,
        receiptId: 'receipt-1',
      });
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
    const module = createExpoIapVegaModule(service);
    const listener = jest.fn();
    const errorListener = jest.fn();
    module.addListener('purchase-updated', listener);
    module.addListener('purchase-error', errorListener);

    await expect(
      module.requestPurchase({
        skuArr: ['coins_100'],
        type: 'in-app',
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
      const module = createExpoIapVegaModule(service);
      const listener = jest.fn();
      const errorListener = jest.fn();
      module.addListener('purchase-updated', listener);
      module.addListener('purchase-error', errorListener);

      await expect(
        module.requestPurchase({
          skuArr: ['coins_100'],
          type: 'in-app',
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
      const module = createExpoIapVegaModule(service);
      const listener = jest.fn();
      const errorListener = jest.fn();
      module.addListener('purchase-updated', listener);
      module.addListener('purchase-error', errorListener);

      await expect(
        module.requestPurchase({
          skuArr: ['coins_100'],
          type: 'in-app',
        }),
      ).rejects.toBe(parserError);
      expect(listener).not.toHaveBeenCalled();
      expect(service.notifyFulfillment).not.toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PurchaseError,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
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
    const module = createExpoIapVegaModule(service);

    await expect(
      module.requestPurchase({
        skuArr: ['coins_100'],
        type: 'in-app',
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
    const module = createExpoIapVegaModule(service);
    const listener = jest.fn();
    module.addListener('purchase-updated', listener);

    await expect(
      module.requestPurchase({
        skuArr: ['coins_100'],
        type: 'in-app',
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
    const module = createExpoIapVegaModule(service);

    await module.fetchProducts('subs', ['premium_monthly']);

    await expect(
      module.requestPurchase({
        skuArr: ['premium_monthly'],
        type: 'subs',
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
    const module = createExpoIapVegaModule(service);

    await module.fetchProducts('subs', ['premium_monthly']);

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
    const module = createExpoIapVegaModule(service);
    const errorListener = jest.fn();
    module.addListener('purchase-error', errorListener);

    await expect(
      module.requestPurchase({
        skuArr: ['coins_100'],
        type: 'in-app',
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
    const module = createExpoIapVegaModule(service);
    const errorListener = jest.fn();
    module.addListener('purchase-error', errorListener);

    await expect(
      module.requestPurchase({
        skuArr: ['missing_sku'],
        type: 'in-app',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.SkuNotFound,
      productId: 'missing_sku',
    });
    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.SkuNotFound,
        productId: 'missing_sku',
        responseCode: 2,
      }),
    );
  });

  it('returns active subscriptions from purchase updates', async () => {
    const service = createService();
    const module = createExpoIapVegaModule(service);

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
    const module = createExpoIapVegaModule(service);

    await module.fetchProducts('subs', ['premium_monthly']);

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
    const module = createExpoIapVegaModule(service);

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
    const module = createExpoIapVegaModule(service);

    await expect(
      module.requestPurchase({
        skuArr: ['premium_monthly'],
        type: 'subs',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: 'premium_monthly',
        isAutoRenewing: true,
        autoRenewingAndroid: true,
      }),
    ]);
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
    const module = createExpoIapVegaModule(service);

    const purchases = await module.getAvailableItems();

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
  });

  it('treats Amazon parser-only purchase update errors as no updates', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockRejectedValueOnce(
      new Error(
        '[AmazonIAPSDK] Unable to parse the response : userId is not found while parsing Json',
      ),
    );
    const module = createExpoIapVegaModule(service);

    await expect(module.getAvailableItems()).resolves.toEqual([]);
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
    const module = createExpoIapVegaModule(service);

    try {
      const result = module.getAvailableItems();
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

  it('ignores parser-only product type hydration errors for purchase updates', async () => {
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
    const module = createExpoIapVegaModule(service);

    await expect(
      module.getActiveSubscriptions(['premium_monthly']),
    ).resolves.toEqual([]);
  });

  it('limits paginated Amazon purchase updates', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      hasMore: true,
      receiptList: [],
    });
    const module = createExpoIapVegaModule(service);

    await expect(module.getAvailableItems()).rejects.toMatchObject({
      code: ErrorCode.ServiceError,
    });
    expect(service.getPurchaseUpdates).toHaveBeenCalledTimes(100);
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
    const module = createExpoIapVegaModule(service);

    const products = await module.fetchProducts('all', skus);

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
    const module = createExpoIapVegaModule(service);

    const purchases = await module.getAvailableItems();

    expect(purchases).toHaveLength(101);
    expect(purchases[0]).toMatchObject({
      isAutoRenewing: true,
      productId: 'sub_0',
    });
    expect(service.getProductData).toHaveBeenCalledTimes(2);
    expect(service.getProductData.mock.calls[0]?.[0].skus).toHaveLength(100);
    expect(service.getProductData.mock.calls[1]?.[0].skus).toHaveLength(1);
  });

  it('excludes suspended purchases unless requested', async () => {
    const service = createService();
    service.getPurchaseUpdates.mockResolvedValue({
      responseCode: 1,
      receiptList: [
        {
          receiptId: 'deferred-sub',
          sku: 'premium_monthly',
          productType: 3,
          isDeferred: true,
        },
      ],
    });
    const module = createExpoIapVegaModule(service);

    await expect(module.getAvailableItems()).resolves.toEqual([]);

    await expect(
      module.getAvailableItems({includeSuspendedAndroid: true}),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'deferred-sub',
        isAutoRenewing: false,
        isSuspendedAndroid: true,
        purchaseState: 'pending',
      }),
    ]);
  });

  it('verifies Vega receipts through IAPKit Amazon payload', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          isValid: true,
          state: 'ENTITLED',
          store: 'amazon',
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createExpoIapVegaModule(service);

      await expect(
        module.verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: 'kit-key',
            amazon: {
              receiptId: 'receipt-vega-1',
              sandbox: true,
            },
          },
        }),
      ).resolves.toEqual({
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'entitled',
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
        sandbox: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('supports custom IAPKit base URLs for Vega verification', async () => {
    const service = createService();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          isValid: true,
          state: 'ENTITLED',
          store: 'amazon',
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    try {
      const module = createExpoIapVegaModule(service);

      await module.verifyPurchaseWithProvider({
        provider: 'iapkit',
        iapkit: {
          apiKey: 'kit-key',
          baseUrl: 'http://localhost:3100/',
          amazon: {
            userId: 'amazon-user',
            receiptId: 'receipt-vega-1',
          },
        },
      } as Parameters<typeof module.verifyPurchaseWithProvider>[0] & {
        iapkit: {baseUrl: string};
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3100/v1/purchase/verify',
        expect.any(Object),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects mixed IAPKit payloads on the Amazon Vega adapter', async () => {
    const service = createService();
    const module = createExpoIapVegaModule(service);

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
    ).rejects.toMatchObject({
      code: ErrorCode.DeveloperError,
      message:
        'Amazon Vega IAPKit verification requires exactly one amazon payload.',
    });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'HTTP 502',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'receipt no longer valid',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'receipt array failure',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'IAPKit returned non-JSON response (HTTP 200).',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'bad receipt',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'IAPKit returned malformed response (HTTP 200).',
      });
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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'IAPKit returned malformed response (HTTP 200).',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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
      const module = createExpoIapVegaModule(service);

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
        code: ErrorCode.ReceiptFailed,
        message: 'IAPKit returned malformed response (HTTP 200).',
      });
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
      const module = createExpoIapVegaModule(service);

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
        message: 'network offline',
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
      const module = createExpoIapVegaModule(service);

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
        message: 'body stream failed',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
