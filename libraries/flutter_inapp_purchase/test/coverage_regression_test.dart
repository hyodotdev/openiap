import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

typedef _IapCall = Future<dynamic> Function(FlutterInappPurchase iap);

class _FailureCase {
  const _FailureCase(this.name, this.call, {this.invalidResponse = 7});

  final String name;
  final _IapCall call;
  final dynamic invalidResponse;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('flutter_inapp');
  late DebugPrintCallback previousDebugPrint;

  setUp(() {
    previousDebugPrint = debugPrint;
    debugPrint = (String? _, {int? wrapWidth}) {};
  });

  tearDown(() {
    debugPrint = previousDebugPrint;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  final appleFailureCases = <_FailureCase>[
    _FailureCase('storefront', (iap) => iap.getStorefront()),
    _FailureCase('sync', (iap) => iap.syncIOS()),
    _FailureCase(
      'intro offer eligibility',
      (iap) => iap.isEligibleForIntroOfferIOS('group'),
    ),
    _FailureCase(
      'subscription status',
      (iap) => iap.subscriptionStatusIOS('premium'),
      invalidResponse: '{',
    ),
    _FailureCase('clear transactions', (iap) => iap.clearTransactionIOS()),
    _FailureCase(
      'promoted product',
      (iap) => iap.getPromotedProductIOS(),
      invalidResponse: const <String, dynamic>{'id': true},
    ),
    _FailureCase('app transaction', (iap) => iap.getAppTransactionIOS()),
    _FailureCase(
      'code redemption',
      (iap) => iap.presentCodeRedemptionSheetIOS(),
    ),
    _FailureCase(
      'refund request',
      (iap) => iap.beginRefundRequestIOS('premium'),
    ),
    _FailureCase(
      'manage subscriptions',
      (iap) => iap.showManageSubscriptionsIOS(),
      invalidResponse: 'not-json',
    ),
    _FailureCase(
      'pending transactions',
      (iap) => iap.getPendingTransactionsIOS(),
      invalidResponse: 'not-json',
    ),
    _FailureCase(
      'all transactions',
      (iap) => iap.getAllTransactionsIOS(),
      invalidResponse: 'not-json',
    ),
    _FailureCase(
      'current entitlement',
      (iap) => iap.currentEntitlementIOS('premium'),
    ),
    _FailureCase(
      'latest transaction',
      (iap) => iap.latestTransactionIOS('premium'),
    ),
    _FailureCase(
      'transaction verification',
      (iap) => iap.isTransactionVerifiedIOS('premium'),
    ),
    _FailureCase(
      'transaction JWS',
      (iap) => iap.getTransactionJwsIOS('premium'),
    ),
    _FailureCase('receipt data', (iap) => iap.getReceiptDataIOS()),
    _FailureCase(
      'external notice eligibility',
      (iap) => iap.canPresentExternalPurchaseNoticeIOS(),
    ),
    _FailureCase(
      'external notice sheet',
      (iap) => iap.presentExternalPurchaseNoticeSheetIOS(),
    ),
    _FailureCase(
      'external purchase link',
      (iap) => iap.presentExternalPurchaseLinkIOS('https://example.test'),
    ),
    _FailureCase(
      'custom-link eligibility',
      (iap) => iap.isEligibleForExternalPurchaseCustomLinkIOS(),
    ),
    _FailureCase(
      'custom-link token',
      (iap) => iap.getExternalPurchaseCustomLinkTokenIOS(
        types.ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
      ),
    ),
    _FailureCase(
      'custom-link notice',
      (iap) => iap.showExternalPurchaseCustomLinkNoticeIOS(
        types.ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
      ),
    ),
  ];

  group('Apple wrapper failure coverage', () {
    for (final testCase in appleFailureCases) {
      test('${testCase.name} converts PlatformException', () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (_) async {
          throw PlatformException(
            code: 'service-error',
            message: '${testCase.name} failed',
          );
        });
        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await expectLater(testCase.call(iap), throwsA(isA<PurchaseError>()));
      });

      test('${testCase.name} converts unexpected exceptions', () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (_) async {
          return testCase.invalidResponse;
        });
        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await expectLater(testCase.call(iap), throwsA(isA<PurchaseError>()));
      });
    }
  });

  group('platform fallback coverage', () {
    test('Apple-only helpers return documented Android fallbacks', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await iap.syncIOS(), isFalse);
      expect(await iap.isEligibleForIntroOfferIOS('group'), isFalse);
      expect(await iap.subscriptionStatusIOS('premium'), isEmpty);
      expect(await iap.clearTransactionIOS(), isFalse);
      expect(await iap.getPromotedProductIOS(), isNull);
      expect(await iap.getAppTransactionIOS(), isNull);
      expect(await iap.getPendingTransactionsIOS(), isEmpty);
      expect(await iap.getAllTransactionsIOS(), isEmpty);
      expect(await iap.currentEntitlementIOS('premium'), isNull);
      expect(await iap.latestTransactionIOS('premium'), isNull);
      expect(await iap.isTransactionVerifiedIOS('premium'), isFalse);
      expect(await iap.getTransactionJwsIOS('premium'), isNull);
      expect(await iap.getReceiptDataIOS(), isNull);
      expect(await iap.canPresentExternalPurchaseNoticeIOS(), isFalse);
      expect(
        (await iap.presentExternalPurchaseNoticeSheetIOS()).result,
        types.ExternalPurchaseNoticeAction.Dismissed,
      );
      expect(
        (await iap.presentExternalPurchaseLinkIOS('https://example.test'))
            .success,
        isFalse,
      );
      expect(await iap.isEligibleForExternalPurchaseCustomLinkIOS(), isFalse);
      expect(
        (await iap.getExternalPurchaseCustomLinkTokenIOS(
          types.ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        ))
            .token,
        isNull,
      );
      expect(
        (await iap.showExternalPurchaseCustomLinkNoticeIOS(
          types.ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        ))
            .continued,
        isFalse,
      );
    });

    test('Android-only helpers reject Apple callers', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(
        iap.acknowledgePurchaseAndroid('opaque'),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.consumePurchaseAndroid('opaque'),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.createBillingProgramReportingDetailsAndroid(
          types.BillingProgramAndroid.ExternalOffer,
        ),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.getBillingChoiceInfoAndroid(
          const types.GetBillingChoiceInfoParamsAndroid(),
        ),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.showBillingProgramInformationDialogAndroid(
          const types.BillingProgramInformationDialogParamsAndroid(
            externalTransactionToken: 'opaque',
          ),
        ),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.showInAppMessagesAndroid(),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.openRedeemOfferCodeAndroid(),
        throwsA(isA<PurchaseError>()),
      );
    });
  });

  group('Android wrapper fallback coverage', () {
    test('native errors return safe acknowledge and consume results', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (_) async {
        throw StateError('native failure');
      });
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await iap.acknowledgePurchaseAndroid('opaque'), isFalse);
      expect(await iap.consumePurchaseAndroid('opaque'), isFalse);
      expect(
        (await iap.isBillingProgramAvailableAndroid(
          types.BillingProgramAndroid.ExternalOffer,
        ))
            .isAvailable,
        isFalse,
      );
      await expectLater(
        iap.createBillingProgramReportingDetailsAndroid(
          types.BillingProgramAndroid.ExternalOffer,
        ),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        iap.getBillingChoiceInfoAndroid(
          const types.GetBillingChoiceInfoParamsAndroid(),
        ),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        iap.showBillingProgramInformationDialogAndroid(
          const types.BillingProgramInformationDialogParamsAndroid(
            externalTransactionToken: 'opaque',
          ),
        ),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        iap.showInAppMessagesAndroid(),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        iap.openRedeemOfferCodeAndroid(),
        throwsA(isA<PlatformException>()),
      );
    });

    test('null native results take documented defaults', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (_) async => null);
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await iap.acknowledgePurchaseAndroid('opaque'), isTrue);
      expect(await iap.consumePurchaseAndroid('opaque'), isTrue);
      expect(
        (await iap.isBillingProgramAvailableAndroid(
          types.BillingProgramAndroid.ExternalOffer,
        ))
            .isAvailable,
        isFalse,
      );
      expect(
        (await iap.showInAppMessagesAndroid()).responseCode,
        types.InAppMessageResponseCodeAndroid.NoActionNeeded,
      );
      expect(
          await iap.launchExternalLinkAndroid(_externalLinkParams()), isFalse);
      expect(await iap.openRedeemOfferCodeAndroid(), isFalse);
    });
  });

  group('transaction completion coverage', () {
    test('handles Android consume, acknowledge, cache, and response variants',
        () async {
      final responses = <String, dynamic>{
        'consume': <String, dynamic>{'responseCode': 0},
        'bool': true,
        'json': '{"responseCode":"0"}',
        'map': <Object?, Object?>{'responseCode': 0},
        'failure': null,
      };
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        final token = (call.arguments as Map)['purchaseToken'] as String;
        return responses[token];
      });
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        iap.finishTransaction(purchase: _androidPurchase(null)),
        throwsA(isA<PurchaseError>()),
      );
      await iap.finishTransaction(
        purchase: _androidPurchase('consume'),
        isConsumable: true,
      );
      await iap.finishTransaction(purchase: _androidPurchase('bool'));
      await iap.finishTransaction(purchase: _androidPurchase('bool'));
      await iap.finishTransaction(purchase: _androidPurchase('json'));
      await iap.finishTransaction(purchase: _androidPurchase('map'));
      await iap.finishTransaction(purchase: _androidPurchase('failure'));
    });

    test('finishes Apple transactions and rejects unsupported platforms',
        () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        calls.add(call);
        return null;
      });
      final ios = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );
      final linux = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'linux'),
      );

      await ios.finishTransaction(
        purchase: _iosPurchase(),
        isConsumable: false,
      );
      expect(calls.single.method, 'finishTransaction');
      await expectLater(
        linux.finishTransaction(purchase: _iosPurchase()),
        throwsA(isA<PlatformException>()),
      );
    });
  });

  group('native event coverage', () {
    const codec = StandardMethodCodec();

    Future<void> send(String method, Object? arguments) async {
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        'flutter_inapp',
        codec.encodeMethodCall(MethodCall(method, arguments)),
        (_) {},
      );
    }

    test('emits user-choice and subscription billing-issue events', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (_) async => true);
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();
      final userChoice = iap.userChoiceBillingAndroid.first;
      final billingIssue = iap.subscriptionBillingIssueListener.first;

      await send(
        'user-choice-billing-android',
        jsonEncode(<String, dynamic>{
          'externalTransactionToken': 'opaque',
          'products': <String>['premium'],
        }),
      );
      await send(
        'subscription-billing-issue',
        jsonEncode(_androidPurchaseJson('billing-issue')),
      );

      expect((await userChoice).products, <String>['premium']);
      expect((await billingIssue).productId, 'premium');
    });

    test('isolates malformed native events and rejects unknown methods',
        () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (_) async => true);
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();

      await send('user-choice-billing-android', '{');
      await send('developer-provided-billing-android', '{');
      await send('subscription-billing-issue', '{');
      await send('purchase-updated', '{');
      await send('unknown-event', null);
    });
  });

  test('generated handler bundles expose every implemented bridge', () {
    final iap = FlutterInappPurchase.private(
      FakePlatform(operatingSystem: 'android'),
    );
    final query = iap.queryHandlers;
    final mutation = iap.mutationHandlers;
    final subscription = iap.subscriptionHandlers;

    expect(
      iap.purchaseUpdatedListenerWithOptions(null),
      isA<Stream<types.Purchase>>(),
    );

    expect(query.fetchProducts, isNotNull);
    expect(query.getBillingChoiceInfoAndroid, isNotNull);
    expect(mutation.acknowledgePurchaseAndroid, isNotNull);
    expect(mutation.beginRefundRequestIOS, isNotNull);
    expect(mutation.consumePurchaseAndroid, isNotNull);
    expect(mutation.createBillingProgramReportingDetailsAndroid, isNotNull);
    expect(mutation.deepLinkToSubscriptions, isNotNull);
    expect(mutation.endConnection, isNotNull);
    expect(mutation.finishTransaction, isNotNull);
    expect(mutation.initConnection, isNotNull);
    expect(mutation.isBillingProgramAvailableAndroid, isNotNull);
    expect(mutation.launchExternalLinkAndroid, isNotNull);
    expect(mutation.openRedeemOfferCodeAndroid, isNotNull);
    expect(mutation.presentCodeRedemptionSheetIOS, isNotNull);
    expect(mutation.requestPurchase, isNotNull);
    expect(mutation.restorePurchases, isNotNull);
    expect(mutation.showBillingProgramInformationDialogAndroid, isNotNull);
    expect(mutation.showInAppMessagesAndroid, isNotNull);
    expect(mutation.showManageSubscriptionsIOS, isNotNull);
    expect(mutation.syncIOS, isNotNull);
    expect(mutation.verifyPurchase, isNotNull);
    expect(mutation.clearTransactionIOS, isNotNull);
    expect(mutation.presentExternalPurchaseNoticeSheetIOS, isNotNull);
    expect(mutation.presentExternalPurchaseLinkIOS, isNotNull);
    expect(mutation.showExternalPurchaseCustomLinkNoticeIOS, isNotNull);
    expect(mutation.verifyPurchaseWithProvider, isNotNull);
    expect(subscription.promotedProductIOS, isNotNull);
    expect(subscription.purchaseError, isNotNull);
    expect(subscription.purchaseUpdated, isNotNull);
    expect(subscription.subscriptionBillingIssue, isNotNull);
    expect(subscription.userChoiceBillingAndroid, isNotNull);
    expect(subscription.developerProvidedBillingAndroid, isNotNull);
  });

  test('generated Android handlers forward named arguments', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'launchExternalLinkAndroid':
          return true;
        case 'getBillingChoiceInfoAndroid':
          return jsonEncode(<String, dynamic>{
            'playBillingChoiceImageUrl': 'https://example.test/choice.png',
          });
        case 'createBillingProgramReportingDetailsAndroid':
          return jsonEncode(<String, dynamic>{
            'billingProgram': 'external-offer',
            'externalTransactionToken': 'opaque',
          });
        case 'showBillingProgramInformationDialogAndroid':
          return jsonEncode(<String, dynamic>{'responseCode': 0});
        case 'showInAppMessagesAndroid':
          return jsonEncode(<String, dynamic>{
            'responseCode': 'no-action-needed',
          });
      }
      return null;
    });
    final iap = FlutterInappPurchase.private(
      FakePlatform(operatingSystem: 'android'),
    );
    final query = iap.queryHandlers;
    final mutation = iap.mutationHandlers;

    await query.getBillingChoiceInfoAndroid!(
      billingProgram: types.BillingProgramAndroid.BillingChoice,
      playBillingChoiceImageLayout:
          types.BillingChoiceImageLayoutAndroid.RectangularFourByOne,
      userLocale: 'en-US',
    );
    await mutation.launchExternalLinkAndroid!(
      billingProgram: types.BillingProgramAndroid.ExternalOffer,
      launchMode:
          types.ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
      linkType: types.ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
      linkUri: 'https://example.test',
      externalTransactionToken: 'opaque',
    );
    await mutation.createBillingProgramReportingDetailsAndroid!(
      program: types.BillingProgramAndroid.ExternalOffer,
      developerBillingType: types.DeveloperBillingTypeAndroid.ExternalLink,
    );
    await mutation.showBillingProgramInformationDialogAndroid!(
      billingProgram: types.BillingProgramAndroid.BillingChoice,
      externalTransactionToken: 'opaque',
    );
    await mutation.showInAppMessagesAndroid!(
      categories: const <types.InAppMessageCategoryAndroid>[
        types.InAppMessageCategoryAndroid.Transactional,
      ],
    );
  });

  test('generated subscription handlers deliver native events', () async {
    const codec = StandardMethodCodec();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async => true);
    final iap = FlutterInappPurchase.private(
      FakePlatform(operatingSystem: 'android'),
    );
    await iap.initConnection();
    final handlers = iap.subscriptionHandlers;

    Future<void> send(String method, Object? arguments) async {
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(MethodCall(method, arguments)),
        (_) {},
      );
    }

    final promoted = handlers.promotedProductIOS!();
    await send('iap-promoted-product', 'premium');
    expect(await promoted, 'premium');

    final purchaseError = handlers.purchaseError!();
    await send(
      'purchase-error',
      jsonEncode(<String, dynamic>{
        'code': 'service-error',
        'debugMessage': 'native debug',
        'message': 'store unavailable',
        'productId': 'premium',
        'responseCode': 7,
      }),
    );
    final mappedError = await purchaseError;
    expect(mappedError.code, types.ErrorCode.ServiceError);
    expect(mappedError.debugMessage, 'native debug');
    expect(mappedError.message, 'store unavailable');
    expect(mappedError.productId, 'premium');
    expect(mappedError.responseCode, 7);

    final purchaseUpdated = handlers.purchaseUpdated!();
    await send('purchase-updated', jsonEncode(_androidPurchaseJson('updated')));
    expect((await purchaseUpdated).purchaseToken, 'updated');

    final billingIssue = handlers.subscriptionBillingIssue!();
    await send(
      'subscription-billing-issue',
      jsonEncode(_androidPurchaseJson('billing-issue')),
    );
    expect((await billingIssue).purchaseToken, 'billing-issue');

    final userChoice = handlers.userChoiceBillingAndroid!();
    await send(
      'user-choice-billing-android',
      jsonEncode(<String, dynamic>{
        'externalTransactionToken': 'opaque',
        'products': <String>['premium'],
      }),
    );
    expect((await userChoice).products, <String>['premium']);

    final developerProvided = handlers.developerProvidedBillingAndroid!();
    await send(
      'developer-provided-billing-android',
      jsonEncode(<String, dynamic>{
        'linkUri': 'https://example.test/checkout',
        'products': <Map<String, dynamic>>[
          <String, dynamic>{'id': 'premium', 'type': 'subs'},
        ],
      }),
    );
    expect((await developerProvided).products.single.id, 'premium');
  });
}

