// Port of specs/client/src/purchase-flow.ts, the purchase flow shared by every
// OpenIAP SDK; test/purchase_flow_test.dart runs its shared vectors.
// Guide: https://kit.openiap.dev/docs/purchase-flow
import 'dart:async';

import 'package:meta/meta.dart' show visibleForTesting;

import '../errors.dart' show PurchaseError;
import '../types.dart' hide PurchaseError;

/// Where a purchase stands after the flow ran. Only [PurchaseEntitled] grants
/// access.
sealed class PurchaseFlowStatus {
  const PurchaseFlowStatus();
}

/// The app backend's verdict on one purchase. [PurchaseVerified] and
/// [PurchaseLinked] mean the purchase is valid but access is not granted yet.
/// [PurchaseInvalid] and [PurchaseTestAccountRestricted] are settled
/// rejections: answer [PurchaseVerificationDelayed] for anything that may
/// still change.
sealed class PurchaseConfirmation extends PurchaseFlowStatus {
  const PurchaseConfirmation();

  /// Reads the backend's JSON answer. Throws a [FormatException] for anything
  /// off-contract, so a malformed body can never finish a transaction.
  factory PurchaseConfirmation.fromJson(Object? json) {
    final retry = json is Map ? json['retryAfterMs'] : null;
    final retryAfterMs =
        retry is num && retry.isFinite && retry >= 0 ? retry.ceil() : null;
    return switch (json) {
      {'status': 'store_pending'} => const PurchaseStorePending(),
      {'status': 'test_account_restricted'} =>
        const PurchaseTestAccountRestricted(),
      {'status': 'invalid', 'reason': final String reason} =>
        PurchaseInvalid(reason: reason),
      {'status': 'invalid'} => const PurchaseInvalid(),
      {'status': 'verification_delayed'} when retryAfterMs != null =>
        PurchaseVerificationDelayed(retryAfterMs: retryAfterMs),
      {'status': 'verified'} => PurchaseVerified(retryAfterMs: retryAfterMs),
      {'status': 'linked'} => PurchaseLinked(retryAfterMs: retryAfterMs),
      {'status': 'ownership_conflict', 'alreadyGranted': final bool granted} =>
        PurchaseOwnershipConflict(alreadyGranted: granted),
      {'status': 'entitled', 'alreadyGranted': final bool granted} =>
        PurchaseEntitled(alreadyGranted: granted),
      _ => throw FormatException(
          'Unrecognized purchase confirmation from the backend',
          json,
        ),
    };
  }
}

/// Payment is not complete; the store delivers the purchase again once it is.
final class PurchaseStorePending extends PurchaseConfirmation {
  const PurchaseStorePending();
}

final class PurchaseVerificationDelayed extends PurchaseConfirmation {
  const PurchaseVerificationDelayed({required this.retryAfterMs});

  final int retryAfterMs;
}

/// Another account owns the purchase. With [alreadyGranted] that account got
/// access, which lets the flow finish it.
final class PurchaseOwnershipConflict extends PurchaseConfirmation {
  const PurchaseOwnershipConflict({
    required this.alreadyGranted,
    this.finishError,
  });

  final bool alreadyGranted;

  /// Finishing failed; recovery retries it.
  final Object? finishError;
}

final class PurchaseTestAccountRestricted extends PurchaseConfirmation {
  const PurchaseTestAccountRestricted({this.finishError});

  /// Finishing failed; recovery retries it.
  final Object? finishError;
}

final class PurchaseInvalid extends PurchaseConfirmation {
  const PurchaseInvalid({
    this.reason,
    this.finishError,
    this.recovered = false,
  });

  final String? reason;

  /// Finishing failed; recovery retries it.
  final Object? finishError;

  /// Recovery found this purchase; the user did not just buy it.
  final bool recovered;
}

final class PurchaseVerified extends PurchaseConfirmation {
  const PurchaseVerified({this.retryAfterMs});

  final int? retryAfterMs;
}

final class PurchaseLinked extends PurchaseConfirmation {
  const PurchaseLinked({this.retryAfterMs});

  final int? retryAfterMs;
}

final class PurchaseEntitled extends PurchaseConfirmation {
  const PurchaseEntitled({
    required this.alreadyGranted,
    this.finishError,
    this.changePending = false,
  });

  final bool alreadyGranted;

  /// Finishing failed; recovery retries it. Access is still granted.
  final Object? finishError;

  /// A requested upgrade, downgrade, or prepaid top-up has not applied yet
  /// (Google Play waits for its payment, Amazon applies it at the next
  /// renewal): access stays on the current plan.
  final bool changePending;
}

