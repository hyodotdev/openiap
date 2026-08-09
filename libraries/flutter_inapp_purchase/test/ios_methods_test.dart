import 'package:flutter/services.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('iOS specific channel methods', () {
    late FlutterInappPurchase iap;
    late MethodChannel channel;
    final calls = <MethodCall>[];

    setUp(() {
      iap = FlutterInappPurchase.private(FakePlatform(operatingSystem: 'ios'));
      channel = iap.channel;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        calls.add(methodCall);
        switch (methodCall.method) {
          case 'initConnection':
            return true;
          case 'presentCodeRedemptionSheetIOS':
            return <String, dynamic>{
              'id': 'redeemed-transaction',
              'productId': 'com.example.subscription',
              'transactionDate': 1700000000000,
              'transactionId': 'redeemed-transaction',
              'purchaseState': 'PURCHASED',
              'purchaseToken': 'redeemed-jws',
              'quantity': 1,
              'isAutoRenewing': true,
              'store': 'apple',
            };
          case 'showManageSubscriptionsIOS':
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'managed-subscription-transaction',
                'productId': 'com.example.subscription',
                'transactionDate': 1700000000000,
                'transactionId': 'managed-subscription-transaction',
                'purchaseState': 'PURCHASED',
                'purchaseToken': 'managed-subscription-jws',
                'quantity': 1,
                'isAutoRenewing': true,
                'platform': 'ios',
                'store': 'apple',
              },
            ];
          case 'deepLinkToSubscriptions':
            return null;
          case 'getStorefront':
            return 'US';
          case 'syncIOS':
            return true;
          case 'isEligibleForIntroOfferIOS':
            return true;
          case 'subscriptionStatusIOS':
            return <Map<String, dynamic>>[
              <String, dynamic>{'state': 'active'},
            ];
          case 'getAvailableItems':
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'platform': 'ios',
                'store': 'apple',
                'productId': 'com.example.prod1',
                'transactionId': 'txn-available',
                'purchaseState': 'PURCHASED',
                'purchaseToken': 'receipt-data',
                'transactionDate': 1700000000000,
              },
            ];
          case 'getAppTransactionIOS':
            return <String, dynamic>{
              'appId': 1,
              'appTransactionId': 'txn-app',
              'appVersion': '1.0',
              'appVersionId': 1,
              'bundleId': 'com.example',
              'deviceVerification': 'verify',
              'deviceVerificationNonce': 'nonce',
              'environment': 'Sandbox',
              'originalAppVersion': '1.0',
              'originalPlatform': 'ios',
              'originalPurchaseDate': 1700000000000,
              'preorderDate': 1700000000000,
              'signedDate': 1700000000000,
            };
          case 'getPurchaseHistoriesIOS':
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'platform': 'ios',
                'store': 'apple',
                'productId': 'com.example.prod1',
                'transactionId': 'txn-history',
                'purchaseState': 'PURCHASED',
                'purchaseToken': 'history-receipt',
                'transactionDate': 1700000000000,
              },
            ];
          case 'clearTransactionIOS':
            return true;
          case 'getPromotedProductIOS':
            return <String, dynamic>{
              'currency': 'USD',
              'description': 'Desc',
              'displayNameIOS': 'Prod 1',
              'displayPrice': '\$0.99',
              'id': 'com.example.prod1',
              'isFamilyShareableIOS': false,
              'jsonRepresentationIOS': '{}',
              'platform': 'IOS',
              'price': 0.99,
              'title': 'Prod 1',
              'type': 'IN_APP',
              'typeIOS': 'CONSUMABLE',
            };
          case 'beginRefundRequestIOS':
            return 'success';
          case 'currentEntitlementIOS':
            return <String, dynamic>{
              '__typename': 'PurchaseIOS',
              'id': 'txn-entitlement',
              'productId': 'com.example.prod1',
              'platform': 'IOS',
              'store': 'apple',
              'purchaseState': 'PURCHASED',
              'quantity': 1,
              'transactionDate': 1700000000000,
              'transactionId': 'txn-entitlement',
              'isAutoRenewing': false,
            };
          case 'latestTransactionIOS':
            return <String, dynamic>{
              '__typename': 'PurchaseIOS',
              'id': 'txn-latest',
              'productId': 'com.example.prod1',
              'platform': 'IOS',
              'store': 'apple',
              'purchaseState': 'PURCHASED',
              'quantity': 1,
              'transactionDate': 1700000000000,
              'transactionId': 'txn-latest',
              'isAutoRenewing': false,
            };
          case 'isTransactionVerifiedIOS':
            return true;
          case 'getTransactionJwsIOS':
            return 'jws-representation-token';
          case 'getReceiptDataIOS':
            return 'base64-receipt-data';
          case 'canPresentExternalPurchaseNoticeIOS':
            return true;
          case 'presentExternalPurchaseNoticeSheetIOS':
            return <String, dynamic>{
              'result': 'continue',
              'externalPurchaseToken': 'external-token',
            };
          case 'getPendingTransactionsIOS':
            // Return a list of purchases (as native would)
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'id': '1000001',
                'productId': 'com.example.prod1',
                'transactionDate': DateTime.now().millisecondsSinceEpoch,
                'transactionId': '1000001',
                'purchaseState': 'PURCHASED',
                'purchaseToken': 'jwt-token',
                'quantity': 1,
                'isAutoRenewing': false,
                'platform': 'ios',
                'store': 'apple',
              },
            ];
          case 'getAllTransactionsIOS':
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'id': '1000002',
                'productId': 'com.example.prod1',
                'transactionDate': DateTime.now().millisecondsSinceEpoch,
                'transactionId': '1000002',
                'purchaseState': 'PURCHASED',
                'purchaseToken': 'all-jwt-token',
                'quantity': 1,
                'isAutoRenewing': false,
                'platform': 'ios',
                'store': 'apple',
              },
            ];
          default:
            return null;
        }
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      calls.clear();
    });

    test(
      'presentCodeRedemptionSheetIOS calls correct channel method',
      () async {
        final purchase = await iap.presentCodeRedemptionSheetIOS();
        expect(purchase?.id, 'redeemed-transaction');
        expect(calls.last.method, 'presentCodeRedemptionSheetIOS');
      },
    );

    test('presentCodeRedemptionSheetIOS preserves a null result', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'presentCodeRedemptionSheetIOS') return null;
        return null;
      });

      expect(await iap.presentCodeRedemptionSheetIOS(), isNull);
    });

    test('showManageSubscriptionsIOS returns changed purchases', () async {
      final purchases = await iap.showManageSubscriptionsIOS();

      expect(purchases, hasLength(1));
      expect(purchases.single.productId, 'com.example.subscription');
      expect(
        purchases.single.transactionId,
        'managed-subscription-transaction',
      );
      expect(calls.last.method, 'showManageSubscriptionsIOS');
    });

    test('deepLinkToSubscriptions calls Apple channel method', () async {
      await iap.deepLinkToSubscriptions();
      expect(calls.last.method, 'deepLinkToSubscriptions');
    });

    test('getStorefront returns storefront country code', () async {
      final code = await iap.getStorefront();
      expect(code, 'US');
      expect(calls.last.method, 'getStorefront');
    });

    test('getPromotedProduct returns structured map', () async {
      final product = await iap.getPromotedProductIOS();
      expect(product, isA<ProductIOS>());
      expect(product!.id, 'com.example.prod1');
      expect(calls.last.method, 'getPromotedProductIOS');
    });

    test('getPendingTransactionsIOS returns purchases list', () async {
      final list = await iap.getPendingTransactionsIOS();
      expect(list, isA<List<PurchaseIOS>>());
      expect(list.length, 1);
      expect(list.first.productId, 'com.example.prod1');
      expect(calls.last.method, 'getPendingTransactionsIOS');
    });

    test('getAllTransactionsIOS returns purchases list', () async {
      final list = await iap.getAllTransactionsIOS();
      expect(list, isA<List<PurchaseIOS>>());
      expect(list.single.transactionId, '1000002');
      expect(calls.last.method, 'getAllTransactionsIOS');
    });

    test('transaction-list APIs preserve native platform errors', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getPendingTransactionsIOS' ||
            methodCall.method == 'getAllTransactionsIOS') {
          throw PlatformException(
            code: 'service-error',
            message: 'native transaction query failed',
          );
        }
        return null;
      });

      await expectLater(
        iap.getPendingTransactionsIOS(),
        throwsA(isA<PurchaseError>()),
      );
      await expectLater(
        iap.getAllTransactionsIOS(),
        throwsA(isA<PurchaseError>()),
      );
    });

    test('authoritative iOS lists reject mixed malformed payloads', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'showManageSubscriptionsIOS' ||
            methodCall.method == 'getPendingTransactionsIOS' ||
            methodCall.method == 'getAllTransactionsIOS') {
          return <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'valid',
              'productId': 'premium',
              'transactionDate': 1700000000000,
              'transactionId': 'valid',
              'purchaseState': 'PURCHASED',
              'quantity': 1,
              'isAutoRenewing': false,
              'store': 'apple',
            },
            <String, dynamic>{'id': 'malformed'},
          ];
        }
        return null;
      });

      for (final request in <Future<List<PurchaseIOS>> Function()>[
        iap.showManageSubscriptionsIOS,
        iap.getPendingTransactionsIOS,
        iap.getAllTransactionsIOS,
      ]) {
        await expectLater(
          request(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              ErrorCode.BillingResponseJsonParseError,
            ),
          ),
        );
      }
    });

    test('isEligibleForIntroOfferIOS returns platform result', () async {
      expect(await iap.isEligibleForIntroOfferIOS('group'), isTrue);
      expect(calls.last.method, 'isEligibleForIntroOfferIOS');
    });

    test('isEligibleForIntroOfferIOS returns false on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await androidIap.isEligibleForIntroOfferIOS('group'), isFalse);
    });

    test('subscriptionStatusIOS parses list payload', () async {
      final statuses = await iap.subscriptionStatusIOS('sku');
      expect(statuses, hasLength(1));
      expect(statuses.first.state, 'active');
      expect(calls.last.method, 'subscriptionStatusIOS');
    });

    test('subscriptionStatusIOS normalizes nested renewal info', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'subscriptionStatusIOS') {
          return <Object?>[
            <Object?, Object?>{
              'state': 'active',
              'renewalInfo': <Object?, Object?>{
                'willAutoRenew': true,
              },
            },
          ];
        }
        return null;
      });

      final statuses = await iap.subscriptionStatusIOS('sku');
      expect(statuses.single.renewalInfo?.willAutoRenew, isTrue);
    });

    test('subscriptionStatusIOS accepts string payload', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'subscriptionStatusIOS') {
          return '[{"state":"expired"}]';
        }
        return null;
      });

      final statuses = await iap.subscriptionStatusIOS('sku');
      expect(statuses.single.state, 'expired');
    });

    test('getAppTransactionIOS returns typed transaction', () async {
      final transaction = await iap.getAppTransactionIOS();
      expect(transaction, isNotNull);
      expect(transaction!.bundleId, 'com.example');
      expect(calls.last.method, 'getAppTransactionIOS');
    });

    test('getStorefront throws when country code is missing or blank',
        () async {
      final responses = <String?>[null, '', '   '];

      for (final response in responses) {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'getStorefront') {
            return response;
          }
          return null;
        });

        await expectLater(
          iap.getStorefront(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              ErrorCode.ServiceError,
            ),
          ),
        );
      }
    });

    test('presentCodeRedemptionSheetIOS throws on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        androidIap.presentCodeRedemptionSheetIOS(),
        throwsA(isA<PlatformException>()),
      );
    });

    test('showManageSubscriptionsIOS throws on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        androidIap.showManageSubscriptionsIOS(),
        throwsA(isA<PlatformException>()),
      );
    });

    test(
      'getAppTransactionIOS returns null when native layer returns null',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'getAppTransactionIOS') {
            return null;
          }
          return null;
        });

        final transaction = await iap.getAppTransactionIOS();
        expect(transaction, isNull);
      },
    );

    test(
      'clearTransactionIOS returns true when native call succeeds',
      () async {
        expect(await iap.clearTransactionIOS(), isTrue);
        expect(calls.last.method, 'clearTransactionIOS');
      },
    );

    test('clearTransactionIOS calls native implementation on macOS', () async {
      final macIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );

      expect(await macIap.clearTransactionIOS(), isTrue);
      expect(calls.last.method, 'clearTransactionIOS');
    });

    test('macOS routes every supported non-UI StoreKit API', () async {
      final macIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );

      expect(await macIap.getStorefront(), 'US');
      expect(await macIap.syncIOS(), isTrue);
      expect(await macIap.isEligibleForIntroOfferIOS('group'), isTrue);
      expect(await macIap.subscriptionStatusIOS('sku'), hasLength(1));
      expect(await macIap.getAppTransactionIOS(), isNotNull);
      expect(await macIap.getPendingTransactionsIOS(), hasLength(1));
      expect(await macIap.getAllTransactionsIOS(), hasLength(1));
      expect(
        await macIap.currentEntitlementIOS('com.example.prod1'),
        isNotNull,
      );
      expect(
        await macIap.latestTransactionIOS('com.example.prod1'),
        isNotNull,
      );
      expect(
        await macIap.isTransactionVerifiedIOS('com.example.prod1'),
        isTrue,
      );
      expect(
        await macIap.getTransactionJwsIOS('com.example.prod1'),
        'jws-representation-token',
      );
      expect(await macIap.getReceiptDataIOS(), 'base64-receipt-data');
      expect(await macIap.canPresentExternalPurchaseNoticeIOS(), isTrue);
      final notice = await macIap.presentExternalPurchaseNoticeSheetIOS();
      expect(notice.result, ExternalPurchaseNoticeAction.Continue);
      expect(notice.externalPurchaseToken, 'external-token');

      expect(
        calls.map((call) => call.method),
        containsAll(<String>[
          'getStorefront',
          'syncIOS',
          'isEligibleForIntroOfferIOS',
          'subscriptionStatusIOS',
          'getAppTransactionIOS',
          'getPendingTransactionsIOS',
          'getAllTransactionsIOS',
          'currentEntitlementIOS',
          'latestTransactionIOS',
          'isTransactionVerifiedIOS',
          'getTransactionJwsIOS',
          'getReceiptDataIOS',
          'canPresentExternalPurchaseNoticeIOS',
          'presentExternalPurchaseNoticeSheetIOS',
        ]),
      );
    });

    test('macOS keeps window-dependent APIs explicitly unsupported', () async {
      final macIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );
      final initialCallCount = calls.length;

      await expectLater(
        macIap.presentCodeRedemptionSheetIOS(),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        macIap.beginRefundRequestIOS('sku'),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        macIap.showManageSubscriptionsIOS(),
        throwsA(isA<PlatformException>()),
      );
      await expectLater(
        macIap.deepLinkToSubscriptions(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.FeatureNotSupported,
          ),
        ),
      );
      final link = await macIap.presentExternalPurchaseLinkIOS(
        'https://example.com',
      );
      expect(link.success, isFalse);
      expect(link.error, contains('not supported on macOS'));
      expect(calls.length, initialCallCount);
    });

    test('clearTransactionIOS returns false on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await androidIap.clearTransactionIOS(), isFalse);
    });

    test('clearTransactionIOS preserves native platform errors', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'clearTransactionIOS') {
          throw PlatformException(code: '500', message: 'error');
        }
        return null;
      });

      await expectLater(
        iap.clearTransactionIOS(),
        throwsA(isA<PurchaseError>()),
      );
    });

    test(
      'getPromotedProductIOS returns null when native sends string payload',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'getPromotedProductIOS') {
            return '{}';
          }
          return null;
        });

        expect(await iap.getPromotedProductIOS(), isNull);
      },
    );

    test('subscriptionStatusIOS preserves native platform errors', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'subscriptionStatusIOS') {
          throw PlatformException(code: '500', message: 'failure');
        }
        return null;
      });

      await expectLater(
        iap.subscriptionStatusIOS('sku'),
        throwsA(isA<PurchaseError>()),
      );
    });

    test('getPromotedProductIOS preserves native platform errors', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getPromotedProductIOS') {
          throw PlatformException(code: '500', message: 'error');
        }
        return null;
      });

      await expectLater(
        iap.getPromotedProductIOS(),
        throwsA(isA<PurchaseError>()),
      );
    });

    test('beginRefundRequestIOS invokes channel and returns status', () async {
      final status = await iap.beginRefundRequestIOS('com.example.prod1');
      expect(status, 'success');
      expect(calls.last.method, 'beginRefundRequestIOS');
      expect(
        calls.last.arguments,
        <String, dynamic>{'sku': 'com.example.prod1'},
      );
    });

    test('beginRefundRequestIOS throws PlatformException on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await expectLater(
        androidIap.beginRefundRequestIOS('com.example.prod1'),
        throwsA(isA<PlatformException>()),
      );
    });

    test('currentEntitlementIOS returns typed PurchaseIOS', () async {
      final purchase = await iap.currentEntitlementIOS('com.example.prod1');
      expect(purchase, isA<PurchaseIOS>());
      expect(purchase!.productId, 'com.example.prod1');
      expect(calls.last.method, 'currentEntitlementIOS');
    });

    test('currentEntitlementIOS returns null on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      expect(await androidIap.currentEntitlementIOS('sku'), isNull);
    });

    test('latestTransactionIOS returns typed PurchaseIOS', () async {
      final purchase = await iap.latestTransactionIOS('com.example.prod1');
      expect(purchase, isA<PurchaseIOS>());
      expect(purchase!.transactionId, 'txn-latest');
      expect(calls.last.method, 'latestTransactionIOS');
    });

    test('latestTransactionIOS returns null when native returns null',
        () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'latestTransactionIOS') {
          return null;
        }
        return null;
      });
      expect(await iap.latestTransactionIOS('sku'), isNull);
    });

    test('isTransactionVerifiedIOS returns bool from native', () async {
      expect(await iap.isTransactionVerifiedIOS('com.example.prod1'), isTrue);
      expect(calls.last.method, 'isTransactionVerifiedIOS');
    });

    test('isTransactionVerifiedIOS returns false on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      expect(await androidIap.isTransactionVerifiedIOS('sku'), isFalse);
    });

    test('getTransactionJwsIOS returns JWS string', () async {
      final jws = await iap.getTransactionJwsIOS('com.example.prod1');
      expect(jws, 'jws-representation-token');
      expect(calls.last.method, 'getTransactionJwsIOS');
    });

    test('getReceiptDataIOS returns base64 receipt string', () async {
      final receipt = await iap.getReceiptDataIOS();
      expect(receipt, 'base64-receipt-data');
      expect(calls.last.method, 'getReceiptDataIOS');
    });

    test('canPresentExternalPurchaseNoticeIOS returns bool', () async {
      expect(await iap.canPresentExternalPurchaseNoticeIOS(), isTrue);
      expect(calls.last.method, 'canPresentExternalPurchaseNoticeIOS');
    });

    test('canPresentExternalPurchaseNoticeIOS returns false on non-iOS',
        () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      expect(await androidIap.canPresentExternalPurchaseNoticeIOS(), isFalse);
    });
  });

  group('ExternalPurchaseCustomLink APIs (iOS 18.1+)', () {
    late FlutterInappPurchase iap;
    late MethodChannel channel;
    final calls = <MethodCall>[];

    setUp(() {
      iap = FlutterInappPurchase.private(FakePlatform(operatingSystem: 'ios'));
      channel = iap.channel;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        calls.add(methodCall);
        switch (methodCall.method) {
          case 'isEligibleForExternalPurchaseCustomLinkIOS':
            return true;
          case 'getExternalPurchaseCustomLinkTokenIOS':
            return <String, dynamic>{
              'token': 'test-token-123',
            };
          case 'showExternalPurchaseCustomLinkNoticeIOS':
            return <String, dynamic>{
              'continued': true,
            };
          default:
            return null;
        }
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      calls.clear();
    });

    test('isEligibleForExternalPurchaseCustomLinkIOS returns true', () async {
      final result = await iap.isEligibleForExternalPurchaseCustomLinkIOS();
      expect(result, isTrue);
      expect(calls.last.method, 'isEligibleForExternalPurchaseCustomLinkIOS');
    });

    test('ExternalPurchaseCustomLink APIs route on macOS', () async {
      final macIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );

      expect(
        await macIap.isEligibleForExternalPurchaseCustomLinkIOS(),
        isTrue,
      );
      final token = await macIap.getExternalPurchaseCustomLinkTokenIOS(
        ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
      );
      expect(token.token, 'test-token-123');
      final notice = await macIap.showExternalPurchaseCustomLinkNoticeIOS(
        ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
      );
      expect(notice.continued, isTrue);
    });

    test(
      'isEligibleForExternalPurchaseCustomLinkIOS returns false on non-iOS',
      () async {
        final androidIap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );
        expect(
          await androidIap.isEligibleForExternalPurchaseCustomLinkIOS(),
          isFalse,
        );
      },
    );

    test(
      'isEligibleForExternalPurchaseCustomLinkIOS throws on platform error',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method ==
              'isEligibleForExternalPurchaseCustomLinkIOS') {
            throw PlatformException(
              code: 'service-error',
              message: 'native error',
            );
          }
          return null;
        });

        await expectLater(
          iap.isEligibleForExternalPurchaseCustomLinkIOS(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              ErrorCode.ServiceError,
            ),
          ),
        );
      },
    );

    test(
      'getExternalPurchaseCustomLinkTokenIOS returns token',
      () async {
        final result = await iap.getExternalPurchaseCustomLinkTokenIOS(
          ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        );
        expect(result.token, 'test-token-123');
        expect(result.error, isNull);
        expect(calls.last.method, 'getExternalPurchaseCustomLinkTokenIOS');
        expect(calls.last.arguments['tokenType'], 'acquisition');
      },
    );

    test(
      'getExternalPurchaseCustomLinkTokenIOS returns error on non-iOS',
      () async {
        final androidIap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );
        final result = await androidIap.getExternalPurchaseCustomLinkTokenIOS(
          ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        );
        expect(result.token, isNull);
        expect(result.error, isNotNull);
      },
    );

    test(
      'getExternalPurchaseCustomLinkTokenIOS preserves platform error',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'getExternalPurchaseCustomLinkTokenIOS') {
            throw PlatformException(code: '500', message: 'native error');
          }
          return null;
        });

        await expectLater(
          iap.getExternalPurchaseCustomLinkTokenIOS(
            ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
          ),
          throwsA(isA<PurchaseError>()),
        );
      },
    );

    test(
      'showExternalPurchaseCustomLinkNoticeIOS returns continued true',
      () async {
        final result = await iap.showExternalPurchaseCustomLinkNoticeIOS(
          ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        );
        expect(result.continued, isTrue);
        expect(result.error, isNull);
        expect(calls.last.method, 'showExternalPurchaseCustomLinkNoticeIOS');
        expect(calls.last.arguments['noticeType'], 'browser');
      },
    );

    test(
      'showExternalPurchaseCustomLinkNoticeIOS returns error on non-iOS',
      () async {
        final androidIap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );
        final result = await androidIap.showExternalPurchaseCustomLinkNoticeIOS(
          ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        );
        expect(result.continued, isFalse);
        expect(result.error, isNotNull);
      },
    );

    test(
      'showExternalPurchaseCustomLinkNoticeIOS preserves platform error',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'showExternalPurchaseCustomLinkNoticeIOS') {
            throw PlatformException(code: '500', message: 'native error');
          }
          return null;
        });

        await expectLater(
          iap.showExternalPurchaseCustomLinkNoticeIOS(
            ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
          ),
          throwsA(isA<PurchaseError>()),
        );
      },
    );
  });
}
