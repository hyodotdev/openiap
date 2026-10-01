import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/types.dart';

void main() {
  Map<String, dynamic> payload(String store) => {
        'store': store,
        'id': 'txn',
        'productId': 'sku',
        'quantity': 1,
        'isAutoRenewing': false,
        'purchaseState': 'purchased',
        'transactionDate': 1.0,
      };

  test('legacy official purchases infer and round trip identity', () {
    for (final entry in {
      'apple': 'apple',
      'google': 'play',
      'horizon': 'horizon',
      'amazon': 'amazon'
    }.entries) {
      final purchase = PurchaseAndroid.fromJson(payload(entry.key));
      expect(purchase.storeId, entry.value);
      expect(PurchaseAndroid.fromJson(purchase.toJson()).storeId, entry.value);
    }
  });

  test('community identity is required and survives serialization', () {
    final json = {...payload('unknown'), 'storeId': 'community-fixture'};
    expect(
        PurchaseAndroid.fromJson(PurchaseAndroid.fromJson(json).toJson())
            .storeId,
        'community-fixture');
    for (final id in [
      null,
      '',
      'auto',
      'none',
      'unknown',
      'apple',
      'play',
      'google',
      'horizon',
      'amazon',
      'Bad id',
      'store\n',
      42
    ]) {
      expect(() => PurchaseAndroid.fromJson({...json, 'storeId': id}),
          throwsFormatException);
    }
    expect(
        () => PurchaseAndroid.fromJson(
            {...payload('google'), 'storeId': 'other'}),
        throwsFormatException);
  });
}
