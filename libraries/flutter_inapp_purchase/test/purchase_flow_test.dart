// The shared groups run specs/client/src/purchase-flow.vectors.json, the cases
// every purchase-flow port runs, the way specs/client/src/purchase-flow.test.ts
// does; the rest cover what is specific to Dart and this SDK.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/src/purchase_flow.dart'
    show deviceConfirmationIOS;
import 'package:flutter_test/flutter_test.dart';
import 'package:platform/platform.dart';

/// A vector purchase lists only the fields the flow reads.
Purchase purchaseFromVector(Map<String, dynamic> json) {
  final pending = json['pendingPurchaseUpdateAndroid'] as Map<String, dynamic>?;
  final full = <String, dynamic>{
    'isAutoRenewing': false,
    'quantity': 1,
    'transactionDate': 0,
    'transactionId': json['id'],
    ...json,
    if (pending != null)
      'pendingPurchaseUpdateAndroid': {'purchaseToken': 'pending', ...pending},
  };
  if (json['store'] != 'apple') return PurchaseAndroid.fromJson(full);
  // Built field by field: fromJson rejects a community storeId under "apple".
  final ios = PurchaseIOS.fromJson({...full, 'storeId': 'apple'});
  return PurchaseIOS(
    id: ios.id,
    transactionId: ios.transactionId,
    productId: ios.productId,
    purchaseState: ios.purchaseState,
    purchaseToken: ios.purchaseToken,
    quantity: ios.quantity,
    isAutoRenewing: ios.isAutoRenewing,
    transactionDate: ios.transactionDate,
    ids: ios.ids,
    environmentIOS: ios.environmentIOS,
    expirationDateIOS: ios.expirationDateIOS,
    revocationDateIOS: ios.revocationDateIOS,
    isUpgradedIOS: ios.isUpgradedIOS,
    store: ios.store,
    storeId: full['storeId'] as String? ?? ios.storeId,
  );
}

/// The status as the vectors spell it: `error` and `finishError` as `true`.
Map<String, Object?> comparableStatus(PurchaseFlowStatus status) =>
    switch (status) {
      PurchaseStorePending() => {'status': 'store_pending'},
      PurchaseVerificationDelayed(:final retryAfterMs) => {
          'status': 'verification_delayed',
          'retryAfterMs': retryAfterMs,
        },
      PurchaseOwnershipConflict(:final alreadyGranted, :final finishError) => {
          'status': 'ownership_conflict',
          'alreadyGranted': alreadyGranted,
          if (finishError != null) 'finishError': true,
        },
      PurchaseTestAccountRestricted(:final finishError) => {
          'status': 'test_account_restricted',
          if (finishError != null) 'finishError': true,
        },
      PurchaseInvalid(:final reason, :final finishError, :final recovered) => {
          'status': 'invalid',
          if (reason != null) 'reason': reason,
          if (finishError != null) 'finishError': true,
          if (recovered) 'recovered': true,
        },
      PurchaseVerified(:final retryAfterMs) => {
          'status': 'verified',
          if (retryAfterMs != null) 'retryAfterMs': retryAfterMs,
        },
      PurchaseLinked(:final retryAfterMs) => {
          'status': 'linked',
          if (retryAfterMs != null) 'retryAfterMs': retryAfterMs,
        },
      PurchaseEntitled(
        :final alreadyGranted,
        :final finishError,
        :final changePending,
      ) =>
        {
          'status': 'entitled',
          'alreadyGranted': alreadyGranted,
          if (finishError != null) 'finishError': true,
          if (changePending) 'changePending': true,
        },
      PurchaseFailed() => {'status': 'failed', 'error': true},
    };

Map<String, Object?> comparableGuidance(PurchaseFlowGuidance guidance) => {
      'key': guidance.key.value,
      'offerPurchase': guidance.offerPurchase,
      if (guidance.retryAfterMs != null) 'retryAfterMs': guidance.retryAfterMs,
    };

// Generated toJson writes null for an absent field; the vectors leave it out.
Object? withoutNulls(Object? value) => switch (value) {
      Map<String, dynamic>() => {
          for (final entry in value.entries)
            if (entry.value != null) entry.key: withoutNulls(entry.value),
        },
      List<dynamic>() => value.map(withoutNulls).toList(),
      _ => value,
    };

