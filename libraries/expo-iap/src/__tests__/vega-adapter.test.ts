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

  it('maps Amazon invalid SKU purchase failures to OpenIAP errors', async () => {
    const service = createService();
    service.purchase.mockResolvedValueOnce({
      responseCode: 2,
      receipt: null,
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

      expect(service.getUserData).toHaveBeenCalledWith({});
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
