import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ShowInAppMessagesAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="showInAppMessagesAndroid"
        description="Show Google Play in-app billing messages such as transactional subscription updates."
        path="/docs/apis/android/show-in-app-messages-android"
        keywords="showInAppMessagesAndroid, InAppMessageParamsAndroid, Play Billing"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        showInAppMessagesAndroid
      </h1>
      <p>
        Shows Google Play billing in-app messages, such as transactional
        subscription updates. OpenIAP support starts in Spec 2.1.0 and{' '}
        <code>openiap-google</code> 2.3.0. The upstream API is available in Play
        Billing 4.1.0+; Play Billing 9.0+ also uses transactional messages for
        pending subscription price-increase opt-ins.
      </p>
      <p>
        Wraps <code>BillingClient.showInAppMessages(...)</code>. If the result
        is <code>'subscription-status-updated'</code>, use the returned{' '}
        <code>purchaseToken</code> to refresh the affected subscription state.
        Google recommends checking transactional messages whenever the app
        opens. This API implements the React Native request tracked in{' '}
        <a
          href="https://github.com/hyodotdev/openiap/issues/221"
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          issue #221
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun showInAppMessages(
    activity: Activity,
    params: InAppMessageParamsAndroid? = null
): InAppMessageResultAndroid`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun showInAppMessagesAndroid(
    params: InAppMessageParamsAndroid? = null
): InAppMessageResultAndroid`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`showInAppMessagesAndroid(
  params?: InAppMessageParamsAndroid | null
): Promise<InAppMessageResultAndroid>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<InAppMessageResultAndroid> showInAppMessagesAndroid({
  List<InAppMessageCategoryAndroid>? categories,
});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<InAppMessageResultAndroid> ShowInAppMessagesAndroidAsync(
    InAppMessageParamsAndroid? @params = null
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func show_in_app_messages_android(
    params: InAppMessageParamsAndroid = null
) -> InAppMessageResultAndroid`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Optional{' '}
        <Link to="/docs/types/billing-programs#in-app-message-params-android">
          <code>InAppMessageParamsAndroid</code>
        </Link>
        :
      </p>
      <ul className="api-params">
        <li>
          <code>categories</code>{' '}
          <em>
            (optional,{' '}
            <Link to="/docs/types/billing-programs#in-app-message-category-android">
              <code>InAppMessageCategoryAndroid[] | null</code>
            </Link>
            )
          </em>{' '}
          - defaults to <code>'transactional'</code> messages.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/billing-programs#in-app-message-result-android">
          <code>Promise&lt;InAppMessageResultAndroid&gt;</code>
        </Link>{' '}
        with:
      </p>
      <ul className="api-params">
        <li>
          <code>responseCode</code>{' '}
          <em>
            (
            <Link to="/docs/types/billing-programs#in-app-message-response-code-android">
              <code>InAppMessageResponseCodeAndroid</code>
            </Link>
            )
          </em>{' '}
          - result of the in-app message flow.
        </li>
        <li>
          <code>purchaseToken</code>{' '}
          <em>
            (<code>string | null</code>)
          </em>{' '}
          - present when a subscription status changed.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`val result = openIapStore.showInAppMessages(
    activity,
    InAppMessageParamsAndroid(
        categories = listOf(InAppMessageCategoryAndroid.Transactional)
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val result = kmpIAP.showInAppMessagesAndroid(
    InAppMessageParamsAndroid(
        categories = listOf(InAppMessageCategoryAndroid.Transactional)
    )
)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`import { showInAppMessagesAndroid } from 'react-native-iap';
// The same API is exported by expo-iap.

if (Platform.OS === 'android') {
  const result = await showInAppMessagesAndroid({
    categories: ['transactional'],
  });

  if (
    result.responseCode === 'subscription-status-updated' &&
    result.purchaseToken
  ) {
    // Refresh this token through your subscription backend.
  }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  final result = await FlutterInappPurchase.instance.showInAppMessagesAndroid(
    categories: [InAppMessageCategoryAndroid.Transactional],
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var result = await ((MutationResolver)OpenIapClient.Instance)
    .ShowInAppMessagesAndroidAsync(new InAppMessageParamsAndroid
    {
        Categories = new[] { InAppMessageCategoryAndroid.Transactional },
    });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    var params = InAppMessageParamsAndroid.new()
    params.categories = [InAppMessageCategoryAndroid.TRANSACTIONAL]
    var result = await iap.show_in_app_messages_android(params)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default ShowInAppMessagesAndroid;