/// Confirming failed or timed out; the purchase stays unfinished.
final class PurchaseFailed extends PurchaseFlowStatus {
  const PurchaseFailed(this.error);

  final Object error;
}

final class PurchaseFlowOutcome {
  const PurchaseFlowOutcome({required this.purchase, required this.status});

  final Purchase purchase;
  final PurchaseFlowStatus status;
}

/// Gives the user what they bought, before the flow finishes (and so consumes)
/// the purchase. Must be idempotent per `purchase.id`: after a crash the same
/// purchase is confirmed again.
typedef PurchaseGrant = Future<void> Function(
  Purchase purchase, {
  required bool isConsumable,
});

/// Confirms a purchase and grants access before it answers
/// [PurchaseEntitled]: the flow finishes, and so consumes, the purchase right
/// after.
typedef PurchaseConfirmer = Future<PurchaseConfirmation> Function(
  Purchase purchase, {
  required bool isConsumable,
});

class _PurchaseRun {
  _PurchaseRun(this.latest, this.requested);

  late final Future<PurchaseFlowStatus> task;
  Purchase latest;
  bool requested;
}

/// Confirms each purchase with the app's backend and decides when the app may
/// finish its transaction. Single-product, single-unit purchases only.
///
/// Create one flow per signed-in app account, capture that session in
/// `confirmWithBackend`, and [dispose] the flow after switching accounts. Apps
/// usually create it with `FlutterInappPurchase.createPurchaseFlow`.
final class PurchaseFlow {
  /// [confirmWithBackend] is usually a call to the app backend, which holds
  /// the IAPKit secret key; an app without one passes
  /// `FlutterInappPurchase.confirmWithIapkit`. It may take [confirmTimeout]
  /// before the purchase ends as [PurchaseFailed].
  ///
  /// [isConsumable] comes from the app's product config: on Android a wrong
  /// answer consumes a non-consumable or blocks rebuying a consumable.
  ///
  /// [getPendingTransactionsIOS] is the SDK's on iOS and null elsewhere.
  /// Recovery reads unfinished StoreKit transactions from it, and confirms
  /// every Apple purchase [getAvailablePurchases] lists when it throws.
  ///
  /// The flow processes each purchase [listenForPurchases] delivers until
  /// [dispose]. Only a delivery [wasRequested] approves may offer buying an
  /// [PurchaseInvalid] purchase again.
  PurchaseFlow({
    required PurchaseConfirmer confirmWithBackend,
    required Future<void> Function({
      required Purchase purchase,
      required bool isConsumable,
    }) finishTransaction,
    required bool Function(String productId) isConsumable,
    required Future<List<Purchase>> Function() getAvailablePurchases,
    required Future<List<Purchase>> Function()? getPendingTransactionsIOS,
    Duration confirmTimeout = const Duration(seconds: 30),
    StreamSubscription<Purchase> Function(void Function(Purchase) onPurchase)?
        listenForPurchases,
    bool Function(Purchase purchase)? wasRequested,
  })  : _confirmWithBackend = confirmWithBackend,
        _finishTransaction = finishTransaction,
        _isConsumable = isConsumable,
        _getAvailablePurchases = getAvailablePurchases,
        _getPendingTransactionsIOS = getPendingTransactionsIOS,
        _confirmTimeout = confirmTimeout {
    _subscription = listenForPurchases?.call((purchase) {
      // A pending delivery leaves the mark for the completed one that follows.
      final requested = purchase.purchaseState != PurchaseState.Pending &&
          (wasRequested?.call(purchase) ?? false);
      unawaited(_deliver(purchase, requested));
    });
  }

  final PurchaseConfirmer _confirmWithBackend;
  final Future<void> Function({
    required Purchase purchase,
    required bool isConsumable,
  }) _finishTransaction;
  final bool Function(String productId) _isConsumable;
  final Future<List<Purchase>> Function() _getAvailablePurchases;
  final Future<List<Purchase>> Function()? _getPendingTransactionsIOS;
  final Duration _confirmTimeout;
  StreamSubscription<Purchase>? _subscription;
  void Function()? _onDispose;

  // A listener and a recovery pass can deliver the same transaction at once.
  final _runs = <String, _PurchaseRun>{};
  // Finished purchases, and rejections the store settles on its own. A
  // recovery pass can hold a store list read before the listener settled one.
  final _settled = <String, PurchaseFlowStatus>{};
  final _recoveries = <bool, Future<List<PurchaseFlowOutcome>>>{};
  final _outcomes = StreamController<PurchaseFlowOutcome>.broadcast();
  var _disposed = false;

