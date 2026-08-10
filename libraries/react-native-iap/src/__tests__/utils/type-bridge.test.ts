import {
  checkTypeSynchronization,
  convertNitroProductToProduct,
  convertNitroPurchaseToPurchase,
  convertNitroSubscriptionStatusToSubscriptionStatusIOS,
  convertProductToProductSubscription,
  validateNitroProduct,
  validateNitroPurchase,
} from '../../utils/type-bridge';
import type {
  NitroProduct,
  NitroPurchase,
  NitroSubscriptionStatus,
} from '../../specs/RnIap.nitro';
import type {PurchaseAndroid, PurchaseIOS} from '../../types';

const product = (overrides: Partial<NitroProduct> = {}): NitroProduct => ({
  id: 'com.example.product',
  title: 'Product',
  description: 'Description',
  type: 'in-app',
  displayName: 'Product',
  displayPrice: '$4.99',
  currency: 'USD',
  price: 4.99,
  platform: 'ios',
  introductoryPricePaymentModeIOS: 'empty',
  ...overrides,
});

const purchase = (overrides: Partial<NitroPurchase> = {}): NitroPurchase => ({
  id: 'transaction-id',
  transactionId: 'transaction-id',
  productId: 'com.example.product',
  transactionDate: 123,
  purchaseToken: 'receipt',
  store: 'apple',
  quantity: 1,
  purchaseState: 'purchased',
  isAutoRenewing: false,
  ...overrides,
});

