import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Flutter 10 no longer exposes the scheduled compatibility surface', () {
    final sources = <String>[
      'lib/builders.dart',
      'lib/enums.dart',
      'lib/errors.dart',
      'lib/flutter_inapp_purchase.dart',
      'lib/helpers.dart',
    ].map((path) => File(path).readAsStringSync()).join('\n');

    final removedPatterns = <MapEntry<String, Pattern>>[
      for (final symbol in <String>[
        'checkAlternativeBillingAvailabilityAndroid',
        'showAlternativeBillingDialogAndroid',
        'createAlternativeBillingTokenAndroid',
        'requestPurchaseOnPromotedProductIOS',
        'getStorefrontIOS',
        'validateReceiptIOS',
        'validateReceipt',
        'purchaseUpdated;',
        'purchaseError;',
        'connectionUpdated;',
        'replacementMode;',
        'useAlternativeBilling',
        'TypeInApp',
        'convertToPurchaseError',
        'transactionReceipt',
        'purchaseStateAndroid',
        'transactionStateIOS',
        'originalJsonAndroid',
        'subscriptionInfoIOS',
        'discountsIOS',
        'subscriptionOfferDetailsAndroid',
        'oneTimePurchaseOfferDetailsAndroid',
      ])
        MapEntry<String, Pattern>(symbol, symbol),
      MapEntry<String, Pattern>(
        'PurchaseResult',
        RegExp(r'\b(?:class|typedef)\s+PurchaseResult\b'),
      ),
      MapEntry<String, Pattern>(
        'ConnectionResult',
        RegExp(r'\b(?:class|typedef)\s+ConnectionResult\b'),
      ),
    ];

    for (final removedPattern in removedPatterns) {
      expect(
        sources,
        isNot(contains(removedPattern.value)),
        reason: '${removedPattern.key} must stay removed from Flutter 10',
      );
    }
  });
}