  /// Every outcome: once per confirmation, however many deliveries shared it,
  /// and once per delivery of an already settled purchase. A broadcast stream:
  /// listen right after creating the flow, since earlier outcomes are not
  /// replayed.
  Stream<PurchaseFlowOutcome> get outcomes => _outcomes.stream;

  /// Confirms one purchase the user just bought. Finishes it once access is
  /// granted to this or another account, and a settled rejection on iOS only:
  /// Google Play refunds a rejected purchase left unacknowledged, while iOS
  /// would redeliver it forever.
  Future<PurchaseFlowStatus> processPurchase(Purchase purchase) =>
      _deliver(purchase, true);

  /// Runs unfinished purchases, or with [includeFinished] every owned one for
  /// a restore button, through the flow one at a time; a call made while a
  /// pass runs shares it. Throws if it meets an Apple purchase without
  /// `getPendingTransactionsIOS`.
  Future<List<PurchaseFlowOutcome>> recoverPurchases({
    bool includeFinished = false,
  }) =>
      _recoveries[includeFinished] ??= _recover(includeFinished).whenComplete(
        () {
          _recoveries.remove(includeFinished);
        },
      );

  /// Stops listening, publishing, and a running recovery pass; confirmations
  /// already running still finish. Call it when the signed-in account
  /// changes, then create the next account's flow.
  void dispose() {
    _disposed = true;
    _onDispose?.call();
    unawaited(_subscription?.cancel());
    unawaited(_outcomes.close());
  }

  void _publish(PurchaseFlowOutcome outcome) {
    if (!_disposed) _outcomes.add(outcome);
  }

  // Marked per delivery: a shared run may have started from an older copy of
  // the purchase, before Play attached the pending change.
  PurchaseFlowStatus _forDelivery(
    Purchase purchase,
    PurchaseFlowStatus status,
    bool requested,
  ) {
    final changePending = purchase is PurchaseAndroid &&
        purchase.pendingPurchaseUpdateAndroid != null;
    return switch (status) {
      PurchaseEntitled(:final alreadyGranted, :final finishError)
          when changePending =>
        PurchaseEntitled(
          alreadyGranted: alreadyGranted,
          finishError: finishError,
          changePending: true,
        ),
      // An old expired renewal must not ask a subscriber to buy again.
      PurchaseInvalid(:final reason, :final finishError) when !requested =>
        PurchaseInvalid(
          reason: reason,
          finishError: finishError,
          recovered: true,
        ),
      _ => status,
    };
  }

  // Registers a run before any await, so deliveries in one tick share it.
  Future<PurchaseFlowStatus> _deliver(
    Purchase purchase,
    bool requested, {
    bool reconfirm = false,
  }) {
    final immediate = _immediateStatus(purchase, reconfirm);
    if (immediate != null) {
      final status = _forDelivery(purchase, immediate, requested);
      _publish(PurchaseFlowOutcome(purchase: purchase, status: status));
      return Future.value(status);
    }
    var run = _runs[purchase.id];
    if (run != null) {
      run
        ..latest = purchase
        ..requested = run.requested || requested;
    } else {
      final started = run = _PurchaseRun(purchase, requested);
      started.task = _confirmAndFinish(purchase).then((status) {
        _runs.remove(purchase.id);
        if (_isSettled(status)) _settled[purchase.id] = status;
        _publish(
          PurchaseFlowOutcome(
            purchase: started.latest,
            status: _forDelivery(started.latest, status, started.requested),
          ),
        );
        return status;
      });
      _runs[purchase.id] = started;
    }
    return run.task.then((status) => _forDelivery(purchase, status, requested));
  }

  PurchaseFlowStatus? _immediateStatus(Purchase purchase, bool reconfirm) {
    try {
      _assertSupportedPurchase(purchase);
    } catch (error) {
      return PurchaseFailed(error);
    }
    // Payment is not complete; the store delivers the purchase again once it is.
    if (purchase.purchaseState == PurchaseState.Pending) {
      return const PurchaseStorePending();
    }
    return reconfirm || _runs.containsKey(purchase.id)
        ? null
        : _settled[purchase.id];
  }

  Future<PurchaseFlowStatus> _confirmAndFinish(Purchase purchase) async {
    final PurchaseConfirmation confirmation;
    final bool isConsumable;
    try {
      // Read once: finishing must consume exactly what confirmation granted.
      isConsumable = _isConsumable(purchase.productId);
      confirmation = _plain(
        await _confirmWithBackend(purchase, isConsumable: isConsumable).timeout(
          _confirmTimeout,
          onTimeout: () => throw TimeoutException(
            'confirmWithBackend did not answer within '
            '${_confirmTimeout.inMilliseconds} ms',
            _confirmTimeout,
          ),
        ),
      );
    } catch (error) {
      return PurchaseFailed(error);
    }
    // Finishing settles a purchase for good, so only a settled verdict does.
    return switch (confirmation) {
      PurchaseEntitled() => await _finish(purchase, isConsumable, confirmation),
      PurchaseOwnershipConflict(alreadyGranted: true) =>
        await _finish(purchase, isConsumable, confirmation),
      PurchaseInvalid() ||
      PurchaseTestAccountRestricted() when purchase.store == IapStore.Apple =>
        await _finish(purchase, isConsumable, confirmation),
      _ => confirmation,
    };
  }

