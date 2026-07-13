import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('native plugins forward the IAPKit baseUrl', () {
    final ios = File(
      'ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift',
    ).readAsStringSync();
    final macos = File(
      'macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift',
    ).readAsStringSync();
    final android = File(
      'android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt',
    ).readAsStringSync();

    const appleForwarding = 'if let baseUrl = iapkit["baseUrl"] as? String {';
    expect(ios, contains(appleForwarding));
    expect(ios, contains('iapkitDict["baseUrl"] = baseUrl'));
    expect(macos, contains(appleForwarding));
    expect(macos, contains('iapkitDict["baseUrl"] = baseUrl'));
    expect(
      android,
      contains(
        '(iapkit["baseUrl"] as? String)?.let { iapkitMap["baseUrl"] = it }',
      ),
    );
  });
}