describe('type-bridge utilities', () => {
  describe('convertNitroProductToProduct', () => {
    it('converts iOS product metadata and normalizes enums', () => {
      const result = convertNitroProductToProduct(
        product({
          type: 'subs',
          typeIOS: 'autoRenewableSubscription',
          isFamilyShareableIOS: true,
          jsonRepresentationIOS: '{"id":"com.example.product"}',
          introductoryPricePaymentModeIOS: 'free-trial',
          introductoryPriceSubscriptionPeriodIOS: 'MONTH',
          subscriptionPeriodUnitIOS: 'YEAR',
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          type: 'subs',
          platform: 'ios',
          displayNameIOS: 'Product',
          isFamilyShareableIOS: true,
          typeIOS: 'auto-renewable-subscription',
          introductoryPricePaymentModeIOS: 'free-trial',
          introductoryPriceSubscriptionPeriodIOS: 'month',
          subscriptionPeriodUnitIOS: 'year',
        }),
      );
    });

    it('parses only standardized iOS offers and pricing terms', () => {
      const result = convertNitroProductToProduct(
        product({
          type: 'subs',
          typeIOS: 'subscriptionBundle',
          bundledSubscriptionsIOS: JSON.stringify([
            {
              description: 'Monthly access',
              displayName: 'Premium Monthly',
              displayPrice: '$4.99',
              id: 'premium.monthly',
              isFamilyShareable: true,
              price: 4.99,
              subscriptionGroupDisplayName: 'Premium',
              subscriptionGroupId: 'premium',
              subscriptionGroupLevel: 1,
            },
          ]),
          pricingTermsIOS: JSON.stringify([
            {billingDisplayPrice: '$4.99', billingPlanType: 'monthly'},
          ]),
          subscriptionOffers: JSON.stringify([
            {
              id: 'intro',
              displayPrice: 'Free',
              price: 0,
              type: 'introductory',
            },
          ]),
        }),
      ) as any;

      expect(result.typeIOS).toBe('subscription-bundle');
      expect(result.bundledSubscriptionsIOS).toEqual([
        expect.objectContaining({
          id: 'premium.monthly',
          subscriptionGroupId: 'premium',
        }),
      ]);
      expect(result.pricingTermsIOS).toHaveLength(1);
      expect(result.subscriptionOffers[0].id).toBe('intro');
      expect(result).not.toHaveProperty('discountOffers');
      expect(result).not.toHaveProperty('subscriptionInfoIOS');
      expect(result).not.toHaveProperty('discountsIOS');
    });

    it('parses standardized Android offers without legacy raw offer fields', () => {
      const result = convertNitroProductToProduct(
        product({
          type: 'subs',
          platform: 'android',
          subscriptionOffers: JSON.stringify([
            {
              id: 'base-monthly',
              displayPrice: '$4.99',
              price: 4.99,
              type: 'introductory',
              basePlanIdAndroid: 'monthly',
              offerTokenAndroid: 'token',
            },
          ]),
        }),
      ) as any;

      expect(result.platform).toBe('android');
      expect(result.subscriptionOffers[0].offerTokenAndroid).toBe('token');
      expect(result).not.toHaveProperty('discountOffers');
      expect(result).not.toHaveProperty('subscriptionOfferDetailsAndroid');
      expect(result).not.toHaveProperty('oneTimePurchaseOfferDetailsAndroid');
    });

    it('parses standardized Android one-time discount offers', () => {
      const result = convertNitroProductToProduct(
        product({
          platform: 'android',
          discountOffers: JSON.stringify([
            {
              id: 'discount',
              displayPrice: '$2.99',
              price: 2.99,
              type: 'one-time',
              offerTokenAndroid: 'discount-token',
            },
          ]),
        }),
      ) as any;

      expect(result.discountOffers[0].offerTokenAndroid).toBe('discount-token');
      expect(result).not.toHaveProperty('oneTimePurchaseOfferDetailsAndroid');
    });

    it('uses safe defaults for invalid standardized offer JSON', () => {
      const iosResult = convertNitroProductToProduct(
        product({subscriptionOffers: '{'}),
      ) as any;
      const androidResult = convertNitroProductToProduct(
        product({
          type: 'subs',
          platform: 'android',
          subscriptionOffers: '{',
        }),
      ) as any;

      expect(iosResult.subscriptionOffers).toBeNull();
      expect(iosResult).not.toHaveProperty('discountOffers');
      expect(androidResult.subscriptionOffers).toEqual([]);
    });

    it('normalizes native aliases and malformed optional metadata', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const fallbackPlatform = convertNitroProductToProduct(
          product({platform: 'unknown' as never}),
        );
        const result = convertNitroProductToProduct(
          product({
            typeIOS: 'mystery' as never,
            introductoryPricePaymentModeIOS: 'payAsYouGo' as never,
            introductoryPriceSubscriptionPeriodIOS: 'DAY' as never,
            subscriptionPeriodUnitIOS: 'WEEK' as never,
            pricingTermsIOS: '{',
            bundledSubscriptionsIOS: '{',
          }),
        ) as any;

        expect(fallbackPlatform.platform).toBe('android');
        expect(result.typeIOS).toBe('non-consumable');
        expect(result.introductoryPricePaymentModeIOS).toBe('pay-as-you-go');
        expect(result.introductoryPriceSubscriptionPeriodIOS).toBe('day');
        expect(result.subscriptionPeriodUnitIOS).toBe('week');
        expect(result.pricingTermsIOS).toBeNull();
        expect(result.bundledSubscriptionsIOS).toBeNull();
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['consumable', 'consumable'],
      ['non_consumable', 'non-consumable'],
      ['nonRenewingSubscription', 'non-renewing-subscription'],
      ['subscriptionSuite', 'subscription-suite'],
    ] as const)('normalizes iOS type %s', (nativeType, expected) => {
      expect(
        (
          convertNitroProductToProduct(
            product({typeIOS: nativeType as never}),
          ) as any
        ).typeIOS,
      ).toBe(expected);
    });

    it('handles non-array iOS metadata and invalid Android discounts', () => {
      const ios = convertNitroProductToProduct(
        product({
          pricingTermsIOS: '{}',
          bundledSubscriptionsIOS: '{}',
          introductoryPricePaymentModeIOS: 'payUpFront' as never,
          introductoryPriceSubscriptionPeriodIOS: 'invalid' as never,
        }),
      ) as any;
      const android = convertNitroProductToProduct(
        product({platform: 'android', discountOffers: '{'}),
      ) as any;

      expect(ios.pricingTermsIOS).toBeNull();
      expect(ios.bundledSubscriptionsIOS).toBeNull();
      expect(ios.introductoryPricePaymentModeIOS).toBe('pay-up-front');
      expect(ios.introductoryPriceSubscriptionPeriodIOS).toBe('empty');
      expect(android.discountOffers).toBeNull();
    });
  });

  it('preserves subscription type when casting a product', () => {
    const subscription = convertProductToProductSubscription(
      convertNitroProductToProduct(product({type: 'subs'})),
    );

    expect(subscription.type).toBe('subs');
  });

  it('warns when casting an in-app product as a subscription', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = convertProductToProductSubscription(
        convertNitroProductToProduct(product()),
      );
      expect(result.id).toBe('com.example.product');
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  describe('convertNitroPurchaseToPurchase', () => {
    it('uses store as the purchase discriminator for Apple', () => {
      const result = convertNitroPurchaseToPurchase(
        purchase({
          transactionId: 'canonical-transaction-id',
          currentPlanId: 'premium-monthly',
          ids: ['com.example.product', 'addon'],
          bundleOriginalTransactionIdIOS: 'bundle-original',
          bundleProductIdIOS: 'bundle-product',
          bundleSubscriptionGroupIdIOS: 'bundle-group',
          bundleTransactionIdIOS: 'bundle-transaction',
          previousOriginalTransactionIdIOS: 'previous-original',
          revocationTypeIOS: 'assignmentRevocation',
          renewalInfoIOS: {
            bundleOriginalTransactionId: 'renewal-bundle-original',
            bundleProductId: 'renewal-bundle-product',
            bundleSubscriptionGroupId: 'renewal-bundle-group',
            willAutoRenew: true,
            isInBillingRetry: true,
            willUnbundle: false,
          },
        }),
      ) as PurchaseIOS;

      expect(result).toEqual(
        expect.objectContaining({
          store: 'apple',
          transactionId: 'canonical-transaction-id',
          currentPlanId: 'premium-monthly',
          ids: ['com.example.product', 'addon'],
          bundleOriginalTransactionIdIOS: 'bundle-original',
          bundleProductIdIOS: 'bundle-product',
          bundleSubscriptionGroupIdIOS: 'bundle-group',
          bundleTransactionIdIOS: 'bundle-transaction',
          previousOriginalTransactionIdIOS: 'previous-original',
          revocationTypeIOS: 'assignmentRevocation',
          renewalInfoIOS: expect.objectContaining({
            bundleOriginalTransactionId: 'renewal-bundle-original',
            bundleProductId: 'renewal-bundle-product',
            bundleSubscriptionGroupId: 'renewal-bundle-group',
            willAutoRenew: true,
            isInBillingRetry: true,
            willUnbundle: false,
          }),
        }),
      );
      expect(result).not.toHaveProperty('platform');
    });

    it('rejects Apple purchases without an explicit transaction id', () => {
      expect(() =>
        convertNitroPurchaseToPurchase(
          purchase({
            id: 'purchase-identity',
            transactionId: null,
          }),
        ),
      ).toThrow('Apple purchase is missing transactionId');
    });

    it.each([
      ['restored', 'purchased'],
      ['deferred', 'pending'],
    ] as const)('normalizes native %s state to %s', (nativeState, expected) => {
      const result = convertNitroPurchaseToPurchase(
        purchase({purchaseState: nativeState as never}),
      );

      expect(result.purchaseState).toBe(expected);
    });

    it('maps Google purchase state and preserves the explicit order id', () => {
      const result = convertNitroPurchaseToPurchase(
        purchase({
          id: 'purchase-token',
          transactionId: 'GPA.1234',
          purchaseToken: null,
          purchaseTokenAndroid: 'purchase-token',
          store: 'google',
          purchaseState: 'unknown',
          purchaseStateAndroid: 1,
          isAutoRenewing: true,
        }),
      ) as PurchaseAndroid;

      expect(result).toEqual(
        expect.objectContaining({
          store: 'google',
          purchaseState: 'purchased',
          autoRenewingAndroid: true,
          transactionId: 'GPA.1234',
        }),
      );
      expect(result).not.toHaveProperty('platform');
    });

    it('does not treat an orderless Google purchase token as transactionId', () => {
      const result = convertNitroPurchaseToPurchase(
        purchase({
          id: 'purchase-token',
          transactionId: null,
          purchaseToken: null,
          purchaseTokenAndroid: 'purchase-token',
          store: 'google',
        }),
      ) as PurchaseAndroid;

      expect(result.transactionId).toBeNull();
    });

    it.each(['amazon', 'horizon'] as const)(
      'preserves a %s receipt id as transactionId',
      (store) => {
        const result = convertNitroPurchaseToPurchase(
          purchase({
            id: `${store}-receipt`,
            transactionId: null,
            purchaseToken: `${store}-receipt`,
            store,
          }),
        ) as PurchaseAndroid;

        expect(result.store).toBe(store);
        expect(result.transactionId).toBe(`${store}-receipt`);
      },
    );

    it('preserves Android pending replacement metadata', () => {
      const result = convertNitroPurchaseToPurchase(
        purchase({
          store: 'google',
          currentPlanId: 'premium-yearly',
          ids: ['premium-monthly', 'premium-yearly'],
          pendingPurchaseUpdateAndroid: {
            products: ['premium-yearly'],
            purchaseToken: 'pending-token',
          },
        }),
      ) as PurchaseAndroid;

      expect(result.pendingPurchaseUpdateAndroid).toEqual({
        products: ['premium-yearly'],
        purchaseToken: 'pending-token',
      });
    });

    it('normalizes numeric states and nullable native primitives', () => {
      const purchased = convertNitroPurchaseToPurchase(
        purchase({
          store: 'google',
          purchaseState: 1 as never,
          transactionId: null,
          isAutoRenewing: false,
          autoRenewingAndroid: 1 as never,
          isAcknowledgedAndroid: 'true' as never,
        }),
      ) as PurchaseAndroid;
      const pending = convertNitroPurchaseToPurchase(
        purchase({store: 'google', purchaseState: 2 as never}),
      );
      const unknown = convertNitroPurchaseToPurchase(
        purchase({store: 'other' as never, purchaseState: 99 as never}),
      );

      expect(purchased.purchaseState).toBe('purchased');
      expect(purchased.autoRenewingAndroid).toBe(true);
      expect(purchased.isAcknowledgedAndroid).toBe(true);
      expect(pending.purchaseState).toBe('pending');
      expect(unknown.purchaseState).toBe('unknown');
      expect(unknown.store).toBe('unknown');
    });

    it('drops malformed optional Apple offer JSON', () => {
      const result = convertNitroPurchaseToPurchase(
        purchase({
          offerIOS: '{',
          quantityIOS: '2' as never,
          expirationDateIOS: 'not-a-number' as never,
          isUpgradedIOS: 'true' as never,
        }),
      ) as PurchaseIOS;

      expect(result.offerIOS).toBeNull();
      expect(result.quantityIOS).toBe(2);
      expect(result.expirationDateIOS).toBeNull();
      expect(result.isUpgradedIOS).toBe(true);
    });
  });

  it('converts iOS subscription status renewal metadata', () => {
    const status: NitroSubscriptionStatus = {
      state: 1,
      platform: 'ios',
      renewalInfo: {
        willAutoRenew: true,
        expirationReason: 'billing-error',
        isInBillingRetry: true,
        renewalBillingPlanType: 'monthly',
      },
    };

    expect(
      convertNitroSubscriptionStatusToSubscriptionStatusIOS(status),
    ).toEqual(
      expect.objectContaining({
        renewalInfo: expect.objectContaining({
          willAutoRenew: true,
          expirationReason: 'billing-error',
          isInBillingRetry: true,
          renewalBillingPlanType: 'monthly',
        }),
      }),
    );
  });

  it('converts an iOS subscription status without renewal metadata', () => {
    expect(
      convertNitroSubscriptionStatusToSubscriptionStatusIOS({
        state: null,
        platform: 'ios',
        renewalInfo: null,
      } as never),
    ).toEqual({state: '', renewalInfo: undefined});
  });

  describe('validation helpers', () => {
    it('validates the required NitroProduct fields', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        expect(validateNitroProduct(product())).toBe(true);
        expect(
          validateNitroProduct({title: 'missing fields'} as NitroProduct),
        ).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[RN-IAP]',
          'NitroProduct missing required field: id',
          {title: 'missing fields'},
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('rejects non-object products and purchases', () => {
      expect(validateNitroProduct(null as never)).toBe(false);
      expect(validateNitroPurchase(null as never)).toBe(false);
    });

    it('requires store when validating NitroPurchase', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        expect(validateNitroPurchase(purchase())).toBe(true);
        expect(
          validateNitroPurchase({
            id: 'id',
            productId: 'sku',
            transactionDate: 1,
          } as NitroPurchase),
        ).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[RN-IAP]',
          'NitroPurchase has invalid required field: store',
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('accepts only decodable object JSON for the Nitro iOS offer', () => {
      expect(
        validateNitroPurchase(
          purchase({
            offerIOS: JSON.stringify({
              id: 'intro',
              paymentMode: 'free-trial',
              type: 'introductory',
            }),
          }),
        ),
      ).toBe(true);
      expect(validateNitroPurchase(purchase({offerIOS: '{invalid'}))).toBe(
        false,
      );
      expect(validateNitroPurchase(purchase({offerIOS: '[]'}))).toBe(false);
    });

    it.each([
      ['id', {id: ''}],
      ['productId', {productId: ''}],
      ['transactionDate', {transactionDate: Number.NaN}],
      ['purchaseState', {purchaseState: ''}],
      ['quantity', {quantity: 1.5}],
      ['isAutoRenewing', {isAutoRenewing: null}],
      ['transactionId', {transactionId: null}],
      ['ids', {ids: [1]}],
      ['pendingPurchaseUpdateAndroid', {pendingPurchaseUpdateAndroid: []}],
      ['renewalInfoIOS', {renewalInfoIOS: 'invalid'}],
      ['offerIOS', {offerIOS: 1}],
    ] as const)('rejects invalid %s metadata', (_field, overrides) => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        expect(validateNitroPurchase(purchase(overrides as never))).toBe(false);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  it('keeps type synchronization healthy', () => {
    expect(checkTypeSynchronization()).toEqual({isSync: true, issues: []});
  });
});
