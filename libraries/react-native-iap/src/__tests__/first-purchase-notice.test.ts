import {Platform} from 'react-native';
import type {getVegaIapModule, RnIap} from '../index';
import type {MutationField, PurchaseIOS, PurchaseState} from '../types';
import {
  createFirstPurchaseNotice,
  FIRST_PURCHASE_NOTICE,
  type FirstPurchaseNoticeSignals,
} from '../utils/first-purchase-notice';

const mockNative = {
  finishTransaction: jest.fn<Promise<boolean>, [unknown]>(),
  claimFirstPurchaseNotice: jest.fn<boolean, []>(),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {createHybridObject: () => mockNative},
}));

const NOTICE = FIRST_PURCHASE_NOTICE.join('\n');
const jestWorkerId = process.env.JEST_WORKER_ID;

const purchase = (purchaseState: PurchaseState): PurchaseIOS => ({
  id: '2000000000000001',
  isAutoRenewing: false,
  productId: 'dev.hyo.martie.10bulbs',
  purchaseState,
  quantity: 1,
  store: 'apple',
  transactionDate: 0,
  transactionId: '2000000000000001',
});

// Lets the notice's promise chain settle.
const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

let claim: jest.Mock<boolean, []>;
let log: jest.Mock<void, [string]>;

beforeEach(() => {
  claim = jest.fn(() => true);
  log = jest.fn();
});

describe('createFirstPurchaseNotice', () => {
  const notice = (
    overrides: Partial<FirstPurchaseNoticeSignals> = {},
  ): ((purchase: PurchaseIOS) => void) =>
    createFirstPurchaseNotice(claim, {
      isDebugBuild: () => true,
      isTestRunner: () => false,
      isVegaOS: () => false,
      log,
      ...overrides,
    });

  it('prints the four lines as one log after a purchased finish in a debug build', async () => {
    notice()(purchase('purchased'));
    await flush();

    expect(FIRST_PURCHASE_NOTICE).toHaveLength(4);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(log.mock.calls).toEqual([[NOTICE]]);
  });

  it('stays silent in a release build', async () => {
    notice({isDebugBuild: () => false})(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('stays silent under a test runner', async () => {
    notice({isTestRunner: () => true})(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('never claims on Vega OS, which has no native flag', async () => {
    notice({isVegaOS: () => true})(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('skips a pending purchase and still claims for a later purchased one', async () => {
    const show = notice();
    show(purchase('pending'));
    await flush();
    expect(claim).not.toHaveBeenCalled();

    show(purchase('purchased'));
    await flush();
    expect(claim).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the install already showed it', async () => {
    claim.mockReturnValue(false);
    notice()(purchase('purchased'));
    await flush();

    expect(claim).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('calls the native flag once per process, even for overlapping finishes', async () => {
    const show = notice();
    show(purchase('purchased'));
    show(purchase('purchased'));
    await flush();
    show(purchase('purchased'));
    await flush();

    expect(claim).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('swallows a flag that throws', () => {
    claim.mockImplementationOnce(() => {
      throw new Error('native method missing');
    });
    expect(() => notice()(purchase('purchased'))).not.toThrow();

    expect(claim).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('the app signals', () => {
  const dev: unknown = Reflect.get(globalThis, '__DEV__');
  const os = Platform.OS;
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.JEST_WORKER_ID;
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.JEST_WORKER_ID = jestWorkerId;
    Reflect.set(globalThis, '__DEV__', dev);
    Object.assign(Platform, {OS: os});
    consoleLog.mockRestore();
  });

  it('print to the console in a debug build', async () => {
    createFirstPurchaseNotice(claim)(purchase('purchased'));
    await flush();

    expect(consoleLog.mock.calls).toEqual([[NOTICE]]);
  });

  it('detect Jest from JEST_WORKER_ID', async () => {
    process.env.JEST_WORKER_ID = jestWorkerId;
    createFirstPurchaseNotice(claim)(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
  });

  it('detect a release build from __DEV__', async () => {
    Reflect.set(globalThis, '__DEV__', false);
    createFirstPurchaseNotice(claim)(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
  });

  it('detect Vega OS from the platform', async () => {
    Object.assign(Platform, {OS: 'kepler'});
    createFirstPurchaseNotice(claim)(purchase('purchased'));
    await flush();

    expect(claim).not.toHaveBeenCalled();
  });
});

describe('finishTransaction', () => {
  let finishTransaction: MutationField<'finishTransaction'>;
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.JEST_WORKER_ID;
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockNative.finishTransaction.mockReset().mockResolvedValue(true);
    mockNative.claimFirstPurchaseNotice.mockReset().mockReturnValue(true);
    // A fresh module per test, so the in-memory guard starts unset.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({finishTransaction} = require('../index'));
    });
  });

  afterEach(() => {
    process.env.JEST_WORKER_ID = jestWorkerId;
    jest.restoreAllMocks();
  });

  it('prints once, after the first successful finish of a purchased purchase', async () => {
    await finishTransaction({purchase: purchase('purchased')});
    await finishTransaction({purchase: purchase('purchased')});
    await flush();

    expect(mockNative.claimFirstPurchaseNotice).toHaveBeenCalledTimes(1);
    expect(consoleLog.mock.calls).toEqual([[NOTICE]]);
  });

  it('stays silent after a failed finish', async () => {
    mockNative.finishTransaction.mockRejectedValue(
      new Error(JSON.stringify({code: 'service-error', message: 'offline'})),
    );

    await expect(
      finishTransaction({purchase: purchase('purchased')}),
    ).rejects.toMatchObject({message: 'offline'});
    await flush();

    expect(mockNative.claimFirstPurchaseNotice).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('stays silent when the native finish reports failure', async () => {
    mockNative.finishTransaction.mockResolvedValue(false);

    await expect(
      finishTransaction({purchase: purchase('purchased')}),
    ).rejects.toThrow('Failed to finish transaction');
    await flush();

    expect(mockNative.claimFirstPurchaseNotice).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('stays silent for a pending purchase', async () => {
    await finishTransaction({purchase: purchase('pending')});
    await flush();

    expect(mockNative.claimFirstPurchaseNotice).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('never fails a finish on the native flag', async () => {
    mockNative.claimFirstPurchaseNotice.mockImplementationOnce(() => {
      throw new Error('preferences unavailable');
    });
    await expect(
      finishTransaction({purchase: purchase('purchased')}),
    ).resolves.toBeUndefined();

    expect(mockNative.claimFirstPurchaseNotice).toHaveBeenCalledTimes(1);
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('prints in the same turn as the finish, with nothing left to settle', async () => {
    await finishTransaction({purchase: purchase('purchased')});

    expect(consoleLog.mock.calls).toEqual([[NOTICE]]);
  });

  it('keeps the native flag out of the exported types', () => {
    const iap: Partial<RnIap> = {};
    // @ts-expect-error The flag is internal to react-native-iap; `yarn typecheck` fails if it leaks.
    expect(iap.claimFirstPurchaseNotice).toBeUndefined();

    const vega: Partial<NonNullable<ReturnType<typeof getVegaIapModule>>> = {};
    // @ts-expect-error Same for the Vega adapter type.
    expect(vega.claimFirstPurchaseNotice).toBeUndefined();
  });
});