  Future<PurchaseFlowStatus> _finish(
    Purchase purchase,
    bool isConsumable,
    PurchaseConfirmation confirmation,
  ) async {
    try {
      // Play keeps an acknowledged purchase finished; a restore need not redo it.
      if (_isAcknowledgedAndroid(purchase) != true || isConsumable) {
        await _finishTransaction(
          purchase: purchase,
          isConsumable: isConsumable,
        );
      }
      return confirmation;
    } catch (finishError) {
      return switch (confirmation) {
        PurchaseEntitled(:final alreadyGranted) => PurchaseEntitled(
            alreadyGranted: alreadyGranted,
            finishError: finishError,
          ),
        PurchaseOwnershipConflict(:final alreadyGranted) =>
          PurchaseOwnershipConflict(
            alreadyGranted: alreadyGranted,
            finishError: finishError,
          ),
        PurchaseInvalid(:final reason) => PurchaseInvalid(
            reason: reason,
            finishError: finishError,
          ),
        PurchaseTestAccountRestricted() => PurchaseTestAccountRestricted(
            finishError: finishError,
          ),
        _ => confirmation,
      };
    }
  }

  Future<List<PurchaseFlowOutcome>> _recover(bool includeFinished) async {
    final getPendingTransactionsIOS = _getPendingTransactionsIOS;
    // iOS lists unfinished transactions directly; other stores list owned
    // purchases, and _isUnfinished picks the ones still to settle.
    List<Purchase>? pendingIOS;
    var pendingIOSFailed = false;
    try {
      pendingIOS = await getPendingTransactionsIOS?.call();
    } catch (_) {
      // One unverified transaction fails the whole list. Re-confirming a
      // finished purchase is safe, so every owned Apple purchase stands in.
      pendingIOSFailed = true;
    }
    final available = includeFinished || pendingIOS == null
        ? await _getAvailablePurchases()
        : const <Purchase>[];
    if (getPendingTransactionsIOS == null &&
        available.any((purchase) => purchase.store == IapStore.Apple)) {
      throw PurchaseError(
        code: ErrorCode.DeveloperError,
        message: 'recoverPurchases needs getPendingTransactionsIOS on iOS to '
            'find unfinished transactions',
      );
    }
    final purchases = <String, Purchase>{};
    for (final purchase in [
      ...?pendingIOS,
      ...available.where(
        (purchase) =>
            includeFinished ||
            (purchase.store == IapStore.Apple
                ? pendingIOSFailed
                : _isUnfinished(purchase)),
      ),
    ]) {
      purchases.putIfAbsent(purchase.id, () => purchase);
    }
    final outcomes = <PurchaseFlowOutcome>[];
    for (final purchase in purchases.values) {
      // The next account's flow confirms the rest with its own session.
      if (_disposed) break;
      if (!includeFinished && _settled.containsKey(purchase.id)) continue;
      final status = await _deliver(
        purchase,
        false,
        reconfirm: includeFinished,
      );
      outcomes.add(PurchaseFlowOutcome(purchase: purchase, status: status));
    }
    return outcomes;
  }

  // Amazon and most community stores report no acknowledgment, and Amazon
  // approves a Kids purchase later; a listed consumable is unconsumed.
  bool _isUnfinished(Purchase purchase) =>
      _isAcknowledgedAndroid(purchase) != true ||
      _isConsumable(purchase.productId);
}

/// Runs [onDispose] when [flow] is disposed, for the SDK's own state; not
/// exported.
void onPurchaseFlowDispose(PurchaseFlow flow, void Function() onDispose) {
  flow._onDispose = onDispose;
}

bool? _isAcknowledgedAndroid(Purchase purchase) =>
    purchase is PurchaseAndroid ? purchase.isAcknowledgedAndroid : null;

