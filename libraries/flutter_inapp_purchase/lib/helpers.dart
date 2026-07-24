import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'deprecation.dart';
import 'errors.dart' as iap_err;
import 'flutter_inapp_purchase.dart';
import 'types.dart' as gentype;

final _billingPeriodRegExp = RegExp(r'^P(\d+)([DWMY])$');

String resolveProductType(Object type) {
  if (type is String) {
    if (type == 'inapp') {
      warnLegacyOnce(
        'product-type.raw-inapp',
        'The product type `inapp` is deprecated and will be removed in '
            'flutter_inapp_purchase 10.0.0. Use `in-app` instead.',
      );
      return 'in-app';
    }
    return type;
  }
  if (type is TypeInApp) {
    warnLegacyOnce(
      'product-type.type-in-app',
      'TypeInApp is deprecated and will be removed in '
          'flutter_inapp_purchase 10.0.0. Use ProductQueryType instead.',
    );
    return type == TypeInApp.inapp ? 'in-app' : 'subs';
  }
  if (type is gentype.ProductType) {
    return type == gentype.ProductType.InApp ? 'in-app' : 'subs';
  }
  if (type is gentype.ProductQueryType) {
    switch (type) {
      case gentype.ProductQueryType.InApp:
        return 'in-app';
      case gentype.ProductQueryType.Subs:
        return 'subs';
      case gentype.ProductQueryType.All:
        return 'all';
    }
  }
  return 'in-app';
}

dynamic _canonicalOrLegacy(
  Map<String, dynamic> payload, {
  required String canonicalKey,
  required String legacyKey,
  required String warningKey,
  required String message,
}) {
  if (payload.containsKey(canonicalKey)) {
    return payload[canonicalKey];
  }

  final legacy = payload[legacyKey];
  if (legacy != null) {
    warnLegacyOnce(warningKey, message);
  }
  return legacy;
}

String _resolveProductId(Map<String, dynamic> json) {
  if (json.containsKey('id')) {
    return json['id']?.toString() ?? '';
  }

  if (json.containsKey('productId')) {
    final legacyProductId = json['productId'];
    if (legacyProductId != null) {
      warnLegacyOnce(
        'product.productId',
        'The product `productId` field is deprecated and will be removed in '
            'flutter_inapp_purchase 10.0.0. Use `id` instead.',
      );
    }
    return legacyProductId?.toString() ?? '';
  }

  if (json.containsKey('sku')) {
    final legacySku = json['sku'];
    if (legacySku != null) {
      warnLegacyOnce(
        'product.sku',
        'The product `sku` field is deprecated and will be removed in '
            'flutter_inapp_purchase 10.0.0. Use `id` instead.',
      );
    }
    return legacySku?.toString() ?? '';
  }

  // StoreKit 1's productIdentifier remains outside the OpenIAP-owned legacy
  // wire cleanup and is intentionally not warned here.
  return json['productIdentifier']?.toString() ?? '';
}

