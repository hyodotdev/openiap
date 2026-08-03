import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'flutter_inapp_purchase.dart';
import 'types.dart' as gentype;

String resolveProductType(Object type) {
  if (type is String) {
    if (type == 'in-app' || type == 'subs' || type == 'all') {
      return type;
    }
    throw ArgumentError.value(type, 'type', 'Use in-app, subs, or all.');
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
  throw ArgumentError.value(type, 'type', 'Unsupported product type.');
}

String _resolveProductId(Map<String, dynamic> json) {
  if (json.containsKey('id')) {
    return json['id']?.toString() ?? '';
  }

  // StoreKit 1's productIdentifier remains outside the OpenIAP-owned legacy
  // wire contract and remains a native-response recovery path.
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
    final looksAndroid = json.containsKey('nameAndroid');
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
        bundledSubscriptionsIOS: _parseBundledSubscriptionsIOS(
          json['bundledSubscriptionsIOS'],
        ),
        pricingTermsIOS: _parseSubscriptionPricingTermsIOS(
          json['pricingTermsIOS'],
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

    return gentype.ProductSubscriptionAndroid(
      currency: currency,
      description: description,
      displayPrice: displayPrice,
      id: productId,
      nameAndroid: json['nameAndroid']?.toString() ?? productId,
      platform: platform,
      subscriptionOffers:
          _parseStandardizedSubscriptionOffers(json['subscriptionOffers']) ??
              const [],
      title: title,
      type: productType,
      debugDescription: json['debugDescription']?.toString(),
      displayName: json['displayName']?.toString(),
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
      subscriptionOffers: _parseStandardizedSubscriptionOffers(
        json['subscriptionOffers'],
      ),
    );
  }

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
    price: priceValue,
    productStatusAndroid: _parseProductStatusAndroid(
      json['productStatusAndroid'],
    ),
    subscriptionOffers:
        _parseStandardizedSubscriptionOffers(json['subscriptionOffers']),
  );
}

gentype.Purchase convertToPurchase(
  Map<String, dynamic> itemJson, {
  required bool platformIsAndroid,
  required bool platformIsIOS,
  required Map<String, bool> acknowledgedAndroidPurchaseTokens,
  Map<String, dynamic>? originalJson,
}) {
  // Native SDKs serialize the generated Purchase types directly. Preserve the
  // canonical payload as the base so newly generated optional fields are not
  // silently dropped by this adapter.
  final sourcePayload = normalizeDynamicMap(<String, dynamic>{
    if (originalJson != null) ...originalJson,
    ...itemJson,
  })!;

  final productId = sourcePayload['productId']?.toString() ?? '';
  final sourceId = sourcePayload['id']?.toString();
  final sourceTransactionId = sourcePayload['transactionId']?.toString();
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

  final String? purchaseId = (sourceId?.isNotEmpty ?? false) ? sourceId : null;

  if (purchaseId == null || purchaseId.isEmpty) {
    debugPrint(
      '[flutter_inapp_purchase] Invalid purchase payload: missing identifier',
    );
    throw const FormatException('Missing purchase identifier');
  }

  final transactionDate =
      _parseTimestampMilliseconds(sourcePayload['transactionDate']) ?? 0;

  if (platformIsAndroid) {
    final hasSelectedPurchaseState = sourcePayload.containsKey('purchaseState');
    final stateValue = _coerceAndroidPurchaseState(
      sourcePayload['purchaseState'],
      hasSelectedState: hasSelectedPurchaseState,
    );
    final purchaseState = _mapAndroidPurchaseState(stateValue).toJson();

    // Determine store from input or default based on platform
    final storeValue = sourcePayload['store']?.toString() ?? 'google';
    final map = <String, dynamic>{
      ...sourcePayload,
      'id': purchaseId,
      'productId': productId,
      'store': storeValue,
      'isAutoRenewing': sourcePayload['isAutoRenewing'] as bool? ?? false,
      'purchaseState': purchaseState,
      'quantity': quantity,
      'transactionDate': transactionDate,
      'purchaseToken': sourcePayload['purchaseToken']?.toString(),
      'autoRenewingAndroid': sourcePayload['autoRenewingAndroid'] as bool?,
      'currentPlanId': sourcePayload['currentPlanId']?.toString(),
      'dataAndroid': sourcePayload['dataAndroid']?.toString(),
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
      'transactionId': sourceTransactionId,
    };

    final purchaseToken = sourcePayload['purchaseToken']?.toString();
    if (purchaseToken != null && purchaseToken.isNotEmpty) {
      acknowledgedAndroidPurchaseTokens[purchaseToken] =
          sourcePayload['isAcknowledgedAndroid'] as bool? ?? false;
    }

    return gentype.PurchaseAndroid.fromJson(map);
  }

  if (platformIsIOS) {
    final stateIOS =
        _parsePurchaseStateIOS(sourcePayload['purchaseState']).toJson();

    final originalTransactionDateIOS = _parseTimestampMilliseconds(
      sourcePayload['originalTransactionDateIOS'],
    );

    // Determine store from input or default based on platform
    final storeValueIOS = sourcePayload['store']?.toString() ?? 'apple';
    if (sourceTransactionId == null || sourceTransactionId.isEmpty) {
      throw const FormatException('Missing iOS transactionId');
    }

    final map = <String, dynamic>{
      ...sourcePayload,
      'id': purchaseId,
      'productId': productId,
      'store': storeValueIOS,
      'isAutoRenewing': sourcePayload['isAutoRenewing'] as bool? ?? false,
      'purchaseState': stateIOS,
      'quantity': quantity,
      'transactionDate': transactionDate,
      'purchaseToken': sourcePayload['purchaseToken']?.toString(),
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
      'transactionId': sourceTransactionId,
      'transactionReasonIOS': sourcePayload['transactionReasonIOS']?.toString(),
      'webOrderLineItemIdIOS':
          sourcePayload['webOrderLineItemIdIOS']?.toString(),
      'revocationDateIOS':
          _parseTimestampMilliseconds(sourcePayload['revocationDateIOS']),
      'revocationReasonIOS': sourcePayload['revocationReasonIOS']?.toString(),
      'revocationTypeIOS': sourcePayload['revocationTypeIOS']?.toString(),
      'bundleOriginalTransactionIdIOS':
          sourcePayload['bundleOriginalTransactionIdIOS']?.toString(),
      'bundleProductIdIOS': sourcePayload['bundleProductIdIOS']?.toString(),
      'bundleSubscriptionGroupIdIOS':
          sourcePayload['bundleSubscriptionGroupIdIOS']?.toString(),
      'bundleTransactionIdIOS':
          sourcePayload['bundleTransactionIdIOS']?.toString(),
      'previousOriginalTransactionIdIOS':
          sourcePayload['previousOriginalTransactionIdIOS']?.toString(),
    };

    return gentype.PurchaseIOS.fromJson(map);
  }

  throw const FormatException('Unsupported purchase platform');
}

