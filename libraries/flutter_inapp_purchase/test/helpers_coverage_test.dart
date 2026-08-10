import 'dart:convert';

import 'package:flutter_inapp_purchase/helpers.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('product bridge fallback coverage', () {
    test('recovers StoreKit 1 identifiers and infers Android metadata', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'productIdentifier': 'legacy.product',
          'nameAndroid': 'Legacy Product',
          'localizedPrice': '\$1.99',
          'price': '1.99',
          'title': 'Legacy Product',
          'description': 'Description',
          'currency': 'USD',
          'discountOffers': <Map<String, dynamic>>[],
        },
        'in-app',
        fallbackIsIOS: true,
      );

      expect(product, isA<types.ProductAndroid>());
      expect(product.id, 'legacy.product');
      expect(product.displayPrice, '\$1.99');
      expect(product.price, 1.99);
    });

    test('accepts enum platforms and both platform heuristics', () {
      final enumPlatform = parseProductFromNative(
        <String, dynamic>{
          'id': 'enum',
          'platform': types.IapPlatform.IOS,
          'title': 'Enum',
          'description': '',
          'displayPrice': 'Free',
          'price': 0,
          'typeIOS': 'CONSUMABLE',
        },
        'in-app',
        fallbackIsIOS: false,
      );
      final iosHeuristic = parseProductFromNative(
        <String, dynamic>{
          'id': 'ios',
          'jsonRepresentationIOS': '{}',
          'title': 'iOS',
          'description': '',
          'displayPrice': 'Free',
          'price': 0,
        },
        'in-app',
        fallbackIsIOS: false,
      );
      final ambiguous = parseProductFromNative(
        <String, dynamic>{
          'id': 'ambiguous',
          'nameAndroid': 'Android',
          'jsonRepresentationIOS': '{}',
          'title': 'Ambiguous',
          'description': '',
          'displayPrice': 'Free',
          'price': 0,
        },
        'in-app',
        fallbackIsIOS: true,
      );

      expect(enumPlatform, isA<types.ProductIOS>());
      expect(iosHeuristic, isA<types.ProductIOS>());
      expect(ambiguous, isA<types.ProductIOS>());
    });

    test('parses Android subscription offers and optional status', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'id': 'premium',
          'platform': 'android',
          'nameAndroid': 'Premium',
          'title': 'Premium',
          'description': 'Monthly access',
          'displayPrice': '\$4.99',
          'price': 4.99,
          'currency': 'USD',
          'productStatusAndroid': 'PURCHASABLE',
          'subscriptionOffers': jsonEncode(<Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'intro',
              'displayPrice': 'Free',
              'price': 0,
              'type': 'introductory',
              'paymentMode': 'free-trial',
              'period': <String, dynamic>{'unit': 'month', 'value': '1'},
              'periodCount': '1',
              'offerTokenAndroid': 'opaque',
            },
          ]),
        },
        'subs',
        fallbackIsIOS: false,
      ) as types.ProductSubscriptionAndroid;

      expect(product.subscriptionOffers, hasLength(1));
      expect(product.subscriptionOffers.first.id, 'intro');
    });

    test('parses iOS offer aliases and ignores malformed list members', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'id': 'premium',
          'platform': 'ios',
          'title': 'Premium',
          'description': 'Monthly access',
          'displayPrice': '\$4.99',
          'price': 4.99,
          'currency': 'USD',
          'typeIOS': 'SUBSCRIPTION_SUITE',
          'introductoryPricePaymentModeIOS': 'unknown',
          'introductoryPriceSubscriptionPeriodIOS': 'unknown',
          'subscriptionPeriodUnitIOS': 'YEAR',
          'pricingTermsIOS': jsonEncode(<dynamic>[
            <String, dynamic>{
              'billingDisplayPrice': '\$4.99',
              'billingPlanType': 'monthly',
            },
            7,
          ]),
          'bundledSubscriptionsIOS': '{',
          'subscriptionOffers': <dynamic>[
            <String, dynamic>{
              'id': 'legacy-offer',
              'displayPrice': 'Free',
              'price': '0',
              'type': 'WINBACK',
              'paymentMode': 'FREETRIAL',
              'period': <String, dynamic>{'unit': 'MONTH', 'value': '1'},
              'periodCount': '1',
            },
            7,
          ],
        },
        'subs',
        fallbackIsIOS: true,
      ) as types.ProductSubscriptionIOS;

      expect(product.typeIOS, types.ProductTypeIOS.SubscriptionSuite);
      expect(product.subscriptionOffers, hasLength(1));
      expect(product.bundledSubscriptionsIOS, isNull);
    });
  });

  group('purchase bridge fallback coverage', () {
    test('normalizes Android state aliases, timestamps, lists, and quantities',
        () {
      final acknowledged = <String, bool>{};
      final purchased = convertToPurchase(
        <String, dynamic>{
          'id': 'android',
          'productId': 'premium',
          'store': 'google',
          'purchaseState': 'purchase_state_purchased',
          'purchaseToken': 'opaque',
          'transactionDate': '2026-01-02T03:04:05Z',
          'quantity': '2',
          'ids': <dynamic>[1, 'premium'],
          'isAcknowledgedAndroid': true,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: acknowledged,
      ) as types.PurchaseAndroid;
      final pending = convertToPurchase(
        <String, dynamic>{
          'id': 'pending',
          'productId': 'premium',
          'store': 'google',
          'purchaseState': 2.0,
          'transactionDate': '1',
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );
      final defaultState = convertToPurchase(
        <String, dynamic>{
          'id': 'default',
          'productId': 'premium',
          'store': 'google',
          'transactionDate': 1,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchased.quantity, 2);
      expect(purchased.ids, <String>['1', 'premium']);
      expect(acknowledged['opaque'], isTrue);
      expect(pending.purchaseState, types.PurchaseState.Pending);
      expect(defaultState.purchaseState, types.PurchaseState.Purchased);
    });

    test('normalizes Apple restored, pending, numeric, and unknown states', () {
      for (final entry in <(dynamic, types.PurchaseState)>[
        ('restored', types.PurchaseState.Purchased),
        ('pending', types.PurchaseState.Pending),
        (0, types.PurchaseState.Pending),
        (1, types.PurchaseState.Purchased),
        (99, types.PurchaseState.Unknown),
      ]) {
        final purchase = convertToPurchase(
          <String, dynamic>{
            'id': 'apple-${entry.$1}',
            'transactionId': 'apple-${entry.$1}',
            'productId': 'premium',
            'store': 'apple',
            'purchaseState': entry.$1,
            'transactionDate': 1,
            'originalTransactionDateIOS': '2026-01-02T03:04:05Z',
          },
          platformIsAndroid: false,
          platformIsIOS: true,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        );
        expect(purchase.purchaseState, entry.$2);
      }
    });

    test('handles malformed purchase lists in strict and lenient modes', () {
      expect(
        extractPurchases(
          '{',
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        ),
        isEmpty,
      );
      expect(
        () => extractPurchases(
          '{',
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
          rejectMalformed: true,
        ),
        throwsFormatException,
      );
      expect(
        extractPurchases(
          <dynamic>[
            7,
            <dynamic, dynamic>{null: 'ignored'}
          ],
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
        ),
        isEmpty,
      );
      expect(
        () => extractPurchases(
          <dynamic>[7],
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: <String, bool>{},
          rejectMalformed: true,
        ),
        throwsFormatException,
      );
    });
  });
}