List<Map<String, Object?>> byId(List<PurchaseFlowOutcome> outcomes) => [
      for (final outcome in outcomes)
        {'id': outcome.purchase.id, 'status': comparableStatus(outcome.status)},
    ];

List<Map<String, dynamic>> cases(Map<String, dynamic> vectors, String key) =>
    (vectors[key] as List<dynamic>).cast<Map<String, dynamic>>();

const _channel = MethodChannel('flutter_inapp');

PurchaseAndroid _play(
  String id, {
  bool? acknowledged,
  List<String>? changeTo,
  double transactionDate = 1,
}) =>
    PurchaseAndroid(
      id: id,
      productId: 'premium',
      purchaseState: PurchaseState.Purchased,
      purchaseToken: 'token-$id',
      quantity: 1,
      isAutoRenewing: false,
      isAcknowledgedAndroid: acknowledged,
      pendingPurchaseUpdateAndroid: changeTo == null
          ? null
          : PendingPurchaseUpdateAndroid(
              products: changeTo,
              purchaseToken: 'change-$id',
            ),
      store: IapStore.Google,
      storeId: 'play',
      transactionDate: transactionDate,
    );

PurchaseFlow _flow(
  PurchaseConfirmer confirm, {
  Future<List<Purchase>> Function()? getAvailablePurchases,
  Duration confirmTimeout = const Duration(seconds: 30),
  StreamSubscription<Purchase> Function(void Function(Purchase))? listen,
}) =>
    PurchaseFlow(
      confirmWithBackend: confirm,
      finishTransaction: ({required purchase, required isConsumable}) async {},
      isConsumable: (_) => false,
      getAvailablePurchases: getAvailablePurchases ?? () async => [],
      getPendingTransactionsIOS: null,
      confirmTimeout: confirmTimeout,
      listenForPurchases: listen,
    );

