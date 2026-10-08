import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/screens/purchase_flow_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  late List<MethodCall> log;
  late bool verificationValid;
  PlatformException? verificationFailure;

  setUp(() {
    log = <MethodCall>[];
    verificationValid = true;
    verificationFailure = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      log.add(call);
      switch (call.method) {
        case 'initConnection':
          return true;
        case 'fetchProducts':
          final args = call.arguments as Map<dynamic, dynamic>?;
          final type = (args?['type']?.toString() ?? 'inapp')
              .replaceAll('-', '')
              .toLowerCase();
          if (type == 'inapp') {
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'platform': 'android',
                'id': 'dev.hyo.martie.10bulbs',
                'productId': 'dev.hyo.martie.10bulbs',
                'title': '10 Bulbs',
                'description': 'Adds 10 bulbs to your account',
                'currency': 'USD',
                'displayPrice': '\$0.99',
                'price': '0.99',
                'type': 'in-app',
                'localizedPrice': '\$0.99',
              },
            ];
          }
          return [];
        case 'getAvailableItems':
        case 'getAvailablePurchases':
        case 'getPurchaseHistory':
          return <Map<String, dynamic>>[];
        case 'requestPurchase':
          return null;
        case 'getPendingTransactionsIOS':
          return <Map<String, dynamic>>[];
        case 'verifyPurchase':
          if (verificationFailure != null) throw verificationFailure!;
          return VerifyPurchaseResultIOS(
            isValid: verificationValid,
            jwsRepresentation: 'test-jws',
            receiptData: 'test-receipt',
          ).toJson();
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

  testWidgets('finishes only completed purchases after successful verification',
      (tester) async {
    try {
      for (final outcome in [
        'valid',
        'invalid',
        'error',
        'unsupported',
        'pending',
        'ignore'
      ]) {
        debugDefaultTargetPlatformOverride = outcome == 'unsupported'
            ? TargetPlatform.android
            : TargetPlatform.iOS;
        log.clear();
        verificationValid = outcome != 'invalid';
        verificationFailure = outcome == 'error'
            ? PlatformException(
                code: 'purchase-verification-failed',
                message: 'Verification unavailable',
              )
            : null;
        await tester.pumpWidget(const MaterialApp(home: PurchaseFlowScreen()));
        await tester.pumpAndSettle();
        expect(log.where((call) => call.method == 'fetchProducts'), isNotEmpty);
        expect(find.text('10 Bulbs'), findsOneWidget);
        if (outcome != 'ignore') {
          await tester.tap(find.text('Ignore'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Local (Device)'));
          await tester.pumpAndSettle();
        }

        final purchase = PurchaseIOS(
          id: 'local-$outcome',
          transactionId: 'local-$outcome',
          productId: 'dev.hyo.martie.10bulbs',
          purchaseToken: 'test-jws',
          purchaseState: outcome == 'pending'
              ? PurchaseState.Pending
              : PurchaseState.Purchased,
          transactionDate: 1,
          quantity: 1,
          isAutoRenewing: false,
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

        expect(
          log.where((call) => call.method == 'finishTransaction').length,
          outcome == 'valid' || outcome == 'ignore' ? 1 : 0,
          reason: outcome,
        );
        expect(
          log.where((call) => call.method == 'verifyPurchase').length,
          ['unsupported', 'pending', 'ignore'].contains(outcome) ? 0 : 1,
          reason: outcome,
        );
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
      }
    } finally {
      debugDefaultTargetPlatformOverride = null;
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    }
  });
}
