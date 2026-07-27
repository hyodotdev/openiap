import 'package:flutter_inapp_purchase/helpers.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('product helpers', () {
    test('resolveProductType accepts only canonical product types', () {
      expect(resolveProductType('in-app'), 'in-app');
      expect(resolveProductType('subs'), 'subs');
      expect(resolveProductType('all'), 'all');
      expect(resolveProductType(types.ProductQueryType.InApp), 'in-app');
      expect(resolveProductType(types.ProductType.Subs), 'subs');
      expect(() => resolveProductType('inapp'), throwsArgumentError);
      expect(() => resolveProductType(Object()), throwsArgumentError);
    });

    test('parses an iOS subscription with standardized offers', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': 'premium.monthly',
          'title': 'Premium Monthly',
          'description': 'Monthly access',
          'currency': 'USD',
          'displayPrice': r'$4.99',
          'displayNameIOS': 'Premium',
          'isFamilyShareableIOS': true,
          'jsonRepresentationIOS': '{}',
          'typeIOS': 'auto-renewable-subscription',
          'subscriptionGroupIdIOS': 'premium',
          'subscriptionOffers': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'intro',
              'displayPrice': r'$0.99',
              'price': 0.99,
              'type': 'introductory',
            },
          ],
        },
        'subs',
        fallbackIsIOS: true,
      );

      expect(product, isA<types.ProductSubscriptionIOS>());
      final subscription = product as types.ProductSubscriptionIOS;
      expect(subscription.subscriptionGroupIdIOS, 'premium');
      expect(subscription.subscriptionOffers, hasLength(1));
      expect(subscription.subscriptionOffers!.single.id, 'intro');
    });

    test('parses an Android one-time product with standardized offers', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'android',
          'id': 'coins.pack',
          'title': 'Coins',
          'description': 'Coin pack',
          'currency': 'USD',
          'displayPrice': r'$1.99',
          'nameAndroid': 'Coins',
          'discountOffers': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'single-purchase',
              'displayPrice': r'$1.99',
              'price': 1.99,
              'currency': 'USD',
              'type': 'one-time',
              'offerTokenAndroid': 'offer-token',
            },
          ],
          'productStatusAndroid': 'ok',
        },
        'in-app',
        fallbackIsIOS: false,
      );

      expect(product, isA<types.ProductAndroid>());
      final androidProduct = product as types.ProductAndroid;
      expect(androidProduct.discountOffers, hasLength(1));
      expect(
        androidProduct.discountOffers!.single.offerTokenAndroid,
        'offer-token',
      );
      expect(
          androidProduct.productStatusAndroid, types.ProductStatusAndroid.Ok);
    });

    test('uses an empty id when canonical id is explicitly null', () {
      final product = parseProductFromNative(
        <String, dynamic>{
          'platform': 'ios',
          'id': null,
          'productIdentifier': 'storekit-product',
          'title': 'Product',
          'description': 'Description',
          'currency': 'USD',
          'displayPrice': r'$1.00',
          'typeIOS': 'consumable',
        },
        'in-app',
        fallbackIsIOS: true,
      );

      expect(product.id, isEmpty);
    });
  });

  group('purchase helpers', () {
    test('preserves canonical Android purchase fields', () {
      final acknowledgedTokens = <String, bool>{};
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'google',
          'id': 'purchase-id',
          'productId': 'coins.pack',
          'transactionId': 'GPA.1234',
          'purchaseState': 'purchased',
          'purchaseToken': 'purchase-token',
          'transactionDate': 1700000000000,
          'dataAndroid': '{"orderId":"GPA.1234"}',
          'isAcknowledgedAndroid': true,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: acknowledgedTokens,
      );

      expect(purchase, isA<types.PurchaseAndroid>());
      final androidPurchase = purchase as types.PurchaseAndroid;
      expect(androidPurchase.transactionId, 'GPA.1234');
      expect(androidPurchase.purchaseToken, 'purchase-token');
      expect(androidPurchase.dataAndroid, '{"orderId":"GPA.1234"}');
      expect(acknowledgedTokens['purchase-token'], isTrue);
    });

    test('does not recover a missing transactionId from id', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'android',
          'store': 'amazon',
          'id': 'receipt-id',
          'productId': 'coins.pack',
          'purchaseState': 'purchased',
          'purchaseToken': 'receipt-id',
          'transactionDate': 1700000000000,
        },
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      ) as types.PurchaseAndroid;

      expect(purchase.transactionId, isNull);
    });

    test('preserves canonical iOS purchase fields', () {
      final purchase = convertToPurchase(
        <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'id': 'transaction-id',
          'productId': 'premium.monthly',
          'transactionId': 'transaction-id',
          'purchaseState': 'purchased',
          'purchaseToken': 'signed-transaction',
          'transactionDate': 1700000000000,
          'quantity': 2,
        },
        platformIsAndroid: false,
        platformIsIOS: true,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchase, isA<types.PurchaseIOS>());
      final iosPurchase = purchase as types.PurchaseIOS;
      expect(iosPurchase.transactionId, 'transaction-id');
      expect(iosPurchase.purchaseToken, 'signed-transaction');
      expect(iosPurchase.quantity, 2);
    });

    test('extractPurchases accepts platform-channel map keys', () {
      final purchases = extractPurchases(
        <dynamic>[
          <Object?, Object?>{
            'platform': 'android',
            'store': 'google',
            'id': 'purchase-id',
            'productId': 'coins.pack',
            'transactionId': 'GPA.1234',
            'purchaseToken': 'token',
            'purchaseState': 'purchased',
            'transactionDate': 1700000000000,
          },
        ],
        platformIsAndroid: true,
        platformIsIOS: false,
        acknowledgedAndroidPurchaseTokens: <String, bool>{},
      );

      expect(purchases, hasLength(1));
      expect(purchases.single.productId, 'coins.pack');
    });
  });

  test('normalizeDynamicMap coerces keys and nested maps', () {
    final normalized = normalizeDynamicMap(<dynamic, dynamic>{
      42: <Object?, Object?>{'nested': true},
    });

    expect(normalized, <String, dynamic>{
      '42': <String, dynamic>{'nested': true},
    });
  });
}
