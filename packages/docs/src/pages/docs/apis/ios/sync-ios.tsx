import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function SyncIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="syncIOS"
        description="Force a StoreKit sync for transactions (iOS 15+)."
        path="/docs/apis/ios/sync-ios"
        keywords="syncIOS, StoreKit sync"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span> syncIOS
      </h1>
      <p>Force a StoreKit sync for transactions (iOS 15+).</p>
      <p>
        Wraps <code>AppStore.sync()</code> — forces StoreKit to refresh
        transactions and entitlements, prompts the user to authenticate. iOS
        15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/sync()"
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
            <CodeBlock language="swift">{`func syncIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun syncIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`syncIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> syncIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> SyncIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func sync_ios() -> Types.VoidResult`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the App
        Store sync completes.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.syncIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
kmpIAP.syncIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { syncIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await syncIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  await FlutterInappPurchase.instance.syncIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using Hyo.OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
await ((QueryResolver)OpenIap.Instance).SyncIOSAsync()`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var result = await iap.sync_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default SyncIOS;
