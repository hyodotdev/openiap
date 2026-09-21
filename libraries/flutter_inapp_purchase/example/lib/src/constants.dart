import 'package:flutter_dotenv/flutter_dotenv.dart';

// Product IDs for testing in the example app
class IapConstants {
  // IAPKit openiap-kit_pk_ publishable key for purchase verification.
  // Never put an openiap-kit_sk_ secret admin key in a Flutter app.
  // `String.fromEnvironment` returns '' for both an absent and an explicitly
  // empty define, so `bool.hasEnvironment` decides which source wins.
  static const _hasIapkitApiKeyDefine = bool.hasEnvironment('IAPKIT_API_KEY');
  static const _iapkitApiKeyFromEnvironment = String.fromEnvironment(
    'IAPKIT_API_KEY',
  );
  static const _hasIapkitBaseUrlDefine = bool.hasEnvironment('IAPKIT_BASE_URL');
  static const _iapkitBaseUrlFromEnvironment = String.fromEnvironment(
    'IAPKIT_BASE_URL',
  );

  /// dotenv throws until `load()` runs, which widget tests never do.
  static String _fromDotenv(String key) {
    try {
      return dotenv.env[key] ?? '';
    } on Object {
      return '';
    }
  }

  static String get iapkitApiKey => _hasIapkitApiKeyDefine
      ? _iapkitApiKeyFromEnvironment
      : _fromDotenv('IAPKIT_API_KEY');
  /// Origin of a local IAPKit server; empty selects the hosted default.
  static String get iapkitBaseUrl => _hasIapkitBaseUrlDefine
      ? _iapkitBaseUrlFromEnvironment
      : _fromDotenv('IAPKIT_BASE_URL');

  static const _hasAmazonRvsSandboxDefine =
      bool.hasEnvironment('AMAZON_RVS_SANDBOX');
  static const _amazonRvsSandboxFromEnvironment = String.fromEnvironment(
    'AMAZON_RVS_SANDBOX',
  );

  /// App Tester receipts only verify against Amazon's RVS Cloud Sandbox.
  static bool get amazonRvsSandbox =>
      (_hasAmazonRvsSandboxDefine
              ? _amazonRvsSandboxFromEnvironment
              : _fromDotenv('AMAZON_RVS_SANDBOX'))
          .toLowerCase() ==
      'true';

  // Consumable Product IDs
  static const List<String> consumableProductIds = [
    'dev.hyo.martie.10bulbs',
    'dev.hyo.martie.30bulbs',
  ];

  // Non-Consumable Product IDs
  static const List<String> nonConsumableProductIds = [
    'dev.hyo.martie.certified',
  ];

  // In-App Purchase Product IDs (Consumable + Non-Consumable)
  static final List<String> inAppProductIds = [
    ...consumableProductIds,
    ...nonConsumableProductIds,
  ];

  // Subscription Product IDs
  static const List<String> subscriptionProductIds = [
    'dev.hyo.martie.premium',
    'dev.hyo.martie.premium_year',
  ];

  // All product IDs combined
  static final List<String> allProductIds = [
    ...inAppProductIds,
    ...subscriptionProductIds,
  ];

  // Check if a product ID is a subscription
  static bool isSubscription(String productId) {
    return subscriptionProductIds.contains(productId);
  }

  // Check if a product ID is an in-app purchase
  static bool isInAppPurchase(String productId) {
    return inAppProductIds.contains(productId);
  }

  // Check if a product ID is consumable
  static bool isConsumable(String productId) {
    return consumableProductIds.contains(productId);
  }

  // Check if a product ID is non-consumable
  static bool isNonConsumable(String productId) {
    return nonConsumableProductIds.contains(productId);
  }

  // Get product type label
  static String getProductTypeLabel(String productId) {
    if (isSubscription(productId)) return 'Subscription';
    if (isConsumable(productId)) return 'Consumable';
    if (isNonConsumable(productId)) return 'Non-Consumable';
    return 'Unknown';
  }
}