// A typed answer may carry flow-only fields or a negative retry hint; read it
// like backend JSON.
PurchaseConfirmation _plain(PurchaseConfirmation confirmation) =>
    switch (confirmation) {
      PurchaseEntitled(:final alreadyGranted) =>
        PurchaseEntitled(alreadyGranted: alreadyGranted),
      PurchaseOwnershipConflict(:final alreadyGranted) =>
        PurchaseOwnershipConflict(alreadyGranted: alreadyGranted),
      PurchaseInvalid(:final reason) => PurchaseInvalid(reason: reason),
      PurchaseTestAccountRestricted() => const PurchaseTestAccountRestricted(),
      PurchaseVerificationDelayed(:final retryAfterMs) when retryAfterMs < 0 =>
        throw FormatException(
          'Unrecognized purchase confirmation from the backend',
          retryAfterMs,
        ),
      PurchaseVerified(:final retryAfterMs) =>
        PurchaseVerified(retryAfterMs: _validRetry(retryAfterMs)),
      PurchaseLinked(:final retryAfterMs) =>
        PurchaseLinked(retryAfterMs: _validRetry(retryAfterMs)),
      _ => confirmation,
    };

int? _validRetry(int? retryAfterMs) =>
    retryAfterMs != null && retryAfterMs >= 0 ? retryAfterMs : null;

// A settled purchase is finished, or rejected for good where the store
// settles it, so the same delivery need not be confirmed again.
bool _isSettled(PurchaseFlowStatus status) => switch (status) {
      PurchaseEntitled(:final finishError) ||
      PurchaseInvalid(:final finishError) ||
      PurchaseTestAccountRestricted(:final finishError) =>
        finishError == null,
      PurchaseOwnershipConflict(:final alreadyGranted, :final finishError) =>
        alreadyGranted && finishError == null,
      _ => false,
    };

void _assertSupportedPurchase(Purchase purchase) {
  if (purchase.quantity != 1) {
    throw PurchaseError(
      code: ErrorCode.FeatureNotSupported,
      message: 'Purchase flow supports only single-unit purchases',
    );
  }
  if ((purchase.ids ?? const <String>[]).toSet().length > 1) {
    throw PurchaseError(
      code: ErrorCode.FeatureNotSupported,
      message: 'Purchase flow cannot finish a multi-product purchase before '
          'every product is granted',
    );
  }
}

/// Body the app sends its backend, which takes the user from its own session.
final class PurchaseConfirmationRequest {
  const PurchaseConfirmationRequest({
    required this.store,
    required this.purchaseToken,
    required this.productId,
  });

  /// [IapStore.Apple] or [IapStore.Google].
  final IapStore store;

  /// Apple JWS or Google Play purchase token, forwarded to IAPKit as is.
  final String purchaseToken;

  /// The product the app expected; IAPKit rejects a store mismatch.
  final String productId;

  Map<String, String> toJson() => {
        'store': store.value,
        'purchaseToken': purchaseToken,
        'productId': productId,
      };
}

/// Builds the backend request body; throws for a purchase without Apple or
/// Google evidence.
PurchaseConfirmationRequest toPurchaseConfirmationRequest(Purchase purchase) {
  final PurchaseCommon(:store, :purchaseToken, :productId) = purchase;
  if ((store != IapStore.Apple && store != IapStore.Google) ||
      purchaseToken == null ||
      purchaseToken.isEmpty) {
    throw PurchaseError(
      code: ErrorCode.DeveloperError,
      message:
          'Purchase $productId has no Apple or Google purchase token to confirm',
    );
  }
  _assertSupportedPurchase(purchase);
  return PurchaseConfirmationRequest(
    store: store,
    purchaseToken: purchaseToken,
    productId: productId,
  );
}

/// Amazon options for [IapkitConfirmationOptions].
final class IapkitAmazonOptions {
  const IapkitAmazonOptions({this.sandbox = false, this.verifiedProductId});

  /// Verify App Tester receipts with the Amazon RVS Cloud Sandbox.
  final bool sandbox;

  /// RVS reports a subscription term under its parent SKU; maps one to the
  /// other.
  final String Function(String productId)? verifiedProductId;
}

/// How an app without its own backend confirms purchases with IAPKit.
final class IapkitConfirmationOptions {
  const IapkitConfirmationOptions({
    this.apiKey,
    this.baseUrl,
    this.amazon,
    this.verifyAs,
    this.grant,
  });

  /// A publishable key (`openiap-kit_pk_...`), which is safe to ship in an
  /// app. Leave it out where the native SDK has one configured.
  final String? apiKey;

  /// A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev.
  final String? baseUrl;

  final IapkitAmazonOptions? amazon;

  /// The IAPKit store that verifies a community store's evidence, such as an
  /// Amazon RVS adapter.
  final IapStore? Function(Purchase purchase)? verifyAs;

  /// Required for consumables. Access read from ownership, such as an active
  /// subscription, needs nothing here.
  final PurchaseGrant? grant;
}

