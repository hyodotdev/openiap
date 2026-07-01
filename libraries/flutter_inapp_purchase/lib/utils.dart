import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'types.dart' as gentype;

/// Parse Android JSON response and log the result
void parseAndLogAndroidResponse(
  dynamic result, {
  required String successLog,
  required String failureLog,
}) {
  if (result == null || result is! String) {
    return;
  }

  try {
    final response = jsonDecode(result) as Map<String, dynamic>;
    if (kDebugMode) {
      debugPrint('$successLog. Response code: ${response['responseCode']}');
    }
  } catch (e) {
    if (kDebugMode) {
      debugPrint('$failureLog: $e');
    }
  }
}

/// Build iOS purchase payload from props
Map<String, dynamic>? buildIosPurchasePayload(
  String nativeType,
  Object? iosProps,
) {
  if (iosProps == null) {
    return null;
  }

  Map<String, dynamic> propsJson;
  if (iosProps is gentype.RequestPurchaseIosProps) {
    propsJson = iosProps.toJson();
  } else if (iosProps is gentype.RequestSubscriptionIosProps) {
    propsJson = iosProps.toJson();
  } else {
    return null;
  }

  final String? sku = propsJson['sku'] as String?;
  if (sku == null || sku.isEmpty) {
    return null;
  }

  final payload = <String, dynamic>{
    'sku': sku,
    'type': nativeType,
    'andDangerouslyFinishTransactionAutomatically':
        (propsJson['andDangerouslyFinishTransactionAutomatically'] as bool?) ??
            false,
  };

  final String? appAccountToken = propsJson['appAccountToken'] as String?;
  if (appAccountToken != null && appAccountToken.isNotEmpty) {
    payload['appAccountToken'] = appAccountToken;
  }

  final dynamic quantityValue = propsJson['quantity'];
  if (quantityValue is int) {
    payload['quantity'] = quantityValue;
  } else if (quantityValue is num) {
    payload['quantity'] = quantityValue.toInt();
  }

  final dynamic offerValue = propsJson['withOffer'];
  if (offerValue is Map) {
    payload['withOffer'] = offerValue.map<String, dynamic>(
      (key, value) => MapEntry(key.toString(), value),
    );
  }

  final String? advancedCommerceData =
      propsJson['advancedCommerceData'] as String?;
  if (advancedCommerceData != null && advancedCommerceData.isNotEmpty) {
    payload['advancedCommerceData'] = advancedCommerceData;
  }

  final String? billingPlanType = propsJson['billingPlanType'] as String?;
  if (billingPlanType != null && billingPlanType.isNotEmpty) {
    payload['billingPlanType'] = billingPlanType;
  }

  final String? compactJWS = propsJson['compactJWS'] as String?;
  if (compactJWS != null && compactJWS.isNotEmpty) {
    payload['compactJWS'] = compactJWS;
  }

  final dynamic promotionalOfferJWS = propsJson['promotionalOfferJWS'];
  if (promotionalOfferJWS is Map) {
    payload['promotionalOfferJWS'] = promotionalOfferJWS.map<String, dynamic>(
      (key, value) => MapEntry(key.toString(), value),
    );
  }

  final dynamic winBackOffer = propsJson['winBackOffer'];
  if (winBackOffer is Map) {
    payload['winBackOffer'] = winBackOffer.map<String, dynamic>(
      (key, value) => MapEntry(key.toString(), value),
    );
  }

  payload.removeWhere((_, value) => value == null);
  return payload;
}
