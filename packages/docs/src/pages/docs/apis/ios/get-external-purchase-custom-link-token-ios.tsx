import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetExternalPurchaseCustomLinkTokenIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getExternalPurchaseCustomLinkTokenIOS"
        description="Get the iOS 18.1+ ExternalPurchaseCustomLink token for reporting transactions to Apple."
        path="/docs/apis/ios/get-external-purchase-custom-link-token-ios"
        keywords="getExternalPurchaseCustomLinkTokenIOS, ExternalPurchaseCustomLink token, StoreKit, iOS 18.1"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getExternalPurchaseCustomLinkTokenIOS
      </h1>
      <p>
        Fetch an external-purchase token for the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          ExternalPurchaseCustomLink
        </a>{' '}
        API (iOS 18.1+). Pair the returned token with Apple's External Purchase
        Server API to report acquisition or services transactions.
      </p>
      <p>
        Wraps <code>ExternalPurchaseCustomLink.token(for:)</code> — token to
        report transactions to Apple's External Purchase Server. iOS 18.1+. See
        the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)"
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
            <CodeBlock language="swift">{`func getExternalPurchaseCustomLinkTokenIOS(
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
) async throws -> ExternalPurchaseCustomLinkTokenResultIOS`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getExternalPurchaseCustomLinkTokenIOS(
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
): ExternalPurchaseCustomLinkTokenResultIOS`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getExternalPurchaseCustomLinkTokenIOS(
  tokenType: ExternalPurchaseCustomLinkTokenTypeIOS,
): Promise<ExternalPurchaseCustomLinkTokenResultIOS>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ExternalPurchaseCustomLinkTokenResultIOS>
    getExternalPurchaseCustomLinkTokenIOS(
  ExternalPurchaseCustomLinkTokenTypeIOS tokenType,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS TokenType)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_external_purchase_custom_link_token_ios(token_type: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>tokenType</code>{' '}
          <em>
            (required, <code>ExternalPurchaseCustomLinkTokenTypeIOS</code>)
          </em>{' '}
          — <code>acquisition</code> (new customers) or <code>services</code>{' '}
          (existing customers).
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/external-purchase-link#external-purchase-custom-link-token-result-ios">
          <code>Promise&lt;ExternalPurchaseCustomLinkTokenResultIOS&gt;</code>
        </Link>{' '}
        — token plus its acquired/expiry metadata. Send the <code>token</code>{' '}
        field to Apple's External Purchase Server within the documented validity
        window.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let token = try await OpenIapModule.shared.getExternalPurchaseCustomLinkTokenIOS(
    tokenType: .acquisition
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val token = kmpIAP.getExternalPurchaseCustomLinkTokenIOS(
    tokenType = ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getExternalPurchaseCustomLinkTokenIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const token = await getExternalPurchaseCustomLinkTokenIOS('acquisition');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final token = await FlutterInappPurchase.instance
      .getExternalPurchaseCustomLinkTokenIOS(
        ExternalPurchaseCustomLinkTokenTypeIOS.acquisition,
      );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var token = await ((QueryResolver)Iap.Instance).GetExternalPurchaseCustomLinkTokenIOSAsync(
    tokenType = ExternalPurchaseCustomLinkTokenTypeIOS.ACQUISITION
)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var token = await iap.get_external_purchase_custom_link_token_ios("acquisition")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <code>tokenType</code> is{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.acquisition</code> for new
        customers or{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.services</code> for
        existing ones. The result wraps the opaque token plus expiration
        metadata.
      </p>
    </div>
  );
}

export default GetExternalPurchaseCustomLinkTokenIOS;
