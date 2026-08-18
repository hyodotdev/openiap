import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
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
        description="Validate in-app purchases with your backend or IAPKit. verifyPurchase and verifyPurchaseWithProvider for receipt and JWS verification."
        path="/docs/features/validation"
        keywords="verifyPurchase, purchase validation, IAPKit, receipt verification, Amazon RVS, Fire OS, Vega OS, server-side validation, JWS verification"
      />
      <h1>Validation</h1>
      <p>
        Verify purchases with your own backend or a managed provider like IAPKit
        before granting entitlements. Always validate through a trusted
        server-side verifier; local StoreKit or Play Billing state alone can be
        bypassed.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <strong>Always verify with a trusted verifier</strong> before
            granting entitlements
          </li>
          <li>
            <a href="#verify-purchase">
              <code>verifyPurchase</code>
            </a>
            : Verify with explicit Apple, Google, or Horizon options
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
          <li>
            <strong>Optional product data</strong>: Valid Apple and Google
            verification can opt into a public IAPKit client payload
          </li>
        </ul>
      </TLDRBox>

      <Callout kind="warning" title="Security">
        Never rely only on local client purchase state. Use your backend or
        IAPKit as the verifier.
      </Callout>

      <section>
        <AnchorLink id="verify-purchase" level="h2">
          verifyPurchase
        </AnchorLink>
        <p>
          Verify a purchase with explicit platform options. The current API
          accepts <code>apple</code>, <code>google</code>, or{' '}
          <code>horizon</code>; it does not accept a Purchase object or a server
          URL. Keep Google and Horizon access tokens on trusted infrastructure
          whenever possible.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`verifyPurchase(options: VerifyPurchaseProps): Promise<VerifyPurchaseResult>`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func verifyPurchase(_ options: VerifyPurchaseProps) async throws -> VerifyPurchaseResult`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`suspend fun verifyPurchase(options: VerifyPurchaseProps): VerifyPurchaseResult`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<VerifyPurchaseResult> verifyPurchase({
  VerifyPurchaseAppleOptions? apple,
  VerifyPurchaseGoogleOptions? google,
  VerifyPurchaseHorizonOptions? horizon,
});`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps options);`}</CodeBlock>
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
  apple: { sku: purchase.productId },
});

if ('isValid' in result && result.isValid) {
  await grantEntitlement(purchase.productId);
  await finishTransaction({ purchase, isConsumable: false });
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let result = try await OpenIapModule.shared.verifyPurchase(
    VerifyPurchaseProps(
        apple: VerifyPurchaseAppleOptions(sku: purchase.productId)
    )
)

if case let .verifyPurchaseResultIos(iosResult) = result,
   iosResult.isValid {
    await grantEntitlement(purchase.productId)
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Keep accessToken on trusted infrastructure; shown here to document the API shape.
val result = module.verifyPurchase(
    VerifyPurchaseProps(
        google = VerifyPurchaseGoogleOptions(
            accessToken = accessToken,
            isSub = false,
            packageName = context.packageName,
            purchaseToken = requireNotNull(purchase.purchaseToken),
            sku = purchase.productId
        )
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`val result = kmpIAP.verifyPurchase(
    VerifyPurchaseProps(
        apple = VerifyPurchaseAppleOptions(sku = purchase.productId)
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final result = await FlutterInappPurchase.instance.verifyPurchase(
  apple: VerifyPurchaseAppleOptions(sku: purchase.productId),
);

if (result is VerifyPurchaseResultIOS && result.isValid) {
  await grantEntitlement(purchase.productId);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var result = await ((MutationResolver)OpenIapClient.Instance).VerifyPurchaseAsync(
    new VerifyPurchaseProps
    {
        Google = new VerifyPurchaseGoogleOptions
        {
            Sku = "com.app.premium",
            PackageName = "com.yourcompany.app",
            PurchaseToken = purchase.PurchaseToken!,
            AccessToken = accessToken,
        },
    });`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var options = VerifyPurchaseProps.new()
options.apple = VerifyPurchaseAppleOptions.new()
options.apple.sku = purchase.product_id

var result = await iap.verify_purchase(options)

if result is VerifyPurchaseResultIOS and result.is_valid:
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
          is <strong>open-source</strong> (MIT) purchase validation and
          entitlement infrastructure for the OpenIAP ecosystem. Its managed
          validation endpoint supports App Store, Google Play, Amazon Appstore,
          and Meta Horizon purchases. Instead of running your own backend that
          talks to each store's verification API, you forward the JWS, purchase
          token, Amazon receipt id, or Horizon entitlement payload to IAPKit and
          get a normalized verification response — so one-time in-app purchases
          are checked against the store's authoritative state. Amazon Fire OS
          and Vega OS both use the <code>iapkit.amazon</code> payload. Use the
          hosted version at{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            kit.openiap.dev
          </a>{' '}
          or self-host the source from{' '}
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
            shape for Apple, Google, Amazon, and Horizon. No per-platform JSON
            parsing.
          </li>
          <li>
            <strong>Fraud-resistant</strong> — verifies receipts and purchase
            state against the store's authoritative server API, blocking common
            forged receipt and replay flows.
          </li>
          <li>
            <strong>Entitlement state, not raw receipts</strong> — IAPKit
            collapses raw store data into a single <code>state</code> field (
            <code>entitled</code>, <code>pending</code>, <code>canceled</code>{' '}
            (including refunds and revocations), <code>expired</code>,{' '}
            <code>inauthentic</code>, etc.) so your client and server can act on
            a single value.
          </li>
          <li>
            <strong>No backend boilerplate</strong> — no service account JSON,
            no App Store private key rotation, no webhook plumbing required to
            get started.
          </li>
          <li>
            <strong>Public per-product rules</strong> — attach a small TOML,
            JSON, or text payload to each iOS or Android product and retrieve it
            during valid Apple or Google verification, or when the app opens.
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
          Get an IAPKit publishable key at{' '}
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
        <p>
          Fail closed when granting access: require IAPKit's store-verified{' '}
          <code>productId</code> and compare it with the product requested by
          the app. The local purchase ID is an expected value, not a fallback
          when verification omits the ID.
        </p>
        <p>
          For Amazon, send that expected value as{' '}
          <code>iapkit.amazon.expectedProductId</code>. Amazon App Tester
          receipts also require enabling{' '}
          <strong>Allow Amazon App Tester / RVS Cloud Sandbox</strong> in the
          IAPKit project before passing <code>sandbox: true</code>. Handled
          Amazon results report exactly <code>'Sandbox'</code> or{' '}
          <code>'Production'</code> in <code>environment</code>; require the
          value expected by the build.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'expo-iap';

const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'openiap-kit_pk_<your-publishable-key>',
    includeClientPayload: true,
    google: { purchaseToken: purchase.purchaseToken ?? '' },
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
  const publicRules = verified.clientPayload?.body;
  if (publicRules) applyPublicRules(publicRules);
  await finishTransaction({ purchase, isConsumable: false });
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

let result = try await OpenIapModule.shared.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit: RequestVerifyPurchaseWithIapkitProps(
            apiKey: "openiap-kit_pk_<your-publishable-key>",
            apple: RequestVerifyPurchaseWithIapkitAppleProps(
                jws: purchase.purchaseToken ?? ""
            ),
            includeClientPayload: true
        ),
        provider: .iapkit
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val result = module.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_pk_<your-publishable-key>",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken.orEmpty()
            ),
            includeClientPayload = true
        ),
        provider = PurchaseVerificationProvider.Iapkit
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`val result = kmpIapInstance.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_pk_<your-publishable-key>",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken.orEmpty()
            ),
            includeClientPayload = true
        ),
        provider = PurchaseVerificationProvider.Iapkit
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final result = await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
  provider: PurchaseVerificationProvider.Iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: 'openiap-kit_pk_<your-publishable-key>',
    apple: RequestVerifyPurchaseWithIapkitAppleProps(jws: purchase.purchaseToken ?? ''),
    includeClientPayload: true,
  ),
);`}</CodeBlock>
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
            ApiKey = "openiap-kit_pk_<your-publishable-key>",
            IncludeClientPayload = true,
            Google = new RequestVerifyPurchaseWithIapkitGoogleProps
            {
                PurchaseToken = purchase.PurchaseToken ?? string.Empty,
            },
        },
    });

var verified = result.Iapkit;
var verifiedProductId = verified?.ProductId;
if (verified is { IsValid: true } &&
    (verified.State == IapkitPurchaseState.Entitled ||
     verified.State == IapkitPurchaseState.PendingAcknowledgment) &&
    verifiedProductId is not null &&
    verifiedProductId == purchase.ProductId)
{
    await GrantEntitlementAsync(verifiedProductId);
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`const Types = preload("res://addons/godot-iap/types.gd")

