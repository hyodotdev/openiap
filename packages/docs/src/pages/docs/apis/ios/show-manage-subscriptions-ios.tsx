import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowManageSubscriptionsIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showManageSubscriptionsIOS"
        description="Show in-app subscription management UI and detect status changes (iOS 15+). Returns purchases for subscriptions whose auto-renewal status changed."
        path="/docs/apis/ios/show-manage-subscriptions-ios"
        keywords="showManageSubscriptionsIOS, manage subscriptions sheet"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        showManageSubscriptionsIOS
      </h1>
      <p>
        Show in-app subscription management UI and detect status changes (iOS
        15+). Returns purchases for subscriptions whose auto-renewal status
        changed.
      </p>
      <p>
        Opens Apple's subscription-management surface for the user. The current
        iOS implementation forwards to the module's{' '}
        <code>deepLinkToSubscriptions(nil)</code> path, which calls{' '}
        <code>AppStore.showManageSubscriptions(in:)</code> with the active{' '}
        <code>UIWindowScene</code>; if no scene is available the call throws
        instead of falling back to a URL. iOS 15+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/appstore/showmanagesubscriptions(in:)"
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
            <CodeBlock language="swift">{`func showManageSubscriptionsIOS() async throws -> [Purchase]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun showManageSubscriptionsIOS(): List<PurchaseIOS>`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`showManageSubscriptionsIOS(): Promise<PurchaseIOS[]>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<List<PurchaseIOS>> showManageSubscriptionsIOS();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<IReadOnlyList<PurchaseIOS>> ShowManageSubscriptionsIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func show_manage_subscriptions_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS[]&gt;</code>
        </Link>{' '}
        — purchases whose status changed while the manage-subscriptions sheet
        was on screen (e.g. cancelled or auto-renew toggled). Empty array when
        nothing changed.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let changed = try await OpenIapModule.shared.showManageSubscriptionsIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val changed = kmpIAP.showManageSubscriptionsIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { showManageSubscriptionsIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const changed = await showManageSubscriptionsIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final changed = await FlutterInappPurchase.instance
      .showManageSubscriptionsIOS();
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// OpenIap.Maui (iOS targets only — no-op on Android)
var changed = await ((MutationResolver)Iap.Instance).ShowManageSubscriptionsIOSAsync();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var changed = await iap.show_manage_subscriptions_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowManageSubscriptionsIOS;
