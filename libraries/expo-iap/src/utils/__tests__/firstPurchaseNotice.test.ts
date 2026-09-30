jest.mock('../../ExpoIapModule', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../__mocks__/ExpoIapModule'),
);

/* eslint-disable import/first */
import {readFileSync} from 'fs';
import {resolve} from 'path';
import type {PurchaseInput} from '../../types';
import {
  createFirstPurchaseNotice,
  type FirstPurchaseNoticeSignals,
} from '../firstPurchaseNotice';
/* eslint-enable import/first */

const {consoleNotice} = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../../packages/docs/community-touchpoints.json',
    ),
    'utf8',
  ),
) as {consoleNotice: string[]};
const expectedNotice = consoleNotice.join('\n');

const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => {
  consoleLog.mockClear();
});

afterAll(() => {
  consoleLog.mockRestore();
});

const flushPromises = () =>
  new Promise<void>((done) => {
    setTimeout(done, 0);
  });

const purchase = (overrides: Partial<PurchaseInput> = {}): PurchaseInput => ({
  id: 'transaction',
  productId: 'premium',
  isAutoRenewing: false,
  purchaseState: 'purchased',
  purchaseToken: 'token',
  quantity: 1,
  store: 'apple',
  transactionDate: 1720000000000,
  ...overrides,
});

describe('createFirstPurchaseNotice', () => {
  const signals = (
    overrides: Partial<Omit<FirstPurchaseNoticeSignals, 'log'>> = {},
  ) => ({
    isDebugBuild: () => true,
    isTestRunner: () => false,
    hasFlagStore: () => true,
    claim: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
    ...overrides,
    log: jest.fn<void, [string]>(),
  });

  it('prints the notice as one log call on the first purchased finish', async () => {
    const host = signals();
    createFirstPurchaseNotice(host)(purchase());
    await flushPromises();

    expect(host.claim).toHaveBeenCalledTimes(1);
    expect(host.log.mock.calls).toEqual([[expectedNotice]]);
  });

  it.each([
    ['in a release build', {isDebugBuild: () => false}],
    ['under a test runner', {isTestRunner: () => true}],
    ['without the native flag store', {hasFlagStore: () => false}],
  ])('prints nothing %s', async (_, overrides) => {
    const host = signals(overrides);
    createFirstPurchaseNotice(host)(purchase());
    await flushPromises();

    expect(host.claim).not.toHaveBeenCalled();
    expect(host.log).not.toHaveBeenCalled();
  });

  it('prints nothing for a pending purchase', async () => {
    const host = signals();
    createFirstPurchaseNotice(host)(purchase({purchaseState: 'pending'}));
    await flushPromises();

    expect(host.claim).not.toHaveBeenCalled();
    expect(host.log).not.toHaveBeenCalled();
  });

  it('prints nothing once this install has claimed the notice', async () => {
    const host = signals({claim: jest.fn().mockResolvedValue(false)});
    createFirstPurchaseNotice(host)(purchase());
    await flushPromises();

    expect(host.claim).toHaveBeenCalledTimes(1);
    expect(host.log).not.toHaveBeenCalled();
  });

  it('skips the native claim after this process has tried once', async () => {
    const host = signals();
    const notify = createFirstPurchaseNotice(host);
    notify(purchase());
    notify(purchase());
    await flushPromises();
    notify(purchase());
    await flushPromises();

    expect(host.claim).toHaveBeenCalledTimes(1);
    expect(host.log).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('flag store failed'))],
    [
      'throws',
      () => {
        throw new Error('module unavailable');
      },
    ],
  ])('swallows a claim that %s', async (_, claim) => {
    const host = signals({claim});
    expect(() => createFirstPurchaseNotice(host)(purchase())).not.toThrow();
    await flushPromises();

    expect(host.log).not.toHaveBeenCalled();
  });
});

describe('finishTransaction', () => {
  const workerId = process.env.JEST_WORKER_ID;
  const globals = globalThis as {__DEV__?: boolean};

  // A fresh registry per test resets the in-process guard.
  const load = async (os: string) => {
    jest.resetModules();
    const {Platform} = await import('react-native');
    Object.assign(Platform, {OS: os});
    const {default: native} = await import('../../ExpoIapModule');
    const {finishTransaction} = await import('../../index');
    jest.mocked(native.finishTransaction).mockResolvedValue(true);
    jest.mocked(native.acknowledgePurchaseAndroid).mockResolvedValue({});
    jest.mocked(native.consumePurchaseAndroid).mockResolvedValue({});
    jest.mocked(native.claimFirstPurchaseNotice).mockResolvedValue(true);
    return {native, finishTransaction};
  };

  beforeEach(() => {
    globals.__DEV__ = true;
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    delete globals.__DEV__;
    process.env.JEST_WORKER_ID = workerId;
  });

  it.each(['ios', 'android'])(
    'prints after the first successful %s finish',
    async (os) => {
      const {native, finishTransaction} = await load(os);
      await finishTransaction({purchase: purchase()});
      await flushPromises();

      expect(native.claimFirstPurchaseNotice).toHaveBeenCalledTimes(1);
      expect(consoleLog.mock.calls).toEqual([[expectedNotice]]);
    },
  );

  it('prints after an Android consume as well as an acknowledge', async () => {
    const {native, finishTransaction} = await load('android');
    await finishTransaction({purchase: purchase(), isConsumable: true});
    await flushPromises();

    expect(native.consumePurchaseAndroid).toHaveBeenCalledTimes(1);
    expect(native.acknowledgePurchaseAndroid).not.toHaveBeenCalled();
    expect(consoleLog.mock.calls).toEqual([[expectedNotice]]);
  });

  it('does not claim after a failed finish', async () => {
    const {native, finishTransaction} = await load('ios');
    const failure = new Error('finish failed');
    jest.mocked(native.finishTransaction).mockRejectedValue(failure);

    await expect(finishTransaction({purchase: purchase()})).rejects.toBe(
      failure,
    );
    await flushPromises();

    expect(native.claimFirstPurchaseNotice).not.toHaveBeenCalled();
  });

  it.each([
    [
      'in a release build',
      'ios',
      () => {
        globals.__DEV__ = false;
      },
    ],
    [
      'under Jest',
      'ios',
      () => {
        process.env.JEST_WORKER_ID = workerId;
      },
    ],
    ['on Vega', 'kepler', () => {}],
  ])('does not claim %s', async (_, os, arrange) => {
    arrange();
    const {native, finishTransaction} = await load(os);
    await finishTransaction({purchase: purchase()});
    await flushPromises();

    expect(native.claimFirstPurchaseNotice).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it.each([
    ['never settles', () => new Promise<boolean>(() => {})],
    ['rejects', () => Promise.reject(new Error('flag store failed'))],
  ])('resolves the finish when the claim %s', async (_, claim) => {
    const {native, finishTransaction} = await load('ios');
    jest.mocked(native.claimFirstPurchaseNotice).mockImplementation(claim);

    await expect(
      finishTransaction({purchase: purchase()}),
    ).resolves.toBeUndefined();
    await flushPromises();

    expect(native.claimFirstPurchaseNotice).toHaveBeenCalledTimes(1);
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
