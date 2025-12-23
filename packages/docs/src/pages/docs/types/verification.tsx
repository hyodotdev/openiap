import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

function TypesVerification() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Verification Types"
        description="OpenIAP Verification type definitions - VerifyPurchaseProps, VerifyPurchaseResult, IAPKit integration types for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/verification"
        keywords="IAP types, VerifyPurchase, IAPKit, purchase verification, TypeScript, Swift, Kotlin"
      />
      <h1>Verification Types</h1>
      <p>
        Type definitions for purchase verification with{' '}
        <code>verifyPurchase()</code> and <code>verifyPurchaseWithProvider()</code>.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <code>VerifyPurchaseProps</code> - Input for verifyPurchase() with
            platform-specific params
          </li>
          <li>
            <code>VerifyPurchaseResult</code> - Platform-specific verification
            results
          </li>
          <li>
            <code>VerifyPurchaseWithProviderProps</code> - IAPKit integration
            input
          </li>
          <li>
            <code>IapkitPurchaseState</code> - Unified purchase states from
            IAPKit
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="purchase-verification-types" level="h2">
          Purchase Verification Types
        </AnchorLink>
        <p>
          Types used with <code>verifyPurchase()</code> for server-side purchase
          verification.
        </p>

        <AnchorLink id="verify-purchase-props" level="h3">
          VerifyPurchaseProps
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>apple</code>
              </td>
              <td>
                Apple App Store verification options. Contains:{' '}
                <code>sku</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                Google Play verification options. Contains:{' '}
                <code>sku</code>, <code>packageName</code>,{' '}
                <code>purchaseToken</code>, <code>accessToken</code>,{' '}
                <code>isSub</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>horizon</code>
              </td>
              <td>
                Meta Horizon (Quest) verification options. Contains:{' '}
                <code>sku</code>, <code>userId</code>, <code>accessToken</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="verify-purchase-result" level="h3">
          VerifyPurchaseResult
        </AnchorLink>
        <p>
          Union of <code>VerifyPurchaseResultIOS</code>,{' '}
          <code>VerifyPurchaseResultAndroid</code>, and{' '}
          <code>VerifyPurchaseResultHorizon</code>.
        </p>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="verify-purchase-result-ios" level="h4">
                  VerifyPurchaseResultIOS
                </AnchorLink>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>isValid</code>
                      </td>
                      <td>Whether verification succeeded</td>
                    </tr>
                    <tr>
                      <td>
                        <code>receiptData</code>
                      </td>
                      <td>Raw App Store receipt data</td>
                    </tr>
                    <tr>
                      <td>
                        <code>jwsRepresentation</code>
                      </td>
                      <td>JWS-encoded transaction</td>
                    </tr>
                    <tr>
                      <td>
                        <code>latestTransaction</code>
                      </td>
                      <td>Most recent transaction for this product</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="verify-purchase-result-android" level="h4">
                  VerifyPurchaseResultAndroid (Google Play)
                </AnchorLink>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>autoRenewing</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>betaProduct</code>
                      </td>
                      <td>True if beta/test product</td>
                    </tr>
                    <tr>
                      <td>
                        <code>cancelDate</code>
                      </td>
                      <td>Cancellation timestamp (null if active)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>cancelReason</code>
                      </td>
                      <td>Reason for cancellation</td>
                    </tr>
                    <tr>
                      <td>
                        <code>freeTrialEndDate</code>
                      </td>
                      <td>Free trial end timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>gracePeriodEndDate</code>
                      </td>
                      <td>Grace period end timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>productId</code>
                      </td>
                      <td>Product identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>productType</code>
                      </td>
                      <td>Product type</td>
                    </tr>
                    <tr>
                      <td>
                        <code>purchaseDate</code>
                      </td>
                      <td>Purchase timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>quantity</code>
                      </td>
                      <td>Purchase quantity</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionId</code>
                      </td>
                      <td>Transaction identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalDate</code>
                      </td>
                      <td>Next renewal timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>term</code>
                      </td>
                      <td>Subscription term (e.g., "P1M")</td>
                    </tr>
                    <tr>
                      <td>
                        <code>testTransaction</code>
                      </td>
                      <td>True if test/sandbox transaction</td>
                    </tr>
                  </tbody>
                </table>

                <AnchorLink id="verify-purchase-result-horizon" level="h4">
                  VerifyPurchaseResultHorizon (Meta Quest)
                </AnchorLink>
                <table className="doc-table" style={{ marginTop: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>success</code>
                      </td>
                      <td>Whether the entitlement verification succeeded</td>
                    </tr>
                    <tr>
                      <td>
                        <code>grantTime</code>
                      </td>
                      <td>
                        Unix timestamp when the entitlement was granted (null if
                        verification failed)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider-props" level="h2">
          VerifyPurchaseWithProviderProps
        </AnchorLink>
        <p>
          Input type for <code>verifyPurchaseWithProvider()</code> - used to
          verify purchases through external providers like{' '}
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
                <code>PurchaseVerificationProvider</code>
              </td>
              <td>
                The verification provider to use. Currently only{' '}
                <code>'iapkit'</code> is supported.
              </td>
            </tr>
            <tr>
              <td>
                <code>iapkit</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitProps?</code>
              </td>
              <td>IAPKit-specific verification parameters.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-verify-purchase-with-iapkit-props" level="h3">
          RequestVerifyPurchaseWithIapkitProps
        </AnchorLink>
        <p>Parameters for IAPKit verification.</p>
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
                <code>apiKey</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                API key used for the Authorization header (Bearer {'{apiKey}'}
                ).
              </td>
            </tr>
            <tr>
              <td>
                <code>apple</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitAppleProps?</code>
              </td>
              <td>Apple/iOS verification parameters.</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                <code>RequestVerifyPurchaseWithIapkitGoogleProps?</code>
              </td>
              <td>Google/Android verification parameters.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-apple-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitAppleProps
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
                <code>jws</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>The JWS token returned with the purchase response.</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink
          id="request-verify-purchase-with-iapkit-google-props"
          level="h4"
        >
          RequestVerifyPurchaseWithIapkitGoogleProps
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
                <code>purchaseToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                The token provided to the user's device when the product or
                subscription was purchased.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider-result" level="h2">
          VerifyPurchaseWithProviderResult
        </AnchorLink>
        <p>
          Result type returned by <code>verifyPurchaseWithProvider()</code>.
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
                <code>PurchaseVerificationProvider</code>
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
              <td>Purchase failed authenticity validation (potentially fraudulent).</td>
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
                  href="https://iapkit.com"
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
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default TypesVerification;
