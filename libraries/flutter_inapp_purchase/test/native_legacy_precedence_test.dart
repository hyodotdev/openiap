import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android custom-channel aliases are canonical-first', () {
    final source = File(
      'android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/'
      'AndroidInappPurchasePlugin.kt',
    ).readAsStringSync();

    final fetchStart = source.indexOf('"fetchProducts" ->');
    final fetchEnd = source.indexOf('"getAvailableItems" ->', fetchStart);
    final fetchBlock = source.substring(fetchStart, fetchEnd);
    expect(fetchBlock, contains('params.containsKey("skus")'));
    expect(fetchBlock, contains('params.containsKey("skuArr")'));
    expect(fetchBlock, contains('params.containsKey("productIds")'));
    expect(
      fetchBlock.indexOf('params.containsKey("skus")'),
      lessThan(fetchBlock.indexOf('params.containsKey("skuArr")')),
    );
    expect(fetchBlock, contains('"fetchProducts.skuArr"'));
    expect(fetchBlock, contains('"fetchProducts.productIds"'));
    expect(
      fetchBlock,
      isNot(contains('call.argument<List<String>>("skuArr")')),
    );

    final acknowledgeStart = source.indexOf('"acknowledgePurchaseAndroid" ->');
    final tokenHelperStart =
        source.indexOf('private fun resolveCanonicalPurchaseToken');
    final tokenHelperEnd = source.indexOf(
        'private suspend fun withBillingReady', tokenHelperStart);
    final tokenHelper = source.substring(tokenHelperStart, tokenHelperEnd);
    expect(acknowledgeStart, greaterThanOrEqualTo(0));
    expect(
      source.substring(acknowledgeStart),
      contains('resolveCanonicalPurchaseToken('),
    );
    expect(tokenHelper, contains('params.containsKey(KEY_PURCHASE_TOKEN)'));
    expect(tokenHelper, contains('params.containsKey("token")'));
    expect(
      tokenHelper.indexOf('params.containsKey(KEY_PURCHASE_TOKEN)'),
      lessThan(tokenHelper.indexOf('params.containsKey("token")')),
    );
    expect(tokenHelper, contains(r'"$operation.token"'));
    expect(tokenHelper, contains('Use `purchaseToken` instead of `token`.'));

    final queryTypeStart = source.indexOf('private fun parseQueryType');
    final queryTypeEnd = source.indexOf(
      'private fun parsePurchaseType',
      queryTypeStart,
    );
    final queryTypeHelper = source.substring(queryTypeStart, queryTypeEnd);
    expect(queryTypeHelper, contains('?: "in-app"'));
    expect(queryTypeHelper, contains('normalized == "in-app"'));
    expect(queryTypeHelper, contains('normalized == "inapp"'));
    expect(queryTypeHelper, contains('"productType.\$normalized"'));
    expect(
      queryTypeHelper,
      contains('Use `in-app` instead.'),
    );
  });

  test('Apple custom-channel aliases require absent canonical keys', () {
    final pluginPaths = <String>[
      'ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/'
          'FlutterInappPurchasePlugin.swift',
      'macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/'
          'FlutterInappPurchasePlugin.swift',
    ];

    for (final path in pluginPaths) {
      final source = File(path).readAsStringSync();

      expect(source, contains('if payload.keys.contains("transactionId")'));
      expect(
        source,
        contains('legacyKey: "transactionIdentifier"'),
      );
      expect(source, contains('legacyKey: "id"'));
      expect(
        source,
        contains('warningKey: "finishTransaction.transactionIdentifier"'),
      );
      expect(
        source,
        contains('warningKey: "finishTransaction.purchase.id"'),
      );
      expect(
        source,
        isNot(
          contains(
            'args["transactionId"] as? String ?? '
            'args["transactionIdentifier"] as? String',
          ),
        ),
      );

      expect(source, contains('if args.keys.contains("apple")'));
      expect(source, contains('guard let sku, !sku.isEmpty else'));
      expect(
        source,
        isNot(
          contains(
            'if let appleOptions = args["apple"] as? [String: Any],',
          ),
        ),
      );

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
        productTypeHelper.indexOf('case ProductQueryType.inApp.rawValue:'),
        lessThan(productTypeHelper.indexOf('case "inapp":')),
      );
      expect(productTypeHelper, contains('"productType.inapp"'));
      expect(productTypeHelper, contains('Use `in-app` instead.'));
    }
  });
}
