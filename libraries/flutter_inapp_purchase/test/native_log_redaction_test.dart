import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('subscription example never logs the offer token value', () {
    final source = File(
      'example/lib/src/screens/subscription_flow_screen.dart',
    ).readAsStringSync();

    expect(source, isNot(contains(r'${selectedOffer.offerToken}')));
    expect(source, isNot(contains(r'${transactionId ??')));
    expect(source, isNot(contains(r'${token ??')));
    expect(source, isNot(contains(r'$masked')));
    expect(source, isNot(contains('t.substring(0')));
    expect(source, isNot(contains(r'Using fake token: $fakeToken')));
    expect(source, isNot(contains("testToken.isEmpty ? 'empty' : testToken")));
    expect(source, isNot(contains(r'${purchase.purchaseToken}')));
    expect(source, isNot(contains(r'$token')));
  });

  test('purchase example never logs a purchase token', () {
    for (final path in [
      'example/lib/src/screens/purchase_flow_screen.dart',
      'example/lib/src/app_purchase_flow.dart',
    ]) {
      final source = File(path).readAsStringSync();

      expect(source, isNot(contains('_formatTokenValue')), reason: path);
      expect(
        source,
        isNot(contains(r'${purchase.purchaseToken}')),
        reason: path,
      );
      expect(source, isNot(contains(r'$jwsOrToken')), reason: path);
    }
  });

  test('Apple native loggers recursively redact sensitive payload keys', () {
    final loggerPaths = [
      'ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapLog.swift',
      'macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapLog.swift',
    ];

    for (final path in loggerPaths) {
      final source = File(path).readAsStringSync();
      expect(source, contains('sanitizeForLogging'));
      expect(source, contains('sensitiveKeyFragments'));
      expect(source, contains('"token"'));
      expect(source, contains('"receipt"'));
      expect(source, contains('"clientpayload"'));
      expect(source, contains('JSONSerialization.jsonObject(with: data)'));
      expect(source, contains('redacted[entry.key] = "hidden"'));
    }
  });

  test('Android custom wire accepts canonical request fields only', () {
    final source = File(
      'android/src/store/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt',
    ).readAsStringSync();

    expect(source, contains('KEY_SKUS'));
    expect(source, contains('KEY_SUBSCRIPTION_OFFERS'));
    expect(source, contains('KEY_SUBSCRIPTION_PRODUCT_REPLACEMENT_PARAMS'));
    for (final removedField in <String>[
      'skuArr',
      'offerTokenArr',
      'obfuscatedAccountIdAndroid',
      'obfuscatedProfileIdAndroid',
      'purchaseTokenAndroid',
      'useAlternativeBilling',
      'alternativeBillingModeAndroid',
    ]) {
      expect(source, isNot(contains(removedField)));
    }
  });
}
