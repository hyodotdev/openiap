import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import DataTable from '../../../components/DataTable';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

interface VerifierChoice {
  app: string;
  verifier: ReactNode;
  call: ReactNode;
}

const VERIFIER_CHOICES: VerifierChoice[] = [
  {
    app: 'Has its own backend that owns user accounts',
    verifier: (
      <>
        Your backend. It checks with the store itself or calls any{' '}
        <Link to="/commerce-protocol">Commerce Protocol</Link> provider.
      </>
    ),
    call: (
      <>
        <code>createPurchaseFlow</code> with a{' '}
        <a href="#confirm-with-backend">
          <code>confirmWithBackend</code>
        </a>{' '}
        function that calls your server
      </>
    ),
  },
  {
    app: 'Has no backend',
    verifier: (
      <>
        A verification service called from the app: IAPKit through the SDK, or
        any <Link to="/commerce-protocol">Commerce Protocol</Link> provider with
        its verification credential.
      </>
    ),
    call: (
      <>
        For IAPKit, <code>createPurchaseFlow</code> with{' '}
        <code>confirmWithIapkit</code>, or{' '}
        <a href="#verify-purchase-with-provider">
          <code>verifyPurchaseWithProvider</code>
        </a>{' '}
        for one call. For another provider, a <code>confirmWithBackend</code>{' '}
        function that calls its{' '}
        <Link to="/commerce-protocol/client#without-a-backend">
          <code>verifyPurchase</code>
        </Link>
      </>
    ),
  },
  {
    app: 'Sells on the App Store only, with no backend or service',
    verifier: 'StoreKit on the device. Weaker: a patched app can skip it.',
    call: (
      <>
        <code>createPurchaseFlow</code> with <code>confirmOnDeviceIOS</code>
      </>
    ),
  },
  {
    app: 'Is a paid download',
    verifier:
      'StoreKit AppTransaction on iOS; on Android, your backend decodes the Play Integrity token',
    call: (
      <Link to="/docs/apis/verify-app-ownership">
        <code>verifyAppOwnership</code>
      </Link>
    ),
  },
];

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
        Check each purchase with a trusted verifier before you grant access;
        local StoreKit or Play Billing state alone can be faked. Pick the
        verifier that fits your app. In the framework SDKs, the purchase flow (
        <code>createPurchaseFlow</code>; <code>create_purchase_flow</code> in
        Godot, <code>CreatePurchaseFlow</code> in MAUI) then confirms, finishes,
        and recovers purchases for you. With the native Swift and Kotlin
        packages, call the verifier yourself and finish the purchase after you
        grant access.
      </p>
      <DataTable
        rows={VERIFIER_CHOICES}
        rowKey={(row) => row.app}
        columns={[
          { header: 'Your app', cell: (row) => row.app },
          { header: 'Verify with', cell: (row) => row.verifier },
          { header: 'Call', cell: (row) => row.call },
        ]}
      />
      <TLDRBox>
        <ul>
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
            : Verify through IAPKit&apos;s API from the app
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
        Never grant access from unverified local purchase state; pick a verifier
        from the table above. An automated attack cracked 60% of 85 popular apps
        that trusted client-side billing state (
        <a
          href="https://www.mulliner.org/collin/publications/virtualswindle_asiaccs2014_mulliner.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          AsiaCCS 2014
        </a>
        ), and a later study traced most payment flaws to SDK and documentation
        gaps rather than app code (
        <a
          href="https://www.ndss-symposium.org/wp-content/uploads/2017/09/ndss2017_05A-2_Yang_paper.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          NDSS 2017
        </a>
        ).
      </Callout>

      <section>
        <AnchorLink id="purchase-flow" level="h2">
          Confirm purchases with the purchase flow
        </AnchorLink>
        <p>
          The framework SDKs&apos; purchase flow listens for purchases, confirms
          each one, finishes it once access is granted, recovers unfinished
          purchases, and reports each outcome. Without a backend of your own,
          pass <code>confirmWithIapkit</code> with your publishable key, or{' '}
          <code>confirmOnDeviceIOS</code> for App Store purchases StoreKit
          verified on the device, and credit consumables in its{' '}
          <code>grant</code> callback, which runs before the purchase is
          consumed. See the{' '}
          <a
            href={`${IAPKIT_URL}/docs/purchase-flow`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            purchase flow guide
          </a>{' '}
          on the IAPKit site.
        </p>
        <Callout kind="warning" title="Device-only receipt cleanup">
          With <code>confirmOnDeviceIOS</code>, the purchase flow reports{' '}
          <code>failed</code> for expired, upgraded or revoked receipts and
          leaves them unfinished. This is not a final no-access verdict: a past
          expiration date can still fall within billing grace. Check the
          subscription group&apos;s current StoreKit status and verified renewal
          information as described in{' '}
          <Link to="/docs/apis/ios/get-pending-transactions-ios">
            pending receipt recovery
          </Link>
          , preserving access during <code>inGracePeriod</code>. Only after
          reconciling a verified matching receipt as inactive and recording that
          decision,{' '}
          <Link to="/docs/apis/finish-transaction">
            finish that receipt explicitly
          </Link>{' '}
          to stop replaying it. Do not finish a purchase merely because
          verification failed.
        </Callout>
        <AnchorLink id="confirm-with-backend" level="h3">
          Confirm through your backend
        </AnchorLink>
        <p>
          When your own backend owns user accounts, pass{' '}
          <code>confirmWithBackend</code>. It receives the purchase and whether
          it is consumable, then returns its confirmation. Answer{' '}
          <code>entitled</code> once access is granted, crediting a consumable
          first, <code>verification_delayed</code> for an answer that may still
          change, and <code>invalid</code> only for a settled rejection, which
          iOS then finishes. A confirmer that throws or times out leaves the
          purchase unfinished, and the next delivery or recovery confirms it
          again.
        </p>
        <p>
          Your backend may check with the store itself or call any verification
          service. Before reporting a valid verdict, it must bind the
          store-verified evidence to the intended store and provider, the
          expected product, and an allowed environment. Use the adapter&apos;s
          documented product mapping, such as a subscription term to its parent
          SKU. Choose allowed stores, providers, and environments from trusted
          backend configuration; client-supplied values are not proof. Missing
          or mismatched evidence must throw, leaving the purchase unfinished for
          investigation and retry. In the example below,{' '}
          <code>myVerifier.verify</code> performs these checks before returning{' '}
          <code>valid</code> and maps store SKUs back to the app&apos;s product
          IDs. The callback also checks that the returned evidence belongs to
          this purchase. This production example accepts only{' '}
          <code>Production</code> receipts; the backend must enforce the same
          policy. The other tabs show the server call itself, for a purchase
          flow&apos;s confirm function or for the native packages, which finish
          the purchase after you grant access.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`const allowedEnvironments = new Set(['Production']);
const flow = createPurchaseFlow({
  confirmWithBackend: async (purchase, {isConsumable}) => {
    const verdict = await myVerifier.verify(purchase);
    if (verdict.pending) return {status: 'verification_delayed', retryAfterMs: 30_000};
    if (
      verdict.productId !== purchase.productId ||
      verdict.store !== purchase.store ||
      (purchase.storeId != null && verdict.storeId !== purchase.storeId) ||
      !allowedEnvironments.has(verdict.environment)
    ) {
      throw new Error('Verification evidence does not match this purchase');
    }
    if (!verdict.valid) return {status: 'invalid', reason: verdict.reason};
    if (isConsumable) await wallet.creditOnce(purchase.id, purchase.productId);
    return {status: 'entitled', alreadyGranted: false};
  },
  isConsumable: (productId) => CONSUMABLE_IDS.includes(productId),
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

// yourBackend is your authenticated client; your server checks the JWS.
// Throws on network errors: an error is not an invalid purchase.
func verifyOnServer(_ purchase: PurchaseIOS) async throws -> Bool {
    let verdict = try await yourBackend.verifyApplePurchase(
        productId: purchase.productId,
        jws: purchase.purchaseToken ?? ""
    )
    // Fail closed: require the store-verified product id.
    return verdict.isValid && verdict.productId == purchase.productId
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

// yourBackend is your authenticated client; your server checks the token.
// Throws on network errors: an error is not an invalid purchase.
suspend fun verifyOnServer(purchase: PurchaseAndroid): Boolean {
    val verdict = yourBackend.verifyGooglePurchase(
        productId = purchase.productId,
        purchaseToken = requireNotNull(purchase.purchaseToken)
    )
    // Fail closed: require the store-verified product id.
    return verdict.isValid && verdict.productId == purchase.productId
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.openiap.*

// yourBackend is your authenticated shared client; your server checks the
// purchase with its store. Throws on network errors.
suspend fun verifyOnServer(purchase: Purchase): Boolean {
    val verdict = yourBackend.verifyPurchase(
        store = purchase.store,
        productId = purchase.productId,
        purchaseToken = requireNotNull(purchase.purchaseToken)
    )
    // Fail closed: require the store-verified product id.
    return verdict.isValid && verdict.productId == purchase.productId
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// yourBackend is your authenticated client; your server checks the
// purchase with its store. Throws on network errors.
Future<bool> verifyOnServer(Purchase purchase) async {
  final verdict = await yourBackend.verifyPurchase(
    store: purchase.store.value,
    productId: purchase.productId,
    purchaseToken: purchase.purchaseToken,
  );
  // Fail closed: require the store-verified product id.
  return verdict.isValid && verdict.productId == purchase.productId;
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using System.Net.Http.Json;
using OpenIap;

async Task<bool> VerifyOnServerAsync(HttpClient http, Purchase purchase)
{
    var response = await http.PostAsJsonAsync(
        "https://your-server.example/api/verify",
        new { purchase.ProductId, purchase.PurchaseToken });
    // A failed call is not an invalid purchase: leave it unfinished and retry.
    response.EnsureSuccessStatusCode();
    var verdict = await response.Content.ReadFromJsonAsync<VerificationResponse>();
    // Fail closed: require the store-verified product id.
    return verdict is { IsValid: true } && verdict.ProductId == purchase.ProductId;
}

record VerificationResponse(bool IsValid, string? ProductId);`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# your_backend is your authenticated HTTP client autoload; your server
# checks the purchase with its store.
func verify_on_server(purchase) -> bool:
    var verdict = await your_backend.verify_purchase({
        "productId": purchase.product_id,
        "purchaseToken": purchase.purchase_token,
    })
    # Fail closed: require the store-verified product id.
    return verdict.get("isValid", false) and verdict.get("productId") == purchase.product_id`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="verify-purchase-with-provider" level="h2">
          verifyPurchaseWithProvider
        </AnchorLink>
        <p>
          Verify a purchase through{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>
          &apos;s own verification API, the only provider this call supports. To
          use another provider, call its{' '}
          <Link to="/commerce-protocol/client#backend-call">
            Commerce Protocol <code>verifyPurchase</code>
          </Link>
          . Pass the evidence for the store that sold the purchase, and require
          the returned store-verified <code>productId</code> to match the
          product you expected; <code>isValid</code> alone is not enough.
        </p>
        <Callout kind="warning" title="Backend resources need your backend">
          A direct app-to-IAPKit call can unlock features inside the app, but it
          cannot authorize resources your backend serves. For those, have your
          backend authenticate the user and check the purchase before serving
          them.
        </Callout>
        <h4>Configure the key</h4>
        <p>
          Use an <code>openiap-kit_pk_</code> publishable key, never an{' '}
          <code>openiap-kit_sk_</code> secret key. Pass it as{' '}
          <code>apiKey</code>, or let Expo and React Native read it from config:
          Expo from the config plugin option <code>iapkitApiKey</code>, React
          Native from <code>IAPKitAPIKey</code> in Info.plist and{' '}
          <code>
            &lt;meta-data android:name="dev.iapkit.API_KEY"
            android:value="openiap-kit_pk_…" /&gt;
          </code>{' '}
          in AndroidManifest.xml.
        </p>

        <h4>Example</h4>
        <p>
          The local purchase ID is the expected value, never a fallback when
          verification omits the ID.
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
        <p>
          Amazon Live App Testing (LAT) uses real RVS with{' '}
          <code>sandbox: false</code>, but a valid test receipt reports{' '}
          <code>Sandbox</code>. With <code>confirmWithIapkit</code>, set{' '}
          <code>amazon.expectedEnvironment: &apos;Sandbox&apos;</code> in the
          LAT build. Leave it unset for production. This option checks the
          returned verdict; it never changes the RVS endpoint or travels in the
          verification request. Rebuild without the Sandbox setting before
          submitting to production; promoting the LAT binary unchanged would
          reject real purchases after payment. Missing or mismatched final
          environments do not grant access or finish the purchase.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { verifyPurchaseWithProvider, type Purchase, type VerifyPurchaseWithProviderResult } from 'expo-iap';
// Same API in react-native-iap:
// import { verifyPurchaseWithProvider, type Purchase, type VerifyPurchaseWithProviderResult } from 'react-native-iap';

const amazonSandbox =
  process.env.EXPO_PUBLIC_AMAZON_RVS_SANDBOX === 'true';
const amazonExpectedEnvironment =
  process.env.EXPO_PUBLIC_AMAZON_EXPECTED_ENVIRONMENT ??
  (amazonSandbox ? 'Sandbox' : 'Production');

// Amazon RVS reports a subscription term under its parent SKU; map each term
// your app sells to that parent. Other stores verify the purchased id.
const AMAZON_PARENT_SKUS: Record<string, string> = {
  premium_monthly_term: 'premium',
};
const verifiedProductIdFor = (purchase: Purchase) =>
  purchase.store === 'amazon'
    ? (AMAZON_PARENT_SKUS[purchase.productId] ?? purchase.productId)
    : purchase.productId;

// purchase.store names the store that sold it, so a build that follows the
// connected device needs no store flag here.
const iapkitPayloadFor = (purchase: Purchase) => {
  const token = purchase.purchaseToken ?? '';

  switch (purchase.store) {
    case 'apple':
      return { apple: { jws: token } };
    case 'amazon': // Fire OS and Vega OS
      if (
        !['Sandbox', 'Production'].includes(amazonExpectedEnvironment) ||
        (amazonSandbox && amazonExpectedEnvironment === 'Production')
      ) throw new Error('Invalid Amazon verification environment');
      return {
        amazon: {
          expectedProductId: verifiedProductIdFor(purchase),
          receiptId: token,
          sandbox: amazonSandbox,
        },
      };
    case 'horizon':
      return { horizon: { sku: purchase.productId } };
    default:
      return { google: { purchaseToken: token } };
  }
};

const hasExpectedEvidence = (
  verified: VerifyPurchaseWithProviderResult['iapkit'],
  purchase: Purchase,
) =>
  verified?.isValid === true &&
  verified.store === purchase.store &&
  (!purchase.storeId || verified.storeId === purchase.storeId) &&
  verified.productId != null &&
  verified.productId === verifiedProductIdFor(purchase) &&
  (purchase.store !== 'amazon' ||
    verified.environment === amazonExpectedEnvironment);

const verifyWithIapkit = async (purchase: Purchase) => {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      // Use an openiap-kit_pk_ key. Optional when Expo or React Native
      // reads it from config (see "Configure the key" above).
      apiKey: process.env.EXPO_PUBLIC_IAPKIT_PUBLISHABLE_KEY,
      ...iapkitPayloadFor(purchase),
    },
  });

  const verified = result.iapkit;
  if (hasExpectedEvidence(verified, purchase)) {
    console.log('IAPKit verified:', verified?.state);
    return true;
  }

  console.error('IAPKit verification failed');
  return false;
};

// isValid covers three states. Before granting or finishing, apply the
// per-store state rules in the error-handling pattern below, or use
// confirmWithIapkit, which applies them for you.`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

// Throws on network errors: an error is not an invalid purchase.
func verifyWithIapkit(_ purchase: PurchaseIOS) async throws -> Bool {
    let result = try await OpenIapModule.shared.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            iapkit: RequestVerifyPurchaseWithIapkitProps(
                apiKey: "openiap-kit_pk_<your-publishable-key>",
                apple: RequestVerifyPurchaseWithIapkitAppleProps(
                    jws: purchase.purchaseToken ?? ""
                )
            ),
            provider: .iapkit
        )
    )
    // Fail closed: require the store-verified product id.
    guard let verified = result.iapkit else { return false }
    return verified.isValid && verified.productId == purchase.productId
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Throws on network errors: an error is not an invalid purchase.
suspend fun verifyWithIapkit(purchase: PurchaseAndroid): Boolean {
    val result = module.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = "openiap-kit_pk_<your-publishable-key>",
                google = RequestVerifyPurchaseWithIapkitGoogleProps(
                    purchaseToken = purchase.purchaseToken.orEmpty()
                )
                // Amazon and Horizon pass amazon or horizon; Amazon verifies a
                // subscription term under its parent SKU (see the TypeScript tab).
            ),
            provider = PurchaseVerificationProvider.Iapkit
        )
    )
    // Fail closed: require the store-verified product id.
    val verified = result.iapkit
    return verified?.isValid == true && verified?.productId == purchase.productId
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`// Throws on network errors: an error is not an invalid purchase.
suspend fun verifyWithIapkit(purchase: Purchase): Boolean {
    val result = kmpIapInstance.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = "openiap-kit_pk_<your-publishable-key>",
                google = RequestVerifyPurchaseWithIapkitGoogleProps(
                    purchaseToken = purchase.purchaseToken.orEmpty()
                )
                // iOS passes apple; Amazon and Horizon pass amazon or horizon. Amazon
                // verifies a subscription term under its parent SKU (see TypeScript).
            ),
            provider = PurchaseVerificationProvider.Iapkit
        )
    )
    // Fail closed: require the store-verified product id.
    val verified = result.iapkit
    return verified?.isValid == true && verified?.productId == purchase.productId
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Throws on network errors: an error is not an invalid purchase.
Future<bool> verifyWithIapkit(Purchase purchase) async {
  final token = purchase.purchaseToken ?? '';
  final result = await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
    provider: PurchaseVerificationProvider.Iapkit,
    iapkit: RequestVerifyPurchaseWithIapkitProps(
      apiKey: 'openiap-kit_pk_<your-publishable-key>',
      apple: purchase.store == IapStore.Apple
          ? RequestVerifyPurchaseWithIapkitAppleProps(jws: token)
          : null,
      google: purchase.store == IapStore.Google
          ? RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken: token)
          : null,
      // Amazon and Horizon pass amazon or horizon; Amazon verifies a
      // subscription term under its parent SKU (see the TypeScript tab).
    ),
  );
  // Fail closed: require the store-verified product id.
  final verified = result.iapkit;
  return verified?.isValid == true && verified?.productId == purchase.productId;
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var result = await OpenIapClient.Mutation
    .VerifyPurchaseWithProviderAsync(new VerifyPurchaseWithProviderProps
    {
        Provider = PurchaseVerificationProvider.Iapkit,
        Iapkit = new RequestVerifyPurchaseWithIapkitProps
        {
            ApiKey = "openiap-kit_pk_<your-publishable-key>",
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
          <a
            href="https://kit.openiap.dev/docs/products"
            target="_blank"
            rel="noreferrer"
          >
            Product client payloads
          </a>
          .
        </p>

        <h4>State contract</h4>
        <p>
          Only <code>entitled</code>, <code>pending-acknowledgment</code>, and{' '}
          <code>ready-to-consume</code> make <code>isValid</code> true, but they
          are not interchangeable across stores or product types. Use the{' '}
          <a href="#error-handling">platform-aware flow</a> under Error
          handling, and see the canonical{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result#iapkit-purchase-state">
            IapkitPurchaseState reference
          </Link>{' '}
          for every state.
        </p>
      </section>

      <section>
        <AnchorLink id="iapkit" level="h2">
          Verification providers
        </AnchorLink>
        <p>
          The <Link to="/commerce-protocol">Commerce Protocol</Link> is an open
          server API built so verification providers, paywall and data services,
          and your own backend can work together through one contract. Any
          provider that implements it can verify purchases for your backend, and
          so can your own server. Choose by what a provider supports, not by
          name: compare{' '}
          <Link to="/commerce-protocol/operations#providerCapabilities">
            capability descriptors
          </Link>{' '}
          for the stores and profiles you need.
        </p>
        <p>
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>{' '}
          is one of these providers: open source (MIT), managed by OpenIAP, and
          hosted at kit.openiap.dev or self-hosted from{' '}
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/kit"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>packages/kit</code>
          </a>
          . It is also the service the SDKs&apos;{' '}
          <a href="#verify-purchase-with-provider">
            <code>verifyPurchaseWithProvider</code>
          </a>{' '}
          and <code>confirmWithIapkit</code> call directly. What that call
          needs:
        </p>
        <ul>
          <li>
            Store credentials (the App Store key, the Google service account)
            stay in the IAPKit project; the app ships only a publishable key.
          </li>
          <li>
            It covers the App Store, Google Play, Amazon Appstore (Fire OS and
            Vega OS, through the <code>iapkit.amazon</code> payload), and Meta
            Horizon.
          </li>
          <li>
            The result reports one <code>state</code> (<code>entitled</code>,{' '}
            <code>pending</code>, <code>canceled</code>, <code>expired</code>,{' '}
            <code>inauthentic</code>, and others). SDK string values are
            kebab-case (<code>pending-acknowledgment</code>); IAPKit&apos;s REST
            API spells the same states in upper snake case (
            <code>PENDING_ACKNOWLEDGMENT</code>).
          </li>
        </ul>
      </section>

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

var result = await OpenIapClient.Mutation.VerifyPurchaseAsync(
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
