import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import IapKitBanner from '../../../components/IapKitBanner';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

function ValidationAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Validation APIs"
        description="OpenIAP validation APIs - verifyPurchase and verifyPurchaseWithProvider for server-side purchase verification."
        path="/docs/apis/validation"
        keywords="verifyPurchase, purchase validation, IAPKit, receipt verification"
      />
      <h1>Validation APIs</h1>
      <p>
        APIs for verifying purchases with your server or third-party providers
        like IAPKit.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <strong>Always verify purchases server-side</strong> before granting
            entitlements
          </li>
          <li>
            <code>verifyPurchase</code>: Send to your own validation server
          </li>
          <li>
            <code>verifyPurchaseWithProvider</code>: Use IAPKit for managed
            validation
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
            dart: (
              <CodeBlock language="dart">{`Future<VerifyPurchaseResult> verifyPurchase(VerifyPurchaseProps options);`}</CodeBlock>
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
            dart: (
              <CodeBlock language="dart">{`final result = await FlutterInappPurchase.instance.verifyPurchase(
  purchase: purchase,
  serverUrl: 'https://your-server.com/api/verify',
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p className="type-link">
          See:{' '}
          <Link to="/docs/types#purchase-verification-types">
            VerifyPurchaseProps
          </Link>
        </p>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider" level="h2">
          verifyPurchaseWithProvider
        </AnchorLink>
        <IapKitBanner />
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
    </div>
  );
}

export default ValidationAPIs;
