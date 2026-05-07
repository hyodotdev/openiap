import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PresentExternalPurchaseLinkIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="presentExternalPurchaseLinkIOS"
        description="Open external purchase URL in Safari (iOS 16+)."
        path="/docs/apis/ios/present-external-purchase-link-ios"
        keywords="presentExternalPurchaseLinkIOS, external link, external purchase"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        presentExternalPurchaseLinkIOS
      </h1>
      <p>Open an external purchase URL outside the app (iOS 16+).</p>
      <p>
        Opens the URL via{' '}
        <code>UIApplication.open(_:options:completionHandler:)</code> after a{' '}
        <code>canOpenURL</code> guard — the openiap-apple implementation routes
        through UIKit rather than StoreKit's <code>ExternalPurchaseLink</code>{' '}
        API. The native call must still be gated by the StoreKit
        external-purchase entitlement on production builds. See the{' '}
        <a
          href="https://developer.apple.com/documentation/uikit/uiapplication/1648685-open"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple UIApplication.open reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS

struct ExternalPurchaseLinkResultIOS {
    let error: String?
    let success: Bool
}`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun presentExternalPurchaseLinkIOS(url: String): ExternalPurchaseLinkResultIOS`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`presentExternalPurchaseLinkIOS(url: string): Promise<ExternalPurchaseLinkResultIOS>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ExternalPurchaseLinkResultIOS> presentExternalPurchaseLinkIOS(String url);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<ExternalPurchaseLinkResultIOS> PresentExternalPurchaseLinkIOSAsync(String Url)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func present_external_purchase_link_ios(url: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>url</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — External purchase URL to present.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/external-purchase-link">
          <code>Promise&lt;ExternalPurchaseLinkResultIOS&gt;</code>
        </Link>{' '}
        — carries the result of opening the external link (success flag + any
        error string from StoreKit).
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.presentExternalPurchaseLinkIOS("https://yourstore.com/checkout")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val result = kmpIAP.presentExternalPurchaseLinkIOS(url = "https://yourstore.com/checkout")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { presentExternalPurchaseLinkIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await presentExternalPurchaseLinkIOS('https://yourstore.com/checkout');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance
      .presentExternalPurchaseLinkIOS('https://yourstore.com/checkout');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var result = await ((QueryResolver)OpenIap.Instance).PresentExternalPurchaseLinkIOSAsync(url = "https://yourstore.com/checkout")`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.present_external_purchase_link_ios("https://yourstore.com/checkout")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default PresentExternalPurchaseLinkIOS;