gentype.ProductCommon parseProductFromNative(
  Map<String, dynamic> json,
  String type, {
  required bool fallbackIsIOS,
}) {
  // Determine platform from JSON data if available, otherwise use heuristics, then runtime
  gentype.IapPlatform platform;
  final dynamic platformRaw = json['platform'];
  if (platformRaw is String) {
    final v = platformRaw.toLowerCase();
    platform = (v == 'android')
        ? gentype.IapPlatform.Android
        : gentype.IapPlatform.IOS;
  } else if (platformRaw is gentype.IapPlatform) {
    platform = platformRaw;
  } else {
    // Heuristics based on well-known platform-specific fields
    final looksAndroid =
        json.containsKey('oneTimePurchaseOfferDetailsAndroid') ||
            json.containsKey('subscriptionOfferDetailsAndroid') ||
            json.containsKey('nameAndroid');
    final looksIOS = json.containsKey('subscriptionGroupIdIOS') ||
        json.containsKey('jsonRepresentationIOS') ||
        json.containsKey('environmentIOS');
    if (looksAndroid && !looksIOS) {
      platform = gentype.IapPlatform.Android;
    } else if (looksIOS && !looksAndroid) {
      platform = gentype.IapPlatform.IOS;
    } else {
      platform =
          fallbackIsIOS ? gentype.IapPlatform.IOS : gentype.IapPlatform.Android;
    }
  }

  double? parsePrice(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  final productId = _resolveProductId(json).trim();
  final title = json['title']?.toString() ?? productId;
  final description = json['description']?.toString() ?? '';
  final currency = json['currency']?.toString() ?? '';
  final displayPrice = json['displayPrice']?.toString() ??
      json['localizedPrice']?.toString() ??
      '0';
  final priceValue = parsePrice(json['price']);
  final productType = _parseProductType(type);

  if (productType == gentype.ProductType.Subs) {
    if (platform == gentype.IapPlatform.IOS) {
      return gentype.ProductSubscriptionIOS(
        currency: currency,
        description: description,
        displayNameIOS: json['displayNameIOS']?.toString() ?? title,
        displayPrice: displayPrice,
        id: productId,
        isFamilyShareableIOS: json['isFamilyShareableIOS'] as bool? ?? false,
        jsonRepresentationIOS:
            json['jsonRepresentationIOS']?.toString() ?? '{}',
        platform: platform,
        title: title,
        type: productType,
        typeIOS: _parseProductTypeIOS(json['typeIOS']?.toString()),
        debugDescription: json['debugDescription']?.toString(),
        discountsIOS: _parseDiscountsIOS(
          _canonicalOrLegacy(
            json,
            canonicalKey: 'discountsIOS',
            legacyKey: 'discounts',
            warningKey: 'product.discounts',
            message: 'The product `discounts` field is deprecated and will be '
                'removed in flutter_inapp_purchase 10.0.0. Use '
                '`subscriptionOffers` instead.',
          ),
        ),
        displayName: json['displayName']?.toString(),
        introductoryPriceAsAmountIOS:
            json['introductoryPriceAsAmountIOS']?.toString(),
        introductoryPriceIOS: json['introductoryPriceIOS']?.toString(),
        introductoryPriceNumberOfPeriodsIOS:
            json['introductoryPriceNumberOfPeriodsIOS']?.toString(),
        introductoryPricePaymentModeIOS: _parsePaymentMode(
          json['introductoryPricePaymentModeIOS'],
        ),
        introductoryPriceSubscriptionPeriodIOS: _parseSubscriptionPeriod(
          json['introductoryPriceSubscriptionPeriodIOS'],
        ),
        price: priceValue,
        pricingTermsIOS: _parseSubscriptionPricingTermsIOS(
          json['pricingTermsIOS'],
        ),
        subscriptionInfoIOS: _parseSubscriptionInfoIOS(
          _canonicalOrLegacy(
            json,
            canonicalKey: 'subscriptionInfoIOS',
            legacyKey: 'subscription',
            warningKey: 'product.subscription',
            message:
                'The product `subscription` field is deprecated and will be '
                'removed in flutter_inapp_purchase 10.0.0. Use '
                '`subscriptionOffers` for offer metadata and '
                '`subscriptionGroupIdIOS` for the group identifier instead.',
          ),
        ),
        subscriptionOffers: _parseStandardizedSubscriptionOffers(
          json['subscriptionOffers'],
        ),
        subscriptionGroupIdIOS: json['subscriptionGroupIdIOS']?.toString(),
        subscriptionPeriodNumberIOS:
            json['subscriptionPeriodNumberIOS']?.toString(),
        subscriptionPeriodUnitIOS: _parseSubscriptionPeriod(
          json['subscriptionPeriodUnitIOS'],
        ),
      );
    }

    final subscriptionOfferDetails = _parseOfferDetails(
      json['subscriptionOfferDetailsAndroid'],
    );
    final subscriptionOffers =
        _parseStandardizedSubscriptionOffers(json['subscriptionOffers']) ??
            _parseSubscriptionOffers(subscriptionOfferDetails);

    return gentype.ProductSubscriptionAndroid(
      currency: currency,
      description: description,
      discountOffers: _parseDiscountOffers(json['discountOffers']),
      displayPrice: displayPrice,
      id: productId,
      nameAndroid: json['nameAndroid']?.toString() ?? productId,
      platform: platform,
      subscriptionOfferDetailsAndroid: subscriptionOfferDetails,
      subscriptionOffers: subscriptionOffers,
      title: title,
      type: productType,
      debugDescription: json['debugDescription']?.toString(),
      displayName: json['displayName']?.toString(),
      oneTimePurchaseOfferDetailsAndroid: _parseOneTimePurchaseOfferDetails(
        json['oneTimePurchaseOfferDetailsAndroid'],
      ),
      price: priceValue,
      productStatusAndroid: _parseProductStatusAndroid(
        json['productStatusAndroid'],
      ),
    );
  }

  if (platform == gentype.IapPlatform.IOS) {
    return gentype.ProductIOS(
      currency: currency,
      description: description,
      displayNameIOS: json['displayNameIOS']?.toString() ?? title,
      displayPrice: displayPrice,
      id: productId,
      isFamilyShareableIOS: json['isFamilyShareableIOS'] as bool? ?? false,
      jsonRepresentationIOS: json['jsonRepresentationIOS']?.toString() ?? '{}',
      platform: platform,
      title: title,
      type: productType,
      typeIOS: _parseProductTypeIOS(json['typeIOS']?.toString()),
      debugDescription: json['debugDescription']?.toString(),
      displayName: json['displayName']?.toString(),
      price: priceValue,
      pricingTermsIOS: _parseSubscriptionPricingTermsIOS(
        json['pricingTermsIOS'],
      ),
      subscriptionInfoIOS: _parseSubscriptionInfoIOS(
        _canonicalOrLegacy(
          json,
          canonicalKey: 'subscriptionInfoIOS',
          legacyKey: 'subscription',
          warningKey: 'product.subscription',
          message: 'The product `subscription` field is deprecated and will be '
              'removed in flutter_inapp_purchase 10.0.0. Use '
              '`subscriptionOffers` for offer metadata instead.',
        ),
      ),
      subscriptionOffers: _parseStandardizedSubscriptionOffers(
        json['subscriptionOffers'],
      ),
    );
  }

  final androidOffers = _parseOfferDetails(
    json['subscriptionOfferDetailsAndroid'],
  );

  return gentype.ProductAndroid(
    currency: currency,
    description: description,
    displayPrice: displayPrice,
    id: productId,
    nameAndroid: json['nameAndroid']?.toString() ?? productId,
    platform: platform,
    title: title,
    type: productType,
    debugDescription: json['debugDescription']?.toString(),
    discountOffers: _parseDiscountOffers(json['discountOffers']),
    displayName: json['displayName']?.toString(),
    oneTimePurchaseOfferDetailsAndroid: _parseOneTimePurchaseOfferDetails(
      json['oneTimePurchaseOfferDetailsAndroid'],
    ),
    price: priceValue,
    productStatusAndroid: _parseProductStatusAndroid(
      json['productStatusAndroid'],
    ),
    subscriptionOfferDetailsAndroid:
        androidOffers.isEmpty ? null : androidOffers,
    subscriptionOffers:
        _parseStandardizedSubscriptionOffers(json['subscriptionOffers']) ??
            (androidOffers.isEmpty
                ? null
                : _parseSubscriptionOffers(androidOffers)),
  );
}

gentype.Purchase convertToPurchase(
  Map<String, dynamic> itemJson, {
  required bool platformIsAndroid,
  required bool platformIsIOS,
  required Map<String, bool> acknowledgedAndroidPurchaseTokens,
  Map<String, dynamic>? originalJson,
}) {
  // Native SDKs serialize the generated Purchase types directly. Preserve that
  // canonical payload as the base so newly generated optional fields are not
  // silently dropped by this legacy compatibility adapter.
  //
  // The fallback wire keys below are accepted through
  // flutter_inapp_purchase 9.x only and are scheduled for removal in 10.0.0.
  // New native bridges, fixtures, and custom MethodChannel producers must emit
  // the canonical OpenIAP keys.
  final sourcePayload = normalizeDynamicMap(<String, dynamic>{
    if (originalJson != null) ...originalJson,
    ...itemJson,
  })!;

  final productId = sourcePayload['productId']?.toString() ?? '';
  final hasSourceId = sourcePayload.containsKey('id');
  final sourceId = sourcePayload['id']?.toString();
  final transactionIdSelection = _transactionIdFrom(sourcePayload);
  final sourceTransactionId = transactionIdSelection.value;
  final dynamic quantityValue = sourcePayload['quantity'];
  int quantity = 1;
  if (quantityValue is num) {
    quantity = quantityValue.toInt();
  } else if (quantityValue is String) {
    final parsedQuantity = int.tryParse(quantityValue.trim());
    if (parsedQuantity != null) {
      quantity = parsedQuantity;
    }
  }

  final String? purchaseId = hasSourceId
      ? ((sourceId?.isNotEmpty ?? false) ? sourceId : null)
      : (sourceTransactionId?.isNotEmpty ?? false)
          ? sourceTransactionId
          : (productId.isNotEmpty ? productId : null);

  if (purchaseId == null || purchaseId.isEmpty) {
    debugPrint(
      '[flutter_inapp_purchase] Skipping purchase with missing identifiers',
    );
    throw const FormatException('Missing purchase identifier');
  }

  final transactionDate =
      _parseTimestampMilliseconds(sourcePayload['transactionDate']) ?? 0;

  if (platformIsAndroid) {
    final hasSelectedPurchaseState =
        sourcePayload.containsKey('purchaseState') ||
            sourcePayload.containsKey('purchaseStateAndroid');
    final stateValue = _coerceAndroidPurchaseState(
      _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'purchaseState',
        legacyKey: 'purchaseStateAndroid',
        warningKey: 'purchase.purchaseStateAndroid',
        message: 'The purchase `purchaseStateAndroid` field is deprecated and '
            'will be removed in flutter_inapp_purchase 10.0.0. Use '
            '`purchaseState` instead.',
      ),
      hasSelectedState: hasSelectedPurchaseState,
    );
    final purchaseState = _mapAndroidPurchaseState(stateValue).toJson();

    // Determine store from input or default based on platform
    final storeValue = sourcePayload['store']?.toString() ?? 'google';
    final androidTransactionId = _resolveAndroidTransactionId(
      hasCanonicalTransactionId: transactionIdSelection.isPresent,
      canonicalTransactionId: sourceTransactionId,
      id: sourceId,
      purchaseToken: sourcePayload['purchaseToken']?.toString(),
      store: storeValue,
    );
    if (!transactionIdSelection.isPresent &&
        androidTransactionId != null &&
        androidTransactionId == sourceId) {
      warnLegacyOnce(
        'purchase.id-transaction-id',
        'Using purchase `id` as `transactionId` is deprecated and will be '
            'removed in flutter_inapp_purchase 10.0.0. Emit `transactionId` '
            'directly instead.',
      );
    }

    final map = <String, dynamic>{
      ...sourcePayload,
      'id': purchaseId,
      'productId': productId,
      'platform': gentype.IapPlatform.Android.toJson(),
      'store': storeValue,
      'isAutoRenewing': sourcePayload['isAutoRenewing'] as bool? ??
          sourcePayload['autoRenewingAndroid'] as bool? ??
          false,
      'purchaseState': purchaseState,
      'quantity': quantity,
      'transactionDate': transactionDate,
      'purchaseToken': sourcePayload['purchaseToken']?.toString(),
      'autoRenewingAndroid': sourcePayload['autoRenewingAndroid'] as bool?,
      'currentPlanId': sourcePayload['currentPlanId']?.toString(),
      'dataAndroid': _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'dataAndroid',
        legacyKey: 'originalJsonAndroid',
        warningKey: 'purchase.originalJsonAndroid',
        message: 'The purchase `originalJsonAndroid` field is deprecated and '
            'will be removed in flutter_inapp_purchase 10.0.0. Use '
            '`dataAndroid` instead.',
      )?.toString(),
      'developerPayloadAndroid':
          sourcePayload['developerPayloadAndroid']?.toString(),
      'ids': _toStringList(sourcePayload['ids']),
      'isAcknowledgedAndroid': sourcePayload['isAcknowledgedAndroid'] as bool?,
      'obfuscatedAccountIdAndroid':
          sourcePayload['obfuscatedAccountIdAndroid']?.toString(),
      'obfuscatedProfileIdAndroid':
          sourcePayload['obfuscatedProfileIdAndroid']?.toString(),
      'packageNameAndroid': sourcePayload['packageNameAndroid']?.toString(),
      'signatureAndroid': sourcePayload['signatureAndroid']?.toString(),
      // Pending/orderless Play purchases legitimately have no order ID.
      // Legacy native payloads only exposed it through `id`, so recover that
      // value only when it is distinguishable from a Google purchase token.
      // The `id` transaction fallback ends in 10.0.0.
      'transactionId': androidTransactionId,
    };

    final purchaseToken = sourcePayload['purchaseToken']?.toString();
    if (purchaseToken != null && purchaseToken.isNotEmpty) {
      acknowledgedAndroidPurchaseTokens[purchaseToken] =
          sourcePayload['isAcknowledgedAndroid'] as bool? ?? false;
    }

    return gentype.PurchaseAndroid.fromJson(map);
  }

  if (platformIsIOS) {
    final stateIOS = _parsePurchaseStateIOS(
      _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'purchaseState',
        legacyKey: 'transactionStateIOS',
        warningKey: 'purchase.transactionStateIOS',
        message: 'The purchase `transactionStateIOS` field is deprecated and '
            'will be removed in flutter_inapp_purchase 10.0.0. Use '
            '`purchaseState` instead.',
      ),
    ).toJson();

    final originalTransactionDateIOS = _parseTimestampMilliseconds(
      sourcePayload['originalTransactionDateIOS'],
    );

    // Determine store from input or default based on platform
    final storeValueIOS = sourcePayload['store']?.toString() ?? 'apple';
    if (!transactionIdSelection.isPresent && (sourceId?.isNotEmpty ?? false)) {
      warnLegacyOnce(
        'purchase.id-transaction-id',
        'Using purchase `id` as `transactionId` is deprecated and will be '
            'removed in flutter_inapp_purchase 10.0.0. Emit `transactionId` '
            'directly instead.',
      );
    }

    final map = <String, dynamic>{
      ...sourcePayload,
      'id': purchaseId,
      'productId': productId,
      'platform': gentype.IapPlatform.IOS.toJson(),
      'store': storeValueIOS,
      'isAutoRenewing': sourcePayload['isAutoRenewing'] as bool? ?? false,
      'purchaseState': stateIOS,
      'quantity': quantity,
      'transactionDate': transactionDate,
      'purchaseToken': _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'purchaseToken',
        legacyKey: 'transactionReceipt',
        warningKey: 'purchase.transactionReceipt',
        message: 'The purchase `transactionReceipt` field is deprecated and '
            'will be removed in flutter_inapp_purchase 10.0.0. Use '
            '`purchaseToken` instead.',
      )?.toString(),
      'ids': _toStringList(sourcePayload['ids']),
      'appAccountToken': sourcePayload['appAccountToken']?.toString(),
      'appBundleIdIOS': sourcePayload['appBundleIdIOS']?.toString(),
      'countryCodeIOS': sourcePayload['countryCodeIOS']?.toString(),
      'currencyCodeIOS': sourcePayload['currencyCodeIOS']?.toString(),
      'currencySymbolIOS': sourcePayload['currencySymbolIOS']?.toString(),
      'environmentIOS': sourcePayload['environmentIOS']?.toString(),
      'expirationDateIOS':
          _parseTimestampMilliseconds(sourcePayload['expirationDateIOS']),
      'originalTransactionIdentifierIOS':
          sourcePayload['originalTransactionIdentifierIOS']?.toString(),
      'originalTransactionDateIOS': originalTransactionDateIOS,
      'subscriptionGroupIdIOS':
          sourcePayload['subscriptionGroupIdIOS']?.toString(),
      'transactionId': transactionIdSelection.isPresent
          ? sourceTransactionId ?? ''
          // The legacy `id` transaction fallback ends in 10.0.0.
          : purchaseId,
      'transactionReasonIOS': sourcePayload['transactionReasonIOS']?.toString(),
      'webOrderLineItemIdIOS':
          sourcePayload['webOrderLineItemIdIOS']?.toString(),
      'revocationDateIOS':
          _parseTimestampMilliseconds(sourcePayload['revocationDateIOS']),
      'revocationReasonIOS': sourcePayload['revocationReasonIOS']?.toString(),
    };

    return gentype.PurchaseIOS.fromJson(map);
  }

  throw const FormatException('Unsupported platform for legacy purchase');
}