List<gentype.Purchase> extractPurchases(
  dynamic result, {
  required bool platformIsAndroid,
  required bool platformIsIOS,
  required Map<String, bool> acknowledgedAndroidPurchaseTokens,
  bool rejectMalformed = false,
}) {
  List<dynamic> list;
  try {
    if (result is String) {
      list = json.decode(result) as List<dynamic>;
    } else if (result is List) {
      list = result;
    } else {
      list = json.decode(result.toString()) as List<dynamic>;
    }
  } catch (_) {
    if (rejectMalformed) {
      throw const FormatException(
        'Native bridge returned a malformed purchase list',
      );
    }
    return const <gentype.Purchase>[];
  }

  final purchases = <gentype.Purchase>[];
  for (var index = 0; index < list.length; index += 1) {
    final dynamic product = list[index];
    try {
      if (product is! Map) {
        if (rejectMalformed) {
          throw FormatException(
            'Native bridge returned a malformed purchase at index $index',
          );
        }
        debugPrint(
          '[flutter_inapp_purchase] Skipping purchase with unexpected type: ${product.runtimeType}',
        );
        continue;
      }
      // Safely convert map keys to strings to handle cases where platform channels
      // return maps with non-string keys (e.g., Map<Object?, Object?>)
      final map = normalizeDynamicMap(product);
      if (map == null) {
        if (rejectMalformed) {
          throw FormatException(
            'Native bridge returned a malformed purchase at index $index',
          );
        }
        debugPrint(
          '[flutter_inapp_purchase] Skipping purchase: failed to normalize map',
        );
        continue;
      }
      final original = map; // Use normalized data to access additional fields
      if (rejectMalformed &&
          !_isValidAuthoritativePurchaseMap(
            map,
            platformIsAndroid: platformIsAndroid,
            platformIsIOS: platformIsIOS,
          )) {
        throw FormatException(
          'Native bridge returned a purchase with invalid fields at index $index',
        );
      }
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
      if (rejectMalformed) {
        if (error is FormatException) rethrow;
        throw FormatException(
          'Failed to decode native purchase at index $index',
        );
      }
      debugPrint(
        '[flutter_inapp_purchase] Skipping purchase due to parse error: $error',
      );
    }
  }

  return purchases;
}

bool _isValidAuthoritativePurchaseMap(
  Map<String, dynamic> value, {
  required bool platformIsAndroid,
  required bool platformIsIOS,
}) {
  for (final field in <String>['id', 'productId', 'store', 'purchaseState']) {
    final item = value[field];
    if (item is! String || item.isEmpty) return false;
  }
  final transactionDate = value['transactionDate'];
  if (transactionDate is! num || !transactionDate.isFinite) return false;
  final store = value['store'];
  if (platformIsIOS && store != 'apple') return false;
  if (platformIsAndroid &&
      store != 'google' &&
      store != 'amazon' &&
      store != 'horizon') {
    return false;
  }
  final quantity = value['quantity'];
  if (quantity is! num || !quantity.isFinite || quantity % 1 != 0) return false;
  if (value['isAutoRenewing'] is! bool) return false;
  if (platformIsIOS) {
    final transactionId = value['transactionId'];
    if (transactionId is! String || transactionId.isEmpty) return false;
  }
  final ids = value['ids'];
  if (ids != null && (ids is! List || ids.any((dynamic id) => id is! String))) {
    return false;
  }
  for (final field in <String>[
    'pendingPurchaseUpdateAndroid',
    'offerIOS',
    'renewalInfoIOS',
    'commitmentInfoIOS',
    'advancedCommerceInfoIOS',
  ]) {
    final nested = value[field];
    if (nested != null && nested is! Map) return false;
  }
  return true;
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
      case 'SUBSCRIPTION_BUNDLE':
        return gentype.ProductTypeIOS.SubscriptionBundle;
      case 'SUBSCRIPTION_SUITE':
        return gentype.ProductTypeIOS.SubscriptionSuite;
      default:
        return gentype.ProductTypeIOS.NonConsumable;
    }
  }
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

List<gentype.BundledSubscriptionIOS>? _parseBundledSubscriptionsIOS(
  dynamic value,
) =>
    _parseGeneratedList(value, gentype.BundledSubscriptionIOS.fromJson);

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
  if (value is Map) {
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
