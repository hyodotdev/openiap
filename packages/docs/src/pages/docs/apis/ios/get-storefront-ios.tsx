import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetStorefrontIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getStorefrontIOS"
        description="Deprecated. Use getStorefront() (cross-platform) instead."
        path="/docs/apis/ios/get-storefront-ios"
        keywords="getStorefrontIOS, deprecated, storefront"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getStorefrontIOS
      </h1>
      <p>Deprecated. Use getStorefront() (cross-platform) instead.</p>
      <p>
        Wraps <code>Storefront.current</code> — deprecated in OpenIAP. Returns
        the App Store storefront country code. iOS 13+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/storefront"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Deprecated.</strong> Use the cross-platform API. Use{' '}
          <Link to="/docs/apis/get-storefront">getStorefront</Link> instead.
        </p>
      </div>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;string&gt;</code> — ISO country code of the App Store
        storefront.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`@available(*, deprecated, message: "Use getStorefront()")
func getStorefrontIOS() async throws -> String`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`@Deprecated("Use getStorefront()")
suspend fun getStorefrontIOS(): String`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getStorefrontIOS(): Promise<string>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`@Deprecated('Use getStorefront()')
Future<String> getStorefrontIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_storefront_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let code = try await OpenIapModule.shared.getStorefrontIOS()
// Deprecated — prefer OpenIapModule.shared.getStorefront()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
// Deprecated — prefer kmpIAP.getStorefront()
val code = kmpIAP.getStorefrontIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
// Deprecated — prefer the cross-platform getStorefront().
import { getStorefrontIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const code = await getStorefrontIOS();
  console.log(code); // "US", "JP", etc.
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`// Deprecated — prefer FlutterInappPurchase.instance.getStorefront().
if (Platform.isIOS) {
  final code = await FlutterInappPurchase.instance.getStorefrontIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var code = await iap.get_storefront_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetStorefrontIOS;
