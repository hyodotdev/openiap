import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import Callout from '../../../../components/Callout';
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
      <p>Present the App Store promo code redemption sheet.</p>

      <Callout kind="warning">
        <strong>Deprecated.</strong> Use the cross-platform{' '}
        <Link to="/docs/apis/open-redeem-offer-code">
          <code>openRedeemOfferCode</code>
        </Link>{' '}
        instead — identical sheet behavior and result semantics on Apple
        platforms. Scheduled for removal in OpenIAP 4.0. Generated TypeScript,
        Kotlin, and C# declarations carry a deprecation annotation, and{' '}
        <code>openiap-apple</code> marks the Swift method{' '}
        <code>@available(*, deprecated)</code>, so builds surface the migration.
      </Callout>
      <p>
        In Xcode 27+ builds on iOS 27, Mac Catalyst 27, and visionOS 27 or
        later, this calls{' '}
        <code>AppStore.presentOfferCodeRedeemSheet(from:options:)</code> and
        returns the verified transaction produced by redemption. On iOS 16–26
        and visionOS 1–26, it uses the StoreKit 2 scene-based sheet and returns{' '}
        <code>null</code>; an older SDK uses that same path on those platforms
        at Apple 27. iOS 15 uses the StoreKit 1 fallback and also returns{' '}
        <code>null</code>. In Mac Catalyst apps, the scene-based API throws{' '}
        <code>StoreKitError.unknown</code> (surfaced by OpenIAP as a purchase
        error), while the Catalyst 15 StoreKit 1 call has no effect and returns{' '}
        <code>null</code>. Reconcile null results only from an actually
        presented sheet through the purchase listener or an available-purchases
        refresh. See the{' '}
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
        Apple 27+ runtimes from Xcode 27+ builds. A <code>null</code> result
        normally means the iOS or visionOS system sheet was presented but that
        API path cannot return its transaction directly. Mac Catalyst 15 is the
        exception: StoreKit 1 has no effect there and OpenIAP returns{' '}
        <code>null</code>. Mac Catalyst 16–26 rejects the scene API with an
        error instead of returning <code>null</code>.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let purchase = try await OpenIapModule.shared.presentCodeRedemptionSheetIOS()
if let purchase {
    print("Verified redemption:", purchase.productId)
} else {
    // iOS/visionOS: reconcile through the listener or refresh purchases.
    // Mac Catalyst 15: StoreKit 1 has no effect, so no sheet was shown.
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
  try {
    const purchase = await presentCodeRedemptionSheetIOS();
    if (purchase) console.log('Verified redemption:', purchase.productId);
    // Null requires reconciliation on iOS/visionOS; Catalyst 15 is a no-op.
  } catch (error) {
    // Catalyst 16–26 reports StoreKitError.unknown through PurchaseError.
    console.warn('Offer-code sheet unavailable:', error);
  }
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
