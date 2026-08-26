import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function OpenRedeemOfferCode() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="openRedeemOfferCode"
        description="Open the platform's offer/promo code redemption flow so the user can enter a code."
        path="/docs/apis/open-redeem-offer-code"
        keywords="openRedeemOfferCode, offer code, promo code, redemption"
      />
      <h1>openRedeemOfferCode</h1>
      <p>
        Open the platform&apos;s offer/promo code redemption flow so the user
        can enter a code. Replaces the deprecated{' '}
        <Link to="/docs/apis/ios/present-code-redemption-sheet-ios">
          <code>presentCodeRedemptionSheetIOS</code>
        </Link>{' '}
        and{' '}
        <Link to="/docs/apis/android/open-redeem-offer-code-android">
          <code>openRedeemOfferCodeAndroid</code>
        </Link>
        , both scheduled for removal in OpenIAP 4.0.
      </p>
      <p>
        Available in OpenIAP Spec 3.3.0 / <code>openiap-apple</code> 3.3.0 /{' '}
        <code>openiap-google</code> 3.4.0.
      </p>
      <p>
        <strong>iOS:</strong> Presents the App Store offer code redemption
        sheet. Xcode 27+ builds running on iOS 27+, Mac Catalyst 27+, or
        visionOS 27+ resolve the verified redeemed purchase; older sheet APIs
        resolve <code>null</code> after presentation.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/presentoffercoderedeemsheet(from:options:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> On Google Play builds, launches the Play
        Store redeem page (
        <a
          href="https://play.google.com/redeem"
          target="_blank"
          rel="noopener noreferrer"
        >
          <code>https://play.google.com/redeem</code>
        </a>
        ) and resolves <code>null</code>; the billing client does not need to be
        initialized. Meta Horizon and Amazon Appstore have no equivalent
        redemption surface and resolve <code>null</code> without launching
        anything.
      </p>
      <p>
        Redeemed purchases are delivered through the standard purchase
        listeners. Register{' '}
        <Link to="/docs/events/purchase-updated-listener">
          <code>purchaseUpdatedListener</code>
        </Link>{' '}
        before calling, and always reconcile with{' '}
        <Link to="/docs/apis/get-available-purchases">
          <code>getAvailablePurchases</code>
        </Link>{' '}
        when the app resumes — the complete reconciliation sequence is in the{' '}
        <Link to="/docs/features/offer-code-redemption">
          Offer Code Redemption
        </Link>{' '}
        guide.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`openRedeemOfferCode(): Promise<Purchase | null>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func openRedeemOfferCode() async throws -> PurchaseIOS?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Native Android returns a launched flag; framework wrappers resolve
// the cross-platform null result from it
suspend fun openRedeemOfferCode(activity: Activity): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun openRedeemOfferCode(): Purchase?`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<Purchase?> openRedeemOfferCode();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Purchase?> OpenRedeemOfferCodeAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func open_redeem_offer_code() -> Variant # Purchase or null`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;Purchase | null&gt;</code> — the verified redeemed{' '}
        <Link to="/docs/types/purchase">
          <code>Purchase</code>
        </Link>{' '}
        only on Apple 27+ runtimes from Xcode 27+ builds. Every other outcome
        resolves <code>null</code>:
      </p>
      <ul>
        <li>
          <strong>iOS 15–26 / visionOS 1–26:</strong> the system sheet was
          presented, but that API path cannot return the transaction directly.
        </li>
        <li>
          <strong>Google Play:</strong> the Play Store redeem page was launched;
          the redemption completes outside the app.
        </li>
        <li>
          <strong>Meta Horizon / Amazon Appstore:</strong> no redemption flow
          exists, so nothing was launched.
        </li>
      </ul>

      <AnchorLink id="throws" level="h2">
        Throws
      </AnchorLink>
      <p>
        Only when a redemption flow exists but cannot be presented or launched —
        for example, no active window scene or view controller on iOS, or the
        Play Store deep link fails to open. Apple platforms without the
        redemption sheet (macOS, tvOS, watchOS) throw FeatureNotSupported.
        Stores without a redemption flow resolve <code>null</code> instead of
        throwing. Until wrappers adopt openiap-google 3.4.0, a failed Play
        launch surfaces per SDK: kmp-iap already throws;
        react-native/expo/flutter/maui resolve <code>null</code> (the released
        native API reports it as a plain <code>false</code>) while native
        exceptions still throw; godot resolves <code>null</code> for all Android
        failures.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { openRedeemOfferCode } from 'expo-iap';

const purchase = await openRedeemOfferCode();
if (purchase) {
  console.log('Verified redemption:', purchase.productId);
}
// null: the flow was presented (pre-27 iOS sheet, Play redeem page) or the
// store has none; reconcile through the purchase listener and
// getAvailablePurchases on resume.`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let purchase = try await OpenIapModule.shared.openRedeemOfferCode()
if let purchase {
    print("Verified redemption:", purchase.productId)
}`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.openRedeemOfferCode(activity)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val purchase = kmpIAP.openRedeemOfferCode()
if (purchase != null) println("Verified redemption: " + purchase.productId)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final purchase = await FlutterInappPurchase.instance.openRedeemOfferCode();
if (purchase != null) print('Verified redemption: \${purchase.productId}');`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var purchase = await ((MutationResolver)OpenIapClient.Instance)
    .OpenRedeemOfferCodeAsync();
if (purchase is not null)
    Console.WriteLine($"Verified redemption: {purchase.ProductId}");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var purchase = await iap.open_redeem_offer_code()
if purchase != null:
    print("Verified redemption: ", purchase.product_id)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        Live example:{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/expo-iap/example/app/offer-code.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          expo-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/react-native-iap/example/screens/OfferCode.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          react-native-iap
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/flutter_inapp_purchase/example/lib/src/screens/offer_code_screen.dart"
          target="_blank"
          rel="noopener noreferrer"
        >
          flutter_inapp_purchase
        </a>{' '}
        ·{' '}
        <a
          href="https://github.com/hyodotdev/openiap/blob/main/libraries/kmp-iap/example/composeApp/src/commonMain/kotlin/dev/hyo/martie/screens/OfferCodeScreen.kt"
          target="_blank"
          rel="noopener noreferrer"
        >
          kmp-iap
        </a>
      </p>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/features/offer-code-redemption">
          Offer Code Redemption
        </Link>
      </p>
    </div>
  );
}

export default OpenRedeemOfferCode;
