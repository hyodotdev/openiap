import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:platform/platform.dart';
import 'package:flutter_inapp_purchase_example/src/screens/subscription_flow_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  late List<MethodCall> log;
  late List<Map<String, dynamic>> ownership;

  setUp(() {
    log = <MethodCall>[];
    ownership = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      log.add(call);
      switch (call.method) {
        case 'initConnection':
          return true;
        case 'fetchProducts':
          final args = call.arguments as Map<dynamic, dynamic>?;
          final type = (args?['type']?.toString() ?? 'subs')
              .replaceAll('-', '')
              .toLowerCase();
          if (type == 'subs') {
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'platform': 'ios',
                'id': 'dev.hyo.martie.premium',
                'productId': 'dev.hyo.martie.premium',
                'title': 'Premium Monthly',
                'description': 'Unlock premium access',
                'currency': 'USD',
                'displayPrice': '\$4.99',
                'price': '4.99',
                'type': 'subs',
                'displayNameIOS': 'Premium Monthly',
                'isFamilyShareableIOS': false,
                'jsonRepresentationIOS': '{}',
                'typeIOS': 'AUTO_RENEWABLE_SUBSCRIPTION',
                'subscriptionGroupIdIOS': 'group1',
                'subscriptionOffers': <Map<String, dynamic>>[],
              },
            ];
          }
          return [];
        case 'getAvailablePurchases':
        case 'getAvailableItems':
        case 'getPurchaseHistory':
          return ownership;
        case 'requestPurchase':
          return null;
        case 'finishTransaction':
          return true;
        case 'endConnection':
          return true;
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  testWidgets('pending subscription ownership and callbacks grant no access',
      (tester) async {
    ownership = [
      const PurchaseIOS(
        id: 'pending-subscription',
        transactionId: 'pending-subscription',
        productId: 'dev.hyo.martie.premium',
        purchaseState: PurchaseState.Pending,
        transactionDate: 1,
        quantity: 1,
        isAutoRenewing: true,
        store: IapStore.Apple,
        storeId: 'apple',
      ).toJson()
    ];
    await tester.pumpWidget(MaterialApp(
      home: SubscriptionFlowScreen(
        iap: FlutterInappPurchase(
          platform: FakePlatform(operatingSystem: 'ios'),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No active subscriptions found'), findsOneWidget);
    expect(find.text('Subscribe'), findsOneWidget);
    expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

  testWidgets('renders subscriptions and leaves pending callbacks unfinished',
      (tester) async {
    ownership = [];
    log.clear();
    await tester.pumpWidget(
      MaterialApp(
        home: SubscriptionFlowScreen(
          iap: FlutterInappPurchase(
            platform: FakePlatform(operatingSystem: 'ios'),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(log.where((call) => call.method == 'fetchProducts'), isNotEmpty);
    expect(find.text('Premium Monthly'), findsOneWidget);

    const purchase = PurchaseIOS(
      id: 'pending-subscription',
      transactionId: 'pending-subscription',
      productId: 'dev.hyo.martie.premium',
      purchaseToken: 'test-jws',
      purchaseState: PurchaseState.Pending,
      transactionDate: 1,
      quantity: 1,
      isAutoRenewing: true,
      store: IapStore.Apple,
      storeId: 'apple',
    );
    await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
      channel.name,
      const StandardMethodCodec().encodeMethodCall(
        MethodCall('purchase-updated', jsonEncode(purchase.toJson())),
      ),
      (_) {},
    );
    await tester.pumpAndSettle();
    expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    expect(log.where((call) => call.method == 'verifyPurchaseWithProvider'),
        isEmpty);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
