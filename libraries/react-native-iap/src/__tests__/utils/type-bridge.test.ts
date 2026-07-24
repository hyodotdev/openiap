import {
  convertNitroProductToProduct,
  convertProductToProductSubscription,
  convertNitroPurchaseToPurchase,
  convertNitroSubscriptionStatusToSubscriptionStatusIOS,
  validateNitroProduct,
  validateNitroPurchase,
  checkTypeSynchronization,
} from '../../utils/type-bridge';
import type {
  NitroProduct,
  NitroPurchase,
  NitroSubscriptionStatus,
} from '../../specs/RnIap.nitro';
import type {PurchaseAndroid} from '../../types';

describe('type-bridge utilities', () => {
  describe('convertNitroProductToProduct', () => {
    it('converts iOS in-app product', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.product',
        title: 'Test Product',
        description: 'Test Description',
        type: 'inapp',
        displayName: 'Display Name',
        displayPrice: '$9.99',
        currency: 'USD',
        price: 9.99,
        platform: 'ios',
        isFamilyShareableIOS: true,
        jsonRepresentationIOS: '{"sku": "com.example.product"}',
        typeIOS: 'consumable',
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct);

      expect(result.type).toBe('in-app');
      expect(result.platform).toBe('ios');
      expect((result as any).displayNameIOS).toBe('Display Name');
      expect((result as any).isFamilyShareableIOS).toBe(true);
      expect((result as any).typeIOS).toBe('consumable');
    });

    it('converts iOS subscription fields with enums', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.subscription',
        title: 'Premium',
        description: 'Premium plan',
        type: 'subs',
        displayName: 'Premium Display',
        displayPrice: '$4.99',
        currency: 'USD',
        price: 4.99,
        platform: 'ios',
        typeIOS: 'autoRenewableSubscription',
        introductoryPriceSubscriptionPeriodIOS: 'MONTH',
        subscriptionPeriodUnitIOS: 'YEAR',
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.type).toBe('subs');
      expect(result.typeIOS).toBe('auto-renewable-subscription');
      expect(result.introductoryPriceSubscriptionPeriodIOS).toBe('month');
      expect(result.subscriptionPeriodUnitIOS).toBe('year');
    });

    it('converts Android subscription and parses offer details', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.android.subs',
        title: 'Android Sub',
        description: 'Android subscription',
        type: 'subs',
        displayName: 'Android Display',
        displayPrice: '$2.99',
        currency: 'USD',
        price: 2.99,
        platform: 'android',
        subscriptionOfferDetailsAndroid: JSON.stringify([
          {
            basePlanId: 'base',
            offerId: 'offer',
            offerToken: 'token',
            offerTags: ['tag'],
            pricingPhases: {
              pricingPhaseList: [
                {
                  formattedPrice: '$2.99',
                  priceCurrencyCode: 'USD',
                  billingPeriod: 'P1M',
                  billingCycleCount: 1,
                  priceAmountMicros: '2990000',
                  recurrenceMode: 1,
                },
              ],
            },
          },
        ]),
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.type).toBe('subs');
      expect(result.platform).toBe('android');
      expect(Array.isArray(result.subscriptionOfferDetailsAndroid)).toBe(true);
      expect(result.subscriptionOfferDetailsAndroid[0].offerToken).toBe(
        'token',
      );
    });

    it('converts iOS subscription with standardized subscriptionOffers', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.ios.subs',
        title: 'Premium',
        description: 'Premium subscription',
        type: 'subs',
        displayName: 'Premium Display',
        displayPrice: '$4.99',
        currency: 'USD',
        price: 4.99,
        platform: 'ios',
        debugDescription: 'StoreKit subscription debug',
        typeIOS: 'autoRenewableSubscription',
        subscriptionGroupIdIOS: '21686373',
        pricingTermsIOS: JSON.stringify([
          {
            billingDisplayPrice: '$4.99',
            billingPeriod: {unit: 'month', value: 1},
            billingPlanType: 'monthly',
            billingPrice: 4.99,
            commitmentInfo: {
              displayPrice: '$59.88',
              period: {unit: 'year', value: 1},
              price: 59.88,
            },
          },
        ]),
        subscriptionInfoIOS: JSON.stringify({
          subscriptionGroupId: '21686373',
          subscriptionPeriod: {unit: 'month', value: 1},
        }),
        subscriptionOffers: JSON.stringify([
          {
            id: 'intro_weekly',
            displayPrice: 'Free',
            price: 0,
            type: 'introductory',
            paymentMode: 'free-trial',
            periodCount: 1,
            period: {
              unit: 'week',
              value: 1,
            },
          },
          {
            id: 'promo_20off',
            displayPrice: '$3.99',
            price: 3.99,
            type: 'promotional',
            paymentMode: 'pay-as-you-go',
            periodCount: 3,
            period: {
              unit: 'month',
              value: 1,
            },
          },
        ]),
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.type).toBe('subs');
      expect(result.platform).toBe('ios');
      expect(result.debugDescription).toBe('StoreKit subscription debug');
      expect(result.subscriptionGroupIdIOS).toBe('21686373');
      expect(result.pricingTermsIOS).toHaveLength(1);
      expect(result.pricingTermsIOS[0].billingPlanType).toBe('monthly');
      expect(result.subscriptionInfoIOS.subscriptionGroupId).toBe('21686373');
      expect(Array.isArray(result.subscriptionOffers)).toBe(true);
      expect(result.subscriptionOffers.length).toBe(2);
      expect(result.subscriptionOffers[0].id).toBe('intro_weekly');
      expect(result.subscriptionOffers[0].type).toBe('introductory');
      expect(result.subscriptionOffers[0].paymentMode).toBe('free-trial');
      expect(result.subscriptionOffers[1].id).toBe('promo_20off');
      expect(result.subscriptionOffers[1].type).toBe('promotional');
    });

    it('rejects invalid iOS metadata JSON payloads', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.ios.invalid',
        title: 'Invalid Metadata',
        description: 'Invalid metadata subscription',
        type: 'subs',
        displayPrice: '$4.99',
        currency: 'USD',
        price: 4.99,
        platform: 'ios',
        typeIOS: 'autoRenewableSubscription',
        pricingTermsIOS: JSON.stringify({billingPlanType: 'monthly'}),
        subscriptionInfoIOS: JSON.stringify([{subscriptionGroupId: 'group'}]),
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.pricingTermsIOS).toBeNull();
      expect(result.subscriptionInfoIOS).toBeNull();

      const malformedJsonProduct: NitroProduct = {
        ...nitroProduct,
        pricingTermsIOS: '[',
        subscriptionInfoIOS: '{',
      };

      const malformedResult = convertNitroProductToProduct(
        malformedJsonProduct,
      ) as any;

      expect(malformedResult.pricingTermsIOS).toBeNull();
      expect(malformedResult.subscriptionInfoIOS).toBeNull();
    });

    it('converts Android subscription with standardized subscriptionOffers', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.android.subs',
        title: 'Premium',
        description: 'Premium subscription',
        type: 'subs',
        displayName: 'Premium Display',
        displayPrice: '$4.99',
        currency: 'USD',
        price: 4.99,
        platform: 'android',
        subscriptionOffers: JSON.stringify([
          {
            id: 'base-monthly',
            displayPrice: '$4.99',
            price: 4.99,
            type: 'introductory',
            basePlanIdAndroid: 'monthly',
            offerTokenAndroid: 'token123',
            offerTagsAndroid: ['monthly', 'default'],
            paymentMode: 'pay-as-you-go',
            installmentPlanDetailsAndroid: {
              commitmentPaymentsCount: 12,
              subsequentCommitmentPaymentsCount: 0,
            },
            period: {
              unit: 'month',
              value: 1,
            },
            pricingPhasesAndroid: {
              pricingPhaseList: [
                {
                  formattedPrice: '$4.99',
                  priceAmountMicros: '4990000',
                  priceCurrencyCode: 'USD',
                  billingPeriod: 'P1M',
                  billingCycleCount: 0,
                  recurrenceMode: 2,
                },
              ],
            },
          },
        ]),
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.type).toBe('subs');
      expect(result.platform).toBe('android');
      expect(Array.isArray(result.subscriptionOffers)).toBe(true);
      expect(result.subscriptionOffers[0].basePlanIdAndroid).toBe('monthly');
      expect(result.subscriptionOffers[0].offerTokenAndroid).toBe('token123');
      expect(
        result.subscriptionOffers[0].installmentPlanDetailsAndroid
          .commitmentPaymentsCount,
      ).toBe(12);
    });

    it('converts Android product with standardized discountOffers', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.android.otp',
        title: 'Item Pack',
        description: 'One-time purchase item pack',
        type: 'inapp',
        displayName: 'Item Pack Display',
        displayPrice: '$9.99',
        currency: 'USD',
        price: 9.99,
        platform: 'android',
        oneTimePurchaseOfferDetailsAndroid: [
          {
            formattedPrice: '$4.99',
            offerTags: ['sale'],
            offerToken: 'discount_token123',
            priceAmountMicros: '4990000',
            priceCurrencyCode: 'USD',
            purchaseOptionId: 'legacy-purchase-option',
          },
        ],
        discountOffers: JSON.stringify([
          {
            id: 'discount_50off',
            currency: 'USD',
            displayPrice: '$4.99',
            price: 4.99,
            type: 'one-time',
            offerTokenAndroid: 'discount_token123',
            offerTagsAndroid: ['sale', 'limited'],
            discountAmountMicrosAndroid: '5000000',
            formattedDiscountAmountAndroid: '$5.00 OFF',
            fullPriceMicrosAndroid: '9990000',
            percentageDiscountAndroid: 50,
            purchaseOptionIdAndroid: 'purchase-option',
            preorderDetailsAndroid: {
              preorderPresaleEndTimeMillis: '1000',
              preorderReleaseTimeMillis: '2000',
            },
            rentalDetailsAndroid: {
              rentalExpirationPeriod: 'P1D',
              rentalPeriod: 'P7D',
            },
          },
        ]),
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.type).toBe('in-app');
      expect(result.platform).toBe('android');
      expect(Array.isArray(result.discountOffers)).toBe(true);
      expect(result.discountOffers[0].id).toBe('discount_50off');
      expect(result.discountOffers[0].discountAmountMicrosAndroid).toBe(
        '5000000',
      );
      expect(result.discountOffers[0].formattedDiscountAmountAndroid).toBe(
        '$5.00 OFF',
      );
      expect(result.discountOffers[0].type).toBe('one-time');
      expect(result.discountOffers[0].percentageDiscountAndroid).toBe(50);
      expect(result.discountOffers[0].purchaseOptionIdAndroid).toBe(
        'purchase-option',
      );
      expect(result.discountOffers[0].preorderDetailsAndroid).toEqual({
        preorderPresaleEndTimeMillis: '1000',
        preorderReleaseTimeMillis: '2000',
      });
      expect(result.discountOffers[0].rentalDetailsAndroid.rentalPeriod).toBe(
        'P7D',
      );
      expect(
        result.oneTimePurchaseOfferDetailsAndroid[0].purchaseOptionId,
      ).toBe('legacy-purchase-option');
    });

    it('handles missing subscriptionOffers gracefully', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.product',
        title: 'Test Product',
        description: 'Test Description',
        type: 'subs',
        platform: 'ios',
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      expect(result.subscriptionOffers).toBeNull();
      expect(result.discountOffers).toBeNull();
    });

    it('handles invalid JSON in subscriptionOffers gracefully for Android subscription', () => {
      const nitroProduct: NitroProduct = {
        id: 'com.example.product',
        title: 'Test Product',
        description: 'Test Description',
        type: 'subs',
        platform: 'android',
        subscriptionOffers: 'invalid json{',
      } as NitroProduct;

      const result = convertNitroProductToProduct(nitroProduct) as any;

      // Android subscription type requires non-nullable subscriptionOffers, so it defaults to empty array
      expect(result.subscriptionOffers).toEqual([]);
    });
  });

  describe('convertProductToProductSubscription', () => {
    it('preserves subscription type', () => {
      const product = {
        id: 'sub',
        title: 'Subscription',
        description: 'Desc',
        type: 'subs',
        displayPrice: '$1.99',
        currency: 'USD',
        platform: 'android',
        subscriptionOfferDetailsAndroid: [],
      } as any;

      const subscription = convertProductToProductSubscription(product);
      expect(subscription.type).toBe('subs');
    });
  });

  describe('convertNitroPurchaseToPurchase', () => {
    it('converts iOS purchases with enums', () => {
      const nitroPurchase: NitroPurchase = {
        id: 'tx-ios',
        productId: 'sku-ios',
        transactionDate: 123,
        purchaseToken: 'token-ios',
        platform: 'ios',
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      };

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result.platform).toBe('ios');
      expect(result.purchaseState).toBe('purchased');
      expect(result.transactionId).toBe('tx-ios');
    });

    it('preserves common and StoreKit purchase metadata', () => {
      const nitroPurchase = {
        id: 'tx-ios-metadata',
        transactionId: 'canonical-tx-ios-metadata',
        productId: 'sku-ios',
        transactionDate: 123,
        platform: 'ios',
        store: 'apple',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: true,
        currentPlanId: 'premium-monthly',
        ids: ['sku-ios', 'item-addon'],
        advancedCommerceInfoIOS: {items: []},
        billingPlanTypeIOS: 'monthly',
        commitmentInfoIOS: {
          billingPeriodNumber: 3,
          commitmentExpiresDate: 456,
          commitmentPrice: 9.99,
          totalBillingPeriods: 12,
        },
        renewalInfoIOS: {
          willAutoRenew: true,
          commitmentInfo: {
            commitmentAutoRenewProductId: 'sku-ios',
            commitmentAutoRenewStatus: true,
            commitmentRenewalBillingPlanType: 'monthly',
            commitmentRenewalDate: 789,
            commitmentRenewalPrice: 9.99,
          },
          renewalBillingPlanType: 'monthly',
        },
      } as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result).toEqual(
        expect.objectContaining({
          currentPlanId: 'premium-monthly',
          ids: ['sku-ios', 'item-addon'],
          transactionId: 'canonical-tx-ios-metadata',
          advancedCommerceInfoIOS: {items: []},
          billingPlanTypeIOS: 'monthly',
          commitmentInfoIOS: expect.objectContaining({totalBillingPeriods: 12}),
          renewalInfoIOS: expect.objectContaining({
            commitmentInfo: expect.objectContaining({
              commitmentAutoRenewProductId: 'sku-ios',
            }),
            renewalBillingPlanType: 'monthly',
          }),
        }),
      );
    });

    it('normalizes restored purchases to purchased state', () => {
      // Test legacy 'restored' state from native layer (not part of PurchaseState type)
      const nitroPurchase = {
        id: 'tx-restored',
        productId: 'sku-ios',
        transactionDate: 123,
        purchaseToken: 'token-ios',
        platform: 'ios',
        store: 'apple',
        quantity: 1,
        purchaseState: 'restored', // Legacy value from native
        isAutoRenewing: false,
      } as unknown as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result.purchaseState).toBe('purchased');
    });

    it('normalizes deferred purchases to pending state', () => {
      // Test legacy 'deferred' state from native layer (not part of PurchaseState type)
      const nitroPurchase = {
        id: 'tx-deferred',
        productId: 'sku-ios',
        transactionDate: 123,
        purchaseToken: 'token-ios',
        platform: 'ios',
        store: 'apple',
        quantity: 1,
        purchaseState: 'deferred', // Legacy value from native
        isAutoRenewing: false,
      } as unknown as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result.purchaseState).toBe('pending');
    });

    it('converts Android purchases and maps purchase state', () => {
      const nitroPurchase: NitroPurchase = {
        id: 'token-android',
        transactionId: 'order-android',
        productId: 'sku-android',
        transactionDate: 456,
        purchaseTokenAndroid: 'token-android',
        platform: 'android',
        store: 'google',
        quantity: 1,
        purchaseState: 'unknown',
        purchaseStateAndroid: 1,
        isAutoRenewing: true,
      } as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase) as any;
      expect(result.platform).toBe('android');
      expect(result.purchaseState).toBe('purchased');
      expect(result.autoRenewingAndroid).toBe(true);
      expect(result.transactionId).toBe('order-android');
    });

    it('does not treat an orderless Android purchase token as transactionId', () => {
      const nitroPurchase: NitroPurchase = {
        id: 'pending-purchase-token',
        transactionId: null,
        productId: 'sku-android',
        transactionDate: 456,
        purchaseTokenAndroid: 'pending-purchase-token',
        platform: 'android',
        store: 'google',
        quantity: 1,
        purchaseState: 'pending',
        isAutoRenewing: false,
      };

      const result = convertNitroPurchaseToPurchase(
        nitroPurchase,
      ) as PurchaseAndroid;
      expect(result.id).toBe('pending-purchase-token');
      expect(result.transactionId).toBeNull();
    });

    it('recovers a legacy Google order ID that differs from its token', () => {
      const nitroPurchase = {
        id: 'GPA.1234-5678',
        productId: 'sku-android',
        transactionDate: 456,
        purchaseToken: 'purchase-token',
        purchaseTokenAndroid: 'purchase-token',
        platform: 'android',
        store: 'google',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      } as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(
        nitroPurchase,
      ) as PurchaseAndroid;
      expect(result.transactionId).toBe('GPA.1234-5678');
    });

    it.each(['amazon', 'horizon'] as const)(
      'recovers a legacy %s receipt ID even when it is also the token',
      (store) => {
        const nitroPurchase = {
          id: `${store}-receipt`,
          productId: 'sku-android',
          transactionDate: 456,
          purchaseToken: `${store}-receipt`,
          purchaseTokenAndroid: `${store}-receipt`,
          platform: 'android',
          store,
          quantity: 1,
          purchaseState: 'purchased',
          isAutoRenewing: false,
        } as NitroPurchase;

        const result = convertNitroPurchaseToPurchase(
          nitroPurchase,
        ) as PurchaseAndroid;
        expect(result.transactionId).toBe(`${store}-receipt`);
      },
    );

    it('preserves Android pending purchase metadata', () => {
      const nitroPurchase = {
        id: 'tx-pending-update',
        productId: 'sku-old',
        transactionDate: 456,
        platform: 'android',
        store: 'google',
        quantity: 1,
        purchaseState: 'pending',
        isAutoRenewing: true,
        currentPlanId: 'premium-yearly',
        ids: ['sku-old', 'sku-new'],
        pendingPurchaseUpdateAndroid: {
          products: ['sku-new'],
          purchaseToken: 'pending-token',
        },
      } as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result).toEqual(
        expect.objectContaining({
          currentPlanId: 'premium-yearly',
          ids: ['sku-old', 'sku-new'],
          pendingPurchaseUpdateAndroid: {
            products: ['sku-new'],
            purchaseToken: 'pending-token',
          },
        }),
      );
    });

    it('preserves Amazon store on Android purchases', () => {
      const nitroPurchase: NitroPurchase = {
        id: 'receipt-amazon',
        productId: 'sku-amazon',
        transactionDate: 789,
        purchaseTokenAndroid: 'receipt-amazon',
        platform: 'android',
        store: 'amazon',
        quantity: 1,
        purchaseState: 'purchased',
        isAutoRenewing: false,
      } as NitroPurchase;

      const result = convertNitroPurchaseToPurchase(nitroPurchase);
      expect(result.store).toBe('amazon');
    });
  });

  describe('convertNitroSubscriptionStatusToSubscriptionStatusIOS', () => {
    it('preserves billing retry and commitment renewal metadata', () => {
      const nitroStatus: NitroSubscriptionStatus = {
        state: 1,
        platform: 'ios',
        renewalInfo: {
          willAutoRenew: true,
          expirationReason: 'billing-error',
          isInBillingRetry: true,
          jsonRepresentation: '{"status":"billing-retry"}',
          renewalBillingPlanType: 'monthly',
          renewalDate: 456,
          commitmentInfo: {
            commitmentAutoRenewProductId: 'premium_monthly',
            commitmentAutoRenewStatus: true,
            commitmentRenewalBillingPlanType: 'monthly',
            commitmentRenewalDate: 123,
            commitmentRenewalPrice: 9.99,
          },
        },
      };

      expect(
        convertNitroSubscriptionStatusToSubscriptionStatusIOS(nitroStatus),
      ).toEqual(
        expect.objectContaining({
          renewalInfo: expect.objectContaining({
            isInBillingRetry: true,
            expirationReason: 'billing-error',
            jsonRepresentation: '{"status":"billing-retry"}',
            renewalBillingPlanType: 'monthly',
            renewalDate: 456,
            willAutoRenew: true,
            commitmentInfo: expect.objectContaining({
              commitmentAutoRenewProductId: 'premium_monthly',
            }),
          }),
        }),
      );
    });
  });

  describe('validation helpers', () => {
    it('validates NitroProduct shape', () => {
      const valid = validateNitroProduct({
        id: 'id',
        title: 'title',
        description: 'desc',
        type: 'inapp',
        platform: 'ios',
      } as NitroProduct);

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        const invalid = validateNitroProduct({
          title: 'missing fields',
        } as NitroProduct);

        expect(valid).toBe(true);
        expect(invalid).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[RN-IAP]',
          'NitroProduct missing required field: id',
          {title: 'missing fields'},
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('validates NitroPurchase shape', () => {
      const valid = validateNitroPurchase({
        id: 'id',
        productId: 'sku',
        transactionDate: 1,
        platform: 'ios',
      } as NitroPurchase);

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      try {
        const invalid = validateNitroPurchase({
          productId: 'sku',
        } as NitroPurchase);

        expect(valid).toBe(true);
        expect(invalid).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[RN-IAP]',
          'NitroPurchase missing required field: id',
          {productId: 'sku'},
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  it('keeps type synchronization healthy', () => {
    const result = checkTypeSynchronization();
    expect(result.isSync).toBe(true);
  });
});
