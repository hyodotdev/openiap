import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

const IAPKIT_URL = 'https://kit.openiap.dev';

function KitBackend() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Purchase Verification with IAPKit"
        description="Purchase verification with IAPKit at kit.openiap.dev handles Apple StoreKit 2, Google Play, Amazon Appstore, and Meta Horizon verification, public per-product client payloads, lifecycle webhooks, subscription state, revenue metrics, and store product sync."
        path="/docs/kit-backend"
        keywords="IAPKit, kit.openiap.dev, OpenIAP kit, hosted backend, purchase verification, receipt validation, product client payload, TOML metadata, Amazon Fire OS, Vega OS, subscription state, App Store Connect, Play Console, MCP server"
      />
      <h1>Purchase Verification</h1>
      <p>
        Purchase verification is the step that proves a store transaction is
        real before your app grants paid access, and IAPKit (
        <a href={IAPKIT_URL} target="_blank" rel="noopener noreferrer">
          <code>kit.openiap.dev</code>
        </a>
        ) is OpenIAP's hosted backend for that flow. Drop it in instead of
        running your own server for the steps that come after a user taps "buy":
        store verification, lifecycle webhooks, subscription state, revenue
        metrics, and App Store Connect / Play Console product sync. Everything
        is exposed through one URL surface that the framework SDKs and MCP
        server speak.
      </p>
      <p>
        Amazon targets use the same IAPKit Amazon verification shape. Fire OS
        purchases from the Android <code>amazon</code> flavor and Vega OS
        purchases from the Kepler runtime both resolve an Amazon user id and
        receipt id through <code>iapkit.amazon</code>, then IAPKit verifies them
        through Amazon RVS and stores the result under <code>amazon</code>.
      </p>

      <section>
        <AnchorLink id="surface" level="h2">
          Surface map
        </AnchorLink>
        <p>
          Purchase verification uses an <code>Authorization: Bearer</code> API
          key header. Webhook, subscription, product, and MCP-friendly endpoints
          carry the project API key as a path segment so store consoles, SDK
          helpers, and stdio MCP tools can call them without custom bearer
          header plumbing.
        </p>
        <ul>
          <li>
            <code>POST /v1/purchase/verify</code> — purchase verification (Apple
            JWS, Google purchaseToken, Amazon RVS receiptId for Fire OS and Vega
            OS, Meta Horizon) with a Bearer API key.
          </li>
          <li>
            <code>POST /v1/webhooks/&#123;apiKey&#125;</code> — unified App
            Store Server Notifications v2 / Google Pub/Sub RTDN receiver (Google
            OIDC verified). Platform-specific <code>/apple</code> /{' '}
            <code>/google</code> aliases remain supported for existing setups.
          </li>
          <li>
            <code>GET /v1/webhooks/stream/&#123;apiKey&#125;</code> — SSE stream
            of normalized <code>WebhookEvent</code>s, driven by Convex's
            reactive subscribe.
          </li>
          <li>
            <code>GET /v1/subscriptions/status/&#123;apiKey&#125;?userId=</code>{' '}
            — fast entitlement gate.
          </li>
          <li>
            <code>
              GET /v1/subscriptions/entitlements/&#123;apiKey&#125;?userId=
            </code>{' '}
            — every active productId for a user.
          </li>
          <li>
            <code>GET /v1/subscriptions/list/&#123;apiKey&#125;</code> —
            filtered subscription list (for the dashboard).
          </li>
          <li>
            <code>GET /v1/subscriptions/metrics/&#123;apiKey&#125;</code> — MRR,
            churn, refund counts.
          </li>
          <li>
            <code>POST /v1/subscriptions/bind-user/&#123;apiKey&#125;</code> —
            attach a userId to a tracked subscription by purchase token.
          </li>
          <li>
            <code>GET/POST/DELETE /v1/products/&#123;apiKey&#125;</code> —
            kit-side product catalog.
          </li>
          <li>
            <code>
              GET
              /v1/products/&#123;apiKey&#125;/&#123;productId&#125;/client-payload?platform=
            </code>{' '}
            — read one public TOML, JSON, or text product payload.
          </li>
          <li>
            <code>
              POST /v1/products/&#123;apiKey&#125;/sync/&#123;ios|android&#125;
            </code>{' '}
            — push-sync with App Store Connect / Play Console.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="api-keys-environments" level="h2">
          API keys and environments
        </AnchorLink>
        <p>
          Kit API keys are project-scoped credentials. Creating more than one
          key lets you rotate credentials, split app builds, and revoke an
          abused app, CI, or staging key without replacing every caller.
        </p>
        <p>
          Additional keys do not create separate sandbox or production
          entitlement stores. <code>status</code>, <code>entitlements</code>,
          and <code>bind-user</code> all resolve the supplied key to its owning
          project and read or write that project's subscription state.
        </p>
        <p>
          If you need staging and production to have isolated purchase logs,
          webhook state, and user bindings, create separate Kit projects and use
          keys from the matching project consistently for verify, webhooks,
          bind-user, status, and entitlement calls.
        </p>
        <p>
          Purchase verification writes purchase rows under the key's project.
          Subscription endpoints read or write subscription rows under the key's
          project. Mixing keys between projects splits those records, so a later{' '}
          <code>bind-user</code>, <code>status</code>, or{' '}
          <code>entitlements</code> call made with a different project's key
          will not see the matching subscription state.
        </p>
      </section>

      <section>
        <AnchorLink id="dashboard" level="h2">
          Dashboard UX
        </AnchorLink>
        <p>
          The hosted dashboard at{' '}
          <a href={IAPKIT_URL} target="_blank" rel="noopener noreferrer">
            <code>kit.openiap.dev</code>
          </a>{' '}
          wires every project-scoped endpoint into a UI:
        </p>
        <ul>
          <li>
            <strong>Subscriptions</strong> — live state filtered by{' '}
            <code>Active</code> / <code>InGracePeriod</code> /{' '}
            <code>InBillingRetry</code> / <code>Expired</code> / etc., with the
            metrics summary at the top.
          </li>
          <li>
            <strong>Products</strong> — kit-side catalog with one-click sync to
            App Store Connect (via the project's uploaded <code>.p8</code> key)
            or Play Console (via the service-account JSON), plus a public client
            payload editor for app-readable TOML, JSON, or text rules.
          </li>
          <li>
            <strong>Webhooks</strong> — copyable lifecycle webhook URL, the SSE
            stream URL, and a curl recipe for emitting a synthetic test
            notification without opening a store console.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="purchase-verification" level="h2">
          Purchase verification from SDKs
        </AnchorLink>
        <p>
          Most app flows should use the framework SDK's{' '}
          <code>verifyPurchaseWithProvider</code> helper instead of constructing{' '}
          <code>POST /v1/purchase/verify</code> payloads by hand. The helper
          sends the store token to IAPKit and returns a typed{' '}
          <code>VerifyPurchaseWithProviderResult</code>. The API is named{' '}
          <code>verifyPurchaseWithProvider</code> in the SDKs; the snippets
          below call it directly.
        </p>
        <p>
          A verification result and the IAPKit Purchases row are snapshots of
          the store response at verification time. On Android, a valid new
          purchase may first return <code>pending-acknowledgment</code>. Call{' '}
          <code>finishTransaction</code>, then verify the same token again when
          the purchase log must reflect <code>entitled</code>. Use subscription
          status, entitlements, and store webhooks for current lifecycle state;
          purchase snapshots otherwise change only when they are verified again.
        </p>
        <p>
          For Fire OS and Vega OS, choose the Amazon branch and pass the Amazon
          receipt ID. The SDK resolves the Amazon user ID from the runtime when
          available. Set <code>sandbox: true</code> when validating Amazon App
          Tester sandbox receipts.
        </p>
        <p>
          Grant access only when IAPKit returns a store-verified{' '}
          <code>productId</code> and it matches the product requested by the
          app. Treat the local purchase ID only as the expected value for this
          comparison; never substitute it when the verified ID is missing.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { Platform } from 'react-native';
import { verifyPurchaseWithProvider } from 'expo-iap';
// Same API in react-native-iap.

const token = purchase.purchaseToken ?? '';
const runtimeOS = Platform.OS as string;
const isFireOSBuild = process.env.EXPO_PUBLIC_STORE === 'amazon';
const isAmazonRuntime = runtimeOS === 'kepler' || isFireOSBuild;
const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    // Optional when configured via Expo config / Info.plist / AndroidManifest.
    apiKey: process.env.EXPO_PUBLIC_IAPKIT_API_KEY,
    // Product payload enrichment applies only to Apple and Google.
    ...(!isAmazonRuntime && { includeClientPayload: true }),
    ...(Platform.OS === 'ios'
      ? { apple: { jws: token } }
      : isAmazonRuntime
        ? {
            amazon: {
              receiptId: token,
              sandbox: __DEV__,
            },
          }
      : { google: { purchaseToken: token } }),
  },
});

