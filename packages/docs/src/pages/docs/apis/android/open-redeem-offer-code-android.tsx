import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function OpenRedeemOfferCodeAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="openRedeemOfferCodeAndroid"
        description="Open the Google Play offer/promo code redemption flow so the user can enter a code."
        path="/docs/apis/android/open-redeem-offer-code-android"
        keywords="openRedeemOfferCodeAndroid, offer code, promo code, redemption"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        openRedeemOfferCodeAndroid
      </h1>
      <p>
        Open the Google Play offer/promo code redemption flow so the user can
        enter a code. Android counterpart of{' '}
        <Link to="/docs/apis/ios/present-code-redemption-sheet-ios">
          <code>presentCodeRedemptionSheetIOS</code>
        </Link>
        .
      </p>
      <p>
        Available in OpenIAP Spec 2.4.0 / <code>openiap-google</code> 2.4.1.
        Launches the Play Store redeem page (
        <code>https://play.google.com/redeem</code>) as a deep link, so it does
        not require the billing client to be initialized and has no Play Billing
        version requirement. See{' '}
        <a
          href="https://support.google.com/googleplay/android-developer/answer/6321495"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play promotions
        </a>{' '}
        for the code types Play supports.
      </p>
      <p>
        The user leaves your app for the Play Store. If the app remains running
        with an active billing connection, the redeemed purchase can arrive
        through the standard purchase listeners. Register{' '}
        <Link to="/docs/events/purchase-updated-listener">
          <code>purchaseUpdatedListener</code>
        </Link>{' '}
        before launching, and reconcile with{' '}
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
          kotlin: (
            <CodeBlock language="kotlin">{`// Returns true when the redemption flow was launched
// No billing client required — opens the Play redeem page
suspend fun openRedeemOfferCode(activity: Activity): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun openRedeemOfferCodeAndroid(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`openRedeemOfferCodeAndroid(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> openRedeemOfferCodeAndroid();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> OpenRedeemOfferCodeAndroidAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func open_redeem_offer_code_android() -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> when the
        redemption flow was launched. Store flavors without an equivalent flow
        return <code>false</code>. The redeemed purchase itself is not returned;
        use the listener and resume reconciliation paths described above.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.openRedeemOfferCode(activity)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android only — returns false on iOS)
kmpIapInstance.openRedeemOfferCodeAndroid()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { Platform } from 'react-native';
import { openRedeemOfferCodeAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  await openRedeemOfferCodeAndroid();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  await FlutterInappPurchase.instance.openRedeemOfferCodeAndroid();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((MutationResolver)OpenIapClient.Instance).OpenRedeemOfferCodeAndroidAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var launched = await iap.open_redeem_offer_code_android()`}</CodeBlock>
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

export default OpenRedeemOfferCodeAndroid;
