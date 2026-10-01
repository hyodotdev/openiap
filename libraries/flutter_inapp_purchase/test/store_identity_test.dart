import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:platform/platform.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart'
    show FlutterInappPurchase;
import 'package:flutter_inapp_purchase/types.dart';
import 'package:flutter_inapp_purchase/helpers.dart' show extractPurchases;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_inapp');
  tearDown(() => TestDefaultBinaryMessengerBinding
      .instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, null));
  test(
      'community completion forwards the full purchase to the Android provider',
      () async {
    final purchase = PurchaseAndroid.fromJson({
      'store': 'unknown',
      'storeId': 'community-fixture',
      'id': 'opaque-id',
      'productId': 'sku',
      'quantity': 1,
      'isAutoRenewing': false,
      'purchaseState': 'purchased',
      'transactionDate': 1.0,
      'purchaseToken': 'opaque-receipt',
    });
    MethodCall? completion;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'finishTransaction') completion = call;
      return null;
    });
    await FlutterInappPurchase.private(FakePlatform(operatingSystem: 'android'))
        .finishTransaction(purchase: purchase, isConsumable: true);
    expect(completion?.arguments,
        {'purchase': purchase.toJson(), 'isConsumable': true});
  });
  test(
      'provider subscription status does not infer entitlement from inactive entries',
      () async {
    final calls = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      if (call.method == 'hasActiveSubscriptions') return false;
      if (call.method == 'getActiveSubscriptions') {
        return [
          {'productId': 'expired', 'isActive': false}
        ];
      }
      return null;
    });
    final iap =
        FlutterInappPurchase.private(FakePlatform(operatingSystem: 'ios'));
    expect(await iap.hasActiveSubscriptions(), false);
    expect(calls, ['hasActiveSubscriptions']);
  });
  Map<String, dynamic> payload(String store) => {
        'store': store,
        'id': 'txn',
        'productId': 'sku',
        'quantity': 1,
        'isAutoRenewing': false,
        'purchaseState': 'purchased',
        'transactionDate': 1.0,
      };

  test('authoritative Android reads preserve and validate community identities',
      () {
    List<Purchase> decode(Object? id) => extractPurchases(
          [
            {...payload('unknown'), 'storeId': id}
          ],
          platformIsAndroid: true,
          platformIsIOS: false,
          acknowledgedAndroidPurchaseTokens: {},
          rejectMalformed: true,
        );
    expect(decode('community-fixture').single.storeId, 'community-fixture');
    for (final id in [null, 42, 'Bad id', 'apple']) {
      expect(() => decode(id), throwsFormatException);
    }
  });

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
