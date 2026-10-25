import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
      'published root confirmation helpers remain callable until the next major',
      () async {
    const purchase = PurchaseIOS(
      id: 'tx-premium',
      transactionId: 'tx-premium',
      productId: 'premium',
      store: IapStore.Apple,
      storeId: 'apple',
      purchaseState: PurchaseState.Purchased,
      transactionDate: 1,
      quantity: 1,
      isAutoRenewing: false,
      purchaseToken: 'synthetic-jws',
    );
    final result = VerifyPurchaseWithProviderResult.fromJson({
      'provider': 'iapkit',
      'iapkit': {
        'store': 'apple',
        'storeId': 'apple',
        'isValid': true,
        'state': 'entitled',
        'productId': 'premium'
      },
    });
    const options = IapkitConfirmationOptions();
    // ignore: deprecated_member_use_from_same_package
    final props = toIapkitVerificationProps(purchase, options);
    expect(props.iapkit?.apple?.jws, 'synthetic-jws');
    // ignore: deprecated_member_use_from_same_package
    expect(readIapkitVerification(result, purchase, isConsumable: false),
        isA<PurchaseEntitled>());
    // ignore: deprecated_member_use_from_same_package
    final iapkit = createIapkitConfirmation((_) async => result, options);
    expect(
        await iapkit(purchase, isConsumable: false), isA<PurchaseEntitled>());
    // ignore: deprecated_member_use_from_same_package
    final device = createDeviceConfirmationIOS(() async => [purchase]);
    expect(
        await device(purchase, isConsumable: false), isA<PurchaseEntitled>());
  });
}
