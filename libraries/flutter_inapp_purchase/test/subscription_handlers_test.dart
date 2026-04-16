import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase/types.dart' as types;

/// Guards the Flutter `subscriptionHandlers` getter against regressing on
/// `subscriptionBillingIssue` bundle exposure. The stream
/// `subscriptionBillingIssueListener` already exists, but consumers using the
/// generated `SubscriptionHandlers` bundle get a null handler if the getter
/// forgets to wire it — this test catches that drift.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('subscriptionHandlers exposes subscriptionBillingIssue', () {
    final iap = FlutterInappPurchase.instance;
    final types.SubscriptionHandlers handlers = iap.subscriptionHandlers;

    expect(
      handlers.subscriptionBillingIssue,
      isNotNull,
      reason:
          'subscriptionHandlers.subscriptionBillingIssue must be wired so '
          'consumers using the generated handler bundle can await the event.',
    );
  });
}