const verified = result.iapkit;
const verifiedProductId = verified?.productId;
const hasAllowedState =
  verified?.state === 'entitled' ||
  (Platform.OS === 'android' &&
    !isAmazonRuntime &&
    verified?.state === 'pending-acknowledgment');
if (
  verified?.isValid === true &&
  hasAllowedState &&
  verifiedProductId != null &&
  verifiedProductId === purchase.productId
) {
  await grantEntitlement(verifiedProductId);
  if (verified.clientPayload) {
    applyPublicRules(verified.clientPayload);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIAP

let result = try await OpenIapModule.shared.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        iapkit: RequestVerifyPurchaseWithIapkitProps(
            apiKey: iapkitApiKey,
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
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

val result = module.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        provider = PurchaseVerificationProvider.Iapkit,
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = iapkitApiKey,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = purchase.purchaseToken.orEmpty(),
            ),
            includeClientPayload = true,
            // Fire OS: use amazon = RequestVerifyPurchaseWithIapkitAmazonProps(...)
            // with userId, receiptId, and sandbox for Amazon App Tester.
        ),
    ),
)

val verified = result.iapkit
val verifiedProductId = verified?.productId
val hasAllowedState =
    verified?.state == IapkitPurchaseState.Entitled ||
        verified?.state == IapkitPurchaseState.PendingAcknowledgment
