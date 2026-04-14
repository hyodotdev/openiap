import 'package:flutter_inapp_purchase/enums.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('androidPurchaseStateFromValue maps integers correctly', () {
    expect(androidPurchaseStateFromValue(1), AndroidPurchaseState.Purchased);
    expect(androidPurchaseStateFromValue(2), AndroidPurchaseState.Pending);
    expect(androidPurchaseStateFromValue(99), AndroidPurchaseState.Unknown);
  });

  test('AndroidPurchaseStateValue extension returns numeric value', () {
    expect(AndroidPurchaseState.Purchased.value, 1);
    expect(AndroidPurchaseState.Pending.value, 2);
    expect(AndroidPurchaseState.Unknown.value, 0);
  });

  test(
    'AndroidReplacementModeValue returns legacy SubscriptionUpdateParams.ReplacementMode integers',
    () {
      // Reference (Billing Library 8.x):
      // BillingFlowParams.SubscriptionUpdateParams.ReplacementMode
      // - UNKNOWN_REPLACEMENT_MODE = 0
      // - WITH_TIME_PRORATION = 1
      // - CHARGE_PRORATED_PRICE = 2
      // - WITHOUT_PRORATION = 3
      // - CHARGE_FULL_PRICE = 5
      // - DEFERRED = 6
      expect(AndroidReplacementMode.unknownReplacementMode.value, 0);
      expect(AndroidReplacementMode.withTimeProration.value, 1);
      expect(AndroidReplacementMode.chargeProratedPrice.value, 2);
      expect(AndroidReplacementMode.withoutProration.value, 3);
      expect(AndroidReplacementMode.chargeFullPrice.value, 5);
      expect(AndroidReplacementMode.deferred.value, 6);
    },
  );
}
