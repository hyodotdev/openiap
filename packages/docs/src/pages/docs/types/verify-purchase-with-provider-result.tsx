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
        description="VerifyPurchaseWithProviderResult field reference, including store-verified product IDs and IAPKit client payloads."
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
            href="https://openiap.dev/docs/features/validation"
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
        <p>
          Individual verification result from IAPKit. The verified product ID is
          independent of optional public product payload enrichment.
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
                <code>store</code>
              </td>
              <td>
                <code>IapStore</code>
              </td>
              <td>
                The store that processed the purchase: <code>'apple'</code>,{' '}
                <code>'google'</code>, <code>'horizon'</code>, or{' '}
                <code>'amazon'</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>isValid</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                True only for <code>entitled</code>,{' '}
                <code>pending-acknowledgment</code>, or{' '}
                <code>ready-to-consume</code>. Still require an exact{' '}
                <code>productId</code> match and a platform/product-type-aware
                fulfillment path.
              </td>
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
            <tr>
              <td>
                <code>productId</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                Product identifier verified by the upstream store, when the
                provider returns one. Use this value instead of trusting a
                client-supplied expected product ID.
              </td>
            </tr>
            <tr>
              <td>
                <code>clientPayload</code>
              </td>
              <td>
                <code>IapkitProductClientPayload?</code>
              </td>
              <td>
                Public app-facing product data. Present only for an opted-in,
                valid Apple or Google verification when that product has a
                currently visible catalog row and a payload in IAPKit.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="iapkit-product-client-payload" level="h3">
          IapkitProductClientPayload
        </AnchorLink>
        <p>
          Public app-facing data attached to one IAPKit product. It is stored
          separately from App Store Connect and Play Console metadata and is
          never sent to either store.
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
                <code>format</code>
              </td>
              <td>
                <code>IapkitClientPayloadFormat</code>
              </td>
              <td>
                Serialization hint: <code>'toml'</code>, <code>'json'</code>, or{' '}
                <code>'text'</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>body</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                Payload content, limited to 16 KiB measured as UTF-8 bytes.
              </td>
            </tr>
            <tr>
              <td>
                <code>version</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>
                Server-managed revision that increments when the payload is
                updated. Apps can use it to replace stale cached content.
              </td>
            </tr>
            <tr>
              <td>
                <code>updatedAt</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Last update time as Unix epoch milliseconds.</td>
            </tr>
          </tbody>
        </table>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Public data:</strong> Anyone able to call the project's
            client endpoints may receive this payload. Never put secrets,
            credentials, signing keys, or private authorization rules in it.
            Entitlement decisions must continue to use <code>isValid</code>,{' '}
            <code>state</code>, and the store-verified <code>productId</code>.
          </p>
        </div>

        <p>
          The field is omitted by default and for invalid receipts, absent or
          removed catalog products, missing payloads, Horizon verification, and
          Amazon verification. IAPKit does not deliver it through APNs or FCM;
          the app receives it only when it requests the value during
          verification or through a product endpoint.
        </p>

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
              <td>
                Google Play purchase still needs acknowledgment or consumption.
              </td>
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
              <td>Purchase was canceled, refunded, or revoked.</td>
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
              <td>
                Consumable is ready for durable fulfillment, then consumption.
              </td>
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
          IapStore
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
            <tr>
              <td>
                <code>'horizon'</code>
              </td>
              <td>Meta Horizon Store.</td>
            </tr>
            <tr>
              <td>
                <code>'amazon'</code>
              </td>
              <td>Amazon Appstore for Fire OS and Vega OS.</td>
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
        <p>
          Grant access only when the store-verified <code>productId</code> is
          present and matches the product requested by the app. Use the local
          purchase ID only as the expected value; do not fall back to it when
          verification omits the ID.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'expo-iap';
// Same API in react-native-iap.

const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'openiap-kit_<your-key>',
    includeClientPayload: true,
    google: {
      purchaseToken: purchase.purchaseToken ?? '',
    },
  },
});

const verified = result.iapkit;
const verifiedProductId = verified?.productId;
if (
  verified?.isValid === true &&
  (verified.state === 'entitled' ||
    verified.state === 'pending-acknowledgment') &&
  verifiedProductId != null &&
  verifiedProductId === purchase.productId
) {
  await grantEntitlement(verifiedProductId);

  if (verified.clientPayload) {
    // Parse according to format and apply in memory; do not log the body.
    applyPublicRules(verified.clientPayload);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

let result = try await OpenIapModule.shared.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit: RequestVerifyPurchaseWithIapkitProps(
            apiKey: "openiap-kit_<your-key>",
            apple: RequestVerifyPurchaseWithIapkitAppleProps(
                jws: purchase.purchaseToken ?? ""
            ),
            includeClientPayload: true
        ),
        provider: .iapkit
    )
)

if let verified = result.iapkit,
   verified.isValid,
   verified.state == .entitled,
   let verifiedProductId = verified.productId,
   verifiedProductId == purchase.productId {
    unlockEntitlement(productId: verifiedProductId)
    if let payload = verified.clientPayload {
        // Parse according to format and apply in memory; do not log the body.
        applyPublicRules(payload)
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

val result = module.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_<your-key>",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken.orEmpty(),
            ),
            includeClientPayload = true,
        ),
        provider = PurchaseVerificationProvider.Iapkit,
    ),
)

