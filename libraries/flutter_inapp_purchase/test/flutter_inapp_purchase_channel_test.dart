import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('flutter_inapp');
  const codec = StandardMethodCodec();

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('billing programs', () {
    test('isBillingProgramAvailableAndroid returns parsed result', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'isBillingProgramAvailableAndroid') {
          return jsonEncode(<String, dynamic>{
            'billingProgram': 'external-offer',
            'isAvailable': true,
          });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.isBillingProgramAvailableAndroid(
        types.BillingProgramAndroid.ExternalOffer,
      );

      expect(result.billingProgram, types.BillingProgramAndroid.ExternalOffer);
      expect(result.isAvailable, isTrue);

      final call = calls.singleWhere(
        (MethodCall call) => call.method == 'isBillingProgramAvailableAndroid',
      );
      expect(call.arguments, <String, dynamic>{'program': 'external-offer'});
    });

    test(
      'createBillingProgramReportingDetailsAndroid returns external token on Android',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'createBillingProgramReportingDetailsAndroid') {
            return jsonEncode(<String, dynamic>{
              'billingProgram': 'external-offer',
              'externalTransactionToken': 'ext-token-123',
            });
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        final result = await iap.createBillingProgramReportingDetailsAndroid(
          types.BillingProgramAndroid.ExternalOffer,
        );

        expect(
          result.billingProgram,
          types.BillingProgramAndroid.ExternalOffer,
        );
        expect(result.externalTransactionToken, 'ext-token-123');

        final call = calls.singleWhere(
          (MethodCall call) =>
              call.method == 'createBillingProgramReportingDetailsAndroid',
        );
        expect(call.arguments, <String, dynamic>{
          'program': 'external-offer',
          'developerBillingType': null,
        });
      },
    );

    test(
      'createBillingProgramReportingDetailsAndroid passes developerBillingType',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'createBillingProgramReportingDetailsAndroid') {
            return jsonEncode(<String, dynamic>{
              'billingProgram': 'billing-choice',
              'externalTransactionToken': 'choice-token-123',
            });
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        final result = await iap.createBillingProgramReportingDetailsAndroid(
          types.BillingProgramAndroid.BillingChoice,
          developerBillingType: types.DeveloperBillingTypeAndroid.ExternalLink,
        );

        expect(
            result.billingProgram, types.BillingProgramAndroid.BillingChoice);

        final call = calls.singleWhere(
          (MethodCall call) =>
              call.method == 'createBillingProgramReportingDetailsAndroid',
        );
        expect(call.arguments, <String, dynamic>{
          'program': 'billing-choice',
          'developerBillingType': 'external-link',
        });
      },
    );

    test('getBillingChoiceInfoAndroid returns parsed display info', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'getBillingChoiceInfoAndroid') {
          return jsonEncode(<String, dynamic>{
            'playBillingChoiceImageUrl': 'https://play.google.com/image.png',
            'playBillingLoyaltyInfo': 'Gold member',
          });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.getBillingChoiceInfoAndroid(
        const types.GetBillingChoiceInfoParamsAndroid(
          billingProgram: types.BillingProgramAndroid.BillingChoice,
          playBillingChoiceImageLayout:
              types.BillingChoiceImageLayoutAndroid.RectangularFourByOne,
          userLocale: 'en-US',
        ),
      );

      expect(result.playBillingChoiceImageUrl,
          'https://play.google.com/image.png');
      expect(result.playBillingLoyaltyInfo, 'Gold member');

      final call = calls.singleWhere(
        (MethodCall call) => call.method == 'getBillingChoiceInfoAndroid',
      );
      expect(call.arguments, <String, dynamic>{
        'billingProgram': 'billing-choice',
        'playBillingChoiceImageLayout': 'rectangular-four-by-one',
        'userLocale': 'en-US',
      });
    });

    test('showBillingProgramInformationDialogAndroid returns billing result',
        () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'showBillingProgramInformationDialogAndroid') {
          return jsonEncode(<String, dynamic>{
            'responseCode': 0,
            'debugMessage': null,
            'subResponseCode': 'no-applicable-sub-response-code',
          });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.showBillingProgramInformationDialogAndroid(
        const types.BillingProgramInformationDialogParamsAndroid(
          billingProgram: types.BillingProgramAndroid.BillingChoice,
          externalTransactionToken: 'choice-token',
        ),
      );

      expect(result.responseCode, 0);
      expect(
        result.subResponseCode,
        types.SubResponseCodeAndroid.NoApplicableSubResponseCode,
      );
      final call = calls.singleWhere(
        (MethodCall call) =>
            call.method == 'showBillingProgramInformationDialogAndroid',
      );
      expect(call.arguments, <String, dynamic>{
        'billingProgram': 'billing-choice',
        'externalTransactionToken': 'choice-token',
      });
    });

    test('showInAppMessagesAndroid returns response code', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'showInAppMessagesAndroid') {
          return jsonEncode(<String, dynamic>{
            'responseCode': 'subscription-status-updated',
            'purchaseToken': 'purchase-token',
          });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.showInAppMessagesAndroid(
        const types.InAppMessageParamsAndroid(
          categories: <types.InAppMessageCategoryAndroid>[
            types.InAppMessageCategoryAndroid.Transactional,
          ],
        ),
      );

      expect(
        result.responseCode,
        types.InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated,
      );
      expect(result.purchaseToken, 'purchase-token');
      final call = calls.singleWhere(
        (MethodCall call) => call.method == 'showInAppMessagesAndroid',
      );
      expect(call.arguments, <String, dynamic>{
        'categories': <String>['transactional'],
      });
    });

    test(
      'initConnection passes enableBillingProgramAndroid to native channel',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection(
          billingChoiceScreenTypeAndroid:
              types.BillingChoiceScreenTypeAndroid.DeveloperRendered,
          enableBillingProgramAndroid:
              types.BillingProgramAndroid.BillingChoice,
        );

        final call = calls.singleWhere(
          (MethodCall call) => call.method == 'initConnection',
        );
        final args = call.arguments as Map<dynamic, dynamic>?;
        expect(args, isNotNull);
        expect(args!['billingChoiceScreenTypeAndroid'], 'developer-rendered');
        expect(args['enableBillingProgramAndroid'], 'billing-choice');
      },
    );

    test(
      'isBillingProgramAvailableAndroid handles ExternalPayments program',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'isBillingProgramAvailableAndroid') {
            return jsonEncode(<String, dynamic>{
              'billingProgram': 'external-payments',
              'isAvailable': true,
            });
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        final result = await iap.isBillingProgramAvailableAndroid(
          types.BillingProgramAndroid.ExternalPayments,
        );

        expect(
          result.billingProgram,
          types.BillingProgramAndroid.ExternalPayments,
        );
        expect(result.isAvailable, isTrue);

        final call = calls.singleWhere(
          (MethodCall call) =>
              call.method == 'isBillingProgramAvailableAndroid',
        );
        expect(call.arguments, <String, dynamic>{
          'program': 'external-payments',
        });
      },
    );

    test(
      'isBillingProgramAvailableAndroid handles UserChoiceBilling program',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'isBillingProgramAvailableAndroid') {
            return jsonEncode(<String, dynamic>{
              'billingProgram': 'user-choice-billing',
              'isAvailable': true,
            });
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        final result = await iap.isBillingProgramAvailableAndroid(
          types.BillingProgramAndroid.UserChoiceBilling,
        );

        expect(
          result.billingProgram,
          types.BillingProgramAndroid.UserChoiceBilling,
        );
        expect(result.isAvailable, isTrue);

        final call = calls.singleWhere(
          (MethodCall call) =>
              call.method == 'isBillingProgramAvailableAndroid',
        );
        expect(call.arguments, <String, dynamic>{
          'program': 'user-choice-billing',
        });
      },
    );

    test(
      'initConnection passes enableBillingProgramAndroid UserChoiceBilling',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection(
          enableBillingProgramAndroid:
              types.BillingProgramAndroid.UserChoiceBilling,
        );

        final call = calls.singleWhere(
          (MethodCall call) => call.method == 'initConnection',
        );
        final args = call.arguments as Map<dynamic, dynamic>?;
        expect(args, isNotNull);
        expect(args!['enableBillingProgramAndroid'], 'user-choice-billing');
      },
    );
  });

  group('launchExternalLinkAndroid', () {
    test('sends correct payload to native channel', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'launchExternalLinkAndroid') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      const params = types.LaunchExternalLinkParamsAndroid(
        billingProgram: types.BillingProgramAndroid.BillingChoice,
        externalTransactionToken: 'external-token',
        launchMode:
            types.ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        linkType: types.ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        linkUri: 'https://example.com/offer',
      );

      final result = await iap.launchExternalLinkAndroid(params);
      expect(result, isTrue);

      final methodCall = calls.singleWhere(
        (MethodCall call) => call.method == 'launchExternalLinkAndroid',
      );
      final payload = Map<String, dynamic>.from(
        methodCall.arguments as Map<dynamic, dynamic>,
      );
      expect(payload, params.toJson());
      expect(payload['externalTransactionToken'], 'external-token');
    });
  });

  group('openRedeemOfferCodeAndroid', () {
    test('invokes native channel and returns true', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'openRedeemOfferCodeAndroid') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.openRedeemOfferCodeAndroid();
      expect(result, isTrue);

      final methodCall = calls.singleWhere(
        (MethodCall call) => call.method == 'openRedeemOfferCodeAndroid',
      );
      expect(methodCall.arguments, isNull);
    });

    test('returns false when native side responds with null', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final result = await iap.openRedeemOfferCodeAndroid();
      expect(result, isFalse);
    });

    test('rethrows errors from the native channel', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        throw PlatformException(code: 'E_UNKNOWN', message: 'boom');
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        iap.openRedeemOfferCodeAndroid(),
        throwsA(isA<PlatformException>()),
      );
    });

    test('throws PurchaseError with IapNotAvailable on iOS', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(
        iap.openRedeemOfferCodeAndroid(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.IapNotAvailable,
          ),
        ),
      );
    });
  });

  group('deepLinkToSubscriptions', () {
    test('sends Android payload to native channel', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'deepLinkToSubscriptionsAndroid') {
          return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.deepLinkToSubscriptions(
        packageNameAndroid: 'dev.hyo.martie',
        skuAndroid: 'sub.premium',
      );

      final methodCall = calls.singleWhere(
        (MethodCall call) => call.method == 'deepLinkToSubscriptionsAndroid',
      );
      final payload = Map<String, dynamic>.from(
        methodCall.arguments as Map<dynamic, dynamic>,
      );
      expect(payload['packageNameAndroid'], 'dev.hyo.martie');
      expect(payload['skuAndroid'], 'sub.premium');
      expect(payload.containsKey('packageName'), isFalse);
      expect(payload.containsKey('sku'), isFalse);
    });

    test('uses Apple channel method on iOS', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'deepLinkToSubscriptions') {
          return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.deepLinkToSubscriptions();
      expect(calls.single.method, 'deepLinkToSubscriptions');
    });

    test('throws PurchaseError on unsupported platforms', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'linux'),
      );

      await expectLater(
        iap.deepLinkToSubscriptions(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.IapNotAvailable,
          ),
        ),
      );
    });
  });

  group('requestPurchase', () {
    test('throws when connection not initialized', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(
        iap.requestPurchase(
          const types.RequestPurchaseProps.inApp((
            apple: types.RequestPurchaseIosProps(sku: 'demo.sku'),
            google: null,
          )),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    test('sends expected payload for iOS purchases', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'requestPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      const props = types.RequestPurchaseProps.inApp((
        apple: types.RequestPurchaseIosProps(
          sku: 'ios.sku',
          appAccountToken: 'app-token',
          quantity: 3,
          andDangerouslyFinishTransactionAutomatically: null,
          withOffer: types.DiscountOfferInputIOS(
            identifier: 'offer-id',
            keyIdentifier: 'key-id',
            nonce: 'nonce',
            signature: 'signature',
            timestamp: 123456.0,
          ),
        ),
        google: null,
      ));

      await iap.requestPurchase(props);

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['sku'], 'ios.sku');
      expect(payload['type'], 'in-app');
      expect(payload['appAccountToken'], 'app-token');
      expect(payload['quantity'], 3);
      expect(payload['andDangerouslyFinishTransactionAutomatically'], isFalse);
      final offer = Map<String, dynamic>.from(
        payload['withOffer'] as Map<dynamic, dynamic>,
      );
      expect(offer['identifier'], 'offer-id');
      expect(offer['keyIdentifier'], 'key-id');
      expect(offer['nonce'], 'nonce');
      expect(offer['signature'], 'signature');
      expect(offer['timestamp'], 123456.0);
    });

    test('sends advancedCommerceData in iOS purchase payload', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'requestPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      const props = types.RequestPurchaseProps.inApp((
        apple: types.RequestPurchaseIosProps(
          sku: 'ios.sku',
          advancedCommerceData: 'campaign_summer_2025',
        ),
        google: null,
      ));

      await iap.requestPurchase(props);

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['sku'], 'ios.sku');
      expect(payload['advancedCommerceData'], 'campaign_summer_2025');
    });

    test('sends advanced iOS subscription purchase fields', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'requestPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      const props = types.RequestPurchaseProps.subs((
        apple: types.RequestSubscriptionIosProps(
          sku: 'ios.sub',
          billingPlanType: types.SubscriptionBillingPlanTypeIOS.Monthly,
          compactJWS: 'intro-eligibility-jws',
          promotionalOfferJWS: types.PromotionalOfferJWSInputIOS(
            offerId: 'promo-offer',
            jws: 'header.payload.signature',
          ),
          winBackOffer: types.WinBackOfferInputIOS(
            offerId: 'winback-offer',
          ),
        ),
        google: null,
      ));

      await iap.requestPurchase(props);

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['sku'], 'ios.sub');
      expect(payload['type'], 'subs');
      expect(payload['billingPlanType'], 'monthly');
      expect(payload['compactJWS'], 'intro-eligibility-jws');
      final promotionalOfferJWS = Map<String, dynamic>.from(
        payload['promotionalOfferJWS'] as Map<dynamic, dynamic>,
      );
      expect(promotionalOfferJWS['offerId'], 'promo-offer');
      expect(promotionalOfferJWS['jws'], 'header.payload.signature');
      final winBackOffer = Map<String, dynamic>.from(
        payload['winBackOffer'] as Map<dynamic, dynamic>,
      );
      expect(winBackOffer['offerId'], 'winback-offer');
    });

    test('initConnection memoizes after first call', () async {
      int initCount = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          initCount += 1;
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.initConnection(), isTrue);
      expect(await iap.initConnection(), isTrue);
      expect(initCount, 1);
    });

    test('endConnection forwards to native channel when initialized', () async {
      int endCount = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'endConnection':
            endCount += 1;
            return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.initConnection(), isTrue);
      expect(await iap.endConnection(), isTrue);
      expect(endCount, 1);
    });

    test('endConnection returns false when not initialized', () async {
      bool endCalled = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'endConnection') {
          endCalled = true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.endConnection(), isFalse);
      expect(endCalled, isFalse);
    });

    test(
      'initConnection wraps platform exception with PurchaseError',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          if (call.method == 'initConnection') {
            throw PlatformException(
              code: 'not-prepared',
              message: 'boom',
            );
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await expectLater(
          iap.initConnection(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              types.ErrorCode.NotPrepared,
            ),
          ),
        );
      },
    );

    test(
      'endConnection throws PurchaseError when native layer fails',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          if (call.method == 'initConnection') {
            return true;
          }
          if (call.method == 'endConnection') {
            throw PlatformException(
              code: 'service-error',
              message: 'end failed',
            );
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        expect(await iap.initConnection(), isTrue);
        await expectLater(
          iap.endConnection(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              types.ErrorCode.ServiceError,
            ),
          ),
        );
      },
    );

    // Note: Android subscription proration (purchaseTokenAndroid, replacementModeAndroid)
    // is not supported in RequestPurchaseAndroidProps. These fields only exist in
    // RequestSubscriptionAndroidProps which is used in specialized subscription APIs.
    test('sends subscription request without proration fields', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'requestPurchase') {
          return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      const props = types.RequestPurchaseProps.subs((
        apple: null,
        google: types.RequestSubscriptionAndroidProps(
          skus: <String>['sub.premium'],
        ),
      ));

      await iap.requestPurchase(props);

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['type'], 'subs');
      expect(payload['productId'], 'sub.premium');
      expect(payload['skus'], <String>['sub.premium']);
      // Proration fields should not be present
      expect(payload.containsKey('purchaseToken'), isFalse);
      expect(payload.containsKey('replacementMode'), isFalse);
    });

    test('sends expected payload for Android subscriptions', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'requestPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      const props = types.RequestPurchaseProps.subs((
        apple: null,
        google: types.RequestSubscriptionAndroidProps(
          skus: <String>['sub.premium'],
          isOfferPersonalized: true,
          obfuscatedAccountId: 'acc-id',
          obfuscatedProfileId: 'profile-id',
        ),
      ));

      await iap.requestPurchase(props);

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['type'], 'subs');
      expect(payload['productId'], 'sub.premium');
      expect(payload['skus'], <String>['sub.premium']);
      expect(payload['isOfferPersonalized'], isTrue);
      expect(payload['obfuscatedAccountId'], 'acc-id');
      expect(payload['obfuscatedProfileId'], 'profile-id');
      // Note: purchaseToken, replacementMode, and subscriptionOffers
      // are not in RequestPurchaseAndroidProps
      // They only exist in RequestSubscriptionAndroidProps
      expect(payload.containsKey('purchaseToken'), isFalse);
      expect(payload.containsKey('replacementMode'), isFalse);
      expect(payload.containsKey('subscriptionOffers'), isFalse);
    });

    test(
      'forwards subscriptionProductReplacementParams on Android subscription',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          switch (call.method) {
            case 'initConnection':
              return true;
            case 'requestPurchase':
              return null;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection();

        const props = types.RequestPurchaseProps.subs((
          apple: null,
          google: types.RequestSubscriptionAndroidProps(
            skus: <String>['sub.premium'],
            subscriptionProductReplacementParams:
                types.SubscriptionProductReplacementParamsAndroid(
              oldProductId: 'sub.premium',
              replacementMode:
                  types.SubscriptionReplacementModeAndroid.ChargeFullPrice,
            ),
          ),
        ));

        await iap.requestPurchase(props);

        final requestCall = calls.singleWhere(
          (MethodCall c) => c.method == 'requestPurchase',
        );
        final payload = Map<String, dynamic>.from(
          requestCall.arguments as Map<dynamic, dynamic>,
        );

        expect(payload.containsKey('subscriptionProductReplacementParams'),
            isTrue);
        final replacement = Map<String, dynamic>.from(
          payload['subscriptionProductReplacementParams']
              as Map<dynamic, dynamic>,
        );
        expect(replacement['oldProductId'], 'sub.premium');
        expect(replacement['replacementMode'], 'charge-full-price');
      },
    );

    test(
      'sends minimal in-app Billing Choice option on Android',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          switch (call.method) {
            case 'initConnection':
              return true;
            case 'requestPurchase':
              return null;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection();

        const props = types.RequestPurchaseProps.inApp((
          apple: null,
          google: types.RequestPurchaseAndroidProps(
            skus: <String>['product.premium'],
            developerBillingOption: types.DeveloperBillingOptionParamsAndroid(
              billingProgram: types.BillingProgramAndroid.BillingChoice,
            ),
          ),
        ));

        await iap.requestPurchase(props);

        final requestCall = calls.singleWhere(
          (MethodCall c) => c.method == 'requestPurchase',
        );
        final payload = Map<String, dynamic>.from(
          requestCall.arguments as Map<dynamic, dynamic>,
        );

        expect(payload['type'], 'in-app');
        expect(payload['skus'], <String>['product.premium']);
        expect(payload.containsKey('developerBillingOption'), isTrue);

        final developerBillingOption = Map<String, dynamic>.from(
          payload['developerBillingOption'] as Map<dynamic, dynamic>,
        );
        expect(developerBillingOption['billingProgram'], 'billing-choice');
        expect(developerBillingOption['launchMode'], isNull);
        expect(developerBillingOption['linkUri'], isNull);
      },
    );

    test(
      'sends Billing Choice fields on Android subscription',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          switch (call.method) {
            case 'initConnection':
              return true;
            case 'requestPurchase':
              return null;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection();

        const props = types.RequestPurchaseProps.subs((
          apple: null,
          google: types.RequestSubscriptionAndroidProps(
            skus: <String>['sub.premium.monthly'],
            originalExternalTransactionId: 'original-external-id',
            developerBillingOption: types.DeveloperBillingOptionParamsAndroid(
              billingProgram: types.BillingProgramAndroid.BillingChoice,
              externalTransactionToken: 'pre-generated-token',
              launchMode:
                  types.DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
              linkUri: 'https://example.com/subscribe',
            ),
            subscriptionOffers: [
              types.AndroidSubscriptionOfferInput(
                sku: 'sub.premium.monthly',
                offerToken: 'monthly-intro-offer-token',
              ),
            ],
          ),
        ));

        await iap.requestPurchase(props);

        final requestCall = calls.singleWhere(
          (MethodCall c) => c.method == 'requestPurchase',
        );
        final payload = Map<String, dynamic>.from(
          requestCall.arguments as Map<dynamic, dynamic>,
        );

        expect(payload['type'], 'subs');
        expect(payload['skus'], <String>['sub.premium.monthly']);
        expect(payload.containsKey('useAlternativeBilling'), isFalse);
        expect(
            payload['originalExternalTransactionId'], 'original-external-id');
        expect(payload.containsKey('developerBillingOption'), isTrue);

        final developerBillingOption = Map<String, dynamic>.from(
          payload['developerBillingOption'] as Map<dynamic, dynamic>,
        );
        expect(developerBillingOption['billingProgram'], 'billing-choice');
        expect(
          developerBillingOption['externalTransactionToken'],
          'pre-generated-token',
        );
        expect(developerBillingOption['launchMode'], 'caller-will-launch-link');
        expect(
          developerBillingOption['linkUri'],
          'https://example.com/subscribe',
        );

        // Verify subscription offers are included
        expect(payload.containsKey('subscriptionOffers'), isTrue);
        final offers = payload['subscriptionOffers'] as List;
        expect(offers.length, 1);
      },
    );

    test(
      'sends developerBillingOption with CallerWillLaunchLink mode',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          switch (call.method) {
            case 'initConnection':
              return true;
            case 'requestPurchase':
              return null;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        await iap.initConnection();

        const props = types.RequestPurchaseProps.inApp((
          apple: null,
          google: types.RequestPurchaseAndroidProps(
            skus: <String>['product.coins'],
            developerBillingOption: types.DeveloperBillingOptionParamsAndroid(
              billingProgram: types.BillingProgramAndroid.ExternalPayments,
              launchMode:
                  types.DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
              linkUri: 'https://example.com/buy-coins',
            ),
          ),
        ));

        await iap.requestPurchase(props);

        final requestCall = calls.singleWhere(
          (MethodCall c) => c.method == 'requestPurchase',
        );
        final payload = Map<String, dynamic>.from(
          requestCall.arguments as Map<dynamic, dynamic>,
        );

        final developerBillingOption = Map<String, dynamic>.from(
          payload['developerBillingOption'] as Map<dynamic, dynamic>,
        );
        expect(developerBillingOption['launchMode'], 'caller-will-launch-link');
      },
    );
  });

  group('requestPurchase validation', () {
    test('throws developer error when iOS props missing', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'requestPurchase') {
          fail(
            'requestPurchase should not be invoked when payload is invalid',
          );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        () => iap.requestPurchase(
          const types.RequestPurchaseProps.inApp((
            apple: null,
            google: types.RequestPurchaseAndroidProps(
              skus: <String>['android-only'],
            ),
          )),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.DeveloperError,
          ),
        ),
      );
    });

    test('throws when platform is not supported', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'requestPurchase') {
          fail(
            'requestPurchase should not reach native layer on unsupported platforms',
          );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'linux'),
      );

      await iap.initConnection();

      await expectLater(
        () => iap.requestPurchase(
          const types.RequestPurchaseProps.inApp((
            apple: types.RequestPurchaseIosProps(sku: 'ignored'),
            google: null,
          )),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.IapNotAvailable,
          ),
        ),
      );
    });
  });

  group('requestPurchase Android in-app', () {
    test('sends payload including obfuscated identifiers', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'requestPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      await iap.requestPurchase(
        const types.RequestPurchaseProps.inApp((
          apple: null,
          google: types.RequestPurchaseAndroidProps(
            skus: <String>['coin.pack'],
            isOfferPersonalized: true,
            obfuscatedAccountId: 'account-1',
            obfuscatedProfileId: 'profile-1',
            offerToken: 'one-time-offer-token',
          ),
        )),
      );

      final requestCall = calls.singleWhere(
        (MethodCall c) => c.method == 'requestPurchase',
      );
      final payload = Map<String, dynamic>.from(
        requestCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['type'], 'in-app');
      expect(payload['productId'], 'coin.pack');
      expect(payload['skus'], <String>['coin.pack']);
      expect(payload['isOfferPersonalized'], isTrue);
      expect(payload['obfuscatedAccountId'], 'account-1');
      expect(payload['obfuscatedProfileId'], 'profile-1');
      expect(payload['offerToken'], 'one-time-offer-token');
      expect(payload.containsKey('purchaseToken'), isFalse);
    });
  });

  group('getAvailablePurchases', () {
    test(
      'forwards iOS options and rejects a partially malformed batch',
      () async {
        final capturedArguments = <dynamic>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          switch (call.method) {
            case 'initConnection':
              return true;
            case 'getAvailableItems':
              capturedArguments.add(call.arguments);
              return <Map<String, dynamic>>[
                <String, dynamic>{
                  'platform': 'ios',
                  'store': 'apple',
                  'id': 'txn-123',
                  'productId': 'iap.premium',
                  'transactionId': 'txn-123',
                  'purchaseToken': 'receipt-data',
                  'purchaseState': 'PURCHASED',
                  'transactionDate': 1700000000000,
                },
                <String, dynamic>{
                  'platform': 'ios',
                  'store': 'apple',
                  'productId': '',
                  'transactionId': null,
                },
              ];
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await iap.initConnection();

        await expectLater(
          () => iap.getAvailablePurchases(
            onlyIncludeActiveItemsIOS: false,
            alsoPublishToEventListenerIOS: true,
          ),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              types.ErrorCode.BillingResponseJsonParseError,
            ),
          ),
        );

        final args = Map<String, dynamic>.from(
          capturedArguments.single as Map<dynamic, dynamic>,
        );

        expect(args['onlyIncludeActiveItemsIOS'], isFalse);
        expect(args['alsoPublishToEventListenerIOS'], isTrue);
      },
    );

    test('preserves an explicit empty purchase list', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'getAvailableItems') {
          return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();

      await expectLater(iap.getAvailablePurchases(), completion(isEmpty));
    });

    // The rejection cases above only prove a malformed batch throws. These
    // assert the inverse: a complete native payload must still be accepted, so
    // a stricter decoder cannot silently break getAvailablePurchases for every
    // user of a store that does populate every required field.
    for (final testCase in <({String os, String store, String id})>[
      (os: 'ios', store: 'apple', id: 'txn-complete-1'),
      (os: 'android', store: 'google', id: 'gpa-complete-1'),
    ]) {
      test(
        'accepts a complete ${testCase.store} purchase payload',
        () async {
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
              .setMockMethodCallHandler(channel, (MethodCall call) async {
            switch (call.method) {
              case 'initConnection':
                return true;
              case 'getAvailableItems':
                return <Map<String, dynamic>>[
                  <String, dynamic>{
                    'platform': testCase.os,
                    'store': testCase.store,
                    'id': testCase.id,
                    'productId': 'iap.premium',
                    'transactionId': testCase.id,
                    'purchaseToken': 'token-data',
                    'purchaseState': 'PURCHASED',
                    'transactionDate': 1700000000000,
                    'quantity': 1,
                    'isAutoRenewing': false,
                  },
                ];
            }
            return null;
          });

          final iap = FlutterInappPurchase.private(
            FakePlatform(operatingSystem: testCase.os),
          );
          await iap.initConnection();

          final purchases = await iap.getAvailablePurchases();

          expect(purchases, hasLength(1));
          expect(purchases.single.productId, 'iap.premium');
          expect(purchases.single.id, testCase.id);
        },
      );
    }

    for (final testCase in <({String os, String foreignStore})>[
      (os: 'ios', foreignStore: 'google'),
      (os: 'android', foreignStore: 'apple'),
    ]) {
      test('rejects a foreign store in the ${testCase.os} purchase list',
          () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          if (call.method == 'initConnection') return true;
          if (call.method == 'getAvailableItems') {
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'foreign',
                'productId': 'premium',
                'transactionId': 'foreign',
                'transactionDate': 1700000000000,
                'store': testCase.foreignStore,
                'quantity': 1,
                'purchaseState': 'purchased',
                'isAutoRenewing': false,
              },
            ];
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: testCase.os),
        );
        await iap.initConnection();

        await expectLater(
          () => iap.getAvailablePurchases(),
          throwsA(
            isA<PurchaseError>().having(
              (error) => error.code,
              'code',
              types.ErrorCode.BillingResponseJsonParseError,
            ),
          ),
        );
      });
    }

    test('throws when connection is not initialized', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await expectLater(
        () => iap.getAvailablePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    test('rejects Android batches with missing purchase identifiers', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'getAvailableItems':
            return <Map<String, dynamic>>[
              <String, dynamic>{
                'platform': 'android',
                'store': 'google',
                'id': 'txn-android',
                'productId': 'coins.100',
                'transactionId': 'txn-android',
                'purchaseToken': 'token-android',
                'purchaseState': 'purchased',
                'dataAndroid': '{"orderId":"order-android"}',
                'currentPlanId': 'base-plan',
                'isSuspendedAndroid': true,
                'pendingPurchaseUpdateAndroid': <String, dynamic>{
                  'products': <String>['coins.200'],
                  'purchaseToken': 'pending-token',
                },
              },
              <String, dynamic>{
                'platform': 'android',
                'store': 'google',
                'productId': '',
              },
            ];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      await expectLater(
        () => iap.getAvailablePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.BillingResponseJsonParseError,
          ),
        ),
      );
    });

    test('wraps native errors as PurchaseError', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'getAvailableItems') {
          throw PlatformException(
            code: 'E_SERVICE_ERROR',
            message: 'failure',
          );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      await expectLater(
        iap.getAvailablePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.ServiceError,
          ),
        ),
      );
    });
  });

  group('method channel listeners', () {
    test('purchase-updated preserves canonical Android payload fields',
        () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      final purchaseFuture = iap.purchaseUpdatedListener.first;

      await iap.initConnection();

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(
          MethodCall(
            'purchase-updated',
            jsonEncode(<String, dynamic>{
              'platform': 'android',
              'store': 'google',
              'id': 'txn-listener-android',
              'productId': 'premium_monthly',
              'transactionId': 'txn-listener-android',
              'purchaseState': 'purchased',
              'purchaseToken': 'token-listener-android',
              'transactionDate': 1700000000000,
              'dataAndroid': '{"orderId":"listener-order"}',
              'currentPlanId': 'listener-base-plan',
              'isSuspendedAndroid': true,
              'pendingPurchaseUpdateAndroid': <String, dynamic>{
                'products': <String>['premium_yearly'],
                'purchaseToken': 'listener-pending-token',
              },
            }),
          ),
        ),
        (_) {},
      );

      final purchase = await purchaseFuture.timeout(const Duration(seconds: 1))
          as types.PurchaseAndroid;
      expect(purchase.dataAndroid, '{"orderId":"listener-order"}');
      expect(purchase.currentPlanId, 'listener-base-plan');
      expect(purchase.isSuspendedAndroid, isTrue);
      expect(
        purchase.pendingPurchaseUpdateAndroid?.purchaseToken,
        'listener-pending-token',
      );
    });

    test('purchase-updated emits events on the canonical stream', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      final listenerFuture = iap.purchaseUpdatedListener.first;

      await iap.initConnection();

      final purchasePayload = <String, dynamic>{
        'platform': 'ios',
        'store': 'apple',
        'id': 'txn-456',
        'productId': 'iap.premium',
        'transactionId': 'txn-456',
        'purchaseState': 'PURCHASED',
        'purchaseToken': 'receipt-data',
        'transactionDate': 1700000000000,
      };

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(
          MethodCall('purchase-updated', jsonEncode(purchasePayload)),
        ),
        (_) {},
      );

      final listenerPurchase = await listenerFuture;

      expect(listenerPurchase.productId, 'iap.premium');
    });

    test(
      'default purchase listener filters replays while non-deduping listener receives them',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );
        final defaultPurchases = <types.Purchase>[];
        final nonDedupingPurchases = <types.Purchase>[];

        await iap.initConnection();
        final defaultSub = iap.purchaseUpdatedListener.listen(
          defaultPurchases.add,
        );
        final nonDedupingSub = iap
            .purchaseUpdatedListenerWithOptions(
              const types.PurchaseUpdatedListenerOptions(
                dedupeTransactionIOS: false,
              ),
            )
            .listen(nonDedupingPurchases.add);
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        final purchasePayload = <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'id': 'txn-dedupe-replay',
          'productId': 'iap.premium',
          'transactionId': 'txn-dedupe-replay',
          'purchaseState': 'PURCHASED',
          'purchaseToken': 'receipt-data',
          'transactionDate': 1700000000000,
        };

        for (var i = 0; i < 2; i += 1) {
          await TestDefaultBinaryMessengerBinding
              .instance.defaultBinaryMessenger
              .handlePlatformMessage(
            channel.name,
            codec.encodeMethodCall(
              MethodCall('purchase-updated', jsonEncode(purchasePayload)),
            ),
            (_) {},
          );
        }
        await Future<void>.delayed(Duration.zero);

        expect(defaultPurchases, hasLength(1));
        expect(nonDedupingPurchases, hasLength(2));

        await defaultSub.cancel();
        await nonDedupingSub.cancel();
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        final optionCalls = calls
            .where((call) => call.method == 'setPurchaseUpdatedListenerOptions')
            .toList();
        expect(optionCalls.map((call) => call.arguments), <Object?>[
          <String, dynamic>{'dedupeTransactionIOS': false},
          <String, dynamic>{'dedupeTransactionIOS': true},
        ]);
      },
    );

    test(
      'resets native dedupe option after last non-deduping iOS listener cancels',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await iap.initConnection();
        final firstSub = iap
            .purchaseUpdatedListenerWithOptions(
              const types.PurchaseUpdatedListenerOptions(
                dedupeTransactionIOS: false,
              ),
            )
            .listen((_) {});
        final secondSub = iap
            .purchaseUpdatedListenerWithOptions(
              const types.PurchaseUpdatedListenerOptions(
                dedupeTransactionIOS: false,
              ),
            )
            .listen((_) {});
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        await firstSub.cancel();
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);
        var optionCalls = calls
            .where((call) => call.method == 'setPurchaseUpdatedListenerOptions')
            .toList();
        expect(optionCalls.map((call) => call.arguments), <Object?>[
          <String, dynamic>{'dedupeTransactionIOS': false},
        ]);

        await secondSub.cancel();
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);
        optionCalls = calls
            .where((call) => call.method == 'setPurchaseUpdatedListenerOptions')
            .toList();
        expect(optionCalls.map((call) => call.arguments), <Object?>[
          <String, dynamic>{'dedupeTransactionIOS': false},
          <String, dynamic>{'dedupeTransactionIOS': true},
        ]);
      },
    );

    test(
      'subscriptionHandlers.purchaseUpdated honors non-deduping iOS option',
      () async {
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          calls.add(call);
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'ios'),
        );

        await iap.initConnection();
        final defaultSub = iap.purchaseUpdatedListener.listen((_) {});
        await Future<void>.delayed(Duration.zero);

        final purchasePayload = <String, dynamic>{
          'platform': 'ios',
          'store': 'apple',
          'id': 'txn-handler-dedupe-replay',
          'productId': 'iap.premium',
          'transactionId': 'txn-handler-dedupe-replay',
          'purchaseState': 'PURCHASED',
          'purchaseToken': 'receipt-data',
          'transactionDate': 1700000000000,
        };

        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(
          channel.name,
          codec.encodeMethodCall(
            MethodCall('purchase-updated', jsonEncode(purchasePayload)),
          ),
          (_) {},
        );

        final future = iap.subscriptionHandlers.purchaseUpdated!(
          dedupeTransactionIOS: false,
        );
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(
          channel.name,
          codec.encodeMethodCall(
            MethodCall('purchase-updated', jsonEncode(purchasePayload)),
          ),
          (_) {},
        );

        final purchase = await future.timeout(const Duration(seconds: 1));
        expect(purchase.id, 'txn-handler-dedupe-replay');
        final optionCalls = calls
            .where((call) => call.method == 'setPurchaseUpdatedListenerOptions')
            .toList();
        expect(optionCalls.map((call) => call.arguments), <Object?>[
          <String, dynamic>{'dedupeTransactionIOS': false},
          <String, dynamic>{'dedupeTransactionIOS': true},
        ]);

        await defaultSub.cancel();
      },
    );

    test('purchase-error emits results to the canonical error stream',
        () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      final listenerErrorFuture = iap.purchaseErrorListener.first;

      await iap.initConnection();

      final errorPayload = <String, dynamic>{
        'responseCode': 5,
        'debugMessage': 'Billing response rejected the selected offer',
        'code': 'developer-error',
        'message': 'Validation failed',
        'productId': 'premium-monthly',
        'productIds': <String>['premium-monthly', 'premium-yearly'],
        'productType': 'subs',
        'isEmptyProductList': false,
        'subResponseCodeAndroid': 'user-ineligible',
      };

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(
          MethodCall('purchase-error', jsonEncode(errorPayload)),
        ),
        (_) {},
      );

      final listenerError = await listenerErrorFuture;

      expect(listenerError.code, types.ErrorCode.DeveloperError);
      expect(listenerError.message, 'Validation failed');
      expect(listenerError.responseCode, 5);
      expect(
        listenerError.debugMessage,
        'Billing response rejected the selected offer',
      );
      expect(listenerError.productId, 'premium-monthly');
      expect(
        listenerError.productIds,
        <String>['premium-monthly', 'premium-yearly'],
      );
      expect(listenerError.productType, 'subs');
      expect(listenerError.isEmptyProductList, isFalse);
      expect(
        listenerError.subResponseCodeAndroid,
        types.SubResponseCodeAndroid.UserIneligible,
      );
    });

    test('iap-promoted-product emits the productId', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      final promotedFuture = iap.purchasePromoted.first;

      await iap.initConnection();

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channel.name,
        codec.encodeMethodCall(
          const MethodCall('iap-promoted-product', 'promo.product'),
        ),
        (_) {},
      );

      final productId = await promotedFuture;
      expect(productId, 'promo.product');
    });

    test(
      'developer-provided-billing-android emits details to stream',
      () async {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (MethodCall call) async {
          if (call.method == 'initConnection') {
            return true;
          }
          return null;
        });

        final iap = FlutterInappPurchase.private(
          FakePlatform(operatingSystem: 'android'),
        );

        final developerBillingFuture =
            iap.developerProvidedBillingAndroid.first;

        await iap.initConnection();

        final payload = <String, dynamic>{
          'externalTransactionToken': null,
          'linkUri': 'https://example.com/checkout',
          'originalExternalTransactionId': 'original-external-id',
          'products': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'premium_monthly',
              'type': 'subs',
              'offerToken': 'offer-token',
            },
          ],
        };

        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(
          channel.name,
          codec.encodeMethodCall(
            MethodCall(
              'developer-provided-billing-android',
              jsonEncode(payload),
            ),
          ),
          (_) {},
        );

        final details = await developerBillingFuture;
        expect(details.externalTransactionToken, isNull);
        expect(details.linkUri, 'https://example.com/checkout');
        expect(details.originalExternalTransactionId, 'original-external-id');
        expect(details.products.single.id, 'premium_monthly');
        expect(details.products.single.offerToken, 'offer-token');
      },
    );
  });

  group('sync and restore helpers', () {
    test('restorePurchases triggers sync and fetch on iOS', () async {
      int syncCalls = 0;
      int availableCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'syncIOS':
            syncCalls += 1;
            return true;
          case 'getAvailableItems':
            availableCalls += 1;
            return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.initConnection(), isTrue);
      await iap.restorePurchases();

      expect(syncCalls, 1);
      expect(availableCalls, 1);
    });

    test('restorePurchases triggers sync and fetch on macOS', () async {
      int syncCalls = 0;
      int availableCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'syncIOS':
            syncCalls += 1;
            return true;
          case 'getAvailableItems':
            availableCalls += 1;
            return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );

      expect(await iap.initConnection(), isTrue);
      await iap.restorePurchases();

      expect(syncCalls, 1);
      expect(availableCalls, 1);
    });

    test('restorePurchases propagates sync errors and stops fetching',
        () async {
      int availableCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'syncIOS') {
          throw PlatformException(code: '500', message: 'boom');
        }
        if (call.method == 'getAvailableItems') {
          availableCalls += 1;
          return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.initConnection(), isTrue);
      await expectLater(
        iap.restorePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.message,
            'message',
            contains('sync iOS purchases'),
          ),
        ),
      );

      expect(availableCalls, 0);
    });

    test('restorePurchases rejects an incomplete native sync', () async {
      int availableCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') return true;
        if (call.method == 'syncIOS') return false;
        if (call.method == 'getAvailableItems') {
          availableCalls += 1;
          return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'macos'),
      );
      expect(await iap.initConnection(), isTrue);

      await expectLater(
        iap.restorePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.SyncError,
          ),
        ),
      );
      expect(availableCalls, 0);
    });

    test('restorePurchases fetches purchases directly on Android', () async {
      int availableCalls = 0;
      int endCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') {
          return true;
        }
        if (call.method == 'endConnection') {
          endCalls += 1;
          return true;
        }
        if (call.method == 'getAvailableItems') {
          availableCalls += 1;
          return <Map<String, dynamic>>[];
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await iap.initConnection(), isTrue);
      await iap.restorePurchases();

      expect(availableCalls, 1);
      expect(endCalls, 0);
    });

    test('restorePurchases propagates available-purchase errors', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'initConnection') return true;
        if (call.method == 'getAvailableItems') {
          throw PlatformException(
            code: 'service-error',
            message: 'Store query failed',
          );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      expect(await iap.initConnection(), isTrue);

      await expectLater(
        iap.restorePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.ServiceError,
          ),
        ),
      );
    });

    test('syncIOS returns true when native calls succeed', () async {
      int syncCalls = 0;

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'syncIOS') {
          syncCalls += 1;
          return true;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      expect(await iap.syncIOS(), isTrue);
      expect(syncCalls, 1);
    });

    test('syncIOS wraps platform exceptions as PurchaseError', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'syncIOS') {
          throw PlatformException(code: '500', message: 'boom');
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(iap.syncIOS(), throwsA(isA<PurchaseError>()));
    });

    test('syncIOS returns false on unsupported platforms', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      expect(await iap.syncIOS(), isFalse);
    });
  });

  group('verifyPurchase', () {
    test('throws when connection not initialized', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(
        iap.verifyPurchase(
          apple: const types.VerifyPurchaseAppleOptions(sku: 'test.sku'),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    // IAPKit deploys from main while this build is frozen inside a published
    // app, so a value it adds later must degrade rather than fail a purchase
    // the store already confirmed. `isValid` stays authoritative throughout.
    test('never fails a receipt over metadata this build predates', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'productId': 'premium.monthly',
                'state': 'grace-period',
                'store': 'apple',
                'environment': 'Xcode',
                'clientPayload': {
                  'format': 'yaml',
                  'body': 'tier: gold',
                  'version': 2,
                  'updatedAt': 1720000000000,
                },
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );
      await iap.initConnection();

      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          includeClientPayload: true,
          apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
            jws: 'test-jws-token',
          ),
        ),
      );

      expect(result.iapkit!.isValid, isTrue);
      expect(result.iapkit!.productId, 'premium.monthly');
      // An unknown state degrades to the neutral member, an unknown format
      // drops only the optional payload, and an open-string environment is
      // forwarded untouched.
      expect(result.iapkit!.state, types.IapkitPurchaseState.Unknown);
      expect(result.iapkit!.clientPayload, isNull);
      expect(result.iapkit!.environment, 'Xcode');
    });

    test('sends correct payload for iOS verification', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchase':
            return <Object?, Object?>{
              '__typename': 'VerifyPurchaseResultIOS',
              'isValid': true,
              'jwsRepresentation': 'test-jws-representation',
              'receiptData': 'test-receipt-data',
              'latestTransaction': <Object?, Object?>{
                '__typename': 'PurchaseIOS',
                'id': 'ios-transaction-id',
                'isAutoRenewing': false,
                'platform': 'ios',
                'productId': 'premium.upgrade',
                'purchaseState': 'purchased',
                'quantity': 1,
                'store': 'apple',
                'transactionDate': 1705315800000.0,
                'transactionId': 'ios-transaction-id',
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchase(
        apple: const types.VerifyPurchaseAppleOptions(sku: 'premium.upgrade'),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall c) => c.method == 'verifyPurchase',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['apple'], isNotNull);
      final appleOptions = Map<String, dynamic>.from(
        payload['apple'] as Map<dynamic, dynamic>,
      );
      expect(appleOptions['sku'], 'premium.upgrade');

      expect(result, isA<types.VerifyPurchaseResultIOS>());
      final iosResult = result as types.VerifyPurchaseResultIOS;
      expect(iosResult.isValid, true);
      expect(iosResult.jwsRepresentation, 'test-jws-representation');
      expect(iosResult.latestTransaction?.productId, 'premium.upgrade');
    });

    test('sends correct payload for Android verification', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchase':
            return {
              '__typename': 'VerifyPurchaseResultAndroid',
              'isValid': true,
              'productId': 'premium.upgrade',
              'productType': 'inapp',
              'purchaseDate': 1705315800000.0,
              'autoRenewing': false,
              'betaProduct': false,
              'freeTrialEndDate': 0.0,
              'gracePeriodEndDate': 0.0,
              'parentProductId': '',
              'quantity': 1,
              'receiptId': 'test-receipt-id',
              'renewalDate': 0.0,
              'term': '',
              'termSku': '',
              'testTransaction': false,
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchase(
        google: const types.VerifyPurchaseGoogleOptions(
          sku: 'premium.upgrade',
          accessToken: 'test-access-token',
          packageName: 'com.example.app',
          purchaseToken: 'test-purchase-token',
        ),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall c) => c.method == 'verifyPurchase',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['google'], isNotNull);
      final googleOptions = Map<String, dynamic>.from(
        payload['google'] as Map<dynamic, dynamic>,
      );
      expect(googleOptions['sku'], 'premium.upgrade');
      expect(googleOptions['accessToken'], 'test-access-token');
      expect(googleOptions['packageName'], 'com.example.app');
      expect(googleOptions['purchaseToken'], 'test-purchase-token');

      expect(result, isA<types.VerifyPurchaseResultAndroid>());
      final androidResult = result as types.VerifyPurchaseResultAndroid;
      expect(androidResult.productId, 'premium.upgrade');
      expect(androidResult.productType, 'inapp');
      expect(androidResult.autoRenewing, false);
      expect(androidResult.isValid, isTrue);
    });

    test('sends and parses Horizon verification payloads', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchase':
            return jsonEncode(<String, dynamic>{
              '__typename': 'VerifyPurchaseResultHorizon',
              'grantTime': 1705315800,
              'isValid': true,
              'success': true,
            });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();

      final result = await iap.verifyPurchase(
        horizon: const types.VerifyPurchaseHorizonOptions(
          accessToken: 'test-horizon-access-token',
          sku: 'premium.upgrade',
          userId: 'horizon-user-id',
        ),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall call) => call.method == 'verifyPurchase',
      );
      final payload = normalizeDynamicMap(verifyCall.arguments)!;
      expect(payload['google'], isNull);
      expect(
        payload['horizon'],
        containsPair('accessToken', 'test-horizon-access-token'),
      );
      expect(payload['horizon'], containsPair('sku', 'premium.upgrade'));
      expect(payload['horizon'], containsPair('userId', 'horizon-user-id'));

      expect(result, isA<types.VerifyPurchaseResultHorizon>());
      final horizonResult = result as types.VerifyPurchaseResultHorizon;
      expect(horizonResult.isValid, isTrue);
      expect(horizonResult.success, isTrue);
      expect(horizonResult.grantTime, 1705315800);
    });

    test('throws PurchaseError on platform exception', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchase':
            throw PlatformException(
              code: 'VERIFICATION_FAILED',
              message: 'Purchase verification failed',
            );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        iap.verifyPurchase(
          apple: const types.VerifyPurchaseAppleOptions(sku: 'test.sku'),
        ),
        throwsA(isA<PurchaseError>()),
      );
    });

    test('throws when native returns null', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchase':
            return null;
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        iap.verifyPurchase(
          apple: const types.VerifyPurchaseAppleOptions(sku: 'test.sku'),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.PurchaseVerificationFailed,
          ),
        ),
      );
    });
  });

  group('verifyPurchaseWithProvider', () {
    test('throws when connection not initialized', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            apiKey: 'test-key',
            apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
              jws: 'test-jws',
            ),
          ),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    test('sends correct payload for iOS verification', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'productId': 'premium.monthly',
                'state': 'entitled',
                'store': 'apple',
                'clientPayload': {
                  'format': 'toml',
                  'body': 'tier = "gold"',
                  'version': 2,
                  'updatedAt': 1720000000000,
                },
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          includeClientPayload: true,
          apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
            jws: 'test-jws-token',
          ),
        ),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall c) => c.method == 'verifyPurchaseWithProvider',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['provider'], 'iapkit');
      expect(payload['iapkit'], isNotNull);
      final iapkitPayload = Map<String, dynamic>.from(
        payload['iapkit'] as Map<dynamic, dynamic>,
      );
      expect(iapkitPayload['apiKey'], 'test-api-key');
      expect(iapkitPayload['includeClientPayload'], true);
      expect(iapkitPayload['apple'], isNotNull);
      final applePayload = Map<String, dynamic>.from(
        iapkitPayload['apple'] as Map<dynamic, dynamic>,
      );
      expect(applePayload['jws'], 'test-jws-token');

      expect(result.provider, types.PurchaseVerificationProvider.Iapkit);
      expect(result.iapkit, isNotNull);
      expect(result.iapkit!.isValid, true);
      expect(result.iapkit!.productId, 'premium.monthly');
      expect(result.iapkit!.clientPayload!.format,
          types.IapkitClientPayloadFormat.Toml);
      expect(result.iapkit!.clientPayload!.body, 'tier = "gold"');
      expect(result.iapkit!.state, types.IapkitPurchaseState.Entitled);
      expect(result.iapkit!.store, types.IapStore.Apple);
    });

    test('forwards custom IAPKit baseUrl to the native payload', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'state': 'entitled',
                'store': 'apple',
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
            jws: 'test-jws-token',
          ),
          baseUrl: 'http://127.0.0.1:4174',
        ),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall call) => call.method == 'verifyPurchaseWithProvider',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );
      final iapkitPayload = Map<String, dynamic>.from(
        payload['iapkit'] as Map<dynamic, dynamic>,
      );

      expect(iapkitPayload['baseUrl'], 'http://127.0.0.1:4174');
    });

    test('sends correct payload for Android verification', () async {
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return jsonEncode({
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'state': 'pending-acknowledgment',
                'store': 'google',
              },
            });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          google: types.RequestVerifyPurchaseWithIapkitGoogleProps(
            purchaseToken: 'test-purchase-token',
          ),
        ),
      );

      final verifyCall = calls.singleWhere(
        (MethodCall c) => c.method == 'verifyPurchaseWithProvider',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['provider'], 'iapkit');
      final iapkitPayload = Map<String, dynamic>.from(
        payload['iapkit'] as Map<dynamic, dynamic>,
      );
      expect(iapkitPayload['google'], isNotNull);
      final googlePayload = Map<String, dynamic>.from(
        iapkitPayload['google'] as Map<dynamic, dynamic>,
      );
      expect(googlePayload['purchaseToken'], 'test-purchase-token');

      expect(result.iapkit, isNotNull);
      expect(result.iapkit!.isValid, true);
      expect(
        result.iapkit!.state,
        types.IapkitPurchaseState.PendingAcknowledgment,
      );
      expect(result.iapkit!.store, types.IapStore.Google);
    });

    test('sends Amazon payload and preserves valid environments', () async {
      final calls = <MethodCall>[];
      var environment = 'Sandbox';
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return jsonEncode({
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'state': 'entitled',
                'store': 'amazon',
                'environment': environment,
              },
            });
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();

      const verificationRequest = types.RequestVerifyPurchaseWithIapkitProps(
        apiKey: 'test-api-key',
        amazon: types.RequestVerifyPurchaseWithIapkitAmazonProps(
          expectedProductId: 'dev.hyo.martie.10bulbs',
          receiptId: 'amzn1.receipt.test',
          sandbox: true,
          userId: 'amzn1.account.test',
        ),
      );
      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: verificationRequest,
      );

      final verifyCall = calls.singleWhere(
        (MethodCall c) => c.method == 'verifyPurchaseWithProvider',
      );
      final payload = Map<String, dynamic>.from(
        verifyCall.arguments as Map<dynamic, dynamic>,
      );

      expect(payload['provider'], 'iapkit');
      final iapkitPayload = Map<String, dynamic>.from(
        payload['iapkit'] as Map<dynamic, dynamic>,
      );
      expect(iapkitPayload['amazon'], isNotNull);
      final amazonPayload = Map<String, dynamic>.from(
        iapkitPayload['amazon'] as Map<dynamic, dynamic>,
      );
      expect(amazonPayload['receiptId'], 'amzn1.receipt.test');
      expect(
        amazonPayload['expectedProductId'],
        'dev.hyo.martie.10bulbs',
      );
      expect(amazonPayload['sandbox'], true);
      expect(amazonPayload['userId'], 'amzn1.account.test');

      expect(result.iapkit, isNotNull);
      expect(result.iapkit!.isValid, true);
      expect(result.iapkit!.environment, 'Sandbox');
      expect(result.iapkit!.state, types.IapkitPurchaseState.Entitled);
      expect(result.iapkit!.store, types.IapStore.Amazon);

      environment = 'Production';
      final productionResult = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: verificationRequest,
      );
      expect(productionResult.iapkit!.environment, 'Production');
    });

    test('throws PurchaseError on platform exception', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            throw PlatformException(
              code: 'E_PURCHASE_VERIFICATION_FAILED',
              message: 'Verification failed',
            );
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            apiKey: 'test-key',
            apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
              jws: 'invalid-jws',
            ),
          ),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.PurchaseVerificationFailed,
          ),
        ),
      );
    });

    test('handles null iapkit response', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              // iapkit is null/missing
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
            jws: 'test-jws-token',
          ),
        ),
      );

      expect(result.provider, types.PurchaseVerificationProvider.Iapkit);
      expect(result.iapkit, isNull);
    });

    test('rejects missing provider in response', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'iapkit': {
                'isValid': true,
                'state': 'entitled',
                'store': 'apple',
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            apiKey: 'test-api-key',
            apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
              jws: 'test-jws-token',
            ),
          ),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.PurchaseVerificationFailed,
          ),
        ),
      );
    });

    test('handles errors in response', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'isValid': false,
                'state': 'expired',
                'store': 'apple',
              },
              'errors': [
                {
                  'code': 'INVALID_RECEIPT',
                  'message': 'The receipt is invalid',
                },
                {'code': 'EXPIRED', 'message': 'Subscription has expired'},
              ],
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      final result = await iap.verifyPurchaseWithProvider(
        provider: types.PurchaseVerificationProvider.Iapkit,
        iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
          apiKey: 'test-api-key',
          apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
            jws: 'test-jws-token',
          ),
        ),
      );

      expect(result.provider, types.PurchaseVerificationProvider.Iapkit);
      expect(result.iapkit, isNotNull);
      expect(result.iapkit!.isValid, false);
      expect(result.errors, isNotNull);
      expect(result.errors!.length, 2);
      expect(result.errors![0].code, 'INVALID_RECEIPT');
      expect(result.errors![0].message, 'The receipt is invalid');
      expect(result.errors![1].code, 'EXPIRED');
      expect(result.errors![1].message, 'Subscription has expired');
    });

    test('rejects iapkit as non-Map', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': 'invalid-data', // Not a Map
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            apiKey: 'test-api-key',
            apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
              jws: 'test-jws-token',
            ),
          ),
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            types.ErrorCode.PurchaseVerificationFailed,
          ),
        ),
      );
    });

    test('rejects malformed IAPKit client payload', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'isValid': true,
                'state': 'entitled',
                'store': 'apple',
                'clientPayload': {
                  'format': 'toml',
                  'body': 'tier = "gold"',
                  'version': 1.5,
                  'updatedAt': 1,
                },
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );
      await iap.initConnection();

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            includeClientPayload: true,
            apple: types.RequestVerifyPurchaseWithIapkitAppleProps(
              jws: 'test-jws-token',
            ),
          ),
        ),
        throwsA(isA<PurchaseError>()),
      );
    });

    test('rejects malformed IAPKit environment', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'initConnection':
            return true;
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'environment': true,
                'isValid': true,
                'state': 'entitled',
                'store': 'amazon',
              },
            };
        }
        return null;
      });

      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();

      await expectLater(
        iap.verifyPurchaseWithProvider(
          provider: types.PurchaseVerificationProvider.Iapkit,
          iapkit: const types.RequestVerifyPurchaseWithIapkitProps(
            amazon: types.RequestVerifyPurchaseWithIapkitAmazonProps(
              receiptId: 'amzn1.receipt.test',
            ),
          ),
        ),
        throwsA(isA<PurchaseError>()),
      );
    });
  });
}
