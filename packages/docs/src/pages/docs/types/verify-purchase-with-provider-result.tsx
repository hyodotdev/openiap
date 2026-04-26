import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function VerifyPurchaseWithProviderResult() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="VerifyPurchaseWithProviderResult"
        description="VerifyPurchaseWithProviderResult type definition and field reference."
        path="/docs/types/verify-purchase-with-provider-result"
        keywords="VerifyPurchaseWithProviderResult, OpenIAP types, Verify Purchase With Provider Result"
      />
      <h1>VerifyPurchaseWithProviderResult</h1>
      <section>
        <AnchorLink id="verify-purchase-with-provider-result" level="h2">
          VerifyPurchaseWithProviderResult
        </AnchorLink>
        <p>
          Result type returned by <code>verifyPurchaseWithProvider()</code>.
        </p>
        <p>
          Result envelope from <code>verifyPurchaseWithProvider</code>. Carries{' '}
          <code>isValid</code> plus the underlying provider response. See{' '}
          <a
            href="https://www.openiap.dev/docs/features/validation"
            target="_blank"
            rel="noopener noreferrer"
          >
            Validation docs
          </a>
          .
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>provider</code>
              </td>
              <td>
                <Link to="/docs/types/verify-purchase-with-provider-props">
                  <code>PurchaseVerificationProvider</code>
                </Link>
              </td>
              <td>The provider used for verification.</td>
            </tr>
            <tr>
              <td>
                <code>iapkit</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitResult?</code>
              </td>
              <td>IAPKit verification result (optional).</td>
            </tr>
            <tr>
              <td>
                <code>errors</code>
              </td>
              <td>
                <code>VerifyPurchaseWithProviderError[]?</code>
              </td>
              <td>Error details if verification failed (see below).</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="verify-purchase-with-provider-error" level="h3">
          VerifyPurchaseWithProviderError
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>message</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Human-readable error description</td>
            </tr>
            <tr>
              <td>
                <code>code</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>Optional machine-readable error code</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-verify-purchase-with-iapkit-result" level="h3">
          RequestVerifyPurchaseWithIapkitResult
        </AnchorLink>
        <p>Individual verification result from IAPKit.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>store</code>
              </td>
              <td>
                <code>IapkitStore</code>
              </td>
              <td>
                The store that processed the purchase (<code>'apple'</code> or{' '}
                <code>'google'</code>).
              </td>
            </tr>
            <tr>
              <td>
                <code>isValid</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the purchase is valid (not falsified).</td>
            </tr>
            <tr>
              <td>
                <code>state</code>
              </td>
              <td>
                <code>IapkitPurchaseState</code>
              </td>
              <td>The current state of the purchase.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="iapkit-purchase-state" level="h3">
          IapkitPurchaseState
        </AnchorLink>
        <p>Unified purchase states from IAPKit verification response.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>'entitled'</code>
              </td>
              <td>
                User is entitled to the product (purchase is complete and
                active).
              </td>
            </tr>
            <tr>
              <td>
                <code>'pending-acknowledgment'</code>
              </td>
              <td>Purchase needs acknowledgment (Android only).</td>
            </tr>
            <tr>
              <td>
                <code>'pending'</code>
              </td>
              <td>Purchase is pending completion.</td>
            </tr>
            <tr>
              <td>
                <code>'canceled'</code>
              </td>
              <td>Purchase was canceled by the user.</td>
            </tr>
            <tr>
              <td>
                <code>'expired'</code>
              </td>
              <td>Subscription has expired.</td>
            </tr>
            <tr>
              <td>
                <code>'ready-to-consume'</code>
              </td>
              <td>Consumable purchase is ready to be consumed.</td>
            </tr>
            <tr>
              <td>
                <code>'consumed'</code>
              </td>
              <td>Consumable product has been consumed.</td>
            </tr>
            <tr>
              <td>
                <code>'unknown'</code>
              </td>
              <td>Purchase state could not be determined.</td>
            </tr>
            <tr>
              <td>
                <code>'inauthentic'</code>
              </td>
              <td>
                Purchase failed authenticity validation (potentially
                fraudulent).
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="iapkit-store" level="h3">
          IapkitStore
        </AnchorLink>
        <p>Enumeration of stores supported by IAPKit.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>'apple'</code>
              </td>
              <td>Apple App Store.</td>
            </tr>
            <tr>
              <td>
                <code>'google'</code>
              </td>
              <td>Google Play Store.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="purchase-verification-provider" level="h3">
          PurchaseVerificationProvider
        </AnchorLink>
        <p>Supported verification providers.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>'iapkit'</code>
              </td>
              <td>
                <a
                  href="https://kit.openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  IAPKit
                </a>{' '}
                - Server-side purchase verification service.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="verify-purchase-with-provider-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'openiap';
