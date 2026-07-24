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
    expect(source, contains('Using configured subscription offer'));
    expect(source, contains('Has transaction ID:'));
    expect(source, contains('Has purchase credential:'));
    expect(source, contains('has purchase credential:'));
  });

  test('purchase example logs token presence instead of its value', () {
    final source = File(
      'example/lib/src/screens/purchase_flow_screen.dart',
    ).readAsStringSync();

    expect(source, isNot(contains('_formatTokenValue')));
    expect(source, isNot(contains(r'${purchase.purchaseToken}')));
    expect(source, isNot(contains(r'$jwsOrToken')));
    expect(source, contains('Has purchase credential:'));
    expect(source, contains('Has verification credential:'));
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
      expect(
        source,
        contains('private static var emittedDeprecations = Set<String>()'),
      );
      expect(
        source,
        contains('let inserted = emittedDeprecations.insert(key).inserted'),
      );
      expect(
        source,
        contains('guard inserted else { return }'),
      );
    }
  });

  test('Android custom wire fallbacks remain warning-aware and canonical-first',
      () {
    final source = File(
      'android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt',
    ).readAsStringSync();

    expect(source, contains('if (params.containsKey(canonicalKey))'));
    expect(
      source,
      contains('resolveCanonicalOrLegacy("skus", "skuArr")'),
    );
    expect(source, contains('"obfuscatedAccountIdAndroid"'));
    expect(source, contains('"obfuscatedProfileIdAndroid"'));
    expect(
      source,
      contains(
        'resolveCanonicalOrLegacy("purchaseToken", "purchaseTokenAndroid")',
      ),
    );
    expect(source, contains('"requestPurchase.offerTokenArr.in-app"'));
    expect(source, contains('"requestPurchase.offerTokenArr.subs"'));
    expect(
      source,
      contains('Use `subscriptionProductReplacementParams` instead'),
    );
    expect(
      source,
      isNot(
        contains(
          '(params["skus"] as? List<*>)?.filterIsInstance<String>()\n'
          '                        ?: (params["skuArr"]',
        ),
      ),
    );
  });
}
