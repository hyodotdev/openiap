import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/screens/all_products_screen.dart';
import 'package:flutter_inapp_purchase_example/src/screens/alternative_billing_screen.dart';
import 'package:flutter_inapp_purchase_example/src/screens/builder_demo_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      switch (call.method) {
        case 'initConnection':
        case 'endConnection':
        case 'finishTransaction':
          return true;
        case 'fetchProducts':
        case 'getItems':
        case 'getAvailableItems':
          return <Object>[];
        case 'getStorefront':
          return 'US';
      }
      return null;
    });
  });

  tearDown(() async {
    await FlutterInappPurchase.instance.endConnection();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  testWidgets('viewers retain unverified purchases', (tester) async {
    tester.view.physicalSize = const Size(1200, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final entry in <String, Widget>{
      'catalog': const AllProductsScreen(),
      'alternative billing': const AlternativeBillingScreen(),
      'builder': const BuilderDemoScreen(),
    }.entries) {
      calls.clear();
      await tester.pumpWidget(MaterialApp(home: entry.value));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pumpAndSettle();
      expect(calls.any((call) => call.method == 'initConnection'), isTrue);

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        const StandardMethodCodec().encodeMethodCall(
          MethodCall(
            'purchase-updated',
            jsonEncode({
              'store': 'apple',
              'storeId': 'apple',
              'id': 'unverified-${entry.key}',
              'productId': 'dev.hyo.martie.10bulbs',
              'purchaseToken': 'signed-receipt',
              'purchaseState': 'purchased',
              'transactionId': 'unverified-${entry.key}',
              'transactionDate': 1700000000000,
              'quantity': 1,
              'isAutoRenewing': false,
            }),
          ),
        ),
        (_) {},
      );
      await tester.pumpAndSettle();

      expect(
        calls.where((call) => call.method == 'finishTransaction'),
        isEmpty,
      );
      expect(find.textContaining('Receipt retained'), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    }
  });
}
