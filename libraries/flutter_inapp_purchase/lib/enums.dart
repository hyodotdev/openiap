// Enums for flutter_inapp_purchase package
// ignore_for_file: constant_identifier_names

/// Store types
enum Store { none, playStore, appStore }

/// Platform detection enum
enum IapPlatform { ios, android }

/// Transaction states
enum TransactionState { purchasing, purchased, failed, restored, deferred }

/// Platform availability types
enum ProductAvailability {
  canMakePayments,
  installed,
  notInstalled,
  notSupported,
}

/// In-app message types
enum InAppMessageType { purchase, billing, price, generic }

/// Refund types
enum RefundType { issue, priceChange, preference }

/// Offer types
enum OfferType { introductory, promotional, code, winBack }

/// Billing client state
enum BillingClientState { disconnected, connecting, connected, closed }

/// Android purchase states from Google Play Billing
enum AndroidPurchaseState {
  Unknown, // UNSPECIFIED_STATE
  Purchased, // PURCHASED
  Pending, // PENDING
}

AndroidPurchaseState androidPurchaseStateFromValue(int value) {
  switch (value) {
    case 1:
      return AndroidPurchaseState.Purchased;
    case 2:
      return AndroidPurchaseState.Pending;
    default:
      return AndroidPurchaseState.Unknown;
  }
}

extension AndroidPurchaseStateValue on AndroidPurchaseState {
  int get value {
    switch (this) {
      case AndroidPurchaseState.Unknown:
        return 0;
      case AndroidPurchaseState.Purchased:
        return 1;
      case AndroidPurchaseState.Pending:
        return 2;
    }
  }
}

/// Android billing response codes
enum ResponseCodeAndroid {
  billingResponseResultOk,
  billingResponseResultUserCanceled,
  billingResponseResultServiceUnavailable,
  billingResponseResultBillingUnavailable,
  billingResponseResultItemUnavailable,
  billingResponseResultDeveloperError,
  billingResponseResultError,
  billingResponseResultItemAlreadyOwned,
  billingResponseResultItemNotOwned,
  unknown,
}

/// See also https://developer.android.com/reference/com/android/billingclient/api/Purchase.PurchaseState
enum PurchaseState { pending, purchased, unspecified }