iap_err.PurchaseError convertToPurchaseError(
  PurchaseResult result, {
  required gentype.IapPlatform platform,
}) {
  gentype.ErrorCode code = gentype.ErrorCode.Unknown;

  if (result.code != null && result.code!.isNotEmpty) {
    final detected = iap_err.ErrorCodeUtils.fromPlatformCode(
      result.code!,
      platform,
    );
    if (detected != gentype.ErrorCode.Unknown) {
      code = detected;
    }
  }

  if (code == gentype.ErrorCode.Unknown) {
    switch (result.responseCode) {
      case 0:
        code = gentype.ErrorCode.Unknown;
        break;
      case 1:
        code = gentype.ErrorCode.UserCancelled;
        break;
      case 2:
        code = gentype.ErrorCode.ServiceError;
        break;
      case 3:
        code = gentype.ErrorCode.BillingUnavailable;
        break;
      case 4:
        code = gentype.ErrorCode.ItemUnavailable;
        break;
      case 5:
        code = gentype.ErrorCode.DeveloperError;
        break;
      case 6:
        code = gentype.ErrorCode.Unknown;
        break;
      case 7:
        code = gentype.ErrorCode.AlreadyOwned;
        break;
      case 8:
        code = gentype.ErrorCode.PurchaseError;
        break;
    }
  }

  return iap_err.PurchaseError(
    message: result.message ?? 'Unknown error',
    code: code,
    responseCode: result.responseCode,
    debugMessage: result.debugMessage,
    productId: result.productId,
    productIds: result.productIds,
    productType: result.productType,
    isEmptyProductList: result.isEmptyProductList,
    subResponseCodeAndroid: result.subResponseCodeAndroid,
    platform: platform,
  );
}

