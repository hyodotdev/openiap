import {readFileSync} from 'fs';
import {resolve} from 'path';
import {resetNativePlugin, setPlatform} from '../../__mocks__/capacitor-core';
import type {PurchaseInput} from '../../types';
import {
  createFirstPurchaseNotice,
  type FirstPurchaseNoticeSignals,
} from '../firstPurchaseNotice';

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
  storeId: 'apple',
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

  // A fresh registry per test resets the in-process guard.
  const load = async (platform: string) => {
    jest.resetModules();
    const core = await import('../../__mocks__/capacitor-core');
    core.setPlatform(platform);
    core.resetNativePlugin();
    Object.assign(core.nativePlugin, {
      finishTransaction: jest.fn(async () => undefined),
      acknowledgePurchaseAndroid: jest.fn(async () => ({value: true})),
      consumePurchaseAndroid: jest.fn(async () => ({value: true})),
    });
    core.nativePlugin.claimFirstPurchaseNotice.mockResolvedValue({value: true});
    const {finishTransaction} = await import('../../index');
    return {native: core.nativePlugin, finishTransaction};
  };

  beforeEach(() => {
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    process.env.JEST_WORKER_ID = workerId;
    setPlatform('android');
    resetNativePlugin();
  });

  it.each(['ios', 'android'])(
    'prints after the first successful %s finish',
    async (platform) => {
      const {native, finishTransaction} = await load(platform);
      await finishTransaction({purchase: purchase()});
      await flushPromises();

      expect(native.claimFirstPurchaseNotice).toHaveBeenCalledTimes(1);
      expect(consoleLog.mock.calls).toEqual([[expectedNotice]]);
    },
  );

  it('does not claim after a failed finish', async () => {
    const {native, finishTransaction} = await load('ios');
    native.finishTransaction.mockRejectedValue(new Error('finish failed'));

    await expect(finishTransaction({purchase: purchase()})).rejects.toThrow(
      'finish failed',
    );
    await flushPromises();
    expect(native.claimFirstPurchaseNotice).not.toHaveBeenCalled();
  });

  it('prints nothing under a test runner', async () => {
    const {native, finishTransaction} = await load('android');
    process.env.JEST_WORKER_ID = '1';
    await finishTransaction({purchase: purchase()});
    await flushPromises();

    expect(native.claimFirstPurchaseNotice).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('prints nothing on the web', async () => {
    const {native} = await load('android');
    const {showFirstPurchaseNotice} = await import('../firstPurchaseNotice');
    const core = await import('../../__mocks__/capacitor-core');
    core.setPlatform('web');
    showFirstPurchaseNotice(purchase());
    await flushPromises();

    expect(native.claimFirstPurchaseNotice).not.toHaveBeenCalled();
  });
});
