import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/constants.dart';

void main() {
  test('Apple local verification rejects unrelated or inactive signed receipts',
      () {
    PurchaseIOS receipt(
            {String id = 'old',
            String storeId = 'apple',
            String productId = 'dev.hyo.martie.10bulbs',
            String? environment = 'Sandbox',
            double? revoked,
            double? expired,
            bool? upgraded}) =>
        PurchaseIOS(
            id: id,
            transactionId: id,
            productId: productId,
            purchaseState: PurchaseState.Purchased,
            transactionDate: 1,
            quantity: 1,
            isAutoRenewing: false,
            store: IapStore.Apple,
            storeId: storeId,
            environmentIOS: environment,
            revocationDateIOS: revoked,
            expirationDateIOS: expired,
            isUpgradedIOS: upgraded);
    final purchase = receipt();
    expect(IapConstants.matchesVerifiedPendingPurchase(purchase, [receipt()]),
        isTrue);
    for (final other in [
      receipt(id: 'new'),
      receipt(productId: 'foreign'),
      receipt(storeId: 'community'),
      receipt(environment: 'Production'),
      receipt(environment: null),
      receipt(revoked: 1),
      receipt(expired: 1),
      receipt(upgraded: true)
    ]) {
      expect(IapConstants.matchesVerifiedPendingPurchase(purchase, [other]),
          isFalse);
    }
    RequestVerifyPurchaseWithIapkitResult result(String? environment) =>
        RequestVerifyPurchaseWithIapkitResult(
            isValid: true,
            productId: purchase.productId,
            store: IapStore.Apple,
            storeId: 'apple',
            state: IapkitPurchaseState.ReadyToConsume,
            environment: environment);
    expect(
        IapConstants.acceptsVerification(result('Sandbox'), purchase), isTrue);
    expect(IapConstants.acceptsVerification(result('Production'), purchase),
        isFalse);
    expect(IapConstants.acceptsVerification(result(null), purchase), isFalse);
  });

  test(
      'restored Amazon terms require exact catalog metadata and provider identity',
      () {
    for (final term in IapConstants.subscriptionProductIds) {
      for (final store in [IapStore.Amazon, IapStore.Unknown]) {
        PurchaseAndroid restored({String? planId, String? storeId}) =>
            PurchaseAndroid(
              id: 'restored-receipt',
              productId: IapConstants.amazonSubscriptionBaseId,
              currentPlanId: planId,
              purchaseToken: 'restored-receipt',
              purchaseState: PurchaseState.Purchased,
              transactionDate: 1,
              quantity: 1,
              isAutoRenewing: true,
              store: store,
              storeId: storeId ??
                  (store == IapStore.Amazon ? 'amazon' : 'amazon_example'),
            );
        final receipt = restored(planId: term);
        expect(IapConstants.subscriptionProductId(receipt), term);
        expect(receipt.productId, IapConstants.amazonSubscriptionBaseId);
        expect(IapConstants.subscriptionProductId(restored()), isNull);
        expect(
            IapConstants.subscriptionProductId(
                restored(planId: 'foreign.term')),
            isNull);
        if (store == IapStore.Unknown) {
          expect(
              IapConstants.subscriptionProductId(
                  restored(planId: term, storeId: 'foreign')),
              isNull);
        }
      }
    }
  });

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

  test(
      'community verification preserves provider identity and rejects foreign receipts',
      () {
    final purchase = PurchaseAndroid(
        id: 'receipt',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'receipt',
        purchaseState: PurchaseState.Purchased,
        transactionDate: 1,
        quantity: 1,
        isAutoRenewing: true,
        store: IapStore.Unknown,
        storeId: 'amazon_example');
    RequestVerifyPurchaseWithIapkitResult result(
            {String storeId = 'amazon_example',
            IapStore store = IapStore.Unknown,
            String productId = 'dev.hyo.martie.premium.base',
            String? environment}) =>
        RequestVerifyPurchaseWithIapkitResult(
            isValid: true,
            store: store,
            storeId: storeId,
            productId: productId,
            state: IapkitPurchaseState.Entitled,
            environment: environment ??
                (IapConstants.amazonRvsSandbox ? 'Sandbox' : 'Production'));
    expect(IapConstants.verificationStore(purchase), IapStore.Amazon);
    expect(IapConstants.acceptsVerification(result(), purchase), isTrue);
    expect(
        IapConstants.acceptsVerification(result(storeId: 'foreign'), purchase),
        isFalse);
    expect(
        IapConstants.acceptsVerification(
            result(store: IapStore.Amazon, storeId: 'amazon'), purchase),
        isFalse);
    expect(
        IapConstants.acceptsVerification(
            result(productId: 'foreign.base'), purchase),
        isFalse);
    expect(
        IapConstants.acceptsVerification(
            result(
                environment:
                    IapConstants.amazonRvsSandbox ? 'Production' : 'Sandbox'),
            purchase),
        isFalse);
    expect(purchase.store, IapStore.Unknown);
  });
}
