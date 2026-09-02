import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android custom channel accepts canonical wire fields only', () {
    final source = File(
      'android/src/store/kotlin/io/github/hyochan/flutter_inapp_purchase/'
      'AndroidInappPurchasePlugin.kt',
    ).readAsStringSync();

    expect(source, contains('params["skus"]'));
    expect(source, contains('KEY_PURCHASE_TOKEN'));
    expect(source, contains('null, "", "in-app"'));
    expect(source, isNot(contains('"skuArr"')));
    expect(source, isNot(contains('"productIds"')));
    expect(source, isNot(contains('params.containsKey("token")')));
    expect(source, isNot(contains('normalized == "inapp"')));
  });

  test('Apple custom channel accepts canonical wire fields only', () {
    final pluginPaths = <String>[
      'ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/'
          'FlutterInappPurchasePlugin.swift',
      'macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/'
          'FlutterInappPurchasePlugin.swift',
    ];

    for (final path in pluginPaths) {
      final source = File(path).readAsStringSync();

      expect(source, contains('payload["transactionId"]'));
      expect(source, isNot(contains('"transactionIdentifier"')));
      expect(source, isNot(contains('legacyKey:')));
      expect(source, isNot(contains('warningKey:')));
      expect(source, contains('args["apple"]'));
      expect(source, contains('guard let sku, !sku.isEmpty else'));

      final helperPath = path.replaceFirst(
        'FlutterInappPurchasePlugin.swift',
        'FlutterIapHelper.swift',
      );
      final helperSource = File(helperPath).readAsStringSync();
      final productTypeStart = helperSource.indexOf(
        'static func parseProductQueryType',
      );
      final productTypeEnd = helperSource.indexOf(
        'static func decodeProductRequest',
        productTypeStart,
      );
      final productTypeHelper = helperSource.substring(
        productTypeStart,
        productTypeEnd,
      );
      expect(
          productTypeHelper, contains('case ProductQueryType.inApp.rawValue:'));
      expect(productTypeHelper, isNot(contains('case "inapp":')));
      expect(
        productTypeHelper,
        contains('guard let stringValue = rawValue as? String'),
      );
      expect(
        helperSource,
        contains('parseProductQueryType(payload["type"])'),
      );
      expect(
        helperSource,
        isNot(contains('parseProductQueryType(payload["type"] as? String)')),
      );

      final purchaseTypeStart = helperSource.indexOf(
        'static func parsePurchaseProductQueryType',
      );
      final purchaseTypeEnd = helperSource.indexOf(
        'static func decodeProductRequest',
        purchaseTypeStart,
      );
      final purchaseTypeHelper = helperSource.substring(
        purchaseTypeStart,
        purchaseTypeEnd,
      );
      expect(purchaseTypeHelper, contains('return .inApp'));
      expect(purchaseTypeHelper, contains('guard type != .all'));
      expect(purchaseTypeHelper, contains('!(rawValue is NSNull)'));
      expect(
        helperSource,
        contains('parsePurchaseProductQueryType(payload["type"])'),
      );
    }
  });
}
