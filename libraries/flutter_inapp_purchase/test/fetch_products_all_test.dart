import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      switch (call.method) {
        case 'initConnection':
          return true;
        case 'fetchProducts':
          final args = call.arguments as Map<dynamic, dynamic>?;
          final type = args?['type']?.toString();

          final subscription = <String, dynamic>{
            'platform': 'ios',
            'id': 'premium_monthly',
            'type': 'subs',
            'title': 'Premium Monthly',
            'description': 'Monthly subscription',
            'currency': 'USD',
            'displayNameIOS': 'Premium Monthly',
            'displayPrice': '\$24.99',
            'isFamilyShareableIOS': false,
            'jsonRepresentationIOS': '{}',
            'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
            'price': 24.99,
          };

          final inApp = <String, dynamic>{
            'platform': 'ios',
            'id': 'coin_pack',
            'type': 'in-app',
            'title': 'Coin Pack',
            'description': 'One time coins',
            'currency': 'USD',
            'displayNameIOS': 'Coin Pack',
            'displayPrice': '\$2.99',
            'isFamilyShareableIOS': false,
            'jsonRepresentationIOS': '{}',
            'typeIOS': 'NON_CONSUMABLE',
            'price': 2.99,
          };

          if (type == 'subs') {
            return <Map<String, dynamic>>[subscription];
          }
          if (type == 'in-app') {
            return <Map<String, dynamic>>[inApp];
          }
          return <Map<String, dynamic>>[subscription, inApp];
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test(
    'fetchProducts returns in-app products when querying in-app type',
    () async {
      final platform = FakePlatform(operatingSystem: 'ios');
      final iap = FlutterInappPurchase.private(platform);

      await iap.initConnection();

      final products = (await iap.fetchProducts(
        skus: const ['premium_monthly', 'coin_pack'],
        type: types.ProductQueryType.InApp,
      ))
          .cast<types.Product>();

      expect(products, hasLength(1));
      expect(products.first.id, 'coin_pack');
    },
  );

  test('fetchProducts returns subscriptions when querying subs type', () async {
    final platform = FakePlatform(operatingSystem: 'ios');
    final iap = FlutterInappPurchase.private(platform);

    await iap.initConnection();

    final subscriptions = (await iap.fetchProducts(
      skus: const ['premium_monthly', 'coin_pack'],
      type: types.ProductQueryType.Subs,
    ))
        .cast<types.ProductSubscription>();

    expect(subscriptions, hasLength(1));
    expect(subscriptions.first.id, 'premium_monthly');
  });

  test('fetchProducts returns mixed products when querying all type', () async {
    final platform = FakePlatform(operatingSystem: 'ios');
    final iap = FlutterInappPurchase.private(platform);

    await iap.initConnection();

    final products = await iap.fetchProducts<types.ProductCommon>(
      skus: const ['premium_monthly', 'coin_pack'],
      type: types.ProductQueryType.All,
    );

    expect(products, hasLength(2));
    expect(products.whereType<types.ProductSubscription>(), hasLength(1));
    expect(products.whereType<types.Product>(), hasLength(1));
  });

  for (final undecodable in <String, Object>{
    'a product with a wrong field type': <String, dynamic>{
      'platform': 'ios',
      'id': 'coin_pack',
      'type': 'in-app',
      'isFamilyShareableIOS': 'yes',
    },
    'an item that is not a product map': 7,
  }.entries) {
    test('fetchProducts skips ${undecodable.key} and returns the rest',
        () async {
      final skipWarnings = <String>[];
      final previousDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null && message.contains('Skipping product')) {
          skipWarnings.add(message);
        }
      };
      addTearDown(() => debugPrint = previousDebugPrint);
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') return true;
        return <Object>[
          undecodable.value,
          <String, dynamic>{
            'platform': 'ios',
            'id': 'gem_pack',
            'type': 'in-app',
          },
        ];
      });
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );
      await iap.initConnection();

      final products = await iap.fetchProducts<types.Product>(
        skus: const ['coin_pack', 'gem_pack'],
      );

      expect(products.map((product) => product.id), <String>['gem_pack']);
      expect(
        skipWarnings.single,
        contains(undecodable.value is Map ? 'coin_pack' : '(unknown id)'),
      );
    });
  }

  test('queryHandlers fetchProducts preserves all result union', () async {
    final platform = FakePlatform(operatingSystem: 'ios');
    final iap = FlutterInappPurchase.private(platform);

    await iap.initConnection();

    final result = await iap.queryHandlers.fetchProducts!(
      skus: const ['premium_monthly', 'coin_pack'],
      type: types.ProductQueryType.All,
    );

    expect(result, isA<types.FetchProductsResultAll>());
    final allResult = result as types.FetchProductsResultAll;
    expect(allResult.value, hasLength(2));
    expect(
      allResult.value,
      contains(isA<types.ProductOrSubscriptionProductSubscription>()),
    );
    expect(
      allResult.value,
      contains(isA<types.ProductOrSubscriptionProduct>()),
    );
  });

  test('queryHandlers fetchProducts preserves typed result branches', () async {
    final iap = FlutterInappPurchase.private(
      FakePlatform(operatingSystem: 'ios'),
    );
    await iap.initConnection();

    final subscriptions = await iap.queryHandlers.fetchProducts!(
      skus: const ['premium_monthly'],
      type: types.ProductQueryType.Subs,
    );
    final products = await iap.queryHandlers.fetchProducts!(
      skus: const ['coin_pack'],
    );

    expect(subscriptions, isA<types.FetchProductsResultSubscriptions>());
    expect(products, isA<types.FetchProductsResultProducts>());
  });
}
