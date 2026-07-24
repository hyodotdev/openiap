import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_inapp_purchase/deprecation.dart';
import 'package:flutter_inapp_purchase/enums.dart';
import 'package:flutter_inapp_purchase/errors.dart' as iap_err;
import 'package:flutter_inapp_purchase/helpers.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('helpers', () {
    setUp(resetLegacyWarningsForTesting);

    test('resolveProductType emits canonical product types without warnings',
        () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);

      expect(resolveProductType('subs'), 'subs');
      expect(resolveProductType('in-app'), 'in-app');
      expect(resolveProductType(types.ProductQueryType.All), 'all');
      expect(resolveProductType(types.ProductQueryType.InApp), 'in-app');
      expect(resolveProductType(types.ProductType.InApp), 'in-app');
      expect(warnings, isEmpty);
    });

    test('resolveProductType warns once for each legacy product type', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);

      expect(resolveProductType('inapp'), 'in-app');
      expect(resolveProductType('inapp'), 'in-app');
      expect(resolveProductType(TypeInApp.subs), 'subs');
      expect(resolveProductType(TypeInApp.inapp), 'in-app');
      expect(resolveProductType(Object()), 'in-app');
      expect(warnings, hasLength(2));
      expect(warnings.first, contains('`inapp` is deprecated'));
      expect(warnings.last, contains('TypeInApp is deprecated'));
    });

    test('canonical product and purchase payloads emit no legacy warnings', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);

      parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': 'canonical-product',
          'title': 'Canonical',
          'description': 'Canonical product',
          'currency': 'USD',
          'displayPrice': '\$1.00',
          'typeIOS': 'CONSUMABLE',
        },
        'in-app',
        fallbackIsIOS: true,
      );
      convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'canonical-purchase',
          'productId': 'canonical-product',
          'transactionId': 'canonical-transaction',
          'purchaseState': 'purchased',
          'purchaseToken': 'canonical-token',
          'dataAndroid': '{}',
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );
      convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'id': 'canonical-ios-purchase',
          'productId': 'canonical-product',
          'transactionId': 'canonical-ios-transaction',
          'purchaseState': 'purchased',
          'purchaseToken': 'canonical-jws',
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(warnings, isEmpty);
    });

    test('explicit canonical nulls do not select legacy fallbacks', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);

      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': 'canonical-null-product',
          'title': 'Canonical null',
          'description': 'Canonical null product',
          'currency': 'USD',
          'displayPrice': r'$1.00',
          'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
          'discountsIOS': null,
          'discounts': <dynamic>[
            <String, dynamic>{'identifier': 'legacy-discount'},
          ],
          'subscriptionInfoIOS': null,
          'subscription': <String, dynamic>{
            'subscriptionGroupId': 'legacy-group',
          },
        },
        'subs',
        fallbackIsIOS: true,
      ) as types.ProductSubscriptionIOS;
      final productWithNullId = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': null,
          'productId': 'legacy-product-id',
          'sku': 'legacy-sku',
          'title': 'Canonical null ID',
          'description': 'Canonical null ID product',
          'currency': 'USD',
          'displayPrice': r'$1.00',
          'typeIOS': 'CONSUMABLE',
        },
        'in-app',
        fallbackIsIOS: true,
      ) as types.ProductIOS;
      final androidPurchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'canonical-null-android',
          'productId': 'canonical-null-product',
          'transactionId': 'canonical-null-android',
          'purchaseState': null,
          'purchaseStateAndroid': 2,
          'purchaseToken': 'canonical-null-token',
          'dataAndroid': null,
          'originalJsonAndroid': '{"legacy":true}',
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;
      final iosPurchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'id': 'canonical-null-ios',
          'productId': 'canonical-null-product',
          'transactionId': 'canonical-null-ios',
          'purchaseState': null,
          'transactionStateIOS': 'purchased',
          'purchaseToken': null,
          'transactionReceipt': 'legacy-receipt',
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseIOS;

      expect(product.discountsIOS, isNull);
      expect(product.subscriptionInfoIOS, isNull);
      expect(productWithNullId.id, isEmpty);
      expect(androidPurchase.purchaseState, types.PurchaseState.Unknown);
      expect(androidPurchase.dataAndroid, isNull);
      expect(iosPurchase.purchaseState, types.PurchaseState.Unknown);
      expect(iosPurchase.purchaseToken, isNull);
      expect(warnings, isEmpty);
    });

    test(
      'explicit purchase id presence suppresses identifier recovery',
      () {
        for (final canonicalId in <dynamic>[null, '']) {
          expect(
            () => convertToPurchase(
              <String, dynamic>{
                'platform': 'android',
                'store': 'google',
                'id': canonicalId,
                'productId': 'fallback-product',
                'transactionId': 'fallback-transaction',
                'purchaseState': 'purchased',
                'purchaseToken': 'purchase-token',
              },
              platformIsAndroid: true,
              platformIsIOS: false,
              acknowledgedAndroidPurchaseTokens: <String, bool>{},
            ),
            throwsA(isA<FormatException>()),
          );
        }
      },
    );

    test('legacy product fallbacks warn once per selected wire field', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);

      final legacyProductId = <String, dynamic>{
        'platform': 'ios',
        'productId': 'legacy-product-id',
        'title': 'Legacy',
        'description': 'Legacy product',
        'currency': 'USD',
        'displayPrice': '\$1.00',
        'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
        'discounts': <dynamic>[],
        'subscription': <dynamic>[],
      };
      final legacySku = <String, dynamic>{
        'platform': 'ios',
        'sku': 'legacy-sku',
        'title': 'Legacy SKU',
        'description': 'Legacy product',
        'currency': 'USD',
        'displayPrice': '\$1.00',
        'typeIOS': 'CONSUMABLE',
      };

      parseProductFromNative(
        legacyProductId,
        'subs',
        fallbackIsIOS: true,
      );
      parseProductFromNative(
        legacyProductId,
        'subs',
        fallbackIsIOS: true,
      );
      parseProductFromNative(legacySku, 'in-app', fallbackIsIOS: true);
      parseProductFromNative(legacySku, 'in-app', fallbackIsIOS: true);

      expect(warnings, hasLength(4));
      expect(warnings.join('\n'), contains('`productId` field'));
      expect(warnings.join('\n'), contains('`sku` field'));
      expect(warnings.join('\n'), contains('`discounts` field'));
      expect(warnings.join('\n'), contains('`subscription` field'));
      expect(warnings.join('\n'), contains('Use `subscriptionOffers`'));
      expect(warnings.join('\n'), contains('`subscriptionGroupIdIOS`'));
      expect(warnings.join('\n'), isNot(contains('Use `discountsIOS`')));
      expect(warnings.join('\n'), isNot(contains('Use `subscriptionInfoIOS`')));
    });

    test('legacy Android purchase fallbacks warn once per selected field', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);
      final payload = <String, dynamic>{
        'platform': 'android',
        'store': 'google',
        'id': 'GPA.legacy-order',
        'productId': 'legacy-product',
        'purchaseStateAndroid': 1,
        'purchaseToken': 'legacy-token',
        'originalJsonAndroid': '{"legacy":true}',
      };

      for (var index = 0; index < 2; index += 1) {
        convertToPurchase(
          payload,
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );
      }

      expect(warnings, hasLength(3));
      expect(warnings.join('\n'), contains('`purchaseStateAndroid` field'));
      expect(warnings.join('\n'), contains('`originalJsonAndroid` field'));
      expect(warnings.join('\n'), contains('purchase `id` as `transactionId`'));
    });

    test('legacy iOS purchase fallbacks warn once per selected field', () {
      final warnings = <String?>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        warnings.add(message);
      };
      addTearDown(() => debugPrint = originalDebugPrint);
      final payload = <String, dynamic>{
        'platform': 'ios',
        'store': 'apple',
        'id': 'legacy-ios-transaction',
        'productId': 'legacy-product',
        'transactionStateIOS': 'purchased',
        'transactionReceipt': 'legacy-receipt',
      };

      for (var index = 0; index < 2; index += 1) {
        convertToPurchase(
          payload,
          platformIsAndroid: false,
          platformIsIOS: true,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );
      }

      expect(warnings, hasLength(3));
      expect(warnings.join('\n'), contains('`transactionStateIOS` field'));
      expect(warnings.join('\n'), contains('`transactionReceipt` field'));
      expect(warnings.join('\n'), contains('purchase `id` as `transactionId`'));
    });

    test('parseProductFromNative creates iOS subscription product', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': 'premium_monthly',
          'title': 'Premium Monthly',
          'description': 'Monthly plan',
          'currency': 'USD',
          'displayPrice': '\$9.99',
          'price': 9.99,
          'isFamilyShareableIOS': true,
          'jsonRepresentationIOS': '{}',
          'subscriptionGroupIdIOS': '21686373',
          'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
          'pricingTermsIOS': <Map<String, dynamic>>[
            <String, dynamic>{
              'billingDisplayPrice': '\$9.99',
              'billingPeriod': <String, dynamic>{'unit': 'month', 'value': 1},
              'billingPlanType': 'monthly',
              'billingPrice': 9.99,
              'commitmentInfo': <String, dynamic>{
                'displayPrice': '\$119.88',
                'period': <String, dynamic>{'unit': 'year', 'value': 1},
                'price': 119.88,
              },
            },
          ],
        },
        'subs',
        fallbackIsIOS: true,
      );

      expect(product, isA<types.ProductSubscriptionIOS>());
      final subscription = product as types.ProductSubscriptionIOS;
      expect(subscription.id, 'premium_monthly');
      expect(subscription.platform, types.IapPlatform.IOS);
      expect(subscription.isFamilyShareableIOS, isTrue);
      expect(subscription.subscriptionGroupIdIOS, '21686373');
      expect(subscription.pricingTermsIOS, isNotNull);
      expect(subscription.pricingTermsIOS, hasLength(1));
      expect(
        subscription.pricingTermsIOS!.first.billingPlanType,
        types.SubscriptionBillingPlanTypeIOS.Monthly,
      );
      expect(subscription.type, types.ProductType.Subs);
    });

    test(
      'parseProductFromNative parses subscriptionOffers for iOS subscription',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'ios',
            'id': 'premium_yearly',
            'title': 'Premium Yearly',
            'description': 'Yearly plan',
            'currency': 'USD',
            'displayPrice': '\$49.99',
            'price': 49.99,
            'isFamilyShareableIOS': true,
            'jsonRepresentationIOS': '{}',
            'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
            'subscriptionOffers': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'intro_offer',
                'displayPrice': 'Free',
                'price': 0.0,
                'type': 'INTRODUCTORY',
                'paymentMode': 'FREE_TRIAL',
                'periodCount': 1,
                'period': <String, dynamic>{'unit': 'WEEK', 'value': 1},
              },
              <String, dynamic>{
                'id': 'promo_offer',
                'displayPrice': '\$29.99',
                'price': 29.99,
                'type': 'PROMOTIONAL',
                'paymentMode': 'PAY_AS_YOU_GO',
                'periodCount': 3,
                'numberOfPeriodsIOS': 3,
                'localizedPriceIOS': '\$29.99/month',
              },
            ],
          },
          'subs',
          fallbackIsIOS: true,
        );

        expect(product, isA<types.ProductSubscriptionIOS>());
        final subscription = product as types.ProductSubscriptionIOS;
        expect(subscription.subscriptionOffers, isNotNull);
        expect(subscription.subscriptionOffers, hasLength(2));

        final introOffer = subscription.subscriptionOffers!.first;
        expect(introOffer.id, 'intro_offer');
        expect(introOffer.type, types.DiscountOfferType.Introductory);
        expect(introOffer.paymentMode, types.PaymentMode.FreeTrial);
        expect(introOffer.price, 0.0);
        expect(introOffer.period, isNotNull);
        expect(introOffer.period!.unit, types.SubscriptionPeriodUnit.Week);
        expect(introOffer.period!.value, 1);

        final promoOffer = subscription.subscriptionOffers![1];
        expect(promoOffer.id, 'promo_offer');
        expect(promoOffer.type, types.DiscountOfferType.Promotional);
        expect(promoOffer.paymentMode, types.PaymentMode.PayAsYouGo);
        expect(promoOffer.price, 29.99);
        expect(promoOffer.numberOfPeriodsIOS, 3);
        expect(promoOffer.localizedPriceIOS, '\$29.99/month');
      },
    );

    test(
      'parseProductFromNative parses legacy iOS subscriptionOffers JSON string',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'ios',
            'id': 'premium_monthly',
            'title': 'Premium Monthly',
            'description': 'Monthly plan',
            'currency': 'USD',
            'displayPrice': '\$9.99',
            'price': 9.99,
            'isFamilyShareableIOS': false,
            'jsonRepresentationIOS': '{}',
            'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
            'subscriptionOffers': jsonEncode(<Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'legacy_intro',
                'displayPrice': 'Free',
                'price': 0.0,
                'type': 'INTRODUCTORY',
                'paymentMode': 'FREETRIAL',
                'periodCount': 1,
                'period': <String, dynamic>{'unit': 'WEEK', 'value': 1},
              },
            ]),
          },
          'subs',
          fallbackIsIOS: true,
        );

        expect(product, isA<types.ProductSubscriptionIOS>());
        final subscription = product as types.ProductSubscriptionIOS;
        expect(subscription.subscriptionOffers, hasLength(1));
        expect(
          subscription.subscriptionOffers!.single.paymentMode,
          types.PaymentMode.FreeTrial,
        );
      },
    );

    test(
      'parseProductFromNative creates Android in-app product with string offers',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'id': 'coins_pack',
            'title': 'Coins Pack',
            'description': 'One time coins',
            'currency': 'USD',
            'displayPrice': '\$2.99',
            'price': '2.99',
            'nameAndroid': 'Coins Pack',
            'subscriptionOfferDetailsAndroid': jsonEncode(
              <Map<String, dynamic>>[],
            ),
            'oneTimePurchaseOfferDetailsAndroid': <String, dynamic>{
              'formattedPrice': '\$2.99',
              'priceAmountMicros': '2990000',
              'priceCurrencyCode': 'USD',
              'purchaseOptionId': 'single-purchase-option',
            },
            'discountOffers': <dynamic>[
              const types.DiscountOffer(
                currency: 'USD',
                displayPrice: '\$0.99',
                id: 'typed_discount',
                offerTokenAndroid: 'typed-token',
                price: 0.99,
                type: types.DiscountOfferType.OneTime,
              ),
              <String, dynamic>{
                'id': 'malformed_discount',
                'offerTokenAndroid': 'bad-token',
              },
              <String, dynamic>{
                'currency': 'USD',
                'displayPrice': '\$1.99',
                'id': 'discount_001',
                'offerTokenAndroid': 'discount-token',
                'price': 1.99,
                'type': 'one-time',
              },
            ],
            'productStatusAndroid': types.ProductStatusAndroid.Ok,
          },
          'inapp',
          fallbackIsIOS: false,
        );

        expect(product, isA<types.ProductAndroid>());
        final androidProduct = product as types.ProductAndroid;
        expect(androidProduct.id, 'coins_pack');
        expect(androidProduct.platform, types.IapPlatform.Android);
        expect(androidProduct.price, closeTo(2.99, 0.0001));
        expect(androidProduct.oneTimePurchaseOfferDetailsAndroid, isNotNull);
        expect(
          androidProduct
              .oneTimePurchaseOfferDetailsAndroid!.single.purchaseOptionId,
          'single-purchase-option',
        );
        expect(androidProduct.discountOffers, hasLength(2));
        expect(
          androidProduct.discountOffers!.first.offerTokenAndroid,
          'typed-token',
        );
        expect(
          androidProduct.discountOffers![1].offerTokenAndroid,
          'discount-token',
        );
        expect(
          androidProduct.productStatusAndroid,
          types.ProductStatusAndroid.Ok,
        );
      },
    );

    test(
      'convertToPurchase handles Android payloads and tracks acknowledgements',
      () {
        final ackTokens = <String, bool>{};
        final purchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'android',
            'store': 'google',
            'productId': 'coins_pack',
            'transactionId': 'txn-123',
            'purchaseStateAndroid': 1,
            'purchaseToken': 'token-android',
            'isAcknowledgedAndroid': true,
            'transactionDate': 1700000000000,
          },
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: ackTokens,
        );

        expect(purchase, isA<types.PurchaseAndroid>());
        final androidPurchase = purchase as types.PurchaseAndroid;
        expect(androidPurchase.productId, 'coins_pack');
        expect(androidPurchase.purchaseToken, 'token-android');
        expect(ackTokens['token-android'], isTrue);
      },
    );

    test('convertToPurchase preserves canonical Android purchase fields', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'productId': 'premium_monthly',
          'transactionId': 'txn-canonical-android',
          'purchaseState': 'purchased',
          'purchaseToken': 'token-canonical-android',
          'transactionDate': '1700000000000',
          'quantity': 2,
          'autoRenewingAndroid': true,
          'currentPlanId': 'monthly-base-plan',
          'dataAndroid': '{"orderId":"canonical-order"}',
          'originalJsonAndroid': '{"orderId":"legacy-order"}',
          'developerPayloadAndroid': 'developer-payload',
          'ids': <String>['premium_monthly', 'premium_bonus'],
          'isAcknowledgedAndroid': true,
          'isSuspendedAndroid': true,
          'obfuscatedAccountIdAndroid': 'account-id',
          'obfuscatedProfileIdAndroid': 'profile-id',
          'packageNameAndroid': 'dev.hyo.martie',
          'pendingPurchaseUpdateAndroid': <String, dynamic>{
            'products': <String>['premium_yearly'],
            'purchaseToken': 'pending-update-token',
          },
          'signatureAndroid': 'purchase-signature',
          'isAlternativeBilling': true,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.currentPlanId, 'monthly-base-plan');
      expect(purchase.id, 'txn-canonical-android');
      expect(purchase.dataAndroid, '{"orderId":"canonical-order"}');
      expect(purchase.developerPayloadAndroid, 'developer-payload');
      expect(purchase.ids, <String>['premium_monthly', 'premium_bonus']);
      expect(purchase.isSuspendedAndroid, isTrue);
      expect(
        purchase.pendingPurchaseUpdateAndroid?.products,
        <String>['premium_yearly'],
      );
      expect(
        purchase.pendingPurchaseUpdateAndroid?.purchaseToken,
        'pending-update-token',
      );
      expect(purchase.isAlternativeBilling, isTrue);
      expect(purchase.transactionDate, 1700000000000);
    });

    test('convertToPurchase merges original payload before item overrides', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'productId': 'item-product',
          'transactionId': 'item-transaction',
          'purchaseState': 'purchased',
          'purchaseToken': 'item-token',
          'transactionDate': '1700000000000',
          'quantity': '2',
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
        originalJson: <String, dynamic>{
          'productId': 'original-product',
          'transactionDate': 1600000000000,
          'currentPlanId': 'original-plan',
          'dataAndroid': '{"orderId":"original-order"}',
          'developerPayloadAndroid': 'original-developer-payload',
        },
      ) as types.PurchaseAndroid;

      expect(purchase.productId, 'item-product');
      expect(purchase.transactionId, 'item-transaction');
      expect(purchase.currentPlanId, 'original-plan');
      expect(purchase.dataAndroid, '{"orderId":"original-order"}');
      expect(
        purchase.developerPayloadAndroid,
        'original-developer-payload',
      );
      expect(purchase.transactionDate, 1700000000000);
      expect(purchase.quantity, 2);
    });

    test('convertToPurchase prefers canonical Android purchase state', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'pending-token',
          'productId': 'premium_monthly',
          'purchaseState': 'pending',
          'purchaseStateAndroid': 1,
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.purchaseState, types.PurchaseState.Pending);
    });

    test(
      'convertToPurchase maps a malformed selected Android state to unknown',
      () {
        final purchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'android',
            'store': 'google',
            'id': 'malformed-state-purchase',
            'productId': 'premium_monthly',
            'transactionId': 'malformed-state-transaction',
            'purchaseState': 'not-a-purchase-state',
            'purchaseStateAndroid': 1,
          },
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        ) as types.PurchaseAndroid;

        expect(purchase.purchaseState, types.PurchaseState.Unknown);
      },
    );

    test(
      'convertToPurchase keeps the missing-state compatibility default',
      () {
        final purchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'android',
            'store': 'google',
            'id': 'missing-state-purchase',
            'productId': 'premium_monthly',
            'transactionId': 'missing-state-transaction',
          },
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        ) as types.PurchaseAndroid;

        expect(purchase.purchaseState, types.PurchaseState.Purchased);
      },
    );

    test(
      'convertToPurchase falls back to legacy Android original JSON key',
      () {
        final purchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'android',
            'store': 'google',
            'productId': 'coins_pack',
            'transactionId': 'txn-legacy-android',
            'purchaseStateAndroid': 1,
            'purchaseToken': 'token-legacy-android',
            'originalJsonAndroid': '{"orderId":"legacy-order"}',
          },
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        ) as types.PurchaseAndroid;

        expect(purchase.dataAndroid, '{"orderId":"legacy-order"}');
      },
    );

    test('convertToPurchase keeps pending Android transaction ID null', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'pending-purchase-token',
          'productId': 'coins_pack',
          'transactionId': null,
          'purchaseState': 'pending',
          'purchaseToken': 'pending-purchase-token',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.id, 'pending-purchase-token');
      expect(purchase.transactionId, isNull);
    });

    test(
      'canonical transaction ID presence suppresses legacy id recovery',
      () {
        final warnings = <String?>[];
        final originalDebugPrint = debugPrint;
        debugPrint = (String? message, {int? wrapWidth}) {
          warnings.add(message);
        };
        addTearDown(() => debugPrint = originalDebugPrint);

        types.PurchaseAndroid androidPurchase(dynamic transactionId) =>
            convertToPurchase(
              <String, dynamic>{
                'platform': 'android',
                'store': 'google',
                'id': 'GPA.legacy-order',
                'productId': 'coins_pack',
                'transactionId': transactionId,
                'purchaseState': 'purchased',
                'purchaseToken': 'purchase-token',
              },
              platformIsAndroid: true,
              platformIsIOS: false,
              acknowledgedAndroidPurchaseTokens: <String, bool>{},
            ) as types.PurchaseAndroid;

        types.PurchaseIOS iosPurchase(dynamic transactionId) =>
            convertToPurchase(
              <String, dynamic>{
                'platform': 'ios',
                'store': 'apple',
                'id': 'legacy-ios-transaction',
                'productId': 'premium_monthly',
                'transactionId': transactionId,
                'purchaseState': 'purchased',
                'purchaseToken': 'canonical-jws',
              },
              platformIsAndroid: false,
              platformIsIOS: true,
              acknowledgedAndroidPurchaseTokens: <String, bool>{},
            ) as types.PurchaseIOS;

        expect(androidPurchase(null).transactionId, isNull);
        expect(androidPurchase('').transactionId, isEmpty);
        expect(iosPurchase(null).transactionId, isEmpty);
        expect(iosPurchase('').transactionId, isEmpty);
        expect(warnings, isEmpty);
      },
    );

    test('convertToPurchase recovers legacy Google order ID from id', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'GPA.1234-5678',
          'productId': 'coins_pack',
          'purchaseState': 'purchased',
          'purchaseToken': 'purchase-token',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.transactionId, 'GPA.1234-5678');
    });

    test('convertToPurchase recovers legacy non-Google receipt ID', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'amazon',
          'id': 'amazon-receipt',
          'productId': 'coins_pack',
          'purchaseState': 'purchased',
          'purchaseToken': 'amazon-receipt',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.transactionId, 'amazon-receipt');
    });

    test('convertFromLegacyPurchase handles iOS payloads', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'productId': 'premium_monthly',
          'transactionId': 'txn-ios',
          'purchaseState': 'PURCHASED',
          'transactionReceipt': 'receipt-data',
          'transactionDate': 1700000000000,
          'quantity': '2',
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchase, isA<types.PurchaseIOS>());
      final iosPurchase = purchase as types.PurchaseIOS;
      expect(iosPurchase.transactionId, 'txn-ios');
      expect(iosPurchase.purchaseToken, 'receipt-data');
      expect(iosPurchase.quantity, 2);
    });

    test('convertToPurchase preserves canonical iOS purchase fields', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'productId': 'premium_monthly',
          'transactionId': 'txn-canonical-ios',
          'purchaseState': 'purchased',
          'purchaseToken': 'jws-canonical',
          'transactionReceipt': 'legacy-receipt',
          'transactionDate': '2026-07-23T00:00:00Z',
          'quantity': 3,
          'advancedCommerceInfoIOS': <String, dynamic>{
            'items': <Map<String, dynamic>>[
              <String, dynamic>{
                'details': <String, dynamic>{
                  'jsonRepresentation': '{"sku":"generic"}',
                },
              },
            ],
            'requestReferenceId': 'request-reference',
          },
          'billingPlanTypeIOS': 'monthly',
          'commitmentInfoIOS': <String, dynamic>{
            'billingPeriodNumber': 2,
            'commitmentExpiresDate': 1800000000000,
            'commitmentPrice': 9.99,
            'totalBillingPeriods': 12,
          },
          'currentPlanId': 'monthly-plan',
          'expirationDateIOS': '1800000000000',
          'isAutoRenewing': true,
          'isUpgradedIOS': true,
          'offerIOS': <String, dynamic>{
            'id': 'offer-id',
            'paymentMode': 'pay-as-you-go',
            'type': 'promotional',
          },
          'originalTransactionDateIOS': '2026-01-01T00:00:00Z',
          'ownershipTypeIOS': 'purchased',
          'quantityIOS': 3,
          'reasonIOS': 'purchase',
          'reasonStringRepresentationIOS': 'PURCHASE',
          'transactionReasonIOS': 'renewal',
          'renewalInfoIOS': <String, dynamic>{
            'pendingUpgradeProductId': 'premium_yearly',
            'willAutoRenew': true,
          },
          'revocationDateIOS': '1900000000000',
          'storefrontCountryCodeIOS': 'US',
          'isAlternativeBilling': true,
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseIOS;

      expect(
        purchase.advancedCommerceInfoIOS?.requestReferenceId,
        'request-reference',
      );
      expect(
        purchase.billingPlanTypeIOS,
        types.SubscriptionBillingPlanTypeIOS.Monthly,
      );
      expect(purchase.commitmentInfoIOS?.billingPeriodNumber, 2);
      expect(purchase.currentPlanId, 'monthly-plan');
      expect(purchase.expirationDateIOS, 1800000000000);
      expect(purchase.isUpgradedIOS, isTrue);
      expect(purchase.offerIOS?.id, 'offer-id');
      expect(purchase.ownershipTypeIOS, 'purchased');
      expect(purchase.purchaseToken, 'jws-canonical');
      expect(purchase.quantityIOS, 3);
      expect(purchase.reasonIOS, 'purchase');
      expect(purchase.reasonStringRepresentationIOS, 'PURCHASE');
      expect(purchase.transactionReasonIOS, 'renewal');
      expect(
        purchase.renewalInfoIOS?.pendingUpgradeProductId,
        'premium_yearly',
      );
      expect(purchase.revocationDateIOS, 1900000000000);
      expect(purchase.storefrontCountryCodeIOS, 'US');
      expect(purchase.isAlternativeBilling, isTrue);
      expect(
        purchase.transactionDate,
        DateTime.utc(2026, 7, 23).millisecondsSinceEpoch,
      );
    });

    test(
      'extractPurchases parses string payload and skips malformed entries',
      () {
        final ackTokens = <String, bool>{};
        final payload = jsonEncode(<dynamic>[
          <String, dynamic>{
            'platform': 'android',
            'store': 'google',
            'productId': 'coins_pack',
            'transactionId': 'txn-1',
            'purchaseToken': 'token-1',
            'purchaseStateAndroid': 1,
          },
          <String, dynamic>{'platform': 'android', 'store': 'google'},
          'unexpected',
        ]);

        final purchases = extractPurchases(
          payload,
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: ackTokens,
        );

        expect(purchases, hasLength(1));
        expect(purchases.first.productId, 'coins_pack');
        expect(ackTokens['token-1'], isNotNull);
      },
    );

    test('extractPurchases handles maps with non-string keys', () {
      final ackTokens = <String, bool>{};
      // Simulate platform channel returning Map<Object?, Object?> with non-string keys
      final payload = <dynamic>[
        <Object?, Object?>{
          'platform': 'android',
          'store': 'google',
          'productId': 'coins_pack',
          'transactionId': 'txn-1',
          'purchaseToken': 'token-1',
          'purchaseStateAndroid': 1,
        },
      ];

      final purchases = extractPurchases(
        payload,
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: ackTokens,
      );

      expect(purchases, hasLength(1));
      expect(purchases.first.productId, 'coins_pack');
      expect(ackTokens['token-1'], isNotNull);
    });

    test('convertToPurchaseError maps codes and response fallbacks', () {
      final stringResult = PurchaseResult(
        code: 'E_ALREADY_OWNED',
        message: 'Already owned',
      );

      final stringMapped = convertToPurchaseError(
        stringResult,
        platform: types.IapPlatform.Android,
      );
      expect(stringMapped.code, types.ErrorCode.AlreadyOwned);

      final responseResult = PurchaseResult(
        responseCode: 7,
        message: 'already owned',
      );

      final responseMapped = convertToPurchaseError(
        responseResult,
        platform: types.IapPlatform.Android,
      );
      expect(responseMapped.code, types.ErrorCode.AlreadyOwned);
    });

    test('normalizeDynamicMap coerces keys and nested structures', () {
      final normalized = normalizeDynamicMap(<dynamic, dynamic>{
        'key': <String, dynamic>{'inner': 1},
        42: [
          <String, dynamic>{'nested': true},
          'value',
        ],
      });

      expect(normalized, isNotNull);
      expect(normalized!['key'], isA<Map<String, dynamic>>());
      expect(normalized['42'], isA<List<dynamic>>());
    });

    test(
      'parseProductFromNative builds Android subscription with offer details',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'android',
            'id': 'premium_yearly',
            'title': 'Premium Yearly',
            'description': 'Yearly access',
            'currency': 'USD',
            'displayPrice': '\$49.99',
            'price': 49.99,
            'subscriptionOfferDetailsAndroid': <Map<String, dynamic>>[
              <String, dynamic>{
                'basePlanId': 'base',
                'installmentPlanDetails': <String, dynamic>{
                  'commitmentPaymentsCount': '12',
                  'subsequentCommitmentPaymentsCount': 0.0,
                },
                'offerToken': 'token',
                'offerTags': <String>['tag'],
                'pricingPhases': <String, dynamic>{
                  'pricingPhaseList': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'billingCycleCount': 1,
                      'billingPeriod': 'P1Y',
                      'formattedPrice': '\$49.99',
                      'priceAmountMicros': '49990000',
                      'priceCurrencyCode': 'USD',
                      'recurrenceMode': 2,
                    },
                  ],
                },
              },
            ],
            'subscriptionOffers': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'base',
                'displayPrice': '\$49.99',
                'price': 49.99,
                'type': 'introductory',
                'basePlanIdAndroid': 'base',
                'offerTokenAndroid': 'token',
                'offerTagsAndroid': <String>['tag'],
              },
            ],
            'productStatusAndroid': 'ok',
          },
          'subs',
          fallbackIsIOS: false,
        );

        expect(product, isA<types.ProductSubscriptionAndroid>());
        final subscription = product as types.ProductSubscriptionAndroid;
        expect(subscription.subscriptionOfferDetailsAndroid, isNotNull);
        expect(
          subscription.subscriptionOfferDetailsAndroid.single.offerToken,
          'token',
        );
        expect(
          subscription.subscriptionOfferDetailsAndroid.single
              .installmentPlanDetails?.commitmentPaymentsCount,
          12,
        );
        expect(
          subscription.subscriptionOffers.single.offerTokenAndroid,
          'token',
        );
        expect(
          subscription.productStatusAndroid,
          types.ProductStatusAndroid.Ok,
        );
      },
    );

    test(
      'parseProductFromNative preserves Android installment details in fallback subscriptionOffers',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'android',
            'id': 'premium_yearly',
            'title': 'Premium Yearly',
            'description': 'Yearly access',
            'currency': 'USD',
            'displayPrice': '\$49.99',
            'price': 49.99,
            'subscriptionOfferDetailsAndroid': <Map<String, dynamic>>[
              <String, dynamic>{
                'basePlanId': 'base',
                'installmentPlanDetails': <String, dynamic>{
                  'commitmentPaymentsCount': 12,
                  'subsequentCommitmentPaymentsCount': 0,
                },
                'offerToken': 'token',
                'offerTags': <String>['tag'],
                'pricingPhases': <String, dynamic>{
                  'pricingPhaseList': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'billingCycleCount': 1,
                      'billingPeriod': 'P1Y',
                      'formattedPrice': '\$49.99',
                      'priceAmountMicros': '49990000',
                      'priceCurrencyCode': 'USD',
                      'recurrenceMode': 2,
                    },
                  ],
                },
              },
            ],
          },
          'subs',
          fallbackIsIOS: false,
        );

        expect(product, isA<types.ProductSubscriptionAndroid>());
        final subscription = product as types.ProductSubscriptionAndroid;
        final offer = subscription.subscriptionOffers.single;
        expect(
          offer.installmentPlanDetailsAndroid?.commitmentPaymentsCount,
          12,
        );
        expect(offer.period?.unit, types.SubscriptionPeriodUnit.Year);
        expect(offer.period?.value, 1);
        expect(offer.periodCount, 1);
        expect(
            offer.pricingPhasesAndroid?.pricingPhaseList.single.billingPeriod,
            'P1Y');
      },
    );

    test(
      'parseProductFromNative builds Android in-app with one-time offer list',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'android',
            'id': 'coins_pack',
            'title': 'Coins Pack',
            'description': 'Pack of coins',
            'currency': 'USD',
            'displayPrice': '\$1.99',
            'price': 1.99,
            'oneTimePurchaseOfferDetailsAndroid': <Map<String, dynamic>>[
              <String, dynamic>{
                'formattedPrice': '\$1.99',
                'priceAmountMicros': '1990000',
                'priceCurrencyCode': 'USD',
                'offerTags': <String>['launch'],
                'offerToken': 'offer-token',
                'offerId': 'offer-id',
                'fullPriceMicros': '2990000',
                'purchaseOptionId': 'purchase-option',
                'discountDisplayInfo': <String, dynamic>{
                  'discountAmount': <String, dynamic>{
                    'discountAmountMicros': '100000',
                    'formattedDiscountAmount': '\$0.10',
                  },
                  'percentageDiscount': 20,
                },
                'limitedQuantityInfo': <String, dynamic>{
                  'maximumQuantity': 10,
                  'remainingQuantity': 4,
                },
                'validTimeWindow': <String, dynamic>{
                  'startTimeMillis': '1000',
                  'endTimeMillis': '2000',
                },
                'preorderDetailsAndroid': <String, dynamic>{
                  'preorderPresaleEndTimeMillis': '3000',
                  'preorderReleaseTimeMillis': '4000',
                },
                'rentalDetailsAndroid': <String, dynamic>{
                  'rentalPeriod': 'P7D',
                  'rentalExpirationPeriod': 'P1D',
                },
              },
            ],
          },
          'inapp',
          fallbackIsIOS: false,
        );

        expect(product, isA<types.ProductAndroid>());
        final android = product as types.ProductAndroid;
        final offers = android.oneTimePurchaseOfferDetailsAndroid;
        expect(offers, isNotNull);
        expect(offers, hasLength(1));
        final offer = offers!.first;
        expect(offer.offerToken, 'offer-token');
        expect(offer.offerTags, contains('launch'));
        expect(offer.discountDisplayInfo?.percentageDiscount, 20);
        expect(offer.fullPriceMicros, '2990000');
        expect(offer.purchaseOptionId, 'purchase-option');
        expect(offer.limitedQuantityInfo?.maximumQuantity, 10);
        expect(offer.validTimeWindow?.endTimeMillis, '2000');
        expect(offer.preorderDetailsAndroid?.preorderReleaseTimeMillis, '4000');
        expect(offer.rentalDetailsAndroid?.rentalPeriod, 'P7D');
      },
    );

    test(
      'parseProductFromNative coerces numeric validTimeWindow millis to string',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'android',
            'id': 'coins_pack',
            'title': 'Coins Pack',
            'description': 'Pack of coins',
            'currency': 'USD',
            'displayPrice': '\$1.99',
            'price': 1.99,
            'oneTimePurchaseOfferDetailsAndroid': <Map<String, dynamic>>[
              <String, dynamic>{
                'formattedPrice': '\$1.99',
                'priceAmountMicros': 1990000,
                'priceCurrencyCode': 'USD',
                'validTimeWindow': <String, dynamic>{
                  'startTimeMillis': 1000, // numeric
                  'endTimeMillis': 2000, // numeric
                },
              },
            ],
          },
          'inapp',
          fallbackIsIOS: false,
        );

        expect(product, isA<types.ProductAndroid>());
        final android = product as types.ProductAndroid;
        final offers = android.oneTimePurchaseOfferDetailsAndroid;
        expect(offers, isNotNull);
        final validWindow = offers!.first.validTimeWindow;
        expect(validWindow, isNotNull);
        expect(validWindow!.startTimeMillis, '1000');
        expect(validWindow.endTimeMillis, '2000');
      },
    );

    test(
      'parseProductFromNative keeps purchaseOptionId from dynamic maps',
      () {
        final product = parseProductFromNative(
          <String, dynamic>{
            'platform': 'android',
            'id': 'dynamic_offer',
            'title': 'Dynamic Offer',
            'description': 'Dynamic map payload',
            'currency': 'USD',
            'displayPrice': '\$1.99',
            'oneTimePurchaseOfferDetailsAndroid': <Object?, Object?>{
              'formattedPrice': '\$1.99',
              'priceAmountMicros': 1990000,
              'priceCurrencyCode': 'USD',
              'purchaseOptionId': 42,
            },
          },
          'inapp',
          fallbackIsIOS: false,
        ) as types.ProductAndroid;

        expect(
          product.oneTimePurchaseOfferDetailsAndroid!.single.purchaseOptionId,
          '42',
        );
      },
    );

    test('parseProductFromNative creates iOS in-app product', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': 'coins_small',
          'title': 'Coins Small',
          'description': 'Small pack',
          'currency': 'USD',
          'displayPrice': '\$0.99',
          'price': 0.99,
          'typeIOS': 'CONSUMABLE',
          'isFamilyShareableIOS': false,
          'jsonRepresentationIOS': '{}',
        },
        'inapp',
        fallbackIsIOS: true,
      );

      expect(product, isA<types.ProductIOS>());
      final iosProduct = product as types.ProductIOS;
      expect(iosProduct.id, 'coins_small');
      expect(iosProduct.type, types.ProductType.InApp);
    });

    test('convertToPurchase handles iOS restored state as Purchased', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'productId': 'premium_yearly',
          'transactionId': 'txn-restored',
          'purchaseState': 'restored',
          'transactionReceipt': 'receipt-restored',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchase, isA<types.PurchaseIOS>());
      final iosPurchase = purchase as types.PurchaseIOS;
      expect(iosPurchase.purchaseState, types.PurchaseState.Purchased);
    });

    test(
      'convertToPurchase handles iOS numeric state 3 as Purchased (restored)',
      () {
        final purchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'ios',
            'store': 'apple',
            'productId': 'premium_yearly',
            'transactionId': 'txn-restored-num',
            'purchaseState': 3,
            'transactionReceipt': 'receipt-restored',
            'transactionDate': 1700000000000,
          },
          platformIsAndroid: false,
          platformIsIOS: true,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );

        expect(purchase, isA<types.PurchaseIOS>());
        final iosPurchase = purchase as types.PurchaseIOS;
        expect(iosPurchase.purchaseState, types.PurchaseState.Purchased);
      },
    );

    test('convertToPurchase handles iOS unknown numeric states as Unknown', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'productId': 'premium_yearly',
          'transactionId': 'txn-unknown',
          'purchaseState': 99,
          'transactionReceipt': 'receipt-unknown',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchase, isA<types.PurchaseIOS>());
      final iosPurchase = purchase as types.PurchaseIOS;
      expect(iosPurchase.purchaseState, types.PurchaseState.Unknown);
    });

    test(
      'convertToPurchase handles iOS failed/deferred string states as Unknown',
      () {
        // Test 'failed' state
        final failedPurchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'ios',
            'store': 'apple',
            'productId': 'premium',
            'transactionId': 'txn-failed',
            'purchaseState': 'failed',
            'transactionReceipt': 'receipt',
            'transactionDate': 1700000000000,
          },
          platformIsAndroid: false,
          platformIsIOS: true,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );

        expect(failedPurchase, isA<types.PurchaseIOS>());
        expect(
          (failedPurchase as types.PurchaseIOS).purchaseState,
          types.PurchaseState.Unknown,
        );

        // Test 'deferred' state
        final deferredPurchase = convertToPurchase(
          <String, dynamic>{
            'platform': 'ios',
            'store': 'apple',
            'productId': 'premium',
            'transactionId': 'txn-deferred',
            'purchaseState': 'deferred',
            'transactionReceipt': 'receipt',
            'transactionDate': 1700000000000,
          },
          platformIsAndroid: false,
          platformIsIOS: true,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );

        expect(deferredPurchase, isA<types.PurchaseIOS>());
        expect(
          (deferredPurchase as types.PurchaseIOS).purchaseState,
          types.PurchaseState.Unknown,
        );
      },
    );

    test('convertToPurchaseError preserves Android diagnostics', () {
      final result = PurchaseResult.fromJSON(<String, dynamic>{
        'responseCode': 5,
        'debugMessage':
            'Deferred replacement requires the base offer, got a promo offer',
        'code': 'developer-error',
        'message': 'Invalid arguments provided to the API',
        'productId': 'premium-monthly',
        'productIds': <String>['premium-monthly', 'premium-yearly'],
        'productType': 'subs',
        'isEmptyProductList': false,
        'subResponseCodeAndroid': 'payment-declined-due-to-insufficient-funds',
      });

      final error = convertToPurchaseError(
        result,
        platform: types.IapPlatform.Android,
      );

      expect(error, isA<iap_err.PurchaseError>());
      expect(error.code, types.ErrorCode.DeveloperError);
      expect(error.message, 'Invalid arguments provided to the API');
      expect(
        error.debugMessage,
        'Deferred replacement requires the base offer, got a promo offer',
      );
      expect(error.responseCode, 5);
      expect(error.productId, 'premium-monthly');
      expect(
        error.productIds,
        <String>['premium-monthly', 'premium-yearly'],
      );
      expect(error.productType, 'subs');
      expect(error.isEmptyProductList, isFalse);
      expect(
        error.subResponseCodeAndroid,
        types.SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
      );
      expect(error.platform, types.IapPlatform.Android);
    });
  });
}
