import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

import 'constants.dart';

enum VerificationMethod { ignore, local, iapkitLocalhost, iapkit }

extension VerificationMethodX on VerificationMethod {
  String get label => switch (this) {
        VerificationMethod.ignore => 'Ignore',
        VerificationMethod.local => 'Local (Device)',
        VerificationMethod.iapkitLocalhost => 'Local (IAPKit)',
        VerificationMethod.iapkit => 'IAPKit',
      };

  String get subtitle => switch (this) {
        VerificationMethod.ignore => 'Skip verification',
        VerificationMethod.local => 'Basic local verification',
        VerificationMethod.iapkitLocalhost =>
          'IAPKit routed to IAPKIT_BASE_URL',
        VerificationMethod.iapkit => 'Server-side verification via IAPKit',
      };
}

/// No API key: Ignore; a local IAPKit origin: Local (IAPKit); otherwise IAPKit.
VerificationMethod defaultVerificationMethod(
  String apiKey,
  String localBaseUrl,
) {
  if (apiKey.trim().isEmpty) return VerificationMethod.ignore;
  if (localBaseUrl.trim().isNotEmpty) return VerificationMethod.iapkitLocalhost;
  return VerificationMethod.iapkit;
}

/// The example's one purchase flow and store connection, shared by every
/// screen. It confirms each purchase with the verification method picked last.
class AppPurchaseFlow {
  AppPurchaseFlow(this.iap) {
    flow = iap.createPurchaseFlow(
      confirmWithBackend: _confirm,
      isConsumable: IapConstants.isConsumable,
    );
  }

  /// Started from `main` and kept for the app's lifetime; an app with
  /// accounts disposes it on sign-out and creates the next account's.
  static final instance = AppPurchaseFlow(FlutterInappPurchase.instance);

  final FlutterInappPurchase iap;
  late final PurchaseFlow flow;
  Future<bool>? _connecting;

  final verificationMethod = ValueNotifier(
    defaultVerificationMethod(
      IapConstants.iapkitApiKey,
      IapConstants.iapkitBaseUrl,
    ),
  );

  final _creditedPurchaseIds = <String>{};

  /// Whether the latest [start] connected; starts one if none ran yet.
  Future<bool> get connected => _connecting ?? start();

  /// Connects the app to the store, then recovers purchases left unfinished.
  Future<bool> start() => _connecting = _connect();

  Future<bool> _connect() async {
    try {
      final connected = await iap.initConnection();
      if (connected) unawaited(_recover());
      return connected;
    } catch (error) {
      debugPrint('Failed to connect to the store: $error');
      return false;
    }
  }

  // Outcomes reach the screens through flow.outcomes.
  Future<void> _recover() async {
    try {
      await flow.recoverPurchases();
    } catch (error) {
      debugPrint('Purchase recovery failed; receipts retained: $error');
    }
  }

  void dispose() {
    flow.dispose();
    verificationMethod.dispose();
  }

  Future<PurchaseConfirmation> _confirm(
    Purchase purchase, {
    required bool isConsumable,
  }) async {
    final method = verificationMethod.value;
    switch (method) {
      case VerificationMethod.ignore:
        throw _unverified(
          'Receipt retained. Choose verification to retry this receipt.',
        );
      case VerificationMethod.local:
        final confirm = iap.confirmOnDeviceIOS(grant: _grant);
        return confirm(purchase, isConsumable: isConsumable);
      case VerificationMethod.iapkitLocalhost || VerificationMethod.iapkit:
        final confirm = iap.confirmWithIapkit(iapkitOptions(method));
        return confirm(purchase, isConsumable: isConsumable);
    }
  }

  /// How the IAPKit methods verify Martie's catalog.
  IapkitConfirmationOptions iapkitOptions(VerificationMethod method) {
    final localBaseUrl = IapConstants.iapkitBaseUrl.trim();
    final local = method == VerificationMethod.iapkitLocalhost;
    if (local && localBaseUrl.isEmpty) {
      throw _unverified('IAPKIT_BASE_URL not configured for ${method.label}');
    }
    return IapkitConfirmationOptions(
      apiKey: IapConstants.iapkitApiKey,
      baseUrl: local ? localBaseUrl : null,
      amazon: IapkitAmazonOptions(
        sandbox: IapConstants.amazonRvsSandbox,
        verifiedProductId: IapConstants.amazonVerifiedProductId,
      ),
      // The educational community provider wraps Amazon receipts.
      verifyAs: (purchase) =>
          purchase.storeId == 'amazon_example' ? IapStore.Amazon : null,
      grant: _grant,
    );
  }

  // Credits a consumable once per purchase id; a real app stores the ids.
  Future<void> _grant(Purchase purchase, {required bool isConsumable}) async {
    if (!isConsumable) return;
    if (_creditedPurchaseIds.add(purchase.id)) {
      debugPrint('Credited ${purchase.productId}');
    } else {
      debugPrint('Already credited ${purchase.id}');
    }
  }
}

PurchaseError _unverified(String message) => PurchaseError(
      code: ErrorCode.PurchaseVerificationFailed,
      message: message,
    );

/// Shows the picker and returns the method chosen, if any.
Future<VerificationMethod?> pickVerificationMethod(
  BuildContext context,
  AppPurchaseFlow purchases,
  List<VerificationMethod> methods,
) async {
  final picked = await showModalBottomSheet<VerificationMethod>(
    context: context,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final method in methods)
            ListTile(
              leading: Icon(
                purchases.verificationMethod.value == method
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
              ),
              title: Text(method.label),
              subtitle: Text(method.subtitle),
              onTap: () => Navigator.pop(context, method),
            ),
        ],
      ),
    ),
  );
  if (picked != null) purchases.verificationMethod.value = picked;
  return picked;
}

/// The result text for an outcome: the guidance key as the example's copy.
String describeOutcome(PurchaseFlowOutcome outcome) {
  final PurchaseFlowOutcome(:purchase, :status) = outcome;
  final guidance = describePurchaseFlowStatus(status);
  final changeTargets = purchase is PurchaseAndroid
      ? purchase.pendingPurchaseUpdateAndroid?.products.join(', ')
      : null;
  final message = switch (guidance.key) {
    PurchaseFlowGuidanceKey.paymentPending =>
      '⏳ Payment is pending at the store. Access unlocks once it completes.',
    PurchaseFlowGuidanceKey.changePending =>
      '✅ Plan change to $changeTargets is pending. '
          '${purchase.productId} stays active until it applies.',
    PurchaseFlowGuidanceKey.verificationDelayed =>
      '⏳ The store has not confirmed the purchase yet. Retrying soon.',
    PurchaseFlowGuidanceKey.ownedByAnotherAccount =>
      '⚠️ This purchase belongs to another account.',
    PurchaseFlowGuidanceKey.testPurchaseNotAccepted =>
      '⚠️ This backend does not accept sandbox or test purchases.',
    PurchaseFlowGuidanceKey.purchaseNotValid =>
      '❌ The store did not confirm this purchase.',
    PurchaseFlowGuidanceKey.accessPending =>
      '⏳ Purchase confirmed. Access is being prepared.',
    PurchaseFlowGuidanceKey.accessGranted => '✅ Access granted.',
    PurchaseFlowGuidanceKey.tryAgainLater =>
      '❌ Could not confirm the purchase. Try again later.',
  };
  return [
    message,
    'Product: ${purchase.productId}',
    if (guidance.offerPurchase) 'You can buy it again.',
    if (status case PurchaseFailed(:final error))
      error is PurchaseError ? error.message : '$error',
  ].join('\n');
}
