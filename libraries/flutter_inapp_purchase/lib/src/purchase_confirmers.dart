// Port of specs/client/src/purchase-flow-confirmers.ts: the confirmers behind
// confirmWithIapkit and confirmOnDeviceIOS. They use only the purchase flow's
// public contract, as any other verification service's confirmer would.
import '../errors.dart' show PurchaseError;
import '../types.dart' hide PurchaseError;
import 'purchase_flow.dart';

/// Amazon options for [IapkitConfirmationOptions].
final class IapkitAmazonOptions {
  const IapkitAmazonOptions({
    this.sandbox = false,
    this.verifiedProductId,
    this.expectedEnvironment,
  });

  /// Verify App Tester receipts with the Amazon RVS Cloud Sandbox.
  final bool sandbox;

  /// Expected verdict environment; defaults to Sandbox with sandbox,
  /// otherwise Production.
  final String? expectedEnvironment;

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
/// Tests set the time in ms with [clock].
PurchaseConfirmer createDeviceConfirmationIOS(
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
  if (store == IapStore.Amazon) {
    _amazonExpectedEnvironment(options.amazon);
  }
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

String _amazonExpectedEnvironment(IapkitAmazonOptions? amazon) {
  final expected = amazon?.expectedEnvironment ??
      (amazon?.sandbox == true ? 'Sandbox' : 'Production');
  if (expected != 'Sandbox' && expected != 'Production') {
    throw PurchaseError(
      code: ErrorCode.DeveloperError,
      message: 'Amazon expectedEnvironment must be Sandbox or Production',
    );
  }
  if (amazon?.sandbox == true && expected == 'Production') {
    throw PurchaseError(
      code: ErrorCode.DeveloperError,
      message: 'Amazon Cloud Sandbox requires expectedEnvironment Sandbox',
    );
  }
  return expected;
}

String? _environmentMismatch(
  String? environment,
  IapStore store,
  Purchase purchase,
  IapkitAmazonOptions? amazon,
) {
  final expected = switch (store) {
    IapStore.Amazon => _amazonExpectedEnvironment(amazon),
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
