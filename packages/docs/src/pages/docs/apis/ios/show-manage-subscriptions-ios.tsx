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
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowManageSubscriptionsIOS;
