import {
  emitNativeEvent,
  nativePlugin,
  resetNativePlugin,
  setPlatform,
} from '../__mocks__/capacitor-core';
import * as IAP from '../index';
import {ErrorCode, type Purchase} from '../types';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const applePurchase = {
  id: 'apple-1',
  transactionId: 'apple-1',
  productId: 'dev.hyo.martie.premium',
  purchaseState: 'purchased',
  isAutoRenewing: true,
  quantity: 1,
  store: 'apple',
  storeId: 'apple',
  platform: 'ios',
  transactionDate: 1_700_000_000_000,
};

type Case = [
  name: string,
  call: () => Promise<unknown>,
  native: string,
  nativeValue: unknown,
  nativeArgs: unknown[],
  expected: unknown,
];

const iosCases: Case[] = [
  ['syncIOS', () => IAP.syncIOS(), 'syncIOS', true, [], true],
  [
    'isEligibleForIntroOfferIOS',
    () => IAP.isEligibleForIntroOfferIOS('group'),
    'isEligibleForIntroOfferIOS',
    true,
    [{groupID: 'group'}],
    true,
  ],
  [
    'subscriptionStatusIOS',
    () => IAP.subscriptionStatusIOS('sku'),
    'subscriptionStatusIOS',
    null,
    [{sku: 'sku'}],
    [],
  ],
  [
    'currentEntitlementIOS',
    () => IAP.currentEntitlementIOS('sku'),
    'currentEntitlementIOS',
    null,
    [{sku: 'sku'}],
    null,
  ],
  [
    'latestTransactionIOS',
    () => IAP.latestTransactionIOS('sku'),
    'latestTransactionIOS',
    applePurchase,
    [{sku: 'sku'}],
    applePurchase,
  ],
  [
    'beginRefundRequestIOS',
    () => IAP.beginRefundRequestIOS('sku'),
    'beginRefundRequestIOS',
    'success',
    [{sku: 'sku'}],
    'success',
  ],
  [
    'showManageSubscriptionsIOS',
    () => IAP.showManageSubscriptionsIOS(),
    'showManageSubscriptionsIOS',
    [applePurchase],
    [],
    [applePurchase],
  ],
  [
    'getReceiptDataIOS',
    () => IAP.getReceiptDataIOS(),
    'getReceiptDataIOS',
    'receipt',
    [],
    'receipt',
  ],
  [
    'requestReceiptRefreshIOS',
    () => IAP.requestReceiptRefreshIOS(),
    'requestReceiptRefreshIOS',
    'receipt',
    [],
    'receipt',
  ],
  [
    'isTransactionVerifiedIOS',
    () => IAP.isTransactionVerifiedIOS('sku'),
    'isTransactionVerifiedIOS',
    true,
    [{sku: 'sku'}],
    true,
  ],
  [
    'getTransactionJwsIOS',
    () => IAP.getTransactionJwsIOS('sku'),
    'getTransactionJwsIOS',
    null,
    [{sku: 'sku'}],
    '',
  ],
  [
    'getAppTransactionIOS',
    () => IAP.getAppTransactionIOS(),
    'getAppTransactionIOS',
    null,
    [],
    null,
  ],
  [
    'getPromotedProductIOS',
    () => IAP.getPromotedProductIOS(),
    'getPromotedProductIOS',
    null,
    [],
    null,
  ],
  [
    'getPendingTransactionsIOS',
    () => IAP.getPendingTransactionsIOS(),
    'getPendingTransactionsIOS',
    [applePurchase],
    [],
    [applePurchase],
  ],
  [
    'getAllTransactionsIOS',
    () => IAP.getAllTransactionsIOS(),
    'getAllTransactionsIOS',
    [],
    [],
    [],
  ],
  [
    'clearTransactionIOS',
    () => IAP.clearTransactionIOS(),
    'clearTransactionIOS',
    true,
    [],
    true,
  ],
  [
    'deepLinkToSubscriptions',
    () => IAP.deepLinkToSubscriptions(),
    'deepLinkToSubscriptions',
    true,
    [{options: null}],
    undefined,
  ],
  [
    'canPresentExternalPurchaseNoticeIOS',
    () => IAP.canPresentExternalPurchaseNoticeIOS(),
    'canPresentExternalPurchaseNoticeIOS',
    true,
    [],
    true,
  ],
  [
    'presentExternalPurchaseNoticeSheetIOS',
    () => IAP.presentExternalPurchaseNoticeSheetIOS(),
    'presentExternalPurchaseNoticeSheetIOS',
    {result: 'continue'},
    [],
    {result: 'continue'},
  ],
  [
    'presentExternalPurchaseLinkIOS',
    () => IAP.presentExternalPurchaseLinkIOS('https://example.com'),
    'presentExternalPurchaseLinkIOS',
    {success: true},
    [{url: 'https://example.com'}],
    {success: true},
  ],
  [
    'isEligibleForExternalPurchaseCustomLinkIOS',
    () => IAP.isEligibleForExternalPurchaseCustomLinkIOS(),
    'isEligibleForExternalPurchaseCustomLinkIOS',
    false,
    [],
    false,
  ],
  [
    'getExternalPurchaseCustomLinkTokenIOS',
    () => IAP.getExternalPurchaseCustomLinkTokenIOS('acquisition'),
    'getExternalPurchaseCustomLinkTokenIOS',
    {token: 'token'},
    [{tokenType: 'acquisition'}],
    {token: 'token'},
  ],
  [
    'showExternalPurchaseCustomLinkNoticeIOS',
    () => IAP.showExternalPurchaseCustomLinkNoticeIOS('browser'),
    'showExternalPurchaseCustomLinkNoticeIOS',
    {continued: true},
    [{noticeType: 'browser'}],
    {continued: true},
  ],
];

const androidCases: Case[] = [
  [
    'consumePurchaseAndroid',
    () => IAP.consumePurchaseAndroid('token'),
    'consumePurchaseAndroid',
    true,
    [{purchaseToken: 'token'}],
    true,
  ],
  [
    'isBillingProgramAvailableAndroid',
    () => IAP.isBillingProgramAvailableAndroid('external-offer'),
    'isBillingProgramAvailableAndroid',
    {isAvailable: true},
    [{program: 'external-offer'}],
    {isAvailable: true},
  ],
  [
    'getBillingChoiceInfoAndroid',
    () => IAP.getBillingChoiceInfoAndroid({}),
    'getBillingChoiceInfoAndroid',
    {playBillingChoiceImageUrl: 'url'},
    [
      {
        params: {
          billingProgram: 'billing-choice',
          playBillingChoiceImageLayout: 'rectangular-four-by-one',
          userLocale: null,
        },
      },
    ],
    {playBillingChoiceImageUrl: 'url'},
  ],
  [
    'launchExternalLinkAndroid',
    () =>
      IAP.launchExternalLinkAndroid({
        billingProgram: 'external-offer',
        launchMode: 'launch-in-external-browser-or-app',
        linkType: 'link-to-digital-content-offer',
        linkUri: 'https://example.com',
      }),
    'launchExternalLinkAndroid',
    true,
    [
      {
        params: {
          billingProgram: 'external-offer',
          launchMode: 'launch-in-external-browser-or-app',
          linkType: 'link-to-digital-content-offer',
          linkUri: 'https://example.com',
        },
      },
    ],
    true,
  ],
  [
    'showBillingProgramInformationDialogAndroid',
    () =>
      IAP.showBillingProgramInformationDialogAndroid({
        externalTransactionToken: 'token',
      }),
    'showBillingProgramInformationDialogAndroid',
    {responseCode: 0},
    [
      {
        params: {
          billingProgram: 'billing-choice',
          externalTransactionToken: 'token',
        },
      },
    ],
    {responseCode: 0},
  ],
  [
    'showInAppMessagesAndroid',
    () => IAP.showInAppMessagesAndroid(),
    'showInAppMessagesAndroid',
    {responseCode: 0},
    [{params: null}],
    {responseCode: 0},
  ],
  [
    'deepLinkToSubscriptions',
    () =>
      IAP.deepLinkToSubscriptions({
        skuAndroid: 'sku',
        packageNameAndroid: 'dev.hyo.martie',
      }),
    'deepLinkToSubscriptions',
    true,
    [{options: {skuAndroid: 'sku', packageNameAndroid: 'dev.hyo.martie'}}],
    undefined,
  ],
  [
    'openRedeemOfferCode',
    () => IAP.openRedeemOfferCode(),
    'openRedeemOfferCode',
    null,
    [],
    null,
  ],
];

beforeEach(() => {
  resetNativePlugin();
});

describe.each([
  ['ios', iosCases],
  ['android', androidCases],
] as const)('%s wrappers', (platform, cases) => {
  beforeEach(() => setPlatform(platform));

  it.each(cases)(
    '%s forwards to the native plugin',
    async (_name, call, native, nativeValue, nativeArgs, expected) => {
      nativePlugin[native] = jest.fn(async () => ({value: nativeValue}));
      await expect(call()).resolves.toEqual(expected);
      expect(nativePlugin[native]).toHaveBeenCalledWith(...nativeArgs);
    },
  );
});

describe('argument checks', () => {
  beforeEach(() => setPlatform('ios'));

  it.each([
    ['isEligibleForIntroOfferIOS', () => IAP.isEligibleForIntroOfferIOS('')],
    ['subscriptionStatusIOS', () => IAP.subscriptionStatusIOS('')],
    ['currentEntitlementIOS', () => IAP.currentEntitlementIOS('')],
    ['latestTransactionIOS', () => IAP.latestTransactionIOS('')],
    ['beginRefundRequestIOS', () => IAP.beginRefundRequestIOS('')],
    ['isTransactionVerifiedIOS', () => IAP.isTransactionVerifiedIOS('')],
    ['getTransactionJwsIOS', () => IAP.getTransactionJwsIOS('')],
    [
      'presentExternalPurchaseLinkIOS',
      () => IAP.presentExternalPurchaseLinkIOS(''),
    ],
  ])('%s rejects a missing argument', async (_name, call) => {
    await expect(call()).rejects.toMatchObject({
      code: ErrorCode.DeveloperError,
    });
  });

  it('rejects a malformed Apple purchase list', async () => {
    nativePlugin.getPendingTransactionsIOS = jest.fn(async () => ({
      value: [{...applePurchase, store: 'google'}],
    }));
    await expect(IAP.getPendingTransactionsIOS()).rejects.toMatchObject({
      code: ErrorCode.BillingResponseJsonParseError,
    });
  });
});

describe('cross-platform queries', () => {
  it('normalizes available-purchase options', async () => {
    setPlatform('ios');
    nativePlugin.getAvailablePurchases = jest.fn(async () => ({
      value: [applePurchase],
    }));

    await expect(IAP.getAvailablePurchases()).resolves.toEqual([applePurchase]);
    expect(nativePlugin.getAvailablePurchases).toHaveBeenCalledWith({
      options: {
        alsoPublishToEventListenerIOS: false,
        onlyIncludeActiveItemsIOS: true,
        includeSuspendedAndroid: false,
      },
    });
  });

  it('forwards app ownership options', async () => {
    nativePlugin.verifyAppOwnership = jest.fn(async () => ({
      value: {status: 'unknown', storeId: 'play'},
    }));
    const options = {google: {cloudProjectNumber: '1', requestHash: 'hash'}};
    await IAP.verifyAppOwnership(options);
    expect(nativePlugin.verifyAppOwnership).toHaveBeenCalledWith({options});
  });

  it('passes the connection config through', async () => {
    nativePlugin.initConnection = jest.fn(async () => ({value: true}));
    nativePlugin.endConnection = jest.fn(async () => ({value: true}));

    await IAP.initConnection({enableBillingProgramAndroid: 'external-offer'});
    await IAP.endConnection();
    expect(nativePlugin.initConnection).toHaveBeenCalledWith({
      config: {enableBillingProgramAndroid: 'external-offer'},
    });
  });
});