types.LaunchExternalLinkParamsAndroid _externalLinkParams() {
  return const types.LaunchExternalLinkParamsAndroid(
    billingProgram: types.BillingProgramAndroid.ExternalOffer,
    launchMode:
        types.ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
    linkType: types.ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
    linkUri: 'https://example.test',
  );
}

types.PurchaseAndroid _androidPurchase(String? token) {
  return types.PurchaseAndroid(
    id: token ?? 'missing-token',
    isAutoRenewing: false,
    productId: 'premium',
    purchaseState: types.PurchaseState.Purchased,
    purchaseToken: token,
    quantity: 1,
    store: types.IapStore.Google,
    transactionDate: 1,
  );
}

types.PurchaseIOS _iosPurchase() {
  return const types.PurchaseIOS(
    id: 'apple-transaction',
    isAutoRenewing: false,
    productId: 'premium',
    purchaseState: types.PurchaseState.Purchased,
    quantity: 1,
    store: types.IapStore.Apple,
    transactionDate: 1,
    transactionId: 'apple-transaction',
  );
}

Map<String, dynamic> _androidPurchaseJson(String token) {
  return <String, dynamic>{
    'id': token,
    'isAutoRenewing': false,
    'productId': 'premium',
    'purchaseState': 'purchased',
    'purchaseToken': token,
    'quantity': 1,
    'store': 'google',
    'transactionDate': 1,
  };
}