List<gentype.Purchase> extractPurchases(
  dynamic result, {
  required bool platformIsAndroid,
  required bool platformIsIOS,
  required Map<String, bool> acknowledgedAndroidPurchaseTokens,
}) {
  List<dynamic> list;
  if (result is String) {
    list = json.decode(result) as List<dynamic>;
  } else if (result is List) {
    list = result;
  } else {
    list = json.decode(result.toString()) as List<dynamic>;
  }

  final purchases = <gentype.Purchase>[];
  for (final dynamic product in list) {
    try {
      if (product is! Map) {
        debugPrint(
          '[flutter_inapp_purchase] Skipping purchase with unexpected type: ${product.runtimeType}',
        );
        continue;
      }
      // Safely convert map keys to strings to handle cases where platform channels
      // return maps with non-string keys (e.g., Map<Object?, Object?>)
      final map = normalizeDynamicMap(product);
      if (map == null) {
        debugPrint(
          '[flutter_inapp_purchase] Skipping purchase: failed to normalize map',
        );
        continue;
      }
      final original = map; // Use normalized data to access additional fields
      purchases.add(
        convertToPurchase(
          map,
          originalJson: original,
          platformIsAndroid: platformIsAndroid,
          platformIsIOS: platformIsIOS,
          acknowledgedAndroidPurchaseTokens: acknowledgedAndroidPurchaseTokens,
        ),
      );
    } catch (error) {
      debugPrint(
        '[flutter_inapp_purchase] Skipping purchase due to parse error: $error',
      );
    }
  }

  return purchases;
}

// Private helper functions --------------------------------------------------

/// Safe double parsing that handles both num and String inputs.
double? _toDouble(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

double? _parseTimestampMilliseconds(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is! String) return null;

  final trimmed = value.trim();
  final numeric = double.tryParse(trimmed);
  if (numeric != null) return numeric;

  return DateTime.tryParse(trimmed)?.millisecondsSinceEpoch.toDouble();
}

List<String>? _toStringList(dynamic value) {
  if (value is! List) return null;
  return value.map((item) => item.toString()).toList();
}

String? _resolveAndroidTransactionId({
  required bool hasCanonicalTransactionId,
  required String? canonicalTransactionId,
  required String? id,
  required String? purchaseToken,
  required String store,
}) {
  if (hasCanonicalTransactionId) {
    return canonicalTransactionId;
  }
  if (id == null || id.isEmpty) return null;
  if (store.toLowerCase() == 'google' && id == purchaseToken) return null;
  return id;
}

