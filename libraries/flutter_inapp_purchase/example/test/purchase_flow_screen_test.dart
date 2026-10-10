import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:platform/platform.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/screens/purchase_flow_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  late List<MethodCall> log;
  late bool verificationValid;
  late List<Map<String, dynamic>> retainedPurchases;
  PlatformException? verificationFailure;
  PlatformException? recoveryFailure;
  late String verifiedProductId;
  late bool verifiedConsumable;

  setUp(() {
    log = <MethodCall>[];
    verificationValid = true;
    retainedPurchases = [];
    verificationFailure = null;
    recoveryFailure = null;
    verifiedProductId = 'dev.hyo.martie.10bulbs';
    verifiedConsumable = true;
    dotenv.loadFromString(isOptional: true);
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
          if (recoveryFailure != null) throw recoveryFailure!;
          return retainedPurchases;
        case 'requestPurchase':
          return null;
        case 'getPendingTransactionsIOS':
          if (recoveryFailure != null) throw recoveryFailure!;
          return retainedPurchases;
        case 'verifyPurchase':
          if (verificationFailure != null) throw verificationFailure!;
          return VerifyPurchaseResultIOS(
            isValid: verificationValid,
            jwsRepresentation: 'test-jws',
            receiptData: 'test-receipt',
          ).toJson();
        case 'verifyPurchaseWithProvider':
          return VerifyPurchaseWithProviderResult(
            provider: PurchaseVerificationProvider.Iapkit,
            iapkit: RequestVerifyPurchaseWithIapkitResult(
              isValid: true,
              productId: verifiedProductId,
              state: verifiedConsumable
                  ? IapkitPurchaseState.ReadyToConsume
                  : IapkitPurchaseState.Entitled,
              store: IapStore.Google,
              storeId: 'play',
            ),
          ).toJson();
        case 'finishTransaction':
        case 'consumePurchaseAndroid':
        case 'acknowledgePurchaseAndroid':
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

  testWidgets(
      'retains unverified receipts and completes verified purchases once',
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
        recoveryFailure = null;
        retainedPurchases = [];
        verificationValid = outcome != 'invalid';
        verificationFailure = outcome == 'error'
            ? PlatformException(
                code: 'purchase-verification-failed',
                message: 'Verification unavailable',
              )
            : null;
        await tester.pumpWidget(MaterialApp(
          home: PurchaseFlowScreen(
            iap: FlutterInappPurchase(
              platform: FakePlatform(
                operatingSystem: defaultTargetPlatform == TargetPlatform.android
                    ? 'android'
                    : 'ios',
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(log.where((call) => call.method == 'fetchProducts'), isNotEmpty);
        expect(find.text('10 Bulbs'), findsOneWidget);
        if (outcome != 'ignore') {
          await tester.tap(find.text('Ignore'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Local (Device)'));
          await tester.pumpAndSettle();
        }

        final Purchase purchase = outcome == 'unsupported'
            ? PurchaseAndroid(
                id: 'local-unsupported',
                productId: 'dev.hyo.martie.10bulbs',
                purchaseToken: 'test-token',
                purchaseState: PurchaseState.Purchased,
                transactionDate: 1,
                quantity: 1,
                isAutoRenewing: false,
                store: IapStore.Google,
                storeId: 'play',
              )
            : PurchaseIOS(
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
        retainedPurchases = outcome == 'valid' ? [purchase.toJson()] : [];
        if (outcome == 'invalid') {
          retainedPurchases = [
            PurchaseIOS(
              id: 'another-same-sku',
              transactionId: 'another-same-sku',
              productId: purchase.productId,
              store: IapStore.Apple,
              storeId: 'apple',
              purchaseState: PurchaseState.Purchased,
              transactionDate: 1,
              quantity: 1,
              isAutoRenewing: false,
            ).toJson()
          ];
        }
        if (outcome == 'error') recoveryFailure = verificationFailure;
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
          outcome == 'valid' ? 1 : 0,
          reason: outcome,
        );
        expect(log.where((call) => call.method == 'verifyPurchase'), isEmpty);
        expect(log.where((call) => call.method == 'getPendingTransactionsIOS'),
            outcome == 'unsupported' ? isEmpty : isNotEmpty);
        if (outcome == 'ignore') {
          retainedPurchases = [purchase.toJson()];
          await tester.tap(find.text('Ignore'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Local (Device)'));
          await tester.pumpAndSettle();
          expect(
              log.where((call) => call.method == 'verifyPurchase').length, 0);
          expect(log.where((call) => call.method == 'finishTransaction').length,
              1);
          await tester.tap(find.text('Local (Device)'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Local (Device)').last);
          await tester.pumpAndSettle();
          expect(log.where((call) => call.method == 'finishTransaction').length,
              1);
        }
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
      }
    } finally {
      debugDefaultTargetPlatformOverride = null;
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    }
  });

  testWidgets('unsupported recovery does not show a recovery failure',
      (tester) async {
    recoveryFailure = PlatformException(
        code: 'feature-not-supported', message: 'Recovery unavailable');
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    try {
      await tester.pumpWidget(MaterialApp(
        home: PurchaseFlowScreen(
          iap: FlutterInappPurchase(
            platform: FakePlatform(
              operatingSystem: defaultTargetPlatform == TargetPlatform.android
                  ? 'android'
                  : 'ios',
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      expect(log.where((call) => call.method == 'getPendingTransactionsIOS'),
          isNotEmpty);
      expect(find.textContaining('Purchase recovery failed'), findsNothing);
    } finally {
      debugDefaultTargetPlatformOverride = null;
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    }
  });

  for (final isConsumable in [false, true]) {
    testWidgets(
        'verifies acknowledged Android purchase without an order ID ($isConsumable)',
        (tester) async {
      log.clear();
      recoveryFailure = null;
      verificationFailure = null;
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      dotenv.loadFromString(envString: 'IAPKIT_API_KEY=widget-test-public-key');
      verifiedConsumable = isConsumable;
      verifiedProductId =
          isConsumable ? 'dev.hyo.martie.10bulbs' : 'dev.hyo.martie.certified';
      final purchase = PurchaseAndroid(
        id: 'acknowledged-$isConsumable',
        productId: verifiedProductId,
        purchaseToken: 'test-token',
        purchaseState: PurchaseState.Purchased,
        transactionDate: 1,
        quantity: 1,
        isAutoRenewing: false,
        isAcknowledgedAndroid: true,
        store: IapStore.Google,
        storeId: 'play',
      );
      retainedPurchases = [purchase.toJson()];
      try {
        await tester.pumpWidget(MaterialApp(
          home: PurchaseFlowScreen(
            iap: FlutterInappPurchase(
              platform: FakePlatform(
                operatingSystem: defaultTargetPlatform == TargetPlatform.android
                    ? 'android'
                    : 'ios',
              ),
            ),
          ),
        ));
        await tester.pumpAndSettle();
        expect(
            log
                .where((call) => call.method == 'verifyPurchaseWithProvider')
                .length,
            1);
        expect(
            log.where((call) => call.method == 'consumePurchaseAndroid').length,
            isConsumable ? 1 : 0);
        expect(log.where((call) => call.method == 'acknowledgePurchaseAndroid'),
            isEmpty);
        await tester.tap(find.text('IAPKit'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('IAPKit').last);
        await tester.pumpAndSettle();
        expect(
            log
                .where((call) => call.method == 'verifyPurchaseWithProvider')
                .length,
            1);
        expect(
            log.where((call) => call.method == 'consumePurchaseAndroid').length,
            isConsumable ? 1 : 0);
        expect(log.where((call) => call.method == 'acknowledgePurchaseAndroid'),
            isEmpty);
      } finally {
        debugDefaultTargetPlatformOverride = null;
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
      }
    });
  }
}
