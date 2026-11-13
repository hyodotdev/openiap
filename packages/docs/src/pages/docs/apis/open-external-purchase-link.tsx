import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function OpenExternalPurchaseLink() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="openExternalPurchaseLink"
        description="Show the store's required disclosure, open an external purchase link after the user continues, and return the token to report."
        path="/docs/apis/open-external-purchase-link"
        keywords="openExternalPurchaseLink, external purchase, external offers, custom link, report token"
      />
      <h1>openExternalPurchaseLink</h1>
      <p>
        Show the store&apos;s required disclosure, open the external purchase
        link only after the user continues, and return the token to report from
        your server. The disclosure cannot be skipped.
      </p>
      <p>
        Available in Client Protocol 1.5.0 / <code>openiap-apple</code> 4.2.0 /{' '}
        <code>openiap-google</code> 4.2.0 (requires iOS 17.4+ or Play Billing
        8.2.1+).
      </p>
      <ul>
        <li>
          <strong>iOS 18.1+:</strong> shows the{' '}
          <code>ExternalPurchaseCustomLink</code> notice, then requests a token
          of <code>apple.tokenType</code> (default <code>acquisition</code>; use{' '}
          <code>link-out</code> in Japan and Brazil) and opens the URL.
        </li>
        <li>
          <strong>iOS 17.4 to 18.0:</strong> shows the{' '}
          <code>ExternalPurchase</code> notice sheet, which returns the token,
          then opens the URL. Use a link listed under{' '}
          <code>SKExternalPurchase</code> in Info.plist.
        </li>
        <li>
          <strong>Google Play:</strong> creates external offer reporting
          details, then calls <code>launchExternalLink</code>, which shows
          Play&apos;s dialog before opening the link.
        </li>
        <li>
          <strong>Amazon, Meta Horizon, Vega OS:</strong> returns{' '}
          <code>unavailable</code> without showing anything.
        </li>
      </ul>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`openExternalPurchaseLink(
  request: ExternalPurchaseLinkRequest,
): Promise<ExternalPurchaseLinkResult>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func openExternalPurchaseLink(
    _ request: ExternalPurchaseLinkRequest
) async throws -> ExternalPurchaseLinkResult`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun openExternalPurchaseLink(
    activity: Activity,
    request: ExternalPurchaseLinkRequest
): ExternalPurchaseLinkResult`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun openExternalPurchaseLink(
    request: ExternalPurchaseLinkRequest
): ExternalPurchaseLinkResult`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ExternalPurchaseLinkResult> openExternalPurchaseLink(
  ExternalPurchaseLinkRequest request,
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<ExternalPurchaseLinkResult> OpenExternalPurchaseLinkAsync(
    ExternalPurchaseLinkRequest request);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func open_external_purchase_link(request) -> Variant # ExternalPurchaseLinkResult or null`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul>
        <li>
          <code>url</code> (required): the web checkout to open.
        </li>
        <li>
          <code>apple.tokenType</code>: the iOS 18.1+ token type. Ignored on iOS
          17.4 to 18.0.
        </li>
        <li>
          <code>google.linkType</code>: the Play link type. Defaults to{' '}
          <code>link-to-digital-content-offer</code>.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <ul>
        <li>
          <code>status</code>: <code>opened</code> (the user continued and the
          link opened), <code>cancelled</code> (the user dismissed the
          disclosure; nothing opened), or <code>unavailable</code> (nothing was
          shown).
        </li>
        <li>
          <code>reportToken</code>: present only when <code>opened</code>.
          Play&apos;s <code>externalTransactionToken</code> or Apple&apos;s
          external purchase token. OpenIAP never sends it anywhere.
        </li>
        <li>
          <code>platform</code>: the platform that produced the token.
        </li>
      </ul>

      <AnchorLink id="throws" level="h2">
        Throws
      </AnchorLink>
      <p>
        <code>cancelled</code> and <code>unavailable</code> are results, not
        errors. A store failure, a missing token, or a link that cannot open
        throws, for example <code>service-error</code> or{' '}
        <code>not-prepared</code>. Android also needs a current Activity. Godot
        emits <code>purchase_error</code> and returns <code>null</code>.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { openExternalPurchaseLink } from 'expo-iap'; // or 'react-native-iap'

const result = await openExternalPurchaseLink({
  url: 'https://example.com/checkout',
  apple: { tokenType: 'acquisition' },
});
if (result.status === 'opened') {
  // Report result.reportToken from your backend after the web purchase.
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.openExternalPurchaseLink(
    ExternalPurchaseLinkRequest(url: "https://example.com/checkout")
)
if result.status == .opened, let token = result.reportToken {
    // Send token to your backend.
}`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val result = openIapStore.openExternalPurchaseLink(
    activity,
    ExternalPurchaseLinkRequest(url = "https://example.com/checkout"),
)
if (result.status == ExternalPurchaseLinkStatus.Opened) {
    // Send result.reportToken to your backend.
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`val result = kmpIAP.openExternalPurchaseLink(
    ExternalPurchaseLinkRequest(url = "https://example.com/checkout")
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final result = await FlutterInappPurchase.instance.openExternalPurchaseLink(
  ExternalPurchaseLinkRequest(url: 'https://example.com/checkout'),
);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`var result = await OpenIapClient.Mutation.OpenExternalPurchaseLinkAsync(
    new ExternalPurchaseLinkRequest { Url = "https://example.com/checkout" });`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var request = Types.ExternalPurchaseLinkRequest.new()
request.url = "https://example.com/checkout"
var result = await iap.open_external_purchase_link(request)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/features/external-purchase#external-purchase-link">
          External Purchase
        </Link>
      </p>
    </div>
  );
}

export default OpenExternalPurchaseLink;