({bool isPresent, String? value}) _transactionIdFrom(
  Map<String, dynamic> payload,
) {
  if (!payload.containsKey('transactionId')) {
    return (isPresent: false, value: null);
  }

  return (
    isPresent: true,
    value: payload['transactionId']?.toString(),
  );
}

/// Safe int parsing that handles both num and String inputs.
int? _toInt(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

gentype.ProductType _parseProductType(dynamic value) {
  if (value is gentype.ProductType) return value;
  final rawUpper = value?.toString().toUpperCase() ?? 'IN_APP';
  final normalized = rawUpper == 'INAPP' ? 'IN_APP' : rawUpper;
  try {
    return gentype.ProductType.fromJson(normalized);
  } catch (_) {
    return normalized.contains('SUB')
        ? gentype.ProductType.Subs
        : gentype.ProductType.InApp;
  }
}

gentype.ProductTypeIOS _parseProductTypeIOS(String? value) {
  final rawUpper = value?.toString().toUpperCase() ?? 'NON_CONSUMABLE';
  final normalized = rawUpper == 'NONCONSUMABLE' ? 'NON_CONSUMABLE' : rawUpper;
  try {
    return gentype.ProductTypeIOS.fromJson(normalized);
  } catch (_) {
    switch (normalized) {
      case 'CONSUMABLE':
        return gentype.ProductTypeIOS.Consumable;
      case 'AUTO_RENEWABLE_SUBSCRIPTION':
      case 'SUBS':
      case 'SUBSCRIPTION':
        return gentype.ProductTypeIOS.AutoRenewableSubscription;
      case 'NON_RENEWING_SUBSCRIPTION':
        return gentype.ProductTypeIOS.NonRenewingSubscription;
      default:
        return gentype.ProductTypeIOS.NonConsumable;
    }
  }
}

List<gentype.DiscountIOS>? _parseDiscountsIOS(dynamic json) {
  if (json == null) return null;
  final list = json as List<dynamic>;
  return list
      .map(
        (e) => gentype.DiscountIOS.fromJson(
          e is Map<String, dynamic>
              ? e
              : (e as Map).map<String, dynamic>(
                  (key, value) => MapEntry(key.toString(), value),
                ),
        ),
      )
      .toList();
}

List<dynamic>? _parseNativeList(dynamic value) {
  if (value == null) return null;
  if (value is List) return value;
  if (value is String) {
    try {
      final decoded = jsonDecode(value);
      return decoded is List ? decoded : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

List<T>? _parseGeneratedList<T>(
  dynamic value,
  T Function(Map<String, dynamic>) fromJson,
) {
  if (value is List<T>) return value.isEmpty ? null : value;
  final list = _parseNativeList(value);
  if (list == null) return null;

  final parsed = <T>[];
  for (final item in list) {
    if (item is T) {
      parsed.add(item);
      continue;
    }
    final map = normalizeDynamicMap(item);
    if (map == null) continue;
    try {
      parsed.add(fromJson(map));
    } catch (_) {
      continue;
    }
  }
  return parsed.isEmpty ? null : parsed;
}

List<gentype.SubscriptionPricingTermsIOS>? _parseSubscriptionPricingTermsIOS(
  dynamic value,
) =>
    _parseGeneratedList(value, gentype.SubscriptionPricingTermsIOS.fromJson);

List<gentype.DiscountOffer>? _parseDiscountOffers(dynamic value) =>
    _parseGeneratedList(value, gentype.DiscountOffer.fromJson);

List<gentype.SubscriptionOffer>? _parseStandardizedSubscriptionOffers(
  dynamic value,
) {
  final list = _parseNativeList(value);
  if (list == null) return null;
  return _parseGeneratedList(list, gentype.SubscriptionOffer.fromJson) ??
      _parseSubscriptionOffersIOS(list);
}

gentype.ProductStatusAndroid? _parseProductStatusAndroid(dynamic value) {
  if (value == null) return null;
  if (value is gentype.ProductStatusAndroid) return value;
  try {
    return gentype.ProductStatusAndroid.fromJson(value.toString());
  } catch (_) {
    return null;
  }
}

gentype.InstallmentPlanDetailsAndroid? _parseInstallmentPlanDetailsAndroid(
  dynamic value,
) {
  if (value is gentype.InstallmentPlanDetailsAndroid) return value;
  final map = normalizeDynamicMap(value);
  if (map == null) return null;
  return gentype.InstallmentPlanDetailsAndroid(
    commitmentPaymentsCount: _toInt(map['commitmentPaymentsCount']) ?? 0,
    subsequentCommitmentPaymentsCount:
        _toInt(map['subsequentCommitmentPaymentsCount']) ?? 0,
  );
}

List<gentype.ProductSubscriptionAndroidOfferDetails> _parseOfferDetails(
  dynamic json,
) {
  if (json == null) {
    return const <gentype.ProductSubscriptionAndroidOfferDetails>[];
  }

  // Handle both List and String (JSON string from Android)
  List<dynamic> list;
  if (json is String) {
    // Parse JSON string from Android
    try {
      final parsed = jsonDecode(json);
      if (parsed is! List) {
        return const <gentype.ProductSubscriptionAndroidOfferDetails>[];
      }
      list = parsed;
    } catch (e) {
      return const <gentype.ProductSubscriptionAndroidOfferDetails>[];
    }
  } else if (json is List) {
    list = json;
  } else {
    return const <gentype.ProductSubscriptionAndroidOfferDetails>[];
  }

  return list
      .map((item) {
        // Convert Map<Object?, Object?> to Map<String, dynamic>
        final Map<String, dynamic> e;
        if (item is Map<String, dynamic>) {
          e = item;
        } else if (item is Map) {
          e = item.map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          );
        } else {
          // Skip invalid items
          return null;
        }
        return gentype.ProductSubscriptionAndroidOfferDetails(
          basePlanId: e['basePlanId'] as String? ?? '',
          installmentPlanDetails: _parseInstallmentPlanDetailsAndroid(
            e['installmentPlanDetails'],
          ),
          offerId: e['offerId'] as String?,
          offerToken: e['offerToken'] as String? ?? '',
          offerTags: (e['offerTags'] as List<dynamic>?)
                  ?.map((tag) => tag.toString())
                  .toList() ??
              const <String>[],
          pricingPhases: _parsePricingPhases(e['pricingPhases']),
        );
      })
      .whereType<gentype.ProductSubscriptionAndroidOfferDetails>()
      .toList();
}

gentype.PricingPhasesAndroid _parsePricingPhases(dynamic json) {
  if (json == null) {
    return const gentype.PricingPhasesAndroid(pricingPhaseList: []);
  }

  // Handle nested structure from Android
  List<dynamic>? list;
  if (json is Map && json['pricingPhaseList'] != null) {
    list = json['pricingPhaseList'] as List<dynamic>?;
  } else if (json is List) {
    list = json;
  }

  if (list == null) {
    return const gentype.PricingPhasesAndroid(pricingPhaseList: []);
  }

  final phases = list
      .map((item) {
        // Convert Map<Object?, Object?> to Map<String, dynamic>
        final Map<String, dynamic> e;
        if (item is Map<String, dynamic>) {
          e = item;
        } else if (item is Map) {
          e = item.map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          );
        } else {
          // Skip invalid items
          return null;
        }

        final priceAmountMicros = e['priceAmountMicros'];
        final recurrenceMode = e['recurrenceMode'];

        return gentype.PricingPhaseAndroid(
          billingCycleCount: (e['billingCycleCount'] as num?)?.toInt() ?? 0,
          billingPeriod: e['billingPeriod']?.toString() ?? '',
          formattedPrice: e['formattedPrice']?.toString() ?? '0',
          priceAmountMicros: priceAmountMicros?.toString() ?? '0',
          priceCurrencyCode: e['priceCurrencyCode']?.toString() ?? 'USD',
          recurrenceMode: recurrenceMode is int ? recurrenceMode : 0,
        );
      })
      .whereType<gentype.PricingPhaseAndroid>()
      .toList();

  return gentype.PricingPhasesAndroid(pricingPhaseList: phases);
}

gentype.SubscriptionInfoIOS? _parseSubscriptionInfoIOS(dynamic value) {
  final normalizedMap = normalizeDynamicMap(value);
  if (normalizedMap != null) {
    return gentype.SubscriptionInfoIOS.fromJson(normalizedMap);
  }
  if (value is List && value.isNotEmpty) {
    for (final candidate in value) {
      final map = normalizeDynamicMap(candidate);
      if (map != null) {
        return gentype.SubscriptionInfoIOS.fromJson(map);
      }
    }
  }
  return null;
}

/// Parse standardized SubscriptionOffer list from iOS native data.
List<gentype.SubscriptionOffer>? _parseSubscriptionOffersIOS(dynamic json) {
  if (json == null) return null;
  if (json is! List) return null;

  final offers = <gentype.SubscriptionOffer>[];
  for (final item in json) {
    final map = normalizeDynamicMap(item);
    if (map == null) continue;

    // Parse payment mode
    gentype.PaymentMode? paymentMode;
    final paymentModeRaw = map['paymentMode']?.toString().toUpperCase();
    if (paymentModeRaw != null) {
      try {
        paymentMode = gentype.PaymentMode.fromJson(paymentModeRaw);
      } catch (_) {
        // Fallback for non-standard values not handled by fromJson
        switch (paymentModeRaw) {
          case 'FREETRIAL':
            paymentMode = gentype.PaymentMode.FreeTrial;
            break;
          case 'PAYUPFRONT':
            paymentMode = gentype.PaymentMode.PayUpFront;
            break;
          case 'PAYASYOUGO':
            paymentMode = gentype.PaymentMode.PayAsYouGo;
            break;
        }
      }
    }

    // Parse offer type
    gentype.DiscountOfferType type = gentype.DiscountOfferType.Introductory;
    final typeRaw = map['type']?.toString().toUpperCase();
    if (typeRaw != null) {
      try {
        type = gentype.DiscountOfferType.fromJson(typeRaw);
      } catch (_) {
        // Fallback for non-standard values not handled by fromJson
        switch (typeRaw) {
          case 'WIN_BACK':
          case 'WINBACK':
          case 'CODE':
            type = gentype.DiscountOfferType.Promotional;
            break;
          case 'ONETIME':
            type = gentype.DiscountOfferType.OneTime;
            break;
        }
      }
    }

    // Parse period
    gentype.SubscriptionPeriod? period;
    final periodMap = normalizeDynamicMap(map['period']);
    if (periodMap != null) {
      final unitRaw = periodMap['unit']?.toString().toUpperCase();
      final value = _toInt(periodMap['value']) ?? 1;
      gentype.SubscriptionPeriodUnit? unit;
      if (unitRaw != null) {
        try {
          unit = gentype.SubscriptionPeriodUnit.fromJson(unitRaw);
        } catch (_) {
          // ignore
        }
      }
      if (unit != null) {
        period = gentype.SubscriptionPeriod(unit: unit, value: value);
      }
    }

    offers.add(
      gentype.SubscriptionOffer(
        id: map['id']?.toString() ?? '',
        displayPrice: map['displayPrice']?.toString() ?? '',
        price: _toDouble(map['price']) ?? 0,
        currency: map['currency']?.toString(),
        type: type,
        paymentMode: paymentMode,
        period: period,
        periodCount: _toInt(map['periodCount']),
        keyIdentifierIOS: map['keyIdentifierIOS']?.toString(),
        nonceIOS: map['nonceIOS']?.toString(),
        signatureIOS: map['signatureIOS']?.toString(),
        timestampIOS: _toDouble(map['timestampIOS']),
        numberOfPeriodsIOS: _toInt(map['numberOfPeriodsIOS']),
        localizedPriceIOS: map['localizedPriceIOS']?.toString(),
      ),
    );
  }

  return offers.isEmpty ? null : offers;
}

/// Parse standardized SubscriptionOffer list from subscription offer details.
/// Converts legacy subscriptionOfferDetailsAndroid to cross-platform SubscriptionOffer.
List<gentype.SubscriptionOffer> _parseSubscriptionOffers(
  List<gentype.ProductSubscriptionAndroidOfferDetails> offerDetails,
) {
  return offerDetails.map((offer) {
    // Determine payment mode and price from first pricing phase
    gentype.PaymentMode? paymentMode;
    gentype.SubscriptionPeriod? period;
    int? periodCount;
    String displayPrice = '';
    double price = 0;
    String? currency;

    if (offer.pricingPhases.pricingPhaseList.isNotEmpty) {
      final firstPhase = offer.pricingPhases.pricingPhaseList.first;
      final priceAmountMicros = int.tryParse(firstPhase.priceAmountMicros) ?? 0;
      final recurrenceMode = firstPhase.recurrenceMode;
      period = _parseBillingPeriod(firstPhase.billingPeriod);
      periodCount = firstPhase.billingCycleCount;

      if (priceAmountMicros == 0) {
        paymentMode = gentype.PaymentMode.FreeTrial;
      } else if (recurrenceMode == 3) {
        // NON_RECURRING
        paymentMode = gentype.PaymentMode.PayUpFront;
      } else {
        paymentMode = gentype.PaymentMode.PayAsYouGo;
      }

      displayPrice = firstPhase.formattedPrice;
      price = priceAmountMicros / 1000000;
      currency = firstPhase.priceCurrencyCode;
    }

    // Determine offer type
    final gentype.DiscountOfferType type;
    if (offer.offerId != null && offer.offerId!.isNotEmpty) {
      type = gentype.DiscountOfferType.Promotional;
    } else {
      type = gentype.DiscountOfferType.Introductory;
    }

    return gentype.SubscriptionOffer(
      id: offer.offerId ?? offer.basePlanId,
      displayPrice: displayPrice,
      price: price,
      currency: currency,
      type: type,
      paymentMode: paymentMode,
      period: period,
      periodCount: periodCount,
      basePlanIdAndroid: offer.basePlanId,
      installmentPlanDetailsAndroid: offer.installmentPlanDetails,
      offerTokenAndroid: offer.offerToken,
      offerTagsAndroid: offer.offerTags,
      pricingPhasesAndroid: offer.pricingPhases,
    );
  }).toList();
}

gentype.SubscriptionPeriod? _parseBillingPeriod(String billingPeriod) {
  final match = _billingPeriodRegExp.firstMatch(billingPeriod);
  if (match == null) return null;
  final value = int.tryParse(match.group(1) ?? '');
  if (value == null) return null;

  final unit = switch (match.group(2)) {
    'D' => gentype.SubscriptionPeriodUnit.Day,
    'W' => gentype.SubscriptionPeriodUnit.Week,
    'M' => gentype.SubscriptionPeriodUnit.Month,
    'Y' => gentype.SubscriptionPeriodUnit.Year,
    _ => gentype.SubscriptionPeriodUnit.Unknown,
  };
  return gentype.SubscriptionPeriod(unit: unit, value: value);
}

gentype.SubscriptionPeriodIOS? _parseSubscriptionPeriod(dynamic value) {
  if (value == null) return null;
  final raw = value.toString().toUpperCase();
  try {
    return gentype.SubscriptionPeriodIOS.fromJson(raw);
  } catch (_) {
    return null;
  }
}

Map<String, dynamic>? normalizeDynamicMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value.map<String, dynamic>(
      (key, dynamic val) => MapEntry(key, normalizeDynamicValue(val)),
    );
  }
  if (value is Map) {
    final normalized = <String, dynamic>{};
    value.forEach((dynamic key, dynamic val) {
      if (key == null) {
        return;
      }
      final stringKey = key.toString();
      if (stringKey.isEmpty) {
        return;
      }
      normalized[stringKey] = normalizeDynamicValue(val);
    });
    return normalized;
  }
  return null;
}

