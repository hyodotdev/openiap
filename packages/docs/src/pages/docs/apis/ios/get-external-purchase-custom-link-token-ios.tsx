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
        description="Get an ExternalPurchaseCustomLink reporting token (iOS 18.1+, macOS 15.1+)."
        path="/docs/apis/ios/get-external-purchase-custom-link-token-ios"
        keywords="getExternalPurchaseCustomLinkTokenIOS, ExternalPurchaseCustomLink token, StoreKit, iOS 18.1, macOS 15.1"
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
        API (iOS 18.1+, macOS 15.1+). Pair the returned token with Apple's
        External Purchase Server API to report acquisition or services
        transactions.
      </p>
      <p>
        Wraps <code>ExternalPurchaseCustomLink.token(for:)</code> — token to
        report transactions to Apple's External Purchase Server. iOS 18.1+,
        macOS 15.1+. See the{' '}
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
    _ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
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
            <CodeBlock language="csharp">{`Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS tokenType);`}</CodeBlock>
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
        — an optional opaque <code>token</code> plus an optional{' '}
        <code>error</code>. Send a returned token to Apple&apos;s External
        Purchase Server API.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let token = try await OpenIapModule.shared.getExternalPurchaseCustomLinkTokenIOS(
    .acquisition
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val token = kmpIAP.getExternalPurchaseCustomLinkTokenIOS(
    tokenType = ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition
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
            <CodeBlock language="dart">{`if (Platform.isIOS || Platform.isMacOS) {
  final token = await FlutterInappPurchase.instance
      .getExternalPurchaseCustomLinkTokenIOS(
        ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
      );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var token = await ((QueryResolver)OpenIapClient.Instance).GetExternalPurchaseCustomLinkTokenIOSAsync(
    tokenType: ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var token = await iap.get_external_purchase_custom_link_token_ios("acquisition")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <code>tokenType</code> is{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition</code> for new
        customers or{' '}
        <code>ExternalPurchaseCustomLinkTokenTypeIOS.Services</code> for
        existing ones. The result contains the opaque token or an error.
      </p>
    </div>
  );
}

export default GetExternalPurchaseCustomLinkTokenIOS;
