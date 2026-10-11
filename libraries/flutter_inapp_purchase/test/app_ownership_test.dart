import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');
  tearDown(() => TestDefaultBinaryMessengerBinding
      .instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, null));

  test('Android evidence stays unknown and keeps the backend request binding',
      () async {
    const options = types.VerifyAppOwnershipProps(
        google: types.PlayIntegrityParamsAndroid(
            cloudProjectNumber: '123', requestHash: 'digest'));
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'verifyAppOwnership');
      expect(call.arguments, options.toJson());
      return jsonEncode({
        'status': 'unknown',
        'reason': 'backend-verification-required',
        'storeId': 'play',
        'integrityTokenAndroid': 'token'
      });
    });
    final iap =
        FlutterInappPurchase.private(FakePlatform(operatingSystem: 'android'));
    final result = await iap.verifyAppOwnership(google: options.google);
    expect(result.status, types.AppOwnershipStatus.Unknown);
    expect(result.integrityTokenAndroid, 'token');
    expect(result.reason,
        types.AppOwnershipVerificationReason.BackendVerificationRequired);
  });

  test('iOS dictionaries and unsupported states preserve their verdict',
      () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            channel,
            (call) async => {
                  'status': 'unknown',
                  'reason': 'unsupported',
                  'storeId': 'apple'
                });
    final iap =
        FlutterInappPurchase.private(FakePlatform(operatingSystem: 'ios'));
    expect((await iap.queryHandlers.verifyAppOwnership!()).reason,
        types.AppOwnershipVerificationReason.Unsupported);
  });

  test('native failures stay observable', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            channel,
            (call) async => throw PlatformException(
                code: 'developer-error', message: 'Invalid project'));
    final iap =
        FlutterInappPurchase.private(FakePlatform(operatingSystem: 'android'));
    await expectLater(iap.verifyAppOwnership(), throwsA(isA<PurchaseError>()));
  });
}
