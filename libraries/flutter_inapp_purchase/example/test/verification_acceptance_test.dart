import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:flutter_inapp_purchase_example/src/app_purchase_flow.dart';
import 'package:flutter_inapp_purchase_example/src/constants.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final flows = <AppPurchaseFlow>[];

  AppPurchaseFlow purchases() {
    final purchases = AppPurchaseFlow(FlutterInappPurchase());
    flows.add(purchases);
    return purchases;
  }

  tearDown(() {
    for (final purchases in flows) {
      purchases.dispose();
    }
    flows.clear();
  });

  setUp(() {
    dotenv.loadFromString(envString: 'IAPKIT_API_KEY=openiap-kit_pk_test');
  });

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
  });

  test('a restored Amazon term maps to its catalog product', () {
    for (final term in IapConstants.subscriptionProductIds) {
      expect(
        IapConstants.subscriptionProductId(
          IapConstants.amazonSubscriptionBaseId,
          term,
        ),
        term,
      );
      expect(IapConstants.subscriptionProductId(term, null), term);
    }
    expect(
      IapConstants.subscriptionProductId(
        IapConstants.amazonSubscriptionBaseId,
        null,
      ),
      isNull,
    );
    expect(
      IapConstants.subscriptionProductId(
        IapConstants.amazonSubscriptionBaseId,
        'foreign.term',
      ),
      isNull,
    );
  });

  for (final storeId in ['amazon', 'amazon_example']) {
    test('verifies Amazon terms under their base SKU ($storeId)', () {
      final options = purchases().iapkitOptions(VerificationMethod.iapkit);
      final purchase = PurchaseAndroid(
        id: 'receipt',
        productId: 'dev.hyo.martie.premium',
        purchaseToken: 'receipt',
        purchaseState: PurchaseState.Purchased,
        transactionDate: 1,
        quantity: 1,
        isAutoRenewing: true,
        store: storeId == 'amazon' ? IapStore.Amazon : IapStore.Unknown,
        storeId: storeId,
      );

      final props = toIapkitVerificationProps(purchase, options).iapkit!;

      expect(props.apiKey, 'openiap-kit_pk_test');
      expect(props.baseUrl, isNull);
      expect(props.amazon?.receiptId, 'receipt');
      expect(props.amazon?.expectedProductId, 'dev.hyo.martie.premium.base');
      expect(props.amazon?.sandbox, IapConstants.amazonRvsSandbox);
      final environment =
          IapConstants.amazonRvsSandbox ? 'Sandbox' : 'Production';
      VerifyPurchaseWithProviderResult result({
        String productId = 'dev.hyo.martie.premium.base',
        String? env,
      }) =>
          VerifyPurchaseWithProviderResult(
            provider: PurchaseVerificationProvider.Iapkit,
            iapkit: RequestVerifyPurchaseWithIapkitResult(
              isValid: true,
              productId: productId,
              state: IapkitPurchaseState.Entitled,
              store: purchase.store,
              storeId: storeId,
              environment: env ?? environment,
            ),
          );
      expect(
        readIapkitVerification(
          result(),
          purchase,
          isConsumable: false,
          options: options,
        ),
        isA<PurchaseEntitled>(),
      );
      for (final foreign in [
        result(productId: 'foreign.base'),
        result(env: environment == 'Sandbox' ? 'Production' : 'Sandbox'),
      ]) {
        expect(
          () => readIapkitVerification(
            foreign,
            purchase,
            isConsumable: false,
            options: options,
          ),
          throwsA(isA<PurchaseError>()),
        );
      }
    });
  }

  test('Local (IAPKit) needs a configured base URL', () {
    dotenv.loadFromString(
      envString: 'IAPKIT_API_KEY=openiap-kit_pk_test\n'
          'IAPKIT_BASE_URL= http://localhost:3000 ',
    );
    final flow = purchases();

    expect(
      flow.iapkitOptions(VerificationMethod.iapkitLocalhost).baseUrl,
      'http://localhost:3000',
    );
    dotenv.loadFromString(envString: 'IAPKIT_API_KEY=openiap-kit_pk_test');
    expect(
      () => flow.iapkitOptions(VerificationMethod.iapkitLocalhost),
      throwsA(isA<PurchaseError>()),
    );
  });
}