const _iapkitUnknownRetryMs = 30000;

/// The SDK's `confirmWithIapkit`, given its `verifyPurchaseWithProvider`:
/// verifies the purchase with IAPKit, then runs `grant` before the flow
/// finishes it.
PurchaseConfirmer createIapkitConfirmation(
  Future<VerifyPurchaseWithProviderResult> Function(
    VerifyPurchaseWithProviderProps props,
  ) verifyPurchaseWithProvider,
  IapkitConfirmationOptions options,
) =>
    (purchase, {required isConsumable}) async {
      final grant = options.grant;
      _requireGrant('confirmWithIapkit', purchase, isConsumable, grant);
      final confirmation = readIapkitVerification(
        await verifyPurchaseWithProvider(
          toIapkitVerificationProps(purchase, options),
        ),
        purchase,
        isConsumable: isConsumable,
        options: options,
      );
      if (confirmation is PurchaseEntitled && !confirmation.alreadyGranted) {
        await grant?.call(purchase, isConsumable: isConsumable);
      }
      return confirmation;
    };

/// The SDK's `confirmOnDeviceIOS`, given its `getPendingTransactionsIOS`, for
/// an app with neither a backend nor IAPKit. StoreKit verified the transaction
/// if it is still unfinished, unrevoked, not upgraded, unexpired, and from the
/// purchase's environment; [grant] then runs before the flow finishes it.
PurchaseConfirmer createDeviceConfirmationIOS(
  Future<List<Purchase>> Function() getPendingTransactionsIOS, {
  PurchaseGrant? grant,
}) =>
    deviceConfirmationIOS(getPendingTransactionsIOS, grant: grant);

/// [createDeviceConfirmationIOS] reading the time from [clock]; not exported.
@visibleForTesting
PurchaseConfirmer deviceConfirmationIOS(
  Future<List<Purchase>> Function() getPendingTransactionsIOS, {
  PurchaseGrant? grant,
  int Function() clock = _epochMs,
}) =>
    (purchase, {required isConsumable}) async {
      _requireGrant('confirmOnDeviceIOS', purchase, isConsumable, grant);
      if (purchase.store != IapStore.Apple || purchase.storeId != 'apple') {
        throw PurchaseError(
          code: ErrorCode.FeatureNotSupported,
          message: 'Device confirmation covers App Store purchases, not '
              '${purchase.storeId}',
        );
      }
      final pending = await getPendingTransactionsIOS();
      // After the query: a transaction can expire while StoreKit answers.
      final now = clock();
      final verified = pending.any(
        (candidate) =>
            candidate is PurchaseIOS &&
            candidate.store == IapStore.Apple &&
            purchase.id.isNotEmpty &&
            candidate.id == purchase.id &&
            candidate.productId == purchase.productId &&
            candidate.revocationDateIOS == null &&
            candidate.isUpgradedIOS != true &&
            (candidate.expirationDateIOS ?? double.infinity) > now &&
            switch (purchase) {
              PurchaseIOS(:final environmentIOS?) =>
                candidate.environmentIOS == environmentIOS,
              _ => true,
            },
      );
      if (!verified) {
        throw PurchaseError(
          code: ErrorCode.PurchaseVerificationFailed,
          message: 'StoreKit lists no valid unfinished transaction for '
              '${purchase.productId}',
        );
      }
      await grant?.call(purchase, isConsumable: isConsumable);
      return const PurchaseEntitled(alreadyGranted: false);
    };

int _epochMs() => DateTime.now().millisecondsSinceEpoch;

// Checked before verifying: a consumable must never pass without a way to
// credit it.
void _requireGrant(
  String name,
  Purchase purchase,
  bool isConsumable,
  PurchaseGrant? grant,
) {
  if (isConsumable && grant == null) {
    throw PurchaseError(
      code: ErrorCode.DeveloperError,
      message: '$name needs grant to credit consumable ${purchase.productId} '
          'before it is consumed',
    );
  }
}