Future<void> _sendNative(String method, Object? arguments) =>
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
      _channel.name,
      const StandardMethodCodec().encodeMethodCall(
        MethodCall(method, arguments),
      ),
      (_) {},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final vectors = jsonDecode(
    File('test/fixtures/purchase-flow.vectors.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  group('process', () {
    for (final vector in cases(vectors, 'process')) {
      test(vector['name'] as String, () async {
        final isConsumable = vector['isConsumable'] as bool;
        var confirms = 0;
        final finishes = <(Purchase, bool)>[];
        final flow = PurchaseFlow(
          confirmWithBackend: (purchase, {required isConsumable}) async {
            confirms++;
            if (vector['confirmThrows'] == true) throw StateError('down');
            // Raw JSON on purpose: the flow must reject malformed answers.
            return PurchaseConfirmation.fromJson(vector['confirmation']);
          },
          finishTransaction: ({
            required purchase,
            required isConsumable,
          }) async {
            finishes.add((purchase, isConsumable));
            if (vector['finishThrows'] == true) throw StateError('store down');
          },
          isConsumable: (_) => isConsumable,
          getAvailablePurchases: () async => [],
          getPendingTransactionsIOS: null,
        );
        final item = purchaseFromVector(
          vector['purchase'] as Map<String, dynamic>,
        );

        final status = await flow.processPurchase(item);

        expect(confirms, vector['confirms'] == false ? 0 : 1);
        if (vector['finishes'] == true) {
          expect(finishes, hasLength(1));
          expect(finishes.single.$1, same(item));
          expect(finishes.single.$2, isConsumable);
        } else {
          expect(finishes, isEmpty);
        }
        expect(comparableStatus(status), vector['status']);
        expect(
          comparableGuidance(describePurchaseFlowStatus(status)),
          vector['guidance'],
        );
      });
    }
  });

  group('device', () {
    for (final vector in cases(vectors, 'device')) {
      test(vector['name'] as String, () async {
        var reads = 0;
        var grants = 0;
        final clock = vector['clock'] as Map<String, dynamic>?;
        var now = clock?['beforeRead'] as int?;
        final confirm = deviceConfirmationIOS(
          () async {
            reads++;
            if (clock != null) now = clock['afterRead'] as int;
            return [
              for (final pending in vector['pending'] as List<dynamic>)
                purchaseFromVector(pending as Map<String, dynamic>),
            ];
          },
          grant: vector['noGrant'] == true
              ? null
              : (purchase, {required isConsumable}) async => grants++,
          clock: () => now ?? DateTime.now().millisecondsSinceEpoch,
        );

        final answer = confirm(
          purchaseFromVector(vector['purchase'] as Map<String, dynamic>),
          isConsumable: vector['isConsumable'] as bool,
        );

        if (vector['error'] == true) {
          await expectLater(answer, throwsA(anything));
        } else {
          expect(comparableStatus(await answer), vector['confirmation']);
        }
        expect(reads, vector['reads'] == false ? 0 : 1);
        expect(grants, vector['granted'] == true ? 1 : 0);
      });
    }
  });

  group('iapkit', () {
    for (final vector in cases(vectors, 'iapkit')) {
      test(vector['name'] as String, () async {
        final item = purchaseFromVector(
          vector['purchase'] as Map<String, dynamic>,
        );
        final amazon = vector['amazon'] as Map<String, dynamic>?;
        final productIds = (amazon?['verifiedProductIds'] as Map?) ?? {};
        final stores = (vector['verifyAs'] as Map?) ?? {};
        var grants = 0;
        final calls = <VerifyPurchaseWithProviderProps>[];
        final confirm = createIapkitConfirmation(
          (props) async {
            calls.add(props);
            return VerifyPurchaseWithProviderResult.fromJson({
              'provider': 'iapkit',
              ...?vector['result'] as Map<String, dynamic>?,
            });
          },
          IapkitConfirmationOptions(
            apiKey: vector.containsKey('apiKey')
                ? vector['apiKey'] as String?
                : 'pk',
            baseUrl: vector['baseUrl'] as String?,
            amazon: amazon == null
                ? null
                : IapkitAmazonOptions(
                    sandbox: amazon['sandbox'] as bool,
                    verifiedProductId: (id) => productIds[id] as String? ?? id,
                  ),
            verifyAs: (purchase) => switch (stores[purchase.storeId]) {
              final String store => IapStore.fromJson(store),
              _ => null,
            },
            grant: vector['noGrant'] == true
                ? null
                : (purchase, {required isConsumable}) async => grants++,
          ),
        );

        final answer = confirm(
          item,
          isConsumable: vector['isConsumable'] as bool,
        );

        if (vector['error'] == true) {
          await expectLater(answer, throwsA(anything));
        } else {
          expect(comparableStatus(await answer), vector['confirmation']);
        }
        if (vector['props'] == null || vector['verifies'] == false) {
          expect(calls, isEmpty);
        } else {
          expect(calls, hasLength(1));
          expect(withoutNulls(calls.single.toJson()), vector['props']);
        }
        expect(grants, vector['granted'] == true ? 1 : 0);
      });
    }
  });

  group('sequences', () {
    for (final vector in cases(vectors, 'sequences')) {
      test(vector['name'] as String, () async {
        final purchases = {
          for (final MapEntry(:key, :value)
              in (vector['purchases'] as Map<String, dynamic>).entries)
            key: purchaseFromVector(value as Map<String, dynamic>),
        };
        List<Purchase> listed(Object? keys) => [
              for (final key in (keys as List<dynamic>?) ?? []) purchases[key]!,
            ];
        final answers = vector['answers'] as Map<String, dynamic>;
        Set<String> ids(Object? list) =>
            ((list as List<dynamic>?) ?? []).cast<String>().toSet();
        final consumables = ids(vector['consumables']);
        final requested = ids(vector['requested']);
        final pendingIOS = vector['pendingIOS'];
        final confirms = <String, int>{};
        final finishes = <String, int>{};
        final published = <PurchaseFlowOutcome>[];
        final store = StreamController<Purchase>.broadcast(sync: true);
        final flow = PurchaseFlow(
          confirmWithBackend: (purchase, {required isConsumable}) async {
            final count =
                confirms[purchase.id] = (confirms[purchase.id] ?? 0) + 1;
            final list =
                (answers[purchase.id] ?? answers['*']) as List<dynamic>;
            final answer =
                list[(count < list.length ? count : list.length) - 1];
            if (answer == 'throw') throw StateError('backend down');
            return PurchaseConfirmation.fromJson(answer);
          },
          finishTransaction: ({
            required purchase,
            required isConsumable,
          }) async {
            finishes[purchase.id] = (finishes[purchase.id] ?? 0) + 1;
          },
          isConsumable: consumables.contains,
          getAvailablePurchases: () async => listed(vector['available']),
          getPendingTransactionsIOS: pendingIOS == null
              ? null
              : () async {
                  if (pendingIOS == 'throw') throw StateError('unverified');
                  return listed(pendingIOS);
                },
          listenForPurchases: store.stream.listen,
          wasRequested: (purchase) => vector['requestedOnce'] == true
              ? requested.remove(purchase.id)
              : requested.contains(purchase.id),
        );
        flow.outcomes.listen(published.add);

        for (final step in cases(vector, 'steps')) {
          if (step['dispose'] == true) flow.dispose();
          listed(step['listener']).forEach(store.add);
          final processed =
              listed(step['process']).map(flow.processPurchase).toList();
          final recover = step['recover'] as Map<String, dynamic>?;
          final recovered = recover == null
              ? null
              : flow.recoverPurchases(
                  includeFinished: recover['includeFinished'] == true,
                );
          await Future.wait(processed);
          if (recovered != null) {
            expect(byId(await recovered), step['outcomes']);
          }
          // Listener deliveries settle without a future to wait on.
          await Future<void>.delayed(Duration.zero);
        }

        expect(confirms, vector['confirms']);
        expect(finishes, vector['finishes']);
        if (vector['published'] != null) {
          expect(byId(published), vector['published']);
        }
        await store.close();
      });
    }
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
  });

  group('PurchaseConfirmation.fromJson', () {
    for (final body in <Object?>[
      null,
      'entitled',
      {'status': 'granted'},
      {'status': 'entitled'},
      {'status': 'entitled', 'alreadyGranted': 'yes'},
      {'status': 'ownership_conflict'},
      {'status': 'verification_delayed'},
      {'status': 'verification_delayed', 'retryAfterMs': -1},
      {'status': 'verification_delayed', 'retryAfterMs': double.nan},
    ]) {
      test('rejects the off-contract body $body', () {
        expect(
          () => PurchaseConfirmation.fromJson(body),
          throwsFormatException,
        );
      });
    }

    test('drops unknown fields and invalid retry hints', () {
      expect(
        comparableStatus(
          PurchaseConfirmation.fromJson({
            'status': 'linked',
            'retryAfterMs': double.infinity,
            'extra': true,
          }),
        ),
        {'status': 'linked'},
      );
      expect(
        comparableStatus(
          PurchaseConfirmation.fromJson({'status': 'invalid', 'reason': 3}),
        ),
        {'status': 'invalid'},
      );
    });
  });

  group('PurchaseFlow', () {
    test('fails a confirmation still hanging after confirmTimeout', () async {
      var confirms = 0;
      final flow = _flow(
        (purchase, {required isConsumable}) {
          confirms++;
          return Completer<PurchaseConfirmation>().future;
        },
        confirmTimeout: const Duration(milliseconds: 20),
      );

      final status = await flow.processPurchase(_play('p1'));

      expect(status, isA<PurchaseFailed>());
      expect((status as PurchaseFailed).error, isA<TimeoutException>());
      // The hung call no longer holds the transaction.
      unawaited(flow.processPurchase(_play('p1')));
      expect(confirms, 2);
    });

    test('ignores flow-only fields on a typed confirmation', () async {
      final flow = _flow(
        (purchase, {required isConsumable}) async => const PurchaseEntitled(
          alreadyGranted: false,
          finishError: 'stale',
          changePending: true,
        ),
      );

      expect(
        comparableStatus(await flow.processPurchase(_play('p1'))),
        {'status': 'entitled', 'alreadyGranted': false},
      );
    });

    test('finishes with the consumability it confirmed with', () async {
      var reads = 0;
      final finishedAs = <bool>[];
      final flow = PurchaseFlow(
        confirmWithBackend: (purchase, {required isConsumable}) async =>
            const PurchaseEntitled(alreadyGranted: false),
        finishTransaction: ({required purchase, required isConsumable}) async {
          finishedAs.add(isConsumable);
        },
        // A config refresh between confirming and finishing flips the answer.
        isConsumable: (_) => ++reads == 1,
        getAvailablePurchases: () async => [],
        getPendingTransactionsIOS: null,
      );

      await flow.processPurchase(_play('p1'));

      expect(finishedAs, [true]);
      expect(reads, 1);
    });

    test('reads a negative typed retry hint like backend JSON', () async {
      Future<PurchaseFlowStatus> answer(PurchaseConfirmation confirmation) =>
          _flow((purchase, {required isConsumable}) async => confirmation)
              .processPurchase(_play('p1'));

      expect(
        await answer(const PurchaseVerificationDelayed(retryAfterMs: -1)),
        isA<PurchaseFailed>(),
      );
      expect(
        comparableStatus(
            await answer(const PurchaseVerified(retryAfterMs: -1))),
        {'status': 'verified'},
      );
      expect(
        comparableStatus(await answer(const PurchaseLinked(retryAfterMs: -1))),
        {'status': 'linked'},
      );
    });

    test('publishes a run joined by a requested delivery as requested',
        () async {
      final answer = Completer<PurchaseConfirmation>();
      final store = StreamController<Purchase>.broadcast(sync: true);
      final flow = _flow(
        (purchase, {required isConsumable}) => answer.future,
        listen: store.stream.listen,
      );
      final published = <PurchaseFlowOutcome>[];
      flow.outcomes.listen(published.add);

      store.add(_play('p1'));
      final processed = flow.processPurchase(_play('p1'));
      answer.complete(const PurchaseInvalid(reason: 'expired'));
      await processed;
      await Future<void>.delayed(Duration.zero);

      expect(published.map((o) => comparableStatus(o.status)), [
        {'status': 'invalid', 'reason': 'expired'},
      ]);
      await store.close();
    });

    test('publishes the latest delivery a run joined', () async {
      final answer = Completer<PurchaseConfirmation>();
      final flow = _flow((purchase, {required isConsumable}) => answer.future);
      final published = <PurchaseFlowOutcome>[];
      flow.outcomes.listen(published.add);

      final before = flow.processPurchase(_play('p1'));
      final latest = _play('p1', changeTo: ['premium_yearly']);
      final after = flow.processPurchase(latest);
      answer.complete(const PurchaseEntitled(alreadyGranted: true));

      expect(comparableStatus(await before), {
        'status': 'entitled',
        'alreadyGranted': true,
      });
      expect(comparableStatus(await after), {
        'status': 'entitled',
        'alreadyGranted': true,
        'changePending': true,
      });
      await Future<void>.delayed(Duration.zero);
      expect(published.single.purchase, same(latest));
    });

    test('skips a purchase it finished since the store list was read',
        () async {
      var confirms = 0;
      final unacknowledged = _play('p1', acknowledged: false);
      final flow = _flow(
        (purchase, {required isConsumable}) async {
          confirms++;
          return const PurchaseEntitled(alreadyGranted: false);
        },
        getAvailablePurchases: () async => [unacknowledged],
      );

      await flow.processPurchase(unacknowledged);

      expect(await flow.recoverPurchases(), isEmpty);
      expect(confirms, 1);
    });

    test('shares a recovery pass with a call made while it runs', () async {
      var reads = 0;
      final flow = _flow(
        (purchase, {required isConsumable}) async =>
            const PurchaseEntitled(alreadyGranted: false),
        getAvailablePurchases: () async {
          reads++;
          return [_play('p1', acknowledged: false)];
        },
      );

      final first = flow.recoverPurchases();
      final second = flow.recoverPurchases();

      expect(await second, same(await first));
      expect(reads, 1);
      await flow.recoverPurchases();
      expect(reads, 2);
    });

    test('refuses Apple purchases without getPendingTransactionsIOS', () {
      final flow = _flow(
        (purchase, {required isConsumable}) async =>
            const PurchaseEntitled(alreadyGranted: false),
        getAvailablePurchases: () async => [
          const PurchaseIOS(
            id: 'tx-1',
            transactionId: 'tx-1',
            productId: 'premium',
            purchaseState: PurchaseState.Purchased,
            purchaseToken: 'jws',
            quantity: 1,
            isAutoRenewing: false,
            store: IapStore.Apple,
            storeId: 'apple',
            transactionDate: 1,
          ),
        ],
      );

      expect(flow.recoverPurchases(), throwsA(isA<PurchaseError>()));
    });

    test('stops a running recovery pass on dispose', () async {
      final answer = Completer<PurchaseConfirmation>();
      final confirmed = <String>[];
      final flow = _flow(
        (purchase, {required isConsumable}) {
          confirmed.add(purchase.id);
          return answer.future;
        },
        getAvailablePurchases: () async => [
          _play('p1', acknowledged: false),
          _play('p2', acknowledged: false),
        ],
      );

      final recovery = flow.recoverPurchases();
      await pumpEventQueue();
      expect(confirmed, ['p1']);
      flow.dispose();
      answer.complete(const PurchaseEntitled(alreadyGranted: false));

      expect((await recovery).map((outcome) => outcome.purchase.id), ['p1']);
      expect(confirmed, ['p1']);
    });

    test('publishes nothing after dispose, to any subscriber', () async {
      var confirms = 0;
      final store = StreamController<Purchase>.broadcast(sync: true);
      final flow = _flow(
        (purchase, {required isConsumable}) async {
          confirms++;
          return const PurchaseEntitled(alreadyGranted: false);
        },
        listen: store.stream.listen,
      );
      final answer = Completer<void>();
      final running = _flow((purchase, {required isConsumable}) async {
        await answer.future;
        return const PurchaseEntitled(alreadyGranted: false);
      });
      final runningPublished = <PurchaseFlowOutcome>[];
      running.outcomes.listen(runningPublished.add);
      final inFlight = running.processPurchase(_play('p1'));

      flow.dispose();
      running.dispose();
      final late = <PurchaseFlowOutcome>[];
      flow.outcomes.listen(late.add);
      store.add(_play('p2'));
      await flow.processPurchase(_play('p3'));
      answer.complete();
      await inFlight;
      await Future<void>.delayed(Duration.zero);

      expect(confirms, 1);
      expect(late, isEmpty);
      expect(runningPublished, isEmpty);
      expect(store.hasListener, isFalse);
      await store.close();
    });
  });

  group('FlutterInappPurchase.createPurchaseFlow', () {
    late List<MethodCall> calls;

    setUp(() {
      calls = [];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_channel, (call) async {
        calls.add(call);
        switch (call.method) {
          case 'initConnection':
          case 'endConnection':
            return true;
          case 'getAvailableItems':
          case 'getPendingTransactionsIOS':
            return <Object?>[];
          case 'verifyPurchaseWithProvider':
            return {
              'provider': 'iapkit',
              'iapkit': {
                'store': 'google',
                'storeId': 'play',
                'isValid': true,
                'state': 'entitled',
                'productId': 'premium',
              },
            };
        }
        return null;
      });
    });

    Future<FlutterInappPurchase> connected(String os) async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: os),
      );
      await iap.initConnection();
      return iap;
    }

    Future<void> deliver(PurchaseAndroid purchase) =>
        _sendNative('purchase-updated', jsonEncode(purchase.toJson()));

    Future<void> requestPurchase(FlutterInappPurchase iap, String sku) =>
        iap.requestPurchase(
          RequestPurchaseProps.subs((
            apple: null,
            google: RequestSubscriptionAndroidProps(skus: [sku]),
          )),
        );

    test('counts deliveries of requested products as requested', () async {
      final iap = await connected('android');
      final flow = iap.createPurchaseFlow(
        confirmWithBackend: (purchase, {required isConsumable}) async =>
            const PurchaseInvalid(reason: 'expired'),
        isConsumable: (_) => false,
      );
      final published = <PurchaseFlowOutcome>[];
      flow.outcomes.listen(published.add);
      Future<bool> recovered(PurchaseAndroid purchase) async {
        published.clear();
        await deliver(purchase);
        await pumpEventQueue();
        return (published.single.status as PurchaseInvalid).recovered;
      }

      final now = DateTime.now().millisecondsSinceEpoch.toDouble();

      const minute = 60000;

      await requestPurchase(iap, 'premium');
      // A receipt long before the request is a redelivery and keeps the mark.
      expect(
        await recovered(_play('GPA.0', transactionDate: now - 11 * minute)),
        isTrue,
      );
      // A device clock running ahead still leaves the user's own purchase.
      expect(
        await recovered(_play('GPA.1', transactionDate: now - 9 * minute)),
        isFalse,
      );
      // The delivery cleared the mark.
      expect(await recovered(_play('GPA.2', transactionDate: now)), isTrue);
      await requestPurchase(iap, 'premium_yearly');
      // A change to the requested product needs no date check.
      expect(
        await recovered(_play('GPA.3', changeTo: ['premium_yearly'])),
        isFalse,
      );
      await requestPurchase(iap, 'premium');
      await _sendNative(
        'purchase-error',
        jsonEncode({'code': 'user-cancelled', 'message': 'Cancelled'}),
      );
      expect(await recovered(_play('GPA.4', transactionDate: now)), isTrue);
      flow.dispose();
    });

    test('drops request marks on dispose, whatever listens', () async {
      final iap = await connected('android');
      PurchaseFlow create([
        StreamSubscription<Purchase> Function(void Function(Purchase))? listen,
      ]) =>
          iap.createPurchaseFlow(
            confirmWithBackend: (purchase, {required isConsumable}) async =>
                const PurchaseInvalid(reason: 'expired'),
            isConsumable: (_) => false,
            listenForPurchases: listen,
          );
      Future<bool> requested(String id) async {
        final flow = create();
        final outcome = flow.outcomes.first;
        final now = DateTime.now().millisecondsSinceEpoch.toDouble();
        await deliver(_play(id, transactionDate: now));
        final status = (await outcome).status as PurchaseInvalid;
        flow.dispose();
        return !status.recovered;
      }

      for (final listen in [null, iap.purchaseUpdatedListener.listen]) {
        await requestPurchase(iap, 'premium');
        create(listen).dispose();
        expect(await requested('GPA.1'), isFalse);
        // Cleared synchronously: a request right after dispose survives it.
        create(listen).dispose();
        final asked = requestPurchase(iap, 'premium');
        expect(await requested('GPA.2'), isTrue);
        await asked;
      }
    });

    test('passes iOS replays to the flow, which retries a failed one',
        () async {
      final iap = await connected('ios');
      var confirms = 0;
      final flow = iap.createPurchaseFlow(
        confirmWithBackend: (purchase, {required isConsumable}) async {
          if (++confirms == 1) throw StateError('backend down');
          return const PurchaseEntitled(alreadyGranted: false);
        },
        isConsumable: (_) => false,
      );
      final published = <PurchaseFlowOutcome>[];
      flow.outcomes.listen(published.add);
      await pumpEventQueue();
      const replay = PurchaseIOS(
        id: 'tx-1',
        transactionId: 'tx-1',
        productId: 'premium',
        purchaseState: PurchaseState.Purchased,
        purchaseToken: 'jws',
        quantity: 1,
        isAutoRenewing: false,
        store: IapStore.Apple,
        storeId: 'apple',
        transactionDate: 1,
      );

      for (var delivery = 0; delivery < 2; delivery++) {
        await _sendNative('purchase-updated', jsonEncode(replay.toJson()));
        await pumpEventQueue();
      }

      expect(confirms, 2);
      expect(published.map((outcome) => outcome.status), [
        isA<PurchaseFailed>(),
        isA<PurchaseEntitled>(),
      ]);
      flow.dispose();
    });

    test('confirmOnDeviceIOS reads this instance\'s pending transactions',
        () async {
      final iap = await connected('ios');
      final confirm = iap.confirmOnDeviceIOS();

      await expectLater(
        confirm(
          const PurchaseIOS(
            id: 'tx-1',
            transactionId: 'tx-1',
            productId: 'premium',
            purchaseState: PurchaseState.Purchased,
            quantity: 1,
            isAutoRenewing: false,
            store: IapStore.Apple,
            storeId: 'apple',
            transactionDate: 1,
          ),
          isConsumable: false,
        ),
        throwsA(isA<PurchaseError>()),
      );
      expect(
        calls.where((call) => call.method == 'getPendingTransactionsIOS'),
        hasLength(1),
      );
    });

    test('recovers through this instance on each platform', () async {
      for (final os in ['android', 'ios']) {
        calls.clear();
        final iap = await connected(os);
        final flow = iap.createPurchaseFlow(
          confirmWithBackend: (purchase, {required isConsumable}) async =>
              const PurchaseEntitled(alreadyGranted: false),
          isConsumable: (_) => false,
        );

        await flow.recoverPurchases();

        expect(
          calls.map((call) => call.method).where((m) => m.startsWith('get')),
          [os == 'ios' ? 'getPendingTransactionsIOS' : 'getAvailableItems'],
          reason: os,
        );
        flow.dispose();
      }
    });

    test('confirmWithIapkit verifies through verifyPurchaseWithProvider',
        () async {
      final iap = await connected('android');
      final confirm = iap.confirmWithIapkit(
        const IapkitConfirmationOptions(apiKey: 'openiap-kit_pk_test'),
      );

      final confirmation = await confirm(_play('GPA.1'), isConsumable: false);

      expect(comparableStatus(confirmation), {
        'status': 'entitled',
        'alreadyGranted': false,
      });
      final call = calls.singleWhere(
        (call) => call.method == 'verifyPurchaseWithProvider',
      );
      expect(call.arguments, {
        'provider': 'iapkit',
        'iapkit': {
          'apiKey': 'openiap-kit_pk_test',
          'google': {'purchaseToken': 'token-GPA.1'},
        },
      });
    });
  });

  group('connection', () {
    late List<MethodCall> calls;

    setUp(() {
      calls = [];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_channel, (call) async {
        calls.add(call);
        // Native answers late, so overlapping calls would interleave.
        await Future<void>.delayed(const Duration(milliseconds: 5));
        return true;
      });
    });

    test('a failed reconnect leaves the store disconnected', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_channel, (call) async {
        calls.add(call);
        throw PlatformException(code: 'service-error', message: 'down');
      });

      await expectLater(
        iap.initConnection(
          enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
        ),
        throwsA(isA<PurchaseError>()),
      );

      await expectLater(
        iap.getAvailablePurchases(),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.NotPrepared,
          ),
        ),
      );
    });

    test('a refused rebuild keeps the store connected', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await iap.initConnection();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(_channel, (call) async {
        calls.add(call);
        if (call.method == 'initConnection') {
          throw PlatformException(
            code: 'developer-error',
            message: 'initConnection cannot change the billing program while '
                'a purchase is in progress',
          );
        }
        return <Object?>[];
      });

      await expectLater(
        iap.initConnection(
          enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
        ),
        throwsA(
          isA<PurchaseError>().having(
            (error) => error.code,
            'code',
            ErrorCode.DeveloperError,
          ),
        ),
      );

      expect(await iap.getAvailablePurchases(), isEmpty);
    });

    test('iOS ignores the config once connected', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );

      await iap.initConnection();
      await iap.initConnection(
        enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
        billingChoiceScreenTypeAndroid:
            BillingChoiceScreenTypeAndroid.values.first,
      );

      expect(calls.map((call) => call.arguments), [null]);
    });

    test('Android forwards every passed config; native decides', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );

      await iap.initConnection();
      await iap.initConnection();
      await iap.initConnection(
        enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
      );
      await iap.initConnection(
        enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
      );
      // A bare call keeps the live connection and its program.
      await iap.initConnection();

      expect(calls.map((call) => call.arguments), [
        null,
        {'enableBillingProgramAndroid': 'external-offer'},
        {'enableBillingProgramAndroid': 'external-offer'},
      ]);
    });

    test('runs initConnection and endConnection in call order', () async {
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'ios'),
      );
      await iap.initConnection();
      calls.clear();

      final ended = iap.endConnection();
      final reconnected = iap.initConnection();

      expect(await ended, isTrue);
      expect(await reconnected, isTrue);
      expect(calls.map((call) => call.method), [
        'endConnection',
        'initConnection',
      ]);
    });

    test('keeps no settled call that a later zone would wait on', () async {
      // Stands in for a finished widget test, whose zone runs no more work.
      var alive = true;
      final finished = Zone.current.fork(
        specification: ZoneSpecification(
          scheduleMicrotask: (self, parent, zone, task) {
            if (alive) parent.scheduleMicrotask(zone, task);
          },
        ),
      );
      final iap = FlutterInappPurchase.private(
        FakePlatform(operatingSystem: 'android'),
      );
      await finished.run(() => iap.initConnection());
      await pumpEventQueue();
      alive = false;

      await iap
          .initConnection(
            enableBillingProgramAndroid: BillingProgramAndroid.ExternalOffer,
          )
          .timeout(const Duration(seconds: 1));
      expect(calls, hasLength(2));
    });
  });
}
