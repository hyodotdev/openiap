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
        description="Present the App Store promo code redemption sheet."
        path="/docs/apis/ios/present-code-redemption-sheet-ios"
        keywords="presentCodeRedemptionSheetIOS, redemption, promo code"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentCodeRedemptionSheetIOS
      </h1>
      <p>Present the App Store promo code redemption sheet.</p>
      <p>
        Calls <code>SKPaymentQueue.default().presentCodeRedemptionSheet()</code>{' '}
        (the StoreKit 1 API — the StoreKit 2 equivalent{' '}
        <code>AppStore.presentOfferCodeRedeemSheet(in:)</code> is not currently
        wired through this wrapper). See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/skpaymentqueue/presentcoderedemptionsheet()"
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
            <CodeBlock language="swift">{`func presentCodeRedemptionSheetIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun presentCodeRedemptionSheetIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`presentCodeRedemptionSheetIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> presentCodeRedemptionSheetIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func present_code_redemption_sheet_ios() -> Types.VoidResult`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the
        redemption sheet has been presented.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.presentCodeRedemptionSheetIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
kmpIAP.presentCodeRedemptionSheetIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { presentCodeRedemptionSheetIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await presentCodeRedemptionSheetIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance.presentCodeRedemptionSheetIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.present_code_redemption_sheet_ios()`}</CodeBlock>
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
