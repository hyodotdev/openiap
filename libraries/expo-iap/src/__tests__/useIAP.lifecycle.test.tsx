// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../ExpoIapModule', () => require('../__mocks__/ExpoIapModule'));

/* eslint-disable import/first */
import * as React from 'react';
import {createRoot, type Root} from 'test-renderer';
import {Platform} from 'react-native';
import ExpoIapModule from '../ExpoIapModule';
import * as IAP from '../index';
import type {Purchase, UserChoiceBillingDetails} from '../types';
import {useIAP, type UseIAPOptions} from '../useIAP';
/* eslint-enable import/first */

type Hook = ReturnType<typeof useIAP>;

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function Harness({
  options,
  onHook,
}: {
  options?: UseIAPOptions;
  onHook?: (hook: Hook) => void;
}) {
  const hook = useIAP(options);
  React.useEffect(() => {
    onHook?.(hook);
  }, [hook, onHook]);
  return null;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const purchase = (overrides: Partial<Purchase> = {}): Purchase =>
  ({
    id: '2000000000000001',
    transactionId: '2000000000000001',
    productId: 'premium_monthly',
    transactionDate: 1720000000000,
    store: 'apple',
    storeId: 'apple',
    quantity: 1,
    purchaseState: 'purchased',
    isAutoRenewing: true,
    platform: 'ios',
    ...overrides,
  } as Purchase);

const roots: Root[] = [];

const mount = async (element: React.ReactElement): Promise<Root> => {
  const root = createRoot();
  roots.push(root);
  await React.act(async () => {
    root.render(element);
    await flush();
  });
  return root;
};

const unmount = async (root: Root): Promise<void> => {
  await React.act(async () => {
    root.unmount();
    await flush();
  });
  roots.splice(roots.indexOf(root), 1);
};

let purchaseHandler: ((purchase: Purchase) => Promise<void>) | undefined;
const purchaseListenerRemovals: jest.Mock[] = [];

describe('useIAP lifecycle', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.assign(Platform, {OS: 'ios'});
    purchaseHandler = undefined;
    purchaseListenerRemovals.length = 0;
    jest.mocked(ExpoIapModule.initConnection).mockResolvedValue(true);
    jest.mocked(ExpoIapModule.endConnection).mockResolvedValue(true);
    jest.mocked(ExpoIapModule.addListener).mockReturnValue({remove: jest.fn()});
    jest.mocked(ExpoIapModule.getAvailableItems).mockResolvedValue([]);
    jest.mocked(ExpoIapModule.getActiveSubscriptions).mockResolvedValue([]);
    jest.mocked(ExpoIapModule.getPromotedProductIOS).mockResolvedValue(null);
    jest
      .spyOn(IAP, 'purchaseUpdatedListener')
      .mockImplementation((listener) => {
        purchaseHandler = listener as (purchase: Purchase) => Promise<void>;
        const remove = jest.fn();
        purchaseListenerRemovals.push(remove);
        return {remove};
      });
  });

  afterEach(async () => {
    for (const root of [...roots]) {
      await unmount(root);
    }
    jest.restoreAllMocks();
  });

  it('keeps the shared connection until the last mounted hook unmounts', async () => {
    const first = await mount(<Harness />);
    const second = await mount(<Harness />);

    await unmount(first);
    expect(ExpoIapModule.endConnection).not.toHaveBeenCalled();

    await unmount(second);
    expect(ExpoIapModule.endConnection).toHaveBeenCalledTimes(1);
  });

  it('delivers a purchase before the follow-up refresh settles', async () => {
    jest
      .mocked(ExpoIapModule.fetchProducts)
      .mockResolvedValue([
        {id: 'premium_monthly', platform: 'ios', type: 'subs'},
      ]);
    const onPurchaseSuccess = jest.fn();
    let hook: Hook | undefined;
    await mount(
      <Harness options={{onPurchaseSuccess}} onHook={(h) => (hook = h)} />,
    );
    await React.act(async () => {
      await hook!.fetchProducts({skus: ['premium_monthly'], type: 'subs'});
    });

    let releaseRefresh: (value: unknown[]) => void = () => {};
    jest.mocked(ExpoIapModule.getAvailableItems).mockReturnValue(
      new Promise((resolve) => {
        releaseRefresh = resolve;
      }),
    );

    let delivery: Promise<void> | undefined;
    await React.act(async () => {
      delivery = purchaseHandler!(purchase());
      await flush();
    });
    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);

    await React.act(async () => {
      releaseRefresh([]);
      await delivery;
    });
    expect(ExpoIapModule.getActiveSubscriptions).toHaveBeenCalled();
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('host callback failed');
      },
    ],
    [
      'rejects',
      async () => {
        throw new Error('host callback failed');
      },
    ],
  ])(
    'contains an onPurchaseSuccess that %s',
    async (_label, onPurchaseSuccess) => {
      await mount(<Harness options={{onPurchaseSuccess}} />);

      await React.act(async () => {
        await expect(purchaseHandler!(purchase())).resolves.toBeUndefined();
        await flush();
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[Expo-IAP]',
        '[useIAP] onPurchaseSuccess failed:',
        expect.objectContaining({message: 'host callback failed'}),
      );
    },
  );

  it.each(['catalog', 'available purchases'])(
    'refreshes independent ownership state when %s fails after purchase delivery',
    async (failedRead) => {
      jest
        .mocked(ExpoIapModule.fetchProducts)
        .mockResolvedValue([
          {id: 'premium_monthly', platform: 'ios', type: 'subs'},
        ]);
      const onPurchaseSuccess = jest.fn();
      let hook: Hook | undefined;
      await mount(
        <Harness options={{onPurchaseSuccess}} onHook={(h) => (hook = h)} />,
      );
      await React.act(async () => {
        await hook!.fetchProducts({skus: ['premium_monthly'], type: 'subs'});
      });
      jest.mocked(ExpoIapModule.getAvailableItems).mockClear();
      jest.mocked(ExpoIapModule.getActiveSubscriptions).mockClear();
      jest
        .mocked(ExpoIapModule.getAvailableItems)
        .mockResolvedValue([purchase()]);
      jest.mocked(ExpoIapModule.getActiveSubscriptions).mockResolvedValue([
        {
          productId: 'premium_monthly',
          isActive: true,
          transactionId: 'active-transaction',
          transactionDate: 1720000000000,
        },
      ]);
      const storeFailure = new Error('Temporary store query failure');
      if (failedRead === 'catalog') {
        jest
          .mocked(ExpoIapModule.fetchProducts)
          .mockRejectedValueOnce(storeFailure);
      } else {
        jest
          .mocked(ExpoIapModule.getAvailableItems)
          .mockRejectedValueOnce(storeFailure);
      }

      await React.act(async () => {
        await purchaseHandler!(purchase());
      });

      expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
      expect(ExpoIapModule.getAvailableItems).toHaveBeenCalledTimes(1);
      expect(ExpoIapModule.getActiveSubscriptions).toHaveBeenCalledTimes(1);
      expect(hook!.activeSubscriptions).toEqual([
        expect.objectContaining({productId: 'premium_monthly', isActive: true}),
      ]);
      if (failedRead === 'catalog') {
        expect(hook!.availablePurchases).toEqual([purchase()]);
        expect(hook!.subscriptions).toHaveLength(1);
      }
    },
  );

  it('publishes only the latest available-purchases read', async () => {
    let hook: Hook | undefined;
    await mount(
      <Harness
        onHook={(value) => {
          hook = value;
        }}
      />,
    );
    let resolveOlder: (purchases: Purchase[]) => void = () => {};
    jest
      .mocked(ExpoIapModule.getAvailableItems)
      .mockImplementationOnce(
        () =>
          new Promise<Purchase[]>((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockResolvedValueOnce([purchase({id: 'newer'})]);

    await React.act(async () => {
      const older = hook!.getAvailablePurchases();
      await hook!.getAvailablePurchases();
      resolveOlder([purchase({id: 'older'})]);
      await older;
    });

    expect(hook!.availablePurchases).toEqual([purchase({id: 'newer'})]);
  });

  it('publishes an older read when the newer one fails', async () => {
    let hook: Hook | undefined;
    await mount(
      <Harness
        options={{onError: () => {}}}
        onHook={(value) => (hook = value)}
      />,
    );
    let resolveOlder: (purchases: Purchase[]) => void = () => {};
    jest
      .mocked(ExpoIapModule.getAvailableItems)
      .mockImplementationOnce(
        () =>
          new Promise<Purchase[]>((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('store unavailable'));

    await React.act(async () => {
      const older = hook!.getAvailablePurchases();
      await expect(hook!.getAvailablePurchases()).rejects.toThrow(
        'store unavailable',
      );
      resolveOlder([purchase({id: 'owned'})]);
      await older;
    });

    expect(hook!.availablePurchases).toEqual([purchase({id: 'owned'})]);
  });

  it('publishes only the latest active-subscriptions read', async () => {
    let hook: Hook | undefined;
    await mount(<Harness onHook={(value) => (hook = value)} />);
    const active = (productId: string) => ({
      productId,
      isActive: true,
      transactionId: productId,
      transactionDate: 1720000000000,
    });
    let resolveOlder: (
      subscriptions: ReturnType<typeof active>[],
    ) => void = () => {};
    jest
      .mocked(ExpoIapModule.getActiveSubscriptions)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockResolvedValueOnce([active('premium_yearly')]);

    await React.act(async () => {
      const older = hook!.getActiveSubscriptions();
      await hook!.getActiveSubscriptions();
      resolveOlder([active('premium_monthly')]);
      await older;
    });

    expect(hook!.activeSubscriptions).toEqual([
      expect.objectContaining({productId: 'premium_yearly'}),
    ]);
  });

  it('drops a read that started before a subscription purchase arrived', async () => {
    const catalog = [{id: 'premium_monthly', platform: 'ios', type: 'subs'}];
    jest.mocked(ExpoIapModule.fetchProducts).mockResolvedValue(catalog);
    let hook: Hook | undefined;
    await mount(<Harness onHook={(value) => (hook = value)} />);
    await React.act(async () => {
      await hook!.fetchProducts({skus: ['premium_monthly'], type: 'subs'});
    });

    let resolveOlder: (purchases: Purchase[]) => void = () => {};
    let resolveCatalog: () => void = () => {};
    jest
      .mocked(ExpoIapModule.getAvailableItems)
      .mockImplementationOnce(
        () =>
          new Promise<Purchase[]>((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockResolvedValueOnce([purchase({id: 'after-purchase'})]);
    jest.mocked(ExpoIapModule.fetchProducts).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatalog = () => resolve(catalog);
        }),
    );

    let older: Promise<void> = Promise.resolve();
    let delivery: Promise<void> = Promise.resolve();
    await React.act(async () => {
      older = hook!.getAvailablePurchases();
      delivery = purchaseHandler!(purchase({id: 'after-purchase'}));
    });
    await React.act(async () => {
      resolveOlder([purchase({id: 'before-purchase'})]);
      await older;
    });
    expect(hook!.availablePurchases).toEqual([]);

    await React.act(async () => {
      resolveCatalog();
      await delivery;
    });
    expect(hook!.availablePurchases).toEqual([
      purchase({id: 'after-purchase'}),
    ]);
  });

  it.each(['resolves', 'rejects'])(
    'stops an old hook refresh that %s after switching purchase flows',
    async (completion) => {
      const catalog = [{id: 'premium_monthly', platform: 'ios', type: 'subs'}];
      jest.mocked(ExpoIapModule.fetchProducts).mockResolvedValue(catalog);
      const oldPurchase = jest.fn();
      const oldError = jest.fn();
      let oldHook: Hook | undefined;
      let newHook: Hook | undefined;
      const root = await mount(
        <Harness
          key="receipt"
          options={{onPurchaseSuccess: oldPurchase, onError: oldError}}
          onHook={(hook) => (oldHook = hook)}
        />,
      );
      await React.act(async () => {
        await oldHook!.fetchProducts({skus: ['premium_monthly'], type: 'subs'});
      });
      let settleOld: () => void = () => {};
      jest.mocked(ExpoIapModule.fetchProducts).mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            settleOld = () =>
              completion === 'resolves'
                ? resolve(catalog)
                : reject(new Error('Old catalog query ended'));
          }),
      );
      let oldRefresh: Promise<void> | undefined;
      await React.act(async () => {
        oldRefresh = purchaseHandler!(purchase());
        await flush();
      });
      expect(oldPurchase).toHaveBeenCalledTimes(1);
      await React.act(async () => {
        root.render(
          <Harness key="backend" onHook={(hook) => (newHook = hook)} />,
        );
        await flush();
      });
      expect(newHook!.connected).toBe(true);
      jest.mocked(ExpoIapModule.getAvailableItems).mockClear();
      jest.mocked(ExpoIapModule.getActiveSubscriptions).mockClear();

      await React.act(async () => {
        settleOld();
        await oldRefresh;
      });

      expect(oldPurchase).toHaveBeenCalledTimes(1);
      expect(oldError).not.toHaveBeenCalled();
      expect(ExpoIapModule.getAvailableItems).not.toHaveBeenCalled();
      expect(ExpoIapModule.getActiveSubscriptions).not.toHaveBeenCalled();
      await React.act(async () => {
        await newHook!.fetchProducts({skus: ['premium_monthly'], type: 'subs'});
      });
      expect(newHook!.subscriptions).toHaveLength(1);
      expect(newHook!.connected).toBe(true);
    },
  );

  it('delivers every listener event, including a pending purchase that completes', async () => {
    const onPurchaseSuccess = jest.fn();
    await mount(<Harness options={{onPurchaseSuccess}} />);
    const pending = purchase({
      store: 'google',
      storeId: 'play',
      platform: 'android',
      purchaseToken: 'token',
      purchaseState: 'pending',
    });

    await React.act(async () => {
      await purchaseHandler!(pending);
      await purchaseHandler!({...pending, purchaseState: 'purchased'});
    });

    expect(onPurchaseSuccess).toHaveBeenCalledTimes(2);
    expect(onPurchaseSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({purchaseState: 'purchased'}),
    );
  });

  it('leaves requestPurchase results to the purchase listener', async () => {
    jest.mocked(ExpoIapModule.requestPurchase).mockResolvedValue(purchase());
    const onPurchaseSuccess = jest.fn();
    let hook: Hook | undefined;
    await mount(
      <Harness options={{onPurchaseSuccess}} onHook={(h) => (hook = h)} />,
    );

    await React.act(async () => {
      await hook!.requestPurchase({
        request: {apple: {sku: 'premium_monthly'}},
        type: 'subs',
      });
    });

    expect(onPurchaseSuccess).not.toHaveBeenCalled();
  });

  it('forwards Android billing events to a callback set after mount', async () => {
    Object.assign(Platform, {OS: 'android'});
    const listeners: Record<string, (payload: unknown) => void> = {};
    jest
      .mocked(ExpoIapModule.addListener)
      .mockImplementation(
        (eventName: string, listener: (payload: unknown) => void) => {
          listeners[eventName] = listener;
          return {remove: jest.fn()};
        },
      );
    const root = await mount(<Harness />);

    const onUserChoiceBillingAndroid = jest.fn();
    await React.act(async () => {
      root.render(<Harness options={{onUserChoiceBillingAndroid}} />);
      await flush();
    });
    const details: UserChoiceBillingDetails = {
      externalTransactionToken: 'token',
      products: ['premium'],
    };
    listeners['user-choice-billing-android']?.(details);

    expect(onUserChoiceBillingAndroid).toHaveBeenCalledWith(details);
  });

  it('restores the purchase listener before requestPurchase after a failed connection', async () => {
    jest
      .mocked(ExpoIapModule.initConnection)
      .mockRejectedValueOnce(new Error('store unavailable'));
    jest.mocked(ExpoIapModule.requestPurchase).mockResolvedValue(purchase());
    const onPurchaseSuccess = jest.fn();
    let hook: Hook | undefined;
    await mount(
      <Harness
        options={{onPurchaseSuccess, onError: jest.fn()}}
        onHook={(h) => (hook = h)}
      />,
    );
    expect(purchaseListenerRemovals[0]).toHaveBeenCalledTimes(1);

    // The app recovers through the module-level API, not the hook's reconnect.
    await IAP.initConnection();
    await React.act(async () => {
      await hook!.requestPurchase({
        request: {apple: {sku: 'premium_monthly'}},
        type: 'subs',
      });
    });
    expect(IAP.purchaseUpdatedListener).toHaveBeenCalledTimes(2);

    await React.act(async () => {
      await purchaseHandler!(purchase());
    });
    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
  });

  it('restores the purchase listener on reconnect after a failed connection', async () => {
    jest
      .mocked(ExpoIapModule.initConnection)
      .mockRejectedValueOnce(new Error('store unavailable'));
    const onPurchaseSuccess = jest.fn();
    let hook: Hook | undefined;
    await mount(
      <Harness
        options={{onPurchaseSuccess, onError: jest.fn()}}
        onHook={(h) => (hook = h)}
      />,
    );
    expect(purchaseListenerRemovals[0]).toHaveBeenCalledTimes(1);

    await React.act(async () => {
      await expect(hook!.reconnect()).resolves.toBe(true);
    });
    expect(IAP.purchaseUpdatedListener).toHaveBeenCalledTimes(2);

    await React.act(async () => {
      await purchaseHandler!(purchase());
    });
    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1);
  });
});