describe('Android listeners', () => {
  beforeEach(() => setPlatform('android'));

  it('delivers billing selections and billing issues', async () => {
    const userChoice = jest.fn();
    const developer = jest.fn();
    const billingIssue = jest.fn();
    IAP.userChoiceBillingListenerAndroid(userChoice);
    IAP.developerProvidedBillingListenerAndroid(developer);
    IAP.subscriptionBillingIssueListener(billingIssue);
    await flush();

    emitNativeEvent('user-choice-billing-android', {products: ['a']});
    emitNativeEvent('developer-provided-billing-android', {products: ['b']});
    emitNativeEvent('subscription-billing-issue', {productId: 'c'});
    expect(userChoice).toHaveBeenCalledWith({products: ['a']});
    expect(developer).toHaveBeenCalledWith({products: ['b']});
    expect(billingIssue).toHaveBeenCalledWith({productId: 'c'});
  });

  it('ignores iOS-only listeners', () => {
    IAP.promotedProductListenerIOS(jest.fn());
    expect(nativePlugin.addListener).not.toHaveBeenCalled();
  });
});

describe('createPurchaseFlow', () => {
  it('confirms and finishes a purchase the user requested', async () => {
    setPlatform('android');
    const delivered = {
      id: 'order-1',
      productId: 'dev.hyo.martie.10bulbs',
      purchaseToken: 'token-1',
      purchaseState: 'purchased',
      isAutoRenewing: false,
      quantity: 1,
      store: 'google',
      storeId: 'play',
      transactionDate: Date.now(),
    } as Purchase;
    nativePlugin.requestPurchase = jest.fn(async () => ({value: [delivered]}));
    nativePlugin.consumePurchaseAndroid = jest.fn(async () => ({value: true}));
    const confirmWithBackend = jest.fn(async () => ({
      status: 'entitled' as const,
      alreadyGranted: false,
    }));

    const flow = IAP.createPurchaseFlow({
      isConsumable: () => true,
      confirmWithBackend,
    });
    const outcomes: string[] = [];
    flow.subscribe(({status}) => outcomes.push(status.status));
    await flush();

    await IAP.requestPurchase({
      request: {google: {skus: [delivered.productId]}},
      type: 'in-app',
    });
    emitNativeEvent('purchase-updated', delivered);
    await flush();
    await flush();

    expect(confirmWithBackend).toHaveBeenCalledWith(delivered, {
      isConsumable: true,
    });
    expect(nativePlugin.consumePurchaseAndroid).toHaveBeenCalledWith({
      purchaseToken: 'token-1',
    });
    expect(outcomes).toEqual(['entitled']);
    flow.dispose();
  });

  it('confirms iOS purchases through StoreKit history on device', async () => {
    setPlatform('ios');
    nativePlugin.getPendingTransactionsIOS = jest.fn(async () => ({
      value: [applePurchase],
    }));
    const confirm = IAP.confirmOnDeviceIOS();

    await expect(
      confirm(applePurchase as Purchase, {isConsumable: false}),
    ).resolves.toMatchObject({status: 'entitled'});
  });

  it('confirms with IAPKit through verifyPurchaseWithProvider', async () => {
    setPlatform('android');
    nativePlugin.verifyPurchaseWithProvider = jest.fn(async () => ({
      value: {
        provider: 'iapkit',
        iapkit: {
          isValid: true,
          state: 'entitled',
          store: 'google',
          storeId: 'play',
          productId: 'dev.hyo.martie.premium',
        },
      },
    }));
    const confirm = IAP.confirmWithIapkit({apiKey: 'key'});
    const purchase = {
      id: 'order-2',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'token-2',
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'google',
      storeId: 'play',
      transactionDate: 1,
    } as Purchase;

    await expect(
      confirm(purchase, {isConsumable: false}),
    ).resolves.toMatchObject({
      status: 'entitled',
    });
    expect(nativePlugin.verifyPurchaseWithProvider).toHaveBeenCalled();
  });
});
