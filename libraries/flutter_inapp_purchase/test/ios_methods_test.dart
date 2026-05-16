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
            return null;
          case 'showManageSubscriptionsIOS':
            return null;
          case 'deepLinkToSubscriptions':
            return null;
          case 'getStorefrontIOS':
            return <String, dynamic>{'countryCode': 'US'};
          case 'validateReceiptIOS':
            return <String, dynamic>{
              'isValid': true,
              'jwsRepresentation': 'jws-token',
              'receiptData': 'receipt-data',
              'latestTransaction': <String, dynamic>{
                '__typename': 'PurchaseIOS',
                'id': 'txn-ios',
                'productId': 'com.example.prod1',
                'platform': 'IOS',
                'store': 'apple',
                'purchaseState': 'PURCHASED',
                'quantity': 1,
                'transactionDate': 1700000000000,
                'transactionId': 'txn-ios',
                'isAutoRenewing': false,
              },
            };
          case 'isEligibleForIntroOfferIOS':
            return true;
          case 'getSubscriptionStatus':
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
                'transactionReceipt': 'receipt-data',
                'transactionDate': 1700000000000,
              },
            ];
          case 'getAppTransaction':
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
                'transactionReceipt': 'history-receipt',
                'transactionDate': 1700000000000,
              },
            ];
          case 'clearTransactionIOS':
            return null;
          case 'requestPurchaseOnPromotedProductIOS':
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
              'subscriptionInfoIOS': null,
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
          case 'getPendingTransactionsIOS':
            // Return a list of purchases (as native would)
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'id': '1000001',
                'productId': 'com.example.prod1',
                'transactionDate': DateTime.now().millisecondsSinceEpoch,
                'transactionReceipt': 'xyz',
                'purchaseToken': 'jwt-token',
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
        await iap.presentCodeRedemptionSheetIOS();
        expect(calls.last.method, 'presentCodeRedemptionSheetIOS');
      },
    );

    test('showManageSubscriptionsIOS calls correct channel method', () async {
      await iap.showManageSubscriptionsIOS();
      expect(calls.last.method, 'showManageSubscriptionsIOS');
    });

    test('deepLinkToSubscriptions calls Apple channel method', () async {
      await iap.deepLinkToSubscriptions();
      expect(calls.last.method, 'deepLinkToSubscriptions');
    });

    test('getStorefrontIOS returns storefront country code', () async {
      final code = await iap.getStorefrontIOS();
      expect(code, 'US');
      expect(calls.last.method, 'getStorefrontIOS');
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

    test('validateReceiptIOS returns structured result', () async {
      await iap.initConnection();

      final result = await iap.validateReceiptIOS(
        apple: const VerifyPurchaseAppleOptions(sku: 'com.example.prod1'),
      );

      expect(result.isValid, isTrue);
      expect(result.latestTransaction, isA<Purchase>());
      expect(calls.last.method, 'validateReceiptIOS');
    });

    test('validateReceiptIOS throws when connection not initialized', () async {
      await expectLater(
        iap.validateReceiptIOS(
          apple: const VerifyPurchaseAppleOptions(sku: 'com.example.prod1'),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    test('validateReceiptIOS rejects empty SKU', () async {
      await iap.initConnection();

      await expectLater(
        iap.validateReceiptIOS(
          apple: const VerifyPurchaseAppleOptions(sku: '   '),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.DeveloperError,
          ),
        ),
      );
    });

    test('validateReceiptIOS wraps platform exceptions', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'initConnection') {
          return true;
        }
        if (methodCall.method == 'validateReceiptIOS') {
          throw PlatformException(code: '500', message: 'native error');
        }
        return null;
      });

      await iap.initConnection();

      await expectLater(
        iap.validateReceiptIOS(
          apple: const VerifyPurchaseAppleOptions(sku: 'com.example.prod1'),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.ServiceError,
          ),
        ),
      );
    });

    test('validateReceipt throws IapNotAvailable on Android', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        androidIap.validateReceipt(
          apple: const VerifyPurchaseAppleOptions(sku: 'com.example.prod1'),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.IapNotAvailable,
          ),
        ),
      );
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
      expect(calls.last.method, 'getSubscriptionStatus');
    });

    test('subscriptionStatusIOS accepts string payload', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getSubscriptionStatus') {
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
      expect(calls.last.method, 'getAppTransaction');
    });

    test('getStorefrontIOS throws when country code missing', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getStorefrontIOS') {
          return <String, dynamic>{};
        }
        return null;
      });

      await expectLater(
        iap.getStorefrontIOS(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.ServiceError,
          ),
        ),
      );
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
          if (methodCall.method == 'getAppTransaction') {
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

    test('clearTransactionIOS returns false on non-iOS', () async {
      final androidIap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await androidIap.clearTransactionIOS(), isFalse);
    });

    test('clearTransactionIOS returns false when native throws', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'clearTransactionIOS') {
          throw PlatformException(code: '500', message: 'error');
        }
        return null;
      });

      expect(await iap.clearTransactionIOS(), isFalse);
    });

    test('requestPurchaseOnPromotedProductIOS returns true on iOS', () async {
      // ignore: deprecated_member_use_from_same_package
      expect(await iap.requestPurchaseOnPromotedProductIOS(), isTrue);
      expect(calls.last.method, 'requestPurchaseOnPromotedProductIOS');
    });

    test(
      'requestPurchaseOnPromotedProductIOS returns false on non-iOS',
      () async {
        final androidIap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        // ignore: deprecated_member_use_from_same_package
        expect(await androidIap.requestPurchaseOnPromotedProductIOS(), isFalse);
      },
    );

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

    test(
      'requestPurchaseOnPromotedProductIOS returns false when native throws',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'requestPurchaseOnPromotedProductIOS') {
            throw PlatformException(code: '500', message: 'failure');
          }
          return null;
        });

        // ignore: deprecated_member_use_from_same_package
        expect(await iap.requestPurchaseOnPromotedProductIOS(), isFalse);
      },
    );

    test('subscriptionStatusIOS returns empty list on error', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getSubscriptionStatus') {
          throw PlatformException(code: '500', message: 'failure');
        }
        return null;
      });

      final statuses = await iap.subscriptionStatusIOS('sku');
      expect(statuses, isEmpty);
    });

    test('getPromotedProductIOS returns null when native throws', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
        if (methodCall.method == 'getPromotedProductIOS') {
          throw PlatformException(code: '500', message: 'error');
        }
        return null;
      });

      expect(await iap.getPromotedProductIOS(), isNull);
    });

    test(
      'validateReceipt delegates to platform-specific implementation',
      () async {
        await iap.initConnection();

        final result = await iap.validateReceipt(
          apple: const VerifyPurchaseAppleOptions(sku: 'com.example.prod1'),
        );

        expect(result, isA<VerifyPurchaseResultIOS>());
      },
    );

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
      'getExternalPurchaseCustomLinkTokenIOS returns error on platform error',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'getExternalPurchaseCustomLinkTokenIOS') {
            throw PlatformException(code: '500', message: 'native error');
          }
          return null;
        });

        final result = await iap.getExternalPurchaseCustomLinkTokenIOS(
          ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
        );
        expect(result.token, isNull);
        expect(result.error, contains('native error'));
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
      'showExternalPurchaseCustomLinkNoticeIOS returns error on platform error',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
          if (methodCall.method == 'showExternalPurchaseCustomLinkNoticeIOS') {
            throw PlatformException(code: '500', message: 'native error');
          }
          return null;
        });

        final result = await iap.showExternalPurchaseCustomLinkNoticeIOS(
          ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
        );
        expect(result.continued, isFalse);
        expect(result.error, contains('native error'));
      },
    );
  });
}
