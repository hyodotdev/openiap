import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentCodeRedemptionSheetIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentCodeRedemptionSheetIOS"
        description="Present the App Store offer-code redemption sheet and return its verified transaction on iOS 27 or later."
        path="/docs/apis/ios/present-code-redemption-sheet-ios"
        keywords="presentCodeRedemptionSheetIOS, redemption, promo code"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentCodeRedemptionSheetIOS
      </h1>
      <p>
        Present the App Store promo code redemption sheet. iOS counterpart of{' '}
        <Link to="/docs/apis/android/open-redeem-offer-code-android">
          <code>openRedeemOfferCodeAndroid</code>
        </Link>
        .
      </p>
      <p>
        On iOS 27, Mac Catalyst 27, and visionOS 27 or later, this calls{' '}
        <code>AppStore.presentOfferCodeRedeemSheet(from:options:)</code> and
        returns the verified transaction produced by redemption. On iOS 14–26
        and Mac Catalyst 14–26, it presents the legacy{' '}
        <code>SKPaymentQueue</code> sheet and returns <code>null</code>; use the
        purchase listener or refresh available purchases after the sheet closes.
        See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/presentoffercoderedeemsheet(from:options:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func presentCodeRedemptionSheetIOS() async throws -> PurchaseIOS?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun presentCodeRedemptionSheetIOS(): PurchaseIOS?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`presentCodeRedemptionSheetIOS(): Promise<PurchaseIOS | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<PurchaseIOS?> presentCodeRedemptionSheetIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<PurchaseIOS?> PresentCodeRedemptionSheetIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func present_code_redemption_sheet_ios() -> Variant # PurchaseIOS or null`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>PurchaseIOS | null</code> — the verified redeemed transaction on
        Apple 27+ runtimes. A <code>null</code> result means the legacy sheet
        was presented successfully but cannot return its transaction directly;
        it does not mean the feature is unsupported or that redemption failed.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let purchase = try await OpenIapModule.shared.presentCodeRedemptionSheetIOS()
if let purchase {
    print("Verified redemption:", purchase.productId)
} else {
    // iOS 14–26: reconcile through the listener or refresh purchases.
}`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val purchase = kmpIAP.presentCodeRedemptionSheetIOS()
if (purchase != null) println("Verified redemption: " + purchase.productId)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { presentCodeRedemptionSheetIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const purchase = await presentCodeRedemptionSheetIOS();
  if (purchase) console.log('Verified redemption:', purchase.productId);
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final purchase =
      await FlutterInappPurchase.instance.presentCodeRedemptionSheetIOS();
  if (purchase != null) print('Verified redemption: \${purchase.productId}');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// OpenIap.Maui (iOS targets only — unsupported on Android)
var purchase = await ((MutationResolver)OpenIapClient.Instance)
    .PresentCodeRedemptionSheetIOSAsync();
if (purchase is not null)
    Console.WriteLine($"Verified redemption: {purchase.ProductId}");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var purchase = await iap.present_code_redemption_sheet_ios()
    if purchase != null:
        print("Verified redemption: ", purchase.product_id)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/features/offer-code-redemption">
          Offer Code Redemption
        </Link>
      </p>
    </div>
  );
}

export default PresentCodeRedemptionSheetIOS;