dynamic normalizeDynamicValue(dynamic value) {
  if (value is Map || value is Map<dynamic, dynamic>) {
    return normalizeDynamicMap(value);
  }
  if (value is List) {
    return value.map<dynamic>(normalizeDynamicValue).toList();
  }
  return value;
}

gentype.PaymentModeIOS _parsePaymentMode(dynamic value) {
  if (value == null) return gentype.PaymentModeIOS.Empty;
  final raw = value.toString().toUpperCase();
  try {
    return gentype.PaymentModeIOS.fromJson(raw);
  } catch (_) {
    return gentype.PaymentModeIOS.Empty;
  }
}

/// Parses oneTimePurchaseOfferDetailsAndroid - handles both array (new 7.0+)
/// and single object (legacy) for backwards compatibility
List<gentype.ProductAndroidOneTimePurchaseOfferDetail>?
    _parseOneTimePurchaseOfferDetails(dynamic value) {
  if (value == null) return null;

  // New format: array of offers (Android 7.0+)
  if (value is List) {
    return value
        .map((e) => _parseSingleOneTimePurchaseOfferDetail(e))
        .whereType<gentype.ProductAndroidOneTimePurchaseOfferDetail>()
        .toList();
  }

  // Legacy format: single object - wrap in list for compatibility
  final single = _parseSingleOneTimePurchaseOfferDetail(value);
  if (single != null) {
    return [single];
  }

  return null;
}

