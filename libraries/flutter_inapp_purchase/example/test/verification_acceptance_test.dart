import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/constants.dart';

void main() {
  for (final sku in IapConstants.subscriptionProductIds) {
    test('Amazon term $sku must match its catalog base and active state', () {
      final purchase = PurchaseAndroid(
        id: 'receipt',
        productId: sku,
        purchaseToken: 'receipt',
        purchaseState: PurchaseState.Purchased,
        transactionDate: 1,
        quantity: 1,
        isAutoRenewing: true,
        store: IapStore.Amazon,
        storeId: 'amazon',
      );
      RequestVerifyPurchaseWithIapkitResult result({
        String productId = 'dev.hyo.martie.premium.base',
        IapkitPurchaseState state = IapkitPurchaseState.Entitled,
        IapStore store = IapStore.Amazon,
        String? environment,
      }) =>
          RequestVerifyPurchaseWithIapkitResult(
            isValid: true,
            productId: productId,
            state: state,
            store: store,
            storeId: store.value,
            environment: environment ??
                (IapConstants.amazonRvsSandbox ? 'Sandbox' : 'Production'),
          );
      expect(IapConstants.acceptsVerification(result(), purchase), isTrue);
      expect(
          IapConstants.acceptsVerification(
              result(productId: 'foreign.base'), purchase),
          isFalse);
      expect(
          IapConstants.acceptsVerification(
              result(state: IapkitPurchaseState.ReadyToConsume), purchase),
          isFalse);
      expect(
          IapConstants.acceptsVerification(
              result(store: IapStore.Google), purchase),
          isFalse);
      expect(
          IapConstants.acceptsVerification(
              result(
                  environment:
                      IapConstants.amazonRvsSandbox ? 'Production' : 'Sandbox'),
              purchase),
          isFalse);
    });
  }
}
