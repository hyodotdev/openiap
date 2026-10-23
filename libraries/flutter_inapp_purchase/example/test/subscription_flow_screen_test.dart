import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:platform/platform.dart';
import 'package:flutter_inapp_purchase_example/src/app_purchase_flow.dart';
import 'package:flutter_inapp_purchase_example/src/screens/subscription_flow_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');

  late List<MethodCall> log;
  late List<Map<String, dynamic>> ownership;
  late List<Map<String, dynamic>> active;
  PlatformException? recoveryFailure;
  final flows = <AppPurchaseFlow>[];

  Widget screen(String operatingSystem) {
    final purchases = AppPurchaseFlow(
      FlutterInappPurchase(
        platform: FakePlatform(operatingSystem: operatingSystem),
      ),
    );
    flows.add(purchases);
    return MaterialApp(home: SubscriptionFlowScreen(purchases: purchases));
  }

  Future<void> deliver(Purchase purchase) async {
    await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
      channel.name,
      const StandardMethodCodec().encodeMethodCall(
        MethodCall('purchase-updated', jsonEncode(purchase.toJson())),
      ),
      (_) {},
    );
  }

  setUp(() {
    log = <MethodCall>[];
    ownership = [];
    active = [];
    recoveryFailure = null;
    dotenv.loadFromString(isOptional: true);
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
        case 'getAvailableItems':
        case 'getPendingTransactionsIOS':
          if (recoveryFailure != null) throw recoveryFailure!;
          return ownership;
        case 'getActiveSubscriptions':
          return active;
        case 'verifyPurchaseWithProvider':
          return {
            'provider': 'iapkit',
            'iapkit': {
              'store': 'google',
              'storeId': 'play',
              'isValid': true,
              'state': 'entitled',
              'productId': 'dev.hyo.martie.premium',
            },
          };
        case 'requestPurchase':
        case 'finishTransaction':
          return null;
        case 'endConnection':
          return true;
      }
      return null;
    });
  });

  // The listener's native cleanup after dispose starts from a real microtask,
  // so let real async run before the test ends.
  Future<void> closeScreen(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    for (final purchases in flows) {
      purchases.dispose();
    }
    flows.clear();
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();
  }

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  for (final unsupported in [true, false]) {
    testWidgets(
        'subscription recovery reports only genuine failures ($unsupported)',
        (tester) async {
      recoveryFailure = PlatformException(
        code: unsupported ? 'feature-not-supported' : 'service-error',
        message: 'Recovery unavailable',
      );
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        await tester.pumpWidget(screen('ios'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Ignore'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Local (IAPKit)'));
        await tester.pumpAndSettle();
        expect(log.where((call) => call.method == 'getPendingTransactionsIOS'),
            isNotEmpty);
        expect(find.textContaining('Purchase recovery failed'),
            unsupported ? findsNothing : findsOneWidget);
        expect(
            log.where((call) => call.method == 'finishTransaction'), isEmpty);
      } finally {
        debugDefaultTargetPlatformOverride = null;
        await closeScreen(tester);
      }
    });
  }

  testWidgets('an inactive subscription grants no access', (tester) async {
    active = [
      const ActiveSubscription(
        productId: 'dev.hyo.martie.premium',
        transactionId: 'pending-subscription',
        transactionDate: 1,
        isActive: false,
      ).toJson(),
    ];
    await tester.pumpWidget(screen('ios'));
    await tester.pumpAndSettle();
    expect(find.text('No active subscriptions found'), findsOneWidget);
    expect(find.text('Subscribe'), findsOneWidget);
    expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    await closeScreen(tester);
  });

  testWidgets('renders subscriptions and leaves pending callbacks unfinished',
      (tester) async {
    await tester.pumpWidget(screen('ios'));
    await tester.pumpAndSettle();

    expect(log.where((call) => call.method == 'fetchProducts'), isNotEmpty);
    expect(find.text('Premium Monthly'), findsOneWidget);

    await deliver(
      const PurchaseIOS(
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
      ),
    );
    await tester.pumpAndSettle();
    expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    expect(log.where((call) => call.method == 'verifyPurchaseWithProvider'),
        isEmpty);
    expect(find.textContaining('Payment is pending'), findsOneWidget);

    await closeScreen(tester);
  });

  testWidgets('shows a Play plan change that waits for payment',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    dotenv.loadFromString(envString: 'IAPKIT_API_KEY=widget-test-public-key');
    try {
      await tester.pumpWidget(screen('android'));
      await tester.pumpAndSettle();

      await deliver(
        const PurchaseAndroid(
          id: 'GPA.1',
          productId: 'dev.hyo.martie.premium',
          purchaseToken: 'play-token',
          purchaseState: PurchaseState.Purchased,
          isAcknowledgedAndroid: true,
          pendingPurchaseUpdateAndroid: PendingPurchaseUpdateAndroid(
            products: ['dev.hyo.martie.premium_year'],
            purchaseToken: 'change-token',
          ),
          transactionDate: 1,
          quantity: 1,
          isAutoRenewing: true,
          store: IapStore.Google,
          storeId: 'play',
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining(
          'Plan change to dev.hyo.martie.premium_year is pending. '
          'dev.hyo.martie.premium stays active until it applies.',
        ),
        findsOneWidget,
      );
      // Acknowledged already, so nothing is left to finish.
      expect(log.where((call) => call.method == 'finishTransaction'), isEmpty);
    } finally {
      debugDefaultTargetPlatformOverride = null;
      await closeScreen(tester);
    }
  });

  for (final store in [IapStore.Google, IapStore.Amazon]) {
    testWidgets('replaces the current plan in place only on Play ($store)',
        (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      active = [
        const ActiveSubscription(
          productId: 'dev.hyo.martie.premium_year',
          purchaseToken: 'current-token',
          transactionId: 'current',
          transactionDate: 1,
          isActive: true,
        ).toJson(),
      ];
      ownership = [
        PurchaseAndroid(
          id: 'current',
          productId: 'dev.hyo.martie.premium_year',
          purchaseToken: 'current-token',
          purchaseState: PurchaseState.Purchased,
          isAcknowledgedAndroid: true,
          transactionDate: 1,
          quantity: 1,
          isAutoRenewing: true,
          store: store,
          storeId: store == IapStore.Google ? 'play' : 'amazon',
        ).toJson(),
      ];
      final onPlay = store == IapStore.Google;
      try {
        await tester.pumpWidget(screen('android'));
        await tester.pumpAndSettle();
        expect(
          find.text('Proration Mode (Test):'),
          onPlay ? findsOneWidget : findsNothing,
        );

        await tester.ensureVisible(find.text('Upgrade/Downgrade'));
        await tester.tap(find.text('Upgrade/Downgrade'));
        await tester.pumpAndSettle();

        final request =
            log.singleWhere((call) => call.method == 'requestPurchase');
        final arguments = request.arguments as Map<dynamic, dynamic>;
        expect(arguments['skus'], ['dev.hyo.martie.premium']);
        expect(arguments['purchaseToken'], onPlay ? 'current-token' : null);
        expect(
          arguments['subscriptionProductReplacementParams'],
          onPlay
              ? {
                  'oldProductId': 'dev.hyo.martie.premium_year',
                  'replacementMode': 'with-time-proration',
                }
              : null,
        );
      } finally {
        debugDefaultTargetPlatformOverride = null;
        await closeScreen(tester);
      }
    });
  }
}
