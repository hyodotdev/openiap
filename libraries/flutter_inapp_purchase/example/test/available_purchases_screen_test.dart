import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/app_purchase_flow.dart';
import 'package:flutter_inapp_purchase_example/src/screens/available_purchases_screen.dart';
import 'package:flutter_inapp_purchase_example/src/widgets/purchase_detail_view.dart';
import 'package:platform/platform.dart' show FakePlatform;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');
  bool? nativeRenewal;
  PlatformException? restoreFailure;
  bool connects = true;
  Completer<void>? storeReply;
  late List<MethodCall> log;
  late AppPurchaseFlow purchases;

  setUp(() {
    FlutterInappPurchase.resetSharedStateForTesting();
    purchases = AppPurchaseFlow(
      FlutterInappPurchase(platform: FakePlatform(operatingSystem: 'android')),
    );
    nativeRenewal = true;
    restoreFailure = null;
    connects = true;
    storeReply = null;
    log = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      log.add(call);
      switch (call.method) {
        case 'initConnection':
          return connects;
        case 'getAvailableItems':
          await storeReply?.future;
          if (restoreFailure != null) throw restoreFailure!;
          return <Map<String, dynamic>>[
            <String, dynamic>{
              'store': 'google',
              'id': 'txn_123',
              'productId': 'dev.hyo.martie.premium',
              'purchaseToken': 'token_abc',
              'purchaseState': 'purchased',
              'isAutoRenewing': false,
              'autoRenewingAndroid': nativeRenewal,
              'transactionDate': 1700000000000.0,
              'transactionId': 'txn_123',
              'quantity': 1,
            },
          ];
        case 'getPurchaseHistory':
        case 'getPendingPurchases':
          return <Map<String, dynamic>>[];
        case 'endConnection':
          return true;
      }
      return null;
    });
  });

  tearDown(() async {
    purchases.dispose();
    await purchases.iap.endConnection();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  testWidgets('shows available purchase cards', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: AvailablePurchasesScreen(purchases: purchases)),
    );

    // Wait for the initial load to complete
    await tester.pumpAndSettle();

    // Verify the screen loads and shows the connected status
    expect(find.text('Connected to Store'), findsOneWidget);
    // Verify restore button is present
    expect(find.text('Restore Purchases'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('restores through the app purchase flow', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: AvailablePurchasesScreen(purchases: purchases)),
    );
    await tester.pumpAndSettle();
    log.clear();
    storeReply = Completer<void>();

    await tester.tap(find.text('Restore Purchases'));
    await tester.pump();
    expect(find.text('Restoring purchases...'), findsOneWidget);
    storeReply!.complete();
    await tester.pumpAndSettle();

    // Ignore is the default method, so the flow keeps the receipt unverified.
    expect(log.map((call) => call.method), contains('getAvailableItems'));
    expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    expect(find.text('Purchases restored.'), findsOneWidget);
    expect(find.text('dev.hyo.martie.premium'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('explains a failed store connection', (tester) async {
    connects = false;
    await tester.pumpWidget(
      MaterialApp(home: AvailablePurchasesScreen(purchases: purchases)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Not connected to the store.'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('shows a failed restore', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: AvailablePurchasesScreen(purchases: purchases)),
    );
    await tester.pumpAndSettle();
    restoreFailure = PlatformException(
      code: 'service-error',
      message: 'Store unavailable',
    );

    await tester.tap(find.text('Restore Purchases'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Restore failed: '), findsOneWidget);
    expect(find.textContaining('Store unavailable'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final preference in <bool?>[null, false, true]) {
    final label = 'Auto renew: ${preference?.toString() ?? 'unknown'}';
    testWidgets('available cards preserve renewal preference $preference',
        (tester) async {
      nativeRenewal = preference;
      await tester.pumpWidget(
        MaterialApp(home: AvailablePurchasesScreen(purchases: purchases)),
      );
      await tester.pumpAndSettle();
      expect(find.text(label), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('purchase details preserve renewal preference $preference',
        (tester) async {
      final purchase = PurchaseAndroid.fromJson(<String, dynamic>{
        'store': 'amazon',
        'id': 'synthetic-receipt',
        'productId': 'premium',
        'purchaseState': 'purchased',
        'isAutoRenewing': false,
        'autoRenewingAndroid': preference,
        'transactionDate': 1.0,
        'quantity': 1,
      });
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
              child: PurchaseDataView(purchase: purchase)),
        ),
      ));
      expect(find.text(label), findsOneWidget);
    });

    testWidgets('iOS purchase details preserve renewal preference $preference',
        (tester) async {
      final purchase = PurchaseIOS.fromJson(<String, dynamic>{
        'store': 'apple',
        'id': 'synthetic-ios-transaction',
        'transactionId': 'synthetic-ios-transaction',
        'productId': 'premium',
        'purchaseState': 'purchased',
        'isAutoRenewing': true,
        if (preference != null) 'renewalInfoIOS': {'willAutoRenew': preference},
        'transactionDate': 1.0,
        'quantity': 1,
      });
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
              child: PurchaseDataView(purchase: purchase)),
        ),
      ));
      expect(find.text(label), findsOneWidget);
    });
  }
}