gentype.ProductAndroidOneTimePurchaseOfferDetail?
    _parseSingleOneTimePurchaseOfferDetail(dynamic value) {
  if (value is Map<String, dynamic>) {
    return gentype.ProductAndroidOneTimePurchaseOfferDetail(
      formattedPrice: value['formattedPrice']?.toString() ?? '0',
      priceAmountMicros: value['priceAmountMicros']?.toString() ?? '0',
      priceCurrencyCode: value['priceCurrencyCode']?.toString() ?? 'USD',
      offerTags: (value['offerTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      offerToken: value['offerToken']?.toString() ?? '',
      offerId: value['offerId']?.toString(),
      fullPriceMicros: value['fullPriceMicros']?.toString(),
      purchaseOptionId: value['purchaseOptionId']?.toString(),
      discountDisplayInfo: value['discountDisplayInfo'] != null
          ? gentype.DiscountDisplayInfoAndroid.fromJson(
              value['discountDisplayInfo'] as Map<String, dynamic>,
            )
          : null,
      limitedQuantityInfo: value['limitedQuantityInfo'] != null
          ? gentype.LimitedQuantityInfoAndroid.fromJson(
              value['limitedQuantityInfo'] as Map<String, dynamic>,
            )
          : null,
      validTimeWindow: _parseValidTimeWindow(value['validTimeWindow']),
      preorderDetailsAndroid: value['preorderDetailsAndroid'] != null
          ? gentype.PreorderDetailsAndroid.fromJson(
              value['preorderDetailsAndroid'] as Map<String, dynamic>,
            )
          : null,
      rentalDetailsAndroid: value['rentalDetailsAndroid'] != null
          ? gentype.RentalDetailsAndroid.fromJson(
              value['rentalDetailsAndroid'] as Map<String, dynamic>,
            )
          : null,
    );
  }
  if (value is Map) {
    final map = value.map<String, dynamic>(
      (key, val) => MapEntry(key.toString(), val),
    );
    return gentype.ProductAndroidOneTimePurchaseOfferDetail(
      formattedPrice: map['formattedPrice']?.toString() ?? '0',
      priceAmountMicros: map['priceAmountMicros']?.toString() ?? '0',
      priceCurrencyCode: map['priceCurrencyCode']?.toString() ?? 'USD',
      offerTags: (map['offerTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      offerToken: map['offerToken']?.toString() ?? '',
      offerId: map['offerId']?.toString(),
      fullPriceMicros: map['fullPriceMicros']?.toString(),
      purchaseOptionId: map['purchaseOptionId']?.toString(),
      discountDisplayInfo: map['discountDisplayInfo'] != null
          ? gentype.DiscountDisplayInfoAndroid.fromJson(
              Map<String, dynamic>.from(
                map['discountDisplayInfo'] as Map<dynamic, dynamic>,
              ),
            )
          : null,
      limitedQuantityInfo: map['limitedQuantityInfo'] != null
          ? gentype.LimitedQuantityInfoAndroid.fromJson(
              Map<String, dynamic>.from(
                map['limitedQuantityInfo'] as Map<dynamic, dynamic>,
              ),
            )
          : null,
      validTimeWindow: _parseValidTimeWindow(map['validTimeWindow']),
      preorderDetailsAndroid: map['preorderDetailsAndroid'] != null
          ? gentype.PreorderDetailsAndroid.fromJson(
              Map<String, dynamic>.from(
                map['preorderDetailsAndroid'] as Map<dynamic, dynamic>,
              ),
            )
          : null,
      rentalDetailsAndroid: map['rentalDetailsAndroid'] != null
          ? gentype.RentalDetailsAndroid.fromJson(
              Map<String, dynamic>.from(
                map['rentalDetailsAndroid'] as Map<dynamic, dynamic>,
              ),
            )
          : null,
    );
  }
  return null;
}

gentype.ValidTimeWindowAndroid? _parseValidTimeWindow(dynamic value) {
  if (value == null) return null;
  final map = normalizeDynamicMap(value);
  if (map == null) return null;
  return gentype.ValidTimeWindowAndroid.fromJson({
    'endTimeMillis': map['endTimeMillis']?.toString() ?? '',
    'startTimeMillis': map['startTimeMillis']?.toString() ?? '',
  });
}

gentype.PurchaseState _parsePurchaseStateIOS(dynamic value) {
  if (value is gentype.PurchaseState) return value;
  if (value is String) {
    switch (value.toLowerCase()) {
      case 'purchasing':
      case 'pending':
        return gentype.PurchaseState.Pending;
      case 'purchased':
      case 'restored':
        return gentype.PurchaseState.Purchased;
      // Failed, deferred are no longer valid states in OpenIAP v1.3.11+
      // Both platforms return errors instead of Purchase objects on failure
      // Deferred: iOS StoreKit 2 has no transaction state; Android uses Pending
      default:
        return gentype.PurchaseState.Unknown;
    }
  }
  if (value is num) {
    switch (value.toInt()) {
      case 0:
        return gentype.PurchaseState.Pending;
      case 1:
      case 3: // Restored returns as Purchased
        return gentype.PurchaseState.Purchased;
      // case 2 (Failed) and case 4 (Deferred) now return Unknown
      // as these states are no longer part of PurchaseState enum
      default:
        return gentype.PurchaseState.Unknown;
    }
  }
  return gentype.PurchaseState.Unknown;
}

int _coerceAndroidPurchaseState(
  dynamic value, {
  required bool hasSelectedState,
}) {
  if (!hasSelectedState) {
    return AndroidPurchaseState.Purchased.value;
  }
  if (value == null) {
    return AndroidPurchaseState.Unknown.value;
  }
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    final trimmed = value.trim();
    final parsed = int.tryParse(trimmed);
    if (parsed != null) {
      return parsed;
    }
    switch (trimmed.toLowerCase()) {
      case 'purchased':
      case 'purchase_state_purchased':
        return AndroidPurchaseState.Purchased.value;
      case 'pending':
      case 'purchase_state_pending':
        return AndroidPurchaseState.Pending.value;
      case 'unspecified':
      case 'unknown':
      case 'purchase_state_unspecified':
        return AndroidPurchaseState.Unknown.value;
    }
  }
  return AndroidPurchaseState.Unknown.value;
}

gentype.PurchaseState _mapAndroidPurchaseState(int stateValue) {
  final state = androidPurchaseStateFromValue(stateValue);
  switch (state) {
    case AndroidPurchaseState.Purchased:
      return gentype.PurchaseState.Purchased;
    case AndroidPurchaseState.Pending:
      return gentype.PurchaseState.Pending;
    case AndroidPurchaseState.Unknown:
      return gentype.PurchaseState.Unknown;
  }
}

extension PurchaseInputConversion on gentype.Purchase {
  gentype.PurchaseInput toInput() {
    // PurchaseInput is now just a typedef for Purchase, so return this directly
    return this;
  }
}

List<PurchaseResult>? extractResult(dynamic result) {
  List<dynamic> list;
  if (result is String) {
    list = json.decode(result) as List<dynamic>;
  } else if (result is List) {
    list = result;
  } else {
    list = json.decode(result.toString()) as List<dynamic>;
  }

  final decoded = list
      .map<PurchaseResult>(
        (dynamic product) => PurchaseResult.fromJSON(
          (product as Map).map<String, dynamic>(
            (key, value) => MapEntry(key.toString(), value),
          ),
        ),
      )
      .toList();

  return decoded;
}

typedef PurchaseResult = iap_err.PurchaseResult;
typedef ConnectionResult = iap_err.ConnectionResult;