result.iapkit?.let { iapkit ->
    val verifiedProductId = iapkit.productId
    if (iapkit.isValid &&
        (iapkit.state == IapkitPurchaseState.Entitled ||
            iapkit.state == IapkitPurchaseState.PendingAcknowledgment) &&
        verifiedProductId != null &&
        verifiedProductId == purchase.productId) {
        unlockEntitlement(verifiedProductId)
        iapkit.clientPayload?.let { payload ->
            // Parse according to format and apply in memory; do not log the body.
            applyPublicRules(payload)
        }
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.*

val result = kmpIAP.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_<your-key>",
            apple = RequestVerifyPurchaseWithIapkitAppleProps(
                jws = purchase.purchaseToken.orEmpty(),
            ),
            includeClientPayload = true,
        ),
        provider = PurchaseVerificationProvider.Iapkit,
    ),
)

result.iapkit?.let { iapkit ->
    val verifiedProductId = iapkit.productId
    if (iapkit.isValid &&
        iapkit.state == IapkitPurchaseState.Entitled &&
        verifiedProductId != null &&
        verifiedProductId == purchase.productId) {
        unlockEntitlement(verifiedProductId)
        iapkit.clientPayload?.let { payload ->
            // Parse according to format and apply in memory; do not log the body.
            applyPublicRules(payload)
        }
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final result = await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
  provider: PurchaseVerificationProvider.Iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: 'openiap-kit_<your-key>',
    google: RequestVerifyPurchaseWithIapkitGoogleProps(
      purchaseToken: purchase.purchaseToken ?? '',
    ),
    includeClientPayload: true,
  ),
);

final iapkit = result.iapkit;
final verifiedProductId = iapkit?.productId;
if (iapkit != null &&
    iapkit.isValid &&
    (iapkit.state == IapkitPurchaseState.Entitled ||
        iapkit.state == IapkitPurchaseState.PendingAcknowledgment) &&
    verifiedProductId != null &&
    verifiedProductId == purchase.productId) {
  unlockEntitlement(verifiedProductId);
  final payload = iapkit.clientPayload;
  // Parse according to format and apply in memory; do not log the body.
  if (payload != null) applyPublicRules(payload);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var result = await ((MutationResolver)OpenIapClient.Instance)
    .VerifyPurchaseWithProviderAsync(new VerifyPurchaseWithProviderProps
{
    Provider = PurchaseVerificationProvider.Iapkit,
    Iapkit = new RequestVerifyPurchaseWithIapkitProps
    {
        ApiKey = "openiap-kit_<your-key>",
        IncludeClientPayload = true,
        Google = new RequestVerifyPurchaseWithIapkitGoogleProps
        {
            PurchaseToken = purchase.PurchaseToken ?? "",
        },
    },
});

var iapkit = result.Iapkit;
var verifiedProductId = iapkit?.ProductId;
if (iapkit is { IsValid: true } &&
    (iapkit.State == IapkitPurchaseState.Entitled ||
     iapkit.State == IapkitPurchaseState.PendingAcknowledgment) &&
    verifiedProductId is not null &&
    verifiedProductId == purchase.ProductId)
{
    UnlockEntitlement(verifiedProductId);
    if (iapkit.ClientPayload is { } payload)
    {
        // Parse according to format and apply in memory; do not log the body.
        ApplyPublicRules(payload);
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Create verification props for Google Play.
const Types = preload("res://addons/godot-iap/types.gd")

var props = Types.VerifyPurchaseWithProviderProps.new()
props.provider = Types.PurchaseVerificationProvider.IAPKIT
props.iapkit = Types.RequestVerifyPurchaseWithIapkitProps.new()
props.iapkit.api_key = "openiap-kit_<your-key>"
props.iapkit.include_client_payload = true
props.iapkit.google = Types.RequestVerifyPurchaseWithIapkitGoogleProps.new()
props.iapkit.google.purchase_token = purchase.purchase_token

var result = await iap.verify_purchase_with_provider(props)

var iapkit = result.iapkit
var verified_product_id = iapkit.product_id if iapkit != null else null
if (
    iapkit != null
    and iapkit.is_valid
    and iapkit.state in [
        Types.IapkitPurchaseState.ENTITLED,
        Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT,
    ]
    and verified_product_id != null
    and verified_product_id == purchase.product_id
):
    unlock_entitlement(verified_product_id)
    if iapkit.client_payload != null:
        # Parse according to format and apply in memory; do not log the body.
        apply_public_rules(iapkit.client_payload)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          These examples cover non-consumables and subscriptions: Apple examples
          require <code>entitled</code>, while Google examples also allow{' '}
          <code>pending-acknowledgment</code>. Choose the finish path from the
          app-owned product type and platform, not the state alone. Apple and
          Amazon consumables use <code>ready-to-consume</code>, while an
          unconsumed Google product may be <code>entitled</code> or{' '}
          <code>pending-acknowledgment</code>. Persist consumable delivery
          before finishing it; see the{' '}
          <Link to="/docs/features/validation#verify-purchase-with-provider">
            state-aware flow
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default VerifyPurchaseWithProviderResult;
