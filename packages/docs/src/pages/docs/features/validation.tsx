import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import IapKitBanner from '../../../components/IapKitBanner';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

function Validation() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Validation"
        description="Validate in-app purchases server-side. verifyPurchase and verifyPurchaseWithProvider for receipt and JWS verification."
        path="/docs/features/validation"
        keywords="verifyPurchase, purchase validation, IAPKit, receipt verification, server-side validation, JWS verification"
      />
      <h1>Validation</h1>
      <p>
        Verify purchases with your own backend or a managed provider like IAPKit
        before granting entitlements. Always validate server-side — client-side
        checks can be bypassed.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <strong>Always verify purchases server-side</strong> before granting
            entitlements
          </li>
          <li>
            <a href="#verify-purchase">
              <code>verifyPurchase</code>
            </a>
            : Send to your own validation server
          </li>
          <li>
            <a href="#verify-purchase-with-provider">
              <code>verifyPurchaseWithProvider</code>
            </a>
            : Use IAPKit for managed validation
          </li>
          <li>
            <strong>Error ≠ Invalid</strong>: Network errors don't mean the
            purchase is invalid
          </li>
        </ul>
      </TLDRBox>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Security:</strong> Never verify purchases only on the client
          side. Client-side verification can be bypassed.
        </p>
      </div>

      <section>
        <AnchorLink id="verify-purchase" level="h2">
          verifyPurchase
        </AnchorLink>
        <p>Verify a purchase with your backend server.</p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`verifyPurchase(options: VerifyPurchaseProps): Promise<VerifyPurchaseResult>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func verifyPurchase(options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<VerifyPurchaseResult> verifyPurchase(VerifyPurchaseProps options);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps Options)`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func verify_purchase(options: VerifyPurchaseProps) -> VerifyPurchaseResult`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchase } from 'expo-iap';

const result = await verifyPurchase({
  purchase,
  serverUrl: 'https://your-server.com/api/verify',
});

if (result.isValid) {
  await grantEntitlement(purchase.productId);
  await finishTransaction(purchase, false);
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.verifyPurchase(
    VerifyPurchaseProps(purchase: purchase, serverUrl: "https://your-server.com/api/verify")
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val result = openIapStore.verifyPurchase(
    VerifyPurchaseProps(purchase = purchase, serverUrl = "https://your-server.com/api/verify")
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`val result = kmpIAP.verifyPurchase(
    VerifyPurchaseProps(purchase = purchase, serverUrl = "https://your-server.com/api/verify")
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final result = await FlutterInappPurchase.instance.verifyPurchase(
  purchase: purchase,
  serverUrl: 'https://your-server.com/api/verify',
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var result = await ((QueryResolver)Iap.Instance).VerifyPurchaseAsync(
    VerifyPurchaseProps(purchase = purchase, serverUrl = "https://your-server.com/api/verify")
)`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var options = VerifyPurchaseProps.new()
options.purchase = purchase
options.server_url = "https://your-server.com/api/verify"

var result = await iap.verify_purchase(options)

if result.is_valid:
    await grant_entitlement(purchase.product_id)
    await iap.finish_transaction(purchase, false)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p className="type-link">
          See: <Link to="/docs/types/verify-purchase">VerifyPurchaseProps</Link>
        </p>
      </section>

      <section>
        <AnchorLink id="iapkit" level="h2">
          What is IAPKit?
        </AnchorLink>
        <IapKitBanner />
        <p>
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>{' '}
          is an <strong>open-source</strong> (MIT) receipt-validation service
          for App Store and Google Play purchases. Instead of running your own
          backend that talks to Apple's App Store Server API and Google Play
          Developer API, you forward the JWS / purchase token to IAPKit and get
          a normalized verification response — so one-time in-app purchases
          can't be faked, replayed, or tampered with. Use the hosted version at{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            kit.openiap.dev
          </a>{' '}
          (free for everyone) or self-host the source from{' '}
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/kit"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>packages/kit</code>
          </a>{' '}
          in this monorepo.
        </p>

        <h4>Why use it</h4>
        <ul>
          <li>
            <strong>Cross-store, one schema</strong> — same{' '}
            <Link to="/docs/types/verify-purchase-with-provider-result">
              <code>VerifyPurchaseWithProviderResult</code>
            </Link>{' '}
            shape for Apple and Google. No per-platform JSON parsing.
          </li>
          <li>
            <strong>Fraud-proof</strong> — verifies Apple JWS signatures and
            queries Google Play's authoritative subscription/purchase state on
            the server, blocking forged receipts and replay attacks.
          </li>
          <li>
            <strong>Entitlement state, not raw receipts</strong> — IAPKit
            collapses raw store data into a single <code>state</code> field (
            <code>entitled</code>, <code>pending</code>, <code>canceled</code>,{' '}
            <code>expired</code>, <code>refunded</code>,{' '}
            <code>inauthentic</code>, etc.) so your client and server can act on
            a single value.
          </li>
          <li>
            <strong>No backend boilerplate</strong> — no service account JSON,
            no App Store private key rotation, no webhook plumbing required to
            get started.
          </li>
        </ul>

        <h4>When to roll your own instead</h4>
        <ul>
          <li>
            You have strict data-residency requirements that disallow sending
            purchase tokens to a third-party.
          </li>
          <li>
            You already operate a hardened receipt-validation service and don't
            want another vendor in the path.
          </li>
        </ul>

        <p>
          Get an API key at{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            kit.openiap.dev
          </a>
          , then call{' '}
          <a href="#verify-purchase-with-provider">
            <code>verifyPurchaseWithProvider</code>
          </a>{' '}
          below.
        </p>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider" level="h2">
          verifyPurchaseWithProvider
        </AnchorLink>
        <p>
          Verify a purchase using a provider like{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>
          .
        </p>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'expo-iap';

const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    apple: { jws: purchase.purchaseToken },
    google: { purchaseToken: purchase.purchaseToken },
  },
});

if (result.iapkit?.isValid && result.iapkit?.state === 'entitled') {
  await grantEntitlement(purchase.productId);
  await finishTransaction(purchase, false);
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let result = try await store.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit: RequestVerifyPurchaseWithIapkitProps(
            apiKey: "your-iapkit-api-key",
            apple: RequestVerifyPurchaseWithIapkitAppleProps(
                jws: purchase.purchaseToken ?? ""
            ),
            google: nil
        ),
        provider: .iapkit
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val result = module.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "your-api-key",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken
            )
        ),
        provider = PurchaseVerificationProvider.Iapkit
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`val result = kmpIAP.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "your-api-key",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken
            )
        ),
        provider = PurchaseVerificationProvider.Iapkit
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final result = await iap.verifyPurchaseWithProvider(
  VerifyPurchaseWithProviderProps(
    provider: PurchaseVerificationProvider.iapkit,
    iapkit: RequestVerifyPurchaseWithIapkitProps(
      apiKey: 'your-iapkit-api-key',
      apple: RequestVerifyPurchaseWithIapkitAppleProps(jws: purchase.purchaseToken ?? ''),
    ),
  ),
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var result = module.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "your-api-key",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken
            )
        ),
        provider = PurchaseVerificationProvider.Iapkit
    )
)`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var iapkit_props = RequestVerifyPurchaseWithIapkitProps.new()
iapkit_props.api_key = "your-iapkit-api-key"
iapkit_props.google = RequestVerifyPurchaseWithIapkitGoogleProps.new()
iapkit_props.google.purchase_token = purchase.purchase_token

var props = VerifyPurchaseWithProviderProps.new()
props.provider = PurchaseVerificationProvider.IAPKIT
props.iapkit = iapkit_props

var result = await iap.verify_purchase_with_provider(props)

if result.iapkit.is_valid and result.iapkit.state == IapkitPurchaseState.ENTITLED:
    await grant_entitlement(purchase.product_id)
    await iap.finish_transaction(purchase, false)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>IAPKit Purchase States</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>State</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>entitled</code>
              </td>
              <td>User is entitled to the product</td>
            </tr>
            <tr>
              <td>
                <code>pending-acknowledgment</code>
              </td>
              <td>Purchase needs acknowledgment (Android)</td>
            </tr>
            <tr>
              <td>
                <code>pending</code>
              </td>
              <td>Purchase is pending</td>
            </tr>
            <tr>
              <td>
                <code>canceled</code>
              </td>
              <td>Purchase was canceled</td>
            </tr>
            <tr>
              <td>
                <code>expired</code>
              </td>
              <td>Subscription has expired</td>
            </tr>
            <tr>
              <td>
                <code>ready-to-consume</code>
              </td>
              <td>Consumable ready for consumption</td>
            </tr>
            <tr>
              <td>
                <code>consumed</code>
              </td>
              <td>Consumable has been consumed</td>
            </tr>
            <tr>
              <td>
                <code>inauthentic</code>
              </td>
              <td>Purchase failed authenticity check</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="error-handling" level="h2">
          Error Handling Best Practice
        </AnchorLink>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Important: Verification error ≠ Invalid purchase</strong>
          </p>
          <p>
            When verification throws an error, it does NOT mean the purchase is
            invalid. Errors can occur due to network issues, server downtime, or
            misconfigured API keys.
          </p>
          <p>
            <strong>Don't penalize customers for verification failures.</strong>
          </p>
        </div>

        <h4>Recommended Pattern</h4>
        <CodeBlock language="typescript">{`try {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: { apiKey: 'your-key', apple: { jws: purchase.purchaseToken } },
  });

  if (result.iapkit?.isValid) {
    // Verification succeeded - grant access
    await finishTransaction(purchase);
    grantAccess();
  } else {
    // Verification returned invalid - actually invalid purchase
    // Don't call finishTransaction - allow retry
    denyAccess();
  }
} catch (error) {
  // Verification itself failed (network, server error, etc.)
  // This doesn't mean the purchase is invalid
  console.error('Verification failed:', error);

  // Fail-open approach: grant access anyway
  await finishTransaction(purchase);
  grantAccess();
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchase-identifiers" level="h2">
          Purchase Identifier Usage
        </AnchorLink>
        <p>
          Use the appropriate identifiers for content delivery and purchase
          tracking:
        </p>

        <h4>iOS Identifiers</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Consumable</td>
              <td>
                <code>transactionId</code>
              </td>
              <td>Track each purchase individually</td>
            </tr>
            <tr>
              <td>Non-consumable</td>
              <td>
                <code>transactionId</code>
              </td>
              <td>Single purchase tracking</td>
            </tr>
            <tr>
              <td>Subscription</td>
              <td>
                <code>originalTransactionIdentifierIOS</code>
              </td>
              <td>Track across renewals (stays constant)</td>
            </tr>
          </tbody>
        </table>

        <h4>Android Identifiers</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Product Type</th>
              <th>Primary Identifier</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Consumable</td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track each purchase</td>
            </tr>
            <tr>
              <td>Non-consumable</td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Track ownership status</td>
            </tr>
            <tr>
              <td>Subscription</td>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>Same token across renewals</td>
            </tr>
          </tbody>
        </table>

        <p>
          <strong>Idempotency:</strong> Use these identifiers to prevent
          duplicate content delivery.
        </p>
      </section>

      <section>
        <AnchorLink id="references" level="h2">
          Native References
        </AnchorLink>
        <ul>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store"
              target="_blank"
              rel="noopener noreferrer"
            >
              Validating receipts with the App Store
            </a>
          </li>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/appstoreserverapi"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Store Server API
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Developer API · purchases.subscriptionsv2
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/rtdn-reference"
              target="_blank"
              rel="noopener noreferrer"
            >
              Real-time Developer Notifications
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Validation;