/// Builds the IAPKit request for a purchase; throws for a store IAPKit cannot
/// verify.
VerifyPurchaseWithProviderProps toIapkitVerificationProps(
  Purchase purchase,
  IapkitConfirmationOptions options,
) {
  final apiKey = options.apiKey?.trim();
  // An unset environment variable, not a deliberate fallback to the SDK's key.
  if (apiKey != null && apiKey.isEmpty) {
    throw PurchaseError(
      code: ErrorCode.DeveloperError,
      message: 'IAPKit apiKey is empty',
    );
  }
  final baseUrl = options.baseUrl?.trim();
  String token() {
    final token = purchase.purchaseToken;
    if (token == null || token.isEmpty) {
      throw PurchaseError(
        code: ErrorCode.DeveloperError,
        message: 'Purchase ${purchase.productId} has no purchase token to '
            'verify',
      );
    }
    return token;
  }

  final userIdAmazon =
      purchase is PurchaseAndroid ? purchase.userIdAmazon : null;
  final store = _verifyingStore(purchase, options.verifyAs);
  if (store == IapStore.Unknown) {
    throw PurchaseError(
      code: ErrorCode.FeatureNotSupported,
      message: 'IAPKit cannot verify store ${purchase.store.value}',
    );
  }
  return VerifyPurchaseWithProviderProps(
    provider: PurchaseVerificationProvider.Iapkit,
    iapkit: RequestVerifyPurchaseWithIapkitProps(
      apiKey: apiKey,
      baseUrl: baseUrl == null || baseUrl.isEmpty ? null : baseUrl,
      apple: store == IapStore.Apple
          ? RequestVerifyPurchaseWithIapkitAppleProps(jws: token())
          : null,
      google: store == IapStore.Google
          ? RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken: token())
          : null,
      amazon: store == IapStore.Amazon
          ? RequestVerifyPurchaseWithIapkitAmazonProps(
              receiptId: token(),
              expectedProductId: _amazonProductId(purchase, options.amazon),
              sandbox: options.amazon?.sandbox ?? false,
              // The Amazon user the receipt belongs to, which RVS checks.
              userId: userIdAmazon == null || userIdAmazon.isEmpty
                  ? null
                  : userIdAmazon,
            )
          : null,
      horizon: store == IapStore.Horizon
          ? RequestVerifyPurchaseWithIapkitHorizonProps(sku: purchase.productId)
          : null,
    ),
  );
}

/// Turns IAPKit's answer into the flow's confirmation. Anything that may be a
/// configuration error rather than a rejected payment throws, so the flow
/// reports [PurchaseFailed] and leaves the purchase unfinished: evidence for
/// another store, product, or environment, `inauthentic` (IAPKit's answer to a
/// product or package mismatch, and to every Horizon rejection), and a valid
/// state this product type cannot be granted from.
PurchaseConfirmation readIapkitVerification(
  VerifyPurchaseWithProviderResult result,
  Purchase purchase, {
  required bool isConsumable,
  IapkitConfirmationOptions options = const IapkitConfirmationOptions(),
}) {
  final verified = result.iapkit;
  if (verified == null) {
    final errors = [
      for (final error
          in result.errors ?? const <VerifyPurchaseWithProviderError>[])
        (error.code ?? '').isEmpty
            ? error.message
            : '[${error.code}] ${error.message}',
    ];
    throw PurchaseError(
      code: ErrorCode.PurchaseVerificationFailed,
      message: errors.isEmpty
          ? 'IAPKit returned no verification result'
          : errors.join('\n'),
    );
  }
  if (verified.state == IapkitPurchaseState.Pending) {
    return const PurchaseStorePending();
  }
  // The store gave no usable answer: retry instead of rejecting a payment.
  // A state this build doesn't know also arrives as unknown: never finished.
  if (verified.state == IapkitPurchaseState.Unknown) {
    return const PurchaseVerificationDelayed(
      retryAfterMs: _iapkitUnknownRetryMs,
    );
  }
  final store = _verifyingStore(purchase, options.verifyAs);
  final expectedProductId = store == IapStore.Amazon
      ? _amazonProductId(purchase, options.amazon)
      : purchase.productId;
  final mismatch = verified.store != purchase.store
      ? 'store ${verified.store.value}, expected ${purchase.store.value}'
      : purchase.storeId.isNotEmpty && verified.storeId != purchase.storeId
          ? 'store id ${verified.storeId}, expected ${purchase.storeId}'
          : verified.productId != expectedProductId
              ? 'product ${verified.productId ?? '(none)'}, '
                  'expected $expectedProductId'
              : _environmentMismatch(
                  verified.environment,
                  store,
                  purchase,
                  options.amazon,
                );
  if (mismatch != null) {
    throw PurchaseError(
      code: ErrorCode.PurchaseVerificationFailed,
      message: 'IAPKit verified $mismatch',
    );
  }
  if (!verified.isValid) {
    return switch (verified.state) {
      IapkitPurchaseState.Canceled ||
      IapkitPurchaseState.Expired =>
        PurchaseInvalid(reason: verified.state.value),
      // Only a granted purchase is consumed; the flow grants before finishing.
      IapkitPurchaseState.Consumed =>
        const PurchaseEntitled(alreadyGranted: true),
      _ => throw PurchaseError(
          code: ErrorCode.PurchaseVerificationFailed,
          message: 'IAPKit rejected the purchase: ${verified.state.value}',
        ),
    };
  }
  if (!_grantsAccess(store, verified.state, isConsumable)) {
    throw PurchaseError(
      code: ErrorCode.PurchaseVerificationFailed,
      message: 'IAPKit state ${verified.state.value} cannot grant this '
          '${isConsumable ? 'consumable' : 'non-consumable'} '
          '${purchase.store.value} purchase',
    );
  }
  return const PurchaseEntitled(alreadyGranted: false);
}

IapStore _verifyingStore(
  Purchase purchase,
  IapStore? Function(Purchase purchase)? verifyAs,
) =>
    verifyAs?.call(purchase) ?? purchase.store;

String _amazonProductId(Purchase purchase, IapkitAmazonOptions? amazon) =>
    amazon?.verifiedProductId?.call(purchase.productId) ?? purchase.productId;

String? _environmentMismatch(
  String? environment,
  IapStore store,
  Purchase purchase,
  IapkitAmazonOptions? amazon,
) {
  final expected = switch (store) {
    IapStore.Amazon => amazon?.sandbox == true ? 'Sandbox' : 'Production',
    IapStore.Apple => purchase is PurchaseIOS ? purchase.environmentIOS : null,
    _ => null,
  };
  return expected != null && environment != expected
      ? 'environment ${environment ?? '(none)'}, expected $expected'
      : null;
}

// Apple and Amazon keep a consumable at ready-to-consume until it is finished;
// Google reports a granted purchase as pending-acknowledgment until then.
bool _grantsAccess(
  IapStore store,
  IapkitPurchaseState state,
  bool isConsumable,
) =>
    switch (store) {
      IapStore.Apple || IapStore.Amazon => state ==
          (isConsumable
              ? IapkitPurchaseState.ReadyToConsume
              : IapkitPurchaseState.Entitled),
      IapStore.Google => state == IapkitPurchaseState.Entitled ||
          state == IapkitPurchaseState.PendingAcknowledgment ||
          (isConsumable && state == IapkitPurchaseState.ReadyToConsume),
      IapStore.Horizon => state == IapkitPurchaseState.Entitled,
      IapStore.Unknown => false,
    };

enum PurchaseFlowGuidanceKey {
  paymentPending('payment_pending'),
  changePending('change_pending'),
  verificationDelayed('verification_delayed'),
  ownedByAnotherAccount('owned_by_another_account'),
  testPurchaseNotAccepted('test_purchase_not_accepted'),
  purchaseNotValid('purchase_not_valid'),
  accessPending('access_pending'),
  accessGranted('access_granted'),
  tryAgainLater('try_again_later');

  const PurchaseFlowGuidanceKey(this.value);

  final String value;
}

/// Neutral guidance an app maps to its own copy.
final class PurchaseFlowGuidance {
  const PurchaseFlowGuidance({
    required this.key,
    required this.offerPurchase,
    this.retryAfterMs,
  });

  final PurchaseFlowGuidanceKey key;

  /// True only for an invalid purchase the user just made. False whenever the
  /// user may already have paid: never ask them to buy again.
  final bool offerPurchase;

  /// Earliest time to run the purchase through the flow again.
  final int? retryAfterMs;
}

PurchaseFlowGuidance describePurchaseFlowStatus(PurchaseFlowStatus status) =>
    switch (status) {
      PurchaseStorePending() => const PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.paymentPending,
          offerPurchase: false,
        ),
      PurchaseVerificationDelayed(:final retryAfterMs) => PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.verificationDelayed,
          offerPurchase: false,
          retryAfterMs: retryAfterMs,
        ),
      PurchaseOwnershipConflict() => const PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.ownedByAnotherAccount,
          offerPurchase: false,
        ),
      PurchaseTestAccountRestricted() => const PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.testPurchaseNotAccepted,
          offerPurchase: false,
        ),
      PurchaseInvalid(:final recovered) => PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.purchaseNotValid,
          offerPurchase: !recovered,
        ),
      PurchaseVerified(:final retryAfterMs) ||
      PurchaseLinked(:final retryAfterMs) =>
        PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.accessPending,
          offerPurchase: false,
          retryAfterMs: retryAfterMs,
        ),
      PurchaseEntitled(:final changePending) => PurchaseFlowGuidance(
          key: changePending
              ? PurchaseFlowGuidanceKey.changePending
              : PurchaseFlowGuidanceKey.accessGranted,
          offerPurchase: false,
        ),
      PurchaseFailed() => const PurchaseFlowGuidance(
          key: PurchaseFlowGuidanceKey.tryAgainLater,
          offerPurchase: false,
        ),
    };
