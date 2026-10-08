import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/src/first_purchase_notice.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('flutter_inapp');
  final notice = firstPurchaseNoticeLines.join('\n');
  final calls = <String>[];
  final logs = <String>[];
  late Map<String, Object?> responses;
  late DebugPrintCallback previousDebugPrint;

  // A debug build of a host app, outside `flutter test`.
  FlutterInappPurchase app(String operatingSystem) =>
      FlutterInappPurchase.private(
        FakePlatform(
          operatingSystem: operatingSystem,
          environment: const <String, String>{},
        ),
      );
  Future<void> settle() => Future<void>.delayed(Duration.zero);
  int claims() => calls.where((m) => m == 'claimFirstPurchaseNotice').length;
  Iterable<String> notices() => logs.where((l) => l.startsWith('[OpenIAP]'));

  setUp(() {
    calls.clear();
    logs.clear();
    responses = <String, Object?>{
      'acknowledgePurchaseAndroid': '{"responseCode":0}',
      'consumePurchaseAndroid': '{"responseCode":0}',
      'finishTransaction': null,
      'claimFirstPurchaseNotice': true,
    };
    previousDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      if (message != null) logs.add(message);
    };
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      final response = responses[call.method];
      if (response is Exception) throw response;
      return response;
    });
  });

  tearDown(() {
    debugPrint = previousDebugPrint;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  final successfulFinishes = <String, Future<void> Function()>{
    'Android acknowledge': () =>
        app('android').finishTransaction(purchase: _android()),
    'Android consume': () => app('android')
        .finishTransaction(purchase: _android(), isConsumable: true),
    'Apple finish': () => app('ios').finishTransaction(purchase: _apple()),
  };
  for (final finish in successfulFinishes.entries) {
    test('prints the notice as one log after the first ${finish.key}',
        () async {
      await finish.value();
      await settle();

      expect(claims(), 1);
      expect(notices(), <String>[notice]);
    });
  }

  test('stays silent in a release build', () async {
    await FirstPurchaseNotice(
      FakePlatform(environment: const <String, String>{}),
      channel,
      isDebug: false,
    ).onFinished(_android());

    expect(calls, isEmpty);
    expect(logs, isEmpty);
  });

  test('stays silent under flutter test', () async {
    await FlutterInappPurchase.private(
      FakePlatform(
        operatingSystem: 'android',
        environment: const <String, String>{'FLUTTER_TEST': 'true'},
      ),
    ).finishTransaction(purchase: _android());
    await FirstPurchaseNotice(const LocalPlatform(), channel)
        .onFinished(_android());
    await settle();

    expect(claims(), 0);
    expect(notices(), isEmpty);
  });

  test('stays silent when finishTransaction fails', () async {
    responses['acknowledgePurchaseAndroid'] =
        PlatformException(code: 'service-error');
    responses['finishTransaction'] = PlatformException(code: 'service-error');

    await expectLater(
      app('android').finishTransaction(purchase: _android()),
      throwsA(isA<PlatformException>()),
    );
    await expectLater(
      app('ios').finishTransaction(purchase: _apple()),
      throwsA(isA<PlatformException>()),
    );
    await settle();

    expect(claims(), 0);
    expect(notices(), isEmpty);
  });

  test('stays silent when the consume fails', () async {
    responses['consumePurchaseAndroid'] =
        PlatformException(code: 'service-error');

    await expectLater(
      app('android')
          .finishTransaction(purchase: _android(), isConsumable: true),
      throwsA(isA<PlatformException>()),
    );
    await settle();

    expect(claims(), 0);
    expect(notices(), isEmpty);
  });

  test('stays silent when the acknowledgement is not confirmed', () async {
    responses['acknowledgePurchaseAndroid'] = null;

    await app('android').finishTransaction(purchase: _android());
    await settle();

    expect(claims(), 0);
    expect(notices(), isEmpty);
  });

  test('stays silent for a pending purchase', () async {
    const pending = types.PurchaseState.Pending;

    await app('android').finishTransaction(purchase: _android(state: pending));
    await app('ios').finishTransaction(purchase: _apple(state: pending));
    await settle();

    expect(claims(), 0);
    expect(notices(), isEmpty);
  });

  test('stays silent once this install has claimed the notice', () async {
    responses['claimFirstPurchaseNotice'] = false;

    await app('android').finishTransaction(purchase: _android());
    await settle();

    expect(claims(), 1);
    expect(notices(), isEmpty);
  });

  test('skips the native claim after the first attempt', () async {
    final iap = app('android');

    await iap.finishTransaction(purchase: _android(token: 'first'));
    await iap.finishTransaction(purchase: _android(token: 'second'));
    await settle();

    expect(claims(), 1);
    expect(notices(), hasLength(1));
  });

  test('a failing claim never fails finishTransaction', () async {
    responses['claimFirstPurchaseNotice'] =
        PlatformException(code: 'service-error');
    await app('android').finishTransaction(purchase: _android());

    // A host app whose native plugin predates the claim.
    responses['claimFirstPurchaseNotice'] = MissingPluginException();
    await app('macos').finishTransaction(purchase: _apple());
    await settle();

    expect(claims(), 2);
    expect(notices(), isEmpty);
  });
}

types.PurchaseAndroid _android({
  String token = 'token',
  types.PurchaseState state = types.PurchaseState.Purchased,
}) {
  return types.PurchaseAndroid(
    id: token,
    isAutoRenewing: false,
    productId: 'premium',
    purchaseState: state,
    purchaseToken: token,
    quantity: 1,
    store: types.IapStore.Google,
    storeId: 'play',
    transactionDate: 1,
  );
}

types.PurchaseIOS _apple({
  types.PurchaseState state = types.PurchaseState.Purchased,
}) {
  return types.PurchaseIOS(
    id: 'apple-transaction',
    isAutoRenewing: false,
    productId: 'premium',
    purchaseState: state,
    quantity: 1,
    store: types.IapStore.Apple,
    storeId: 'apple',
    transactionDate: 1,
    transactionId: 'apple-transaction',
  );
}