if (verified != null &&
    verified.isValid &&
    hasAllowedState &&
    verifiedProductId != null &&
    verifiedProductId == purchase.productId) {
    unlockEntitlement(verifiedProductId)
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final result = await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
  provider: PurchaseVerificationProvider.Iapkit,
  iapkit: RequestVerifyPurchaseWithIapkitProps(
    apiKey: IapConstants.iapkitApiKey,
    apple: Platform.isIOS
        ? RequestVerifyPurchaseWithIapkitAppleProps(
            jws: purchase.purchaseToken ?? '',
          )
        : null,
    google: Platform.isAndroid
        ? RequestVerifyPurchaseWithIapkitGoogleProps(
            purchaseToken: purchase.purchaseToken ?? '',
          )
        : null,
    includeClientPayload: true,
    // Fire OS builds can pass amazon with userId, receiptId, and sandbox.
  ),
);

final verified = result.iapkit;
final verifiedProductId = verified?.productId;
final hasAllowedState =
    verified?.state == IapkitPurchaseState.Entitled ||
    (Platform.isAndroid &&
        verified?.state == IapkitPurchaseState.PendingAcknowledgment);
if (verified != null &&
    verified.isValid &&
    hasAllowedState &&
    verifiedProductId != null &&
    verifiedProductId == purchase.productId) {
  unlockEntitlement(verifiedProductId);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using Microsoft.Maui.Devices;

var token = purchase.PurchaseToken ?? string.Empty;
var isIos = DeviceInfo.Platform == DevicePlatform.iOS;
var mutate = (MutationResolver)OpenIapClient.Instance;
var result = await mutate.VerifyPurchaseWithProviderAsync(
    new VerifyPurchaseWithProviderProps
    {
        Provider = PurchaseVerificationProvider.Iapkit,
        Iapkit = new RequestVerifyPurchaseWithIapkitProps
        {
            ApiKey = iapkitApiKey,
            IncludeClientPayload = true,
            Apple = isIos
                ? new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token }
                : null,
            Google = isIos
                ? null
                : new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
            // Amazon Fire OS uses Amazon = new RequestVerifyPurchaseWithIapkitAmazonProps { ... }.
        },
    });