var iapkit_props = Types.RequestVerifyPurchaseWithIapkitProps.new()
iapkit_props.api_key = "openiap-kit_pk_<your-publishable-key>"
iapkit_props.include_client_payload = true
iapkit_props.google = Types.RequestVerifyPurchaseWithIapkitGoogleProps.new()
iapkit_props.google.purchase_token = purchase.purchase_token

var props = Types.VerifyPurchaseWithProviderProps.new()
props.provider = Types.PurchaseVerificationProvider.IAPKIT
props.iapkit = iapkit_props

var result = await GodotIapPlugin.verify_purchase_with_provider(props)

var verified_product_id = result.iapkit.product_id if result.iapkit != null else null
if (
    result.iapkit != null
    and result.iapkit.is_valid
    and result.iapkit.state in [
        Types.IapkitPurchaseState.ENTITLED,
        Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT,
    ]
    and verified_product_id != null
    and verified_product_id == purchase.product_id
):
    await grant_entitlement(verified_product_id)
    await GodotIapPlugin.finish_transaction(purchase, false)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Optional product client payload</h4>
        <p>
          Set <code>iapkit.includeClientPayload</code> to <code>true</code> to
          request the product's public IAPKit payload. The default is{' '}
          <code>false</code>. IAPKit returns <code>clientPayload</code> only
          when Apple or Google verifies the receipt as valid, the store supplies
          the product ID, and the matching IAPKit product is currently present,
          not removed, and has a payload. Invalid receipts, absent or removed
          products, missing payloads, Horizon, and Amazon responses omit the
          field. A retained payload becomes eligible again after store sync
          re-pulls its matching product.
        </p>
        <CodeBlock language="json">{`{
  "store": "google",
  "isValid": true,
  "state": "entitled",
  "productId": "premium_monthly",
  "clientPayload": {
    "format": "toml",
    "body": "[access]\\nmax_items = 10",
    "version": 3,
    "updatedAt": 1784160000000
  }
}`}</CodeBlock>
        <Callout kind="warning" title="Public, non-authoritative data">
          <p>
            The payload is client-visible and limited to 16 KiB of UTF-8. Never
            store secrets or server-only authorization rules in it, and never
            use its content instead of <code>isValid</code>, <code>state</code>,
            or the store-verified <code>productId</code> for entitlement
            decisions.
          </p>
          <p>
            A project key compiled into an app can be extracted. It keeps its
            existing project-scoped endpoint permissions and consumes that
            project's quota; create separate keys for each build or environment
            and rotate or revoke a key when a build is retired or compromised.
          </p>
        </Callout>
        <p>
          This is request/response retrieval, not an APNs or FCM push. To fetch
          rules when the app opens without verifying a new purchase, use the
          React Native or Expo <code>kitApi</code> product methods, or MAUI's{' '}
          <code>KitApiClient</code>, as described in{' '}
          <Link to="/docs/kit-backend#product-client-payloads">
            Product client payloads
          </Link>
          .
        </p>

        <h4>State contract</h4>
        <p>
          Only <code>entitled</code>, <code>pending-acknowledgment</code>, and{' '}
          <code>ready-to-consume</code> make <code>isValid</code> true, but they
          are not interchangeable across stores or product types. Use the
          platform-aware flow below, and see the canonical{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result#iapkit-purchase-state">
            IapkitPurchaseState reference
          </Link>{' '}
          for every state.
        </p>
      </section>

      <section>
        <AnchorLink id="error-handling" level="h2">
          Error Handling Best Practice
        </AnchorLink>

        <Callout kind="important" title="Verification error ≠ Invalid purchase">
          <p>
            When verification throws an error, it does NOT mean the purchase is
            invalid. Errors can occur due to network issues, server downtime, or
            misconfigured API keys.
          </p>
          <p>
            <strong>
              Don't revoke previously verified access because of a transient
              failure.
            </strong>{' '}
            At the same time, never grant or finish a new purchase that has not
            been verified.
          </p>
        </Callout>

        <h4>Recommended Pattern</h4>
        <p>
          This example targets App Store and Google Play builds. Fire OS and
          Vega OS builds must select the <code>amazon</code> verification
          branch; their consumables use <code>ready-to-consume</code> like
          Apple.
        </p>
        <CodeBlock language="typescript">{`import { Platform } from 'react-native';

try {
  // App Store / Google Play only; route Fire OS and Vega OS through Amazon.
  const isApple = Platform.OS === 'ios';
  // Resolve this from your app-owned catalog, never from the harmonized state.
  const isConsumable = isConsumableProduct(purchase.productId);
  const token = purchase.purchaseToken ?? '';
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      apiKey: 'your-key',
      ...(isApple
        ? { apple: { jws: token } }
        : { google: { purchaseToken: token } }),
    },
  });

  const verified = result.iapkit;
  const verifiedProductId = verified?.productId;
  const productMatches =
    verifiedProductId != null && verifiedProductId === purchase.productId;
  const stateAllowsFulfillment = isConsumable
    ? isApple
      ? verified?.state === 'ready-to-consume'
      : verified?.state === 'ready-to-consume' ||
        verified?.state === 'entitled' ||
        verified?.state === 'pending-acknowledgment'
    : verified?.state === 'entitled' ||
      (!isApple && verified?.state === 'pending-acknowledgment');

  if (
    verified?.isValid === true &&
    productMatches &&
    stateAllowsFulfillment
  ) {
    if (isConsumable) {
      // Persist idempotent delivery before consuming so it cannot be lost.
      await deliverConsumable(verifiedProductId);
      await finishTransaction({ purchase, isConsumable: true });
    } else {
      await grantEntitlement(verifiedProductId);
      await finishTransaction({ purchase, isConsumable: false });
    }
  } else {
    // IAPKit completed the check but did not verify this entitlement.
    // Do not grant or finish this purchase.
    recordRejectedVerification(purchase, verified);
  }
} catch (error) {
  // A network/server error is not proof that the purchase is invalid.
  console.error('Verification failed:', error);

  // Keep only access established by an earlier successful verification.
  // Do not grant this purchase or finish it; retry verification later.
  preservePreviouslyVerifiedEntitlements();
  scheduleVerificationRetry(purchase);
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