import type {
  VerifyPurchaseWithProviderProps,
  VerifyPurchaseWithProviderResult,
} from 'openiap';

// iOS verification
const iosResult = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    apple: {
      jws: purchase.purchaseToken, // JWS from StoreKit 2
    },
  },
});

// Android verification
const androidResult = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    google: {
      purchaseToken: purchase.purchaseToken,
    },
  },
});

// Check result
if (result.iapkit?.isValid && result.iapkit.state === 'entitled') {
  // Grant entitlement to user
  console.log(\`Valid purchase from \${result.iapkit.store}\`);
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

// Create verification props for iOS
let props = VerifyPurchaseWithProviderProps(
    iapkit: RequestVerifyPurchaseWithIapkitProps(
        apiKey: "your-iapkit-api-key",
        apple: RequestVerifyPurchaseWithIapkitAppleProps(
            jws: purchase.jwsRepresentationIOS ?? ""
        ),
        google: nil
    ),
    provider: .iapkit
)

// Verify purchase
let result = try await store.verifyPurchaseWithProvider(props)

// Check result
if let iapkit = result, iapkit.isValid && iapkit.state == .entitled {
    // Grant entitlement to user
    print("Valid purchase from \\(iapkit.store)")
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

// Create verification props for Android
val props = VerifyPurchaseWithProviderProps(
    iapkit = RequestVerifyPurchaseWithIapkitProps(
        apiKey = "your-iapkit-api-key",
        apple = null,
        google = RequestVerifyPurchaseWithIapkitGoogleProps(
            purchaseToken = purchase.purchaseToken
        )
    ),
    provider = PurchaseVerificationProvider.Iapkit
)

// Verify purchase
val result = module.verifyPurchaseWithProvider(props)

// Check result
result.iapkit?.let { iapkit ->
    if (iapkit.isValid && iapkit.state == IapkitPurchaseState.Entitled) {
        // Grant entitlement to user
        println("Valid purchase from \${iapkit.store}")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Create verification props for iOS
final props = VerifyPurchaseWithProviderProps(
  provider: PurchaseVerificationProvider.iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: 'your-iapkit-api-key',
    apple: RequestVerifyPurchaseWithIapkitAppleProps(
      jws: purchase.jwsRepresentationIOS ?? '',
    ),
  ),
);

// Verify purchase
final result = await iap.verifyPurchaseWithProvider(props);

// Check result
final iapkit = result.iapkit;
if (iapkit != null && iapkit.isValid && iapkit.state == IapkitPurchaseState.entitled) {
  // Grant entitlement to user
  print('Valid purchase from \${iapkit.store}');
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Create verification props for iOS
var props = VerifyPurchaseWithProviderProps.new()
props.provider = PurchaseVerificationProvider.IAPKIT
props.iapkit = RequestVerifyPurchaseWithIapkitProps.new()
props.iapkit.api_key = "your-iapkit-api-key"
props.iapkit.apple = RequestVerifyPurchaseWithIapkitAppleProps.new()
props.iapkit.apple.jws = purchase.jws_representation_ios

# Verify purchase
var result = await iap.verify_purchase_with_provider(props)

# Check result
var iapkit = result.iapkit
if iapkit != null and iapkit.is_valid and iapkit.state == IapkitPurchaseState.ENTITLED:
    # Grant entitlement to user
    print("Valid purchase from %s" % iapkit.store)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default VerifyPurchaseWithProviderResult;