var verified = result.Iapkit;
var verifiedProductId = verified?.ProductId;
var hasAllowedState =
    verified?.State == IapkitPurchaseState.Entitled ||
    (!isIos && verified?.State == IapkitPurchaseState.PendingAcknowledgment);
if (verified is { IsValid: true } &&
    hasAllowedState &&
    verifiedProductId is not null &&
    verifiedProductId == purchase.ProductId)
{
    UnlockEntitlement(verifiedProductId);
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.*

val token = purchase.purchaseToken.orEmpty()
val result = kmpIAP.verifyPurchaseWithProvider(
    VerifyPurchaseWithProviderProps(
        provider = PurchaseVerificationProvider.Iapkit,
        iapkit = RequestVerifyPurchaseWithIapkitProps(
            apiKey = iapkitApiKey,
            apple = if (isIos) RequestVerifyPurchaseWithIapkitAppleProps(jws = token) else null,
            google = if (!isIos) RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = token) else null,
            includeClientPayload = true,
            // Amazon Fire OS builds use amazon with userId, receiptId, and sandbox.
        ),
    ),
)

val verified = result.iapkit
val verifiedProductId = verified?.productId
val hasAllowedState =
    verified?.state == IapkitPurchaseState.Entitled ||
        (!isIos && verified?.state == IapkitPurchaseState.PendingAcknowledgment)
