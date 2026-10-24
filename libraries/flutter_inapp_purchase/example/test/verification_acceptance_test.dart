import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:platform/platform.dart';
import 'package:flutter_inapp_purchase_example/src/app_purchase_flow.dart';
import 'package:flutter_inapp_purchase_example/src/constants.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final flows = <AppPurchaseFlow>[];

  AppPurchaseFlow purchases() {
    // Android needs no native listener options, so nothing reaches native.
    final purchases = AppPurchaseFlow(
      FlutterInappPurchase(platform: FakePlatform(operatingSystem: 'android')),
    );
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

      // The flow's shared vectors cover how these options verify a receipt.
      expect(options.apiKey, 'openiap-kit_pk_test');
      expect(options.baseUrl, isNull);
      expect(options.amazon?.sandbox, IapConstants.amazonRvsSandbox);
      expect(
        options.amazon?.verifiedProductId?.call(purchase.productId),
        'dev.hyo.martie.premium.base',
      );
      expect(
        options.verifyAs?.call(purchase) ?? purchase.store,
        IapStore.Amazon,
      );
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