if (verified != null &&
    verified.isValid &&
    hasAllowedState &&
    verifiedProductId != null &&
    verifiedProductId == purchase.productId) {
    unlockEntitlement(verifiedProductId)
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`const Types = preload("res://addons/godot-iap/types.gd")

var result = await iap.verify_purchase_with_provider({
	"provider": "iapkit",
	"iapkit": {
		"apiKey": iapkit_api_key,
		"includeClientPayload": true,
		"google": {
			"purchaseToken": purchase.get("purchaseToken", ""),
		},
		# iOS: use "apple": { "jws": token }
		# Fire OS: use "amazon": { "userId": user_id, "receiptId": receipt_id }
	},
})

var verified_product_id = result.iapkit.product_id if result.iapkit != null else null
if (
	result.iapkit != null
	and result.iapkit.is_valid
	and result.iapkit.state in [
		Types.IapkitPurchaseState.ENTITLED,
		Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT,
	]
	and verified_product_id != null
	and verified_product_id == purchase.get("productId", "")
):
	unlock_entitlement(verified_product_id)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          These checks cover non-consumables and subscriptions. Choose the
          finish path from the app-owned product type and platform, not the
          state alone: Apple and Amazon consumables use{' '}
          <code>ready-to-consume</code>, while an unconsumed Google product may
          be <code>entitled</code> or <code>pending-acknowledgment</code>.
          Persist consumable delivery before finishing it; see the{' '}
          <Link to="/docs/features/validation#verify-purchase-with-provider">
            state-aware verification flow
          </Link>
          .
        </p>
        <p>
          <code>includeClientPayload</code> is optional and defaults to{' '}
          <code>false</code>. When requested, IAPKit adds{' '}
          <code>clientPayload</code> only to a valid Apple or Google response
          whose store-verified <code>productId</code> has a matching payload.
          Invalid receipts, absent or removed products, missing payloads,
          Horizon, and Amazon responses omit it. Verification success never
          depends on optional payload retrieval.
        </p>
      </section>

      <section>
        <AnchorLink id="entitlements" level="h2">
          Entitlement checks by userId
        </AnchorLink>
        <p>
          The fastest gate ("is this user paying?") is one HTTP request by
          userId. Your app can call Kit directly when IAPKit is acting as your
          managed validation backend. If the protected resource lives on your
          own backend, authenticate the user there and have that backend call
          Kit by userId instead of trusting a client-supplied premium flag. For
          direct client calls, prefer opaque app-scoped user IDs instead of
          public identifiers like email addresses.
        </p>
        <p>
          Status and entitlement helpers are available in the TypeScript and
          MAUI SDKs so those clients do not have to construct URLs by hand:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { kitApi } from 'react-native-iap';
// Expo apps can import from 'expo-iap'.
// Node/server helpers can import from '@hyodotdev/openiap-gql/kit-api'.

const openiapProjectKey = '<project-api-key-from-sdk-config-or-env>';
const api = kitApi({ apiKey: openiapProjectKey });
const { active, subscription } = await api.status('user-1');
if (active) {
  unlockPremium(subscription?.productId);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var openiapProjectKey = "<project-api-key-from-sdk-config-or-env>";
var api = OpenIapClient.KitApi(new KitApiOptions { ApiKey = openiapProjectKey });
var status = await api.StatusAsync("user-1");
if (status.Active)
{
    UnlockPremium(status.Subscription?.ProductId);
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="product-client-payloads" level="h2">
          Product client payloads
        </AnchorLink>
        <p>
          The same <code>includeClientPayload</code> opt-in name appears on two
          independent request surfaces:
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Surface</th>
              <th>Scope</th>
              <th>Payload location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>verifyPurchaseWithProvider</code>
              </td>
              <td>One valid Apple or Google purchase</td>
              <td>
                <code>result.iapkit.clientPayload</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>kitApi.products</code> / <code>GET /v1/products</code>
              </td>
              <td>One paginated platform catalog page</td>
              <td>
                <code>clientPayload</code> on each matching product
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Both default to <code>false</code>; enabling one does not enable the
          other. The direct single-product payload endpoint takes a platform
          instead of this flag.
        </p>
        <p>
          Each IAPKit catalog product may carry one optional public{' '}
          <code>clientPayload</code> keyed by project, platform, and product ID.
          The shape is the same whether it comes from an opted-in verification,
          a catalog read, or the direct payload endpoint:
        </p>
        <CodeBlock language="json">{`{
  "format": "toml",
  "body": "[access]\\nmax_items = 10",
  "version": 3,
  "updatedAt": 1784160000000
}`}</CodeBlock>
        <div className="alert-card alert-card--warning">
          <p>
            <strong>Client payloads are public app data.</strong> Anyone able to
            call the project's client endpoints may receive them. Never store
            API secrets, credentials, signing keys, or server-authoritative
            entitlement rules in a client payload.
          </p>
          <p>
            A project key embedded in an app is extractable. It retains that
            key's existing project-scoped endpoint permissions and consumes the
            project's quota. Use separate keys for each build or environment,
            then rotate or revoke them when a build is retired or compromised.
          </p>
        </div>

        <AnchorLink id="fetch-client-payload-on-app-open" level="h3">
          Fetch on app open
        </AnchorLink>
        <p>
          React Native IAP and Expo IAP export the canonical <code>kitApi</code>{' '}
          helper, and MAUI exposes the equivalent <code>KitApiClient</code>. Use
          the product-list method to refresh a platform catalog, or the direct
          payload method when the product ID is already known. Both surfaces
          return a response envelope.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { Platform } from 'react-native';
import { kitApi } from 'expo-iap';
// React Native IAP apps can import kitApi from 'react-native-iap'.

const platform = Platform.OS === 'ios' ? 'IOS' : 'Android';
const api = kitApi({ apiKey: '<project-api-key>' });

let page = await api.products({
  platform,
  includeClientPayload: true,
  limit: 50,
});
const products = [...page.products];
while (page.hasMore && page.nextCursor) {
  page = await api.products({
    platform,
    includeClientPayload: true,
    limit: 50,
    cursor: page.nextCursor,
  });
  products.push(...page.products);
}

const catalogPayload = products.find(
  (product) => product.productId === 'premium_monthly',
)?.clientPayload;

// Or fetch one known product without downloading the catalog.
const { clientPayload } = await api.clientPayload(
  'premium_monthly',
  platform,
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using System.Linq;
using OpenIap.Maui;

var api = OpenIapClient.KitApi(new KitApiOptions
{
    ApiKey = "<project-api-key>",
});

var page = await api.ProductsAsync(new KitProductsOptions
{
    Platform = KitProductPlatform.IOS,
    IncludeClientPayload = true,
    Limit = 50,
});
var products = page.Products.ToList();
while (page.HasMore == true && page.NextCursor is { Length: > 0 } cursor)
{
    page = await api.ProductsAsync(new KitProductsOptions
    {
        Platform = KitProductPlatform.IOS,
        IncludeClientPayload = true,
        Limit = 50,
        Cursor = cursor,
    });
    products.AddRange(page.Products);
}

var catalogPayload = products
    .FirstOrDefault(product => product.ProductId == "premium_monthly")
    ?.ClientPayload;

var payloadResponse = await api.ClientPayloadAsync(
    "premium_monthly",
    KitProductPlatform.IOS);
var clientPayload = payloadResponse.ClientPayload;`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
        <p>
          These product helper methods are currently exposed by React Native,
          Expo, and MAUI. Use the HTTP endpoints from other environments rather
          than assuming a framework helper exists.
        </p>
        <ul>
          <li>
            <code>
              GET
              /v1/products/&#123;apiKey&#125;?platform=IOS&amp;includeClientPayload=true
            </code>{' '}
            requires <code>platform</code>, accepts <code>limit</code> (default{' '}
            <code>25</code>, maximum <code>50</code>) and an opaque{' '}
            <code>cursor</code>, and returns{' '}
            <code>&#123; products, hasMore, nextCursor? &#125;</code>. Continue
            until <code>hasMore</code> is <code>false</code>. Without the
            explicit payload flag, the response remains exactly{' '}
            <code>&#123; products &#125;</code>; payload bodies are omitted and{' '}
            <code>limit</code> / <code>cursor</code> are ignored for backwards
            compatibility. Their strict validation applies only when{' '}
            <code>includeClientPayload=true</code>. Catalog changes can
            invalidate an opaque cursor; if the server returns{' '}
            <code>400 INVALID_CURSOR</code>, discard that cursor and restart
            from the first page.
          </li>
          <li>
            <code>
              GET
              /v1/products/&#123;apiKey&#125;/&#123;productId&#125;/client-payload?platform=IOS
            </code>{' '}
            returns <code>&#123; clientPayload &#125;</code>, or HTTP 404 when
            no payload exists, the matching product is absent, or its state is{' '}
            <code>Removed</code>.
          </li>
        </ul>

        <AnchorLink id="client-payload-behavior" level="h3">
          Storage, limits, and delivery
        </AnchorLink>
        <ul>
          <li>
            Bodies may use <code>'toml'</code>, <code>'json'</code>, or{' '}
            <code>'text'</code> and are limited to 16 KiB measured as UTF-8
            bytes. JSON must be an object, and TOML syntax is validated.
          </li>
          <li>
            The 64 KiB product-management request limit covers the whole HTTP
            request before parsing. It is separate from the 16 KiB payload body
            limit and was never a per-product metadata field.
          </li>
          <li>
            Store sync never sends a client payload to Apple or Google and never
            overwrites it. Resetting, purging, or hard-deleting the local
            catalog product retains the separate payload row, but direct reads
            return 404 and verification omits it while the matching product is
            absent or <code>Removed</code>. It becomes visible again after sync
            re-pulls the same platform and product ID.
          </li>
          <li>
            IAPKit does not send payloads through APNs or FCM. Apps retrieve
            them with an explicit verification or product request.
          </li>
        </ul>
        <p>
          See the{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result#iapkit-product-client-payload">
            <code>IapkitProductClientPayload</code> type reference
          </Link>{' '}
          and the hosted{' '}
          <a
            href={`${IAPKIT_URL}/docs/products`}
            target="_blank"
            rel="noopener noreferrer"
          >
            IAPKit product guide
          </a>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="product-sync" level="h2">
          Product sync
        </AnchorLink>
        <p>
          kit's <code>products</code> table is a cache of every productId your
          app uses. The sync action runs against App Store Connect (using a
          freshly-minted ES256 JWT signed with the project's <code>.p8</code>)
          and Play Developer API (using the project's service account JSON) and
          supports three directions:
        </p>
        <ul>
          <li>
            <strong>pull</strong> — pull every IAP / subscription from the
            upstream store into kit.
          </li>
          <li>
            <strong>push</strong> — push every <code>state: "Draft"</code> kit
            row to the upstream store.
          </li>
          <li>
            <strong>both</strong> — default; pull then push so the catalog
            converges.
          </li>
        </ul>
        <p>
          Sync is asynchronous —{' '}
          <code>
            POST /v1/products/&#123;apiKey&#125;/sync/&#123;ios|android&#125;
          </code>{' '}
          enqueues a job and returns <code>&#123; jobId, deduped &#125;</code>{' '}
          with HTTP 202 immediately. The actual catalog walk (App Store Connect
          REST or Play Developer API) runs in the background as a Convex
          internalAction, writing progress and the final result back to a{' '}
          <code>productSyncJobs</code> row. Earlier kit versions held the HTTP
          connection open for the entire sync, which iOS Safari aborted on
          cellular / backgrounded tabs as <code>TypeError: Load failed</code>.
        </p>
        <p>Clients poll the job state:</p>
        <ul>
          <li>
            <code>
              GET /v1/products/&#123;apiKey&#125;/sync/jobs/&#123;jobId&#125;
            </code>{' '}
            — current status (<code>queued</code> / <code>running</code> /{' '}
            <code>succeeded</code> / <code>failed</code>),{' '}
            <code>progress.phase</code>, and on terminal status the{' '}
            <code>result</code> object with <code>pulled</code> /{' '}
            <code>pushed</code> counts and per-product <code>failures</code>{' '}
            (price-tier conflicts, locale issues, missing review notes). When
            more than 200 products fail, <code>failuresTruncated: true</code> is
            set and the array is capped.
          </li>
          <li>
            <code>
              POST
              /v1/products/&#123;apiKey&#125;/sync/jobs/&#123;jobId&#125;/cancel
            </code>{' '}
            — request a cancel; the worker checks at phase boundaries (PULL.iaps
            → PULL.subscriptions → PUSH.drafts) and stops within seconds.
          </li>
        </ul>
        <p>
          Backoff polls at ~3s intervals until <code>status</code> is{' '}
          <code>succeeded</code> or <code>failed</code>. Most catalogs finish in
          tens of seconds; large ones in 1–2 minutes. A{' '}
          <code>reapStaleProductSyncJobs</code> cron flips workers stuck past
          the 9-minute deadline to <code>failed</code> so a crashed action can't
          pin the project's "active job" slot.
        </p>
      </section>

      <section>
        <AnchorLink id="mcp" level="h2">
          MCP server
        </AnchorLink>
        <p>
          <code>@hyodotdev/openiap-mcp-server</code> is a stdio Model Context
          Protocol server with 13 tools covering setup, status checks,
          troubleshooting, product CRUD, subscription listing, sandbox
          simulation, and full-state inspection. Plug it into Claude Desktop /
          Cursor / Codex via:
        </p>
        <CodeBlock language="json">{`{
  "mcpServers": {
    "iapkit": {
      "command": "bunx",
      "args": ["@hyodotdev/openiap-mcp-server"],
      "env": {
        "IAPKIT_API_KEY": "openiap-kit_<your-key>",
        "IAPKIT_BASE_URL": "https://kit.openiap.dev"
      }
    }
  }
}`}</CodeBlock>
        <p>
          Every tool funnels through the same kit HTTP surface as the dashboard
          and the SDKs, so an LLM action ("disable this product on Android") and
          a manual edit produce identical state changes.
        </p>
      </section>
    </div>
  );
}

export default KitBackend;
