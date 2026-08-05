import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
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
        keywords="IAPKit, kit.openiap.dev, OpenIAP kit, hosted backend, purchase verification, receipt validation, order lookup, product client payload, TOML metadata, Amazon Fire OS, Vega OS, subscription state, App Store Connect, Play Console, MCP server"
      />
      <h1>Purchase Verification</h1>
      <p>
        Purchase verification is the step that proves a store transaction is
        real before your app grants paid access, and IAPKit (
        <a href={IAPKIT_URL} target="_blank" rel="noopener noreferrer">
          <code>kit.openiap.dev</code>
        </a>
        ) is OpenIAP's hosted backend for that flow. A mobile app can call
        IAPKit directly with a restricted publishable key, so you do not need to
        operate a receipt-verification server. Administrative automation uses a
        separate secret key for lifecycle inspection, revenue metrics, catalog
        writes, and App Store Connect / Play Console product sync.
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
          Purchase verification uses a publishable{' '}
          <code>Authorization: Bearer</code> key. App-facing reads keep the
          publishable key in their compatibility path where required by mobile
          runtimes. Administrative subscription, product, store-sync, and MCP
          calls send the secret key only in the{' '}
          <code>Authorization: Bearer</code> header so it does not enter URL
          logs.
        </p>
        <ul>
          <li>
            <code>POST /v1/purchase/verify</code> — purchase verification (Apple
            JWS, Google purchaseToken, Amazon RVS receiptId for Fire OS and Vega
            OS, Meta Horizon) with a publishable Bearer key.
          </li>
          <li>
            <code>POST /v1/webhooks/&#123;apiKey&#125;</code> — unified App
            Store Server Notifications v2 / Google Pub/Sub RTDN receiver (Google
            OIDC verified). Platform-specific <code>/apple</code> /{' '}
            <code>/google</code> aliases remain supported for existing setups.
          </li>
          <li>
            <code>GET /v1/subscriptions/status?userId=</code> — fast entitlement
            gate with a publishable Bearer key. The key-in-path form remains a
            compatibility alias.
          </li>
          <li>
            <code>GET /v1/subscriptions/entitlements?userId=</code> — every
            active productId for a user, also with a publishable Bearer key.
          </li>
          <li>
            <code>GET /v1/subscriptions/list</code> — secret
            Bearer-authenticated filtered subscription list.
          </li>
          <li>
            <code>GET /v1/subscriptions/metrics</code> — secret
            Bearer-authenticated MRR, churn, and refund counts.
          </li>
          <li>
            <code>POST /v1/subscriptions/bind-user</code> — attach a userId to a
            tracked subscription by purchase token with a publishable Bearer
            key. The key-in-path form remains a compatibility alias.
          </li>
          <li>
            <code>GET /v1/products/&#123;publishableKey&#125;</code> — client
            catalog read. The equivalent header-authenticated{' '}
            <code>GET /v1/products</code> accepts either key type. Catalog{' '}
            <code>POST</code> and <code>DELETE</code> calls require a secret
            Bearer key.
          </li>
          <li>
            <code>
              GET
              /v1/products/&#123;publishableKey&#125;/&#123;productId&#125;/client-payload?platform=
            </code>{' '}
            — read one public TOML, JSON, or text product payload.
          </li>
          <li>
            <code>
              PUT/DELETE
              /v1/products/client-payload/&#123;productId&#125;?platform=
            </code>{' '}
            — create, update, or remove that payload from CI or MCP using a
            secret Bearer key.
          </li>
          <li>
            <code>POST /v1/products/sync/&#123;ios|android&#125;</code> — secret
            Bearer-authenticated push-sync with App Store Connect / Play
            Console.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="api-keys-environments" level="h2">
          API keys and environments
        </AnchorLink>
        <p>IAPKit has two project-scoped credential types:</p>
        <ul>
          <li>
            <code>openiap-kit_pk_...</code> publishable keys belong in mobile
            apps. They can verify purchases, bind/check a user&apos;s
            entitlement state, and read public products or client payloads.
          </li>
          <li>
            <code>openiap-kit_sk_...</code> secret keys belong in MCP, CI, or a
            trusted backend. They additionally authorize catalog and payload
            writes, subscription analytics, and store sync.
          </li>
        </ul>
        <p>
          A secret key can call client endpoints, but a publishable key cannot
          call administrative endpoints. Those attempts return{' '}
          <code>403 INSUFFICIENT_SCOPE</code>.
        </p>
        <p>
          Keys created before scoped credentials are classified as publishable
          because older documentation allowed them in app bundles. Existing apps
          keep verification access; create a new secret key before continuing
          MCP or CI administration.
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
            <strong>Orders</strong> — read-only Apple / Google order ID lookup
            for customer support (see <a href="#order-lookup">Order lookup</a>).
          </li>
          <li>
            <strong>Webhooks</strong> — copyable inbound lifecycle webhook URLs
            for Apple ASN v2 and Google RTDN.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="order-lookup" level="h2">
          Order lookup
        </AnchorLink>
        <p>
          Order lookup is read-only support tooling for customer inquiries:
          paste an Apple or Google order ID from a customer receipt and IAPKit
          returns the full order details, plus — when the order contains a
          subscription and the store returns it — the current subscription
          status. The subscription fetch is best-effort: if it fails, the order
          result still stands and the reason is shown alongside it. It lives in
          the project dashboard under <strong>Orders</strong>.
        </p>
        <p>
          Lookups reuse the store credentials the project already configured for
          purchase verification — the App Store Server API key for Apple and the
          Play service-account JSON for Google — so in most projects there is
          nothing new to set up.
        </p>
        <Callout kind="note">
          <p>
            <strong>Apple lookups are production-only.</strong> Order IDs exist
            only for real App Store purchases, and the App Store Server API
            order-lookup endpoint has no sandbox counterpart, so sandbox
            transactions cannot be found by order ID. Because the lookup always
            verifies against production, the project also needs its{' '}
            <strong>App Apple ID</strong> filled in under Settings → iOS — it is
            optional for sandbox-only verification, but required here.
          </p>
          <p>
            <strong>Google lookups need financial data access.</strong> The
            project&apos;s Play service account must have the{' '}
            <em>View financial data</em> permission in Play Console; without it
            the Play Developer API rejects order lookups.
          </p>
        </Callout>
        <p>
          Lookups are proxied live to the store APIs and never stored — IAPKit
          keeps no record of searched order IDs or their results.
        </p>
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
          Configure these mobile SDK calls with an <code>openiap-kit_pk_</code>{' '}
          publishable key. Do not copy the <code>openiap-kit_sk_</code> secret
          used by MCP or CI into the app.
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
    // Use an openiap-kit_pk_ publishable key. Optional when configured via
    // Expo config / Info.plist / AndroidManifest.
    apiKey: process.env.EXPO_PUBLIC_IAPKIT_PUBLISHABLE_KEY,
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
val result = kmpIapInstance.verifyPurchaseWithProvider(
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

var result = await GodotIapPlugin.verify_purchase_with_provider({
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

const openiapProjectKey = '<IAPKIT_PUBLISHABLE_KEY>';
const api = kitApi({ apiKey: openiapProjectKey });
const { active, subscription } = await api.status('user-1');
if (active) {
  unlockPremium(subscription?.productId);
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var openiapProjectKey = "<IAPKIT_PUBLISHABLE_KEY>";
var api = OpenIapClient.KitApi(new KitApiOptions { ApiKey = openiapProjectKey });
var status = await api.StatusAsync("user-1");
if (status.Active)
{
    UnlockPremium(status.Subscription?.ProductId);
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="refresh-entitlements-without-sse" level="h3">
          Recommended SSE replacement: conditional snapshots
        </AnchorLink>
        <p>
          App Store Server Notifications v2 and Google RTDN update IAPKit&apos;s
          canonical subscription rows. IAPKit deliberately does not relay those
          events to apps, expose a raw event feed, or keep an SSE, WebSocket, or
          long-poll connection open. The app reads only the latest snapshot for
          its opaque <code>userId</code>.
        </p>
        <p>
          Webhook event rows are bounded operational history for deduplication
          and retention. Polling reads the canonical snapshot, not an event
          cursor, so pruning old event rows does not erase the user&apos;s
          latest state and apps do not have to consume every event in order.
        </p>
        <ol>
          <li>
            For a purchase started in this app session, update the UI from the
            SDK purchase callback and verified result. Bind its stable purchase
            token to the app-scoped user ID once.
          </li>
          <li>Render from a persisted status or entitlement snapshot.</li>
          <li>
            Revalidate on cold start, when a foreground snapshot is stale, or
            after an explicit user refresh. Use one refresh coordinator so
            concurrent screens share the same in-flight request; do not run a
            continuous timer. Define a maximum stale age for offline or
            rate-limited fallback and fail closed after that app-specific
            window.
          </li>
          <li>
            Save the response <code>ETag</code> and send it as{' '}
            <code>If-None-Match</code> next time. Reuse the cached body on{' '}
            <code>304</code>; replace it on <code>200</code>.
          </li>
          <li>
            Respect <code>429 Retry-After</code> and use jittered backoff after
            network failures.
          </li>
          <li>
            Key local storage by IAPKit project and opaque user ID, and clear it
            on sign-out. Never render one user&apos;s cached snapshot for
            another.
          </li>
        </ol>
        <p>
          The example below uses the raw HTTP contract so it can retain response
          headers. The current <code>kitApi.status()</code> and{' '}
          <code>kitApi.entitlements()</code> convenience methods still perform
          unconditional reads and return only the decoded body; use raw{' '}
          <code>fetch</code> or an app wrapper when you need conditional
          revalidation.
        </p>
        <CodeBlock language="typescript">{`type CachedEntitlements = {
  cacheScope: string; // App-defined IAPKit project/environment identifier.
  etag: string | null;
  checkedAt: number;
  snapshot: {
    userId: string;
    productIds: string[];
    subscriptions: Array<{
      productId: string;
      state: string;
      expiresAt?: number;
      renewsAt?: number;
      willRenew?: boolean;
    }>;
  };
};

async function refreshEntitlements(
  iapkitCacheScope: string,
  userId: string,
  cached: CachedEntitlements | null,
  maxStaleMs: number,
  iapkitPublishableKey: string,
) {
  const cachedForScope =
    cached?.cacheScope === iapkitCacheScope &&
    cached.snapshot.userId === userId
      ? cached
      : null;
  const canUseCachedSnapshot = () => {
    if (
      cachedForScope === null ||
      !Number.isFinite(cachedForScope.checkedAt) ||
      !Number.isFinite(maxStaleMs) ||
      maxStaleMs < 0
    ) {
      return false;
    }
    const cacheAgeMs = Date.now() - cachedForScope.checkedAt;
    return cacheAgeMs >= 0 && cacheAgeMs <= maxStaleMs;
  };
  let response: Response;
  try {
    response = await fetch(
      \`https://kit.openiap.dev/v1/subscriptions/entitlements?userId=\${encodeURIComponent(userId)}\`,
      {
        headers: {
          Authorization: \`Bearer \${iapkitPublishableKey}\`,
          ...(cachedForScope?.etag
            ? { 'If-None-Match': cachedForScope.etag }
            : {}),
        },
      },
    );
  } catch (error) {
    if (cachedForScope && canUseCachedSnapshot()) {
      return cachedForScope.snapshot;
    }
    throw error;
  }

  if (response.status === 304 && cachedForScope) {
    const refreshed = { ...cachedForScope, checkedAt: Date.now() };
    await persistEntitlements(refreshed);
    return refreshed.snapshot;
  }
  if (response.status === 429) {
    scheduleRetry(response.headers.get('Retry-After'));
    if (cachedForScope && canUseCachedSnapshot()) {
      return cachedForScope.snapshot;
    }
    throw new Error('Entitlement refresh is rate limited');
  }
  if (!response.ok) throw new Error('Entitlement refresh failed');

  const wireSnapshot = (await response.json()) as {
    userId: string;
    productIds: string[];
    subscriptions: Array<{
      productId: string;
      state: string;
      expiresAt?: number;
      renewsAt?: number;
      willRenew?: boolean;
    }>;
  };
  const snapshot = {
    userId: wireSnapshot.userId,
    productIds: wireSnapshot.productIds,
    subscriptions: wireSnapshot.subscriptions.map(
      ({ productId, state, expiresAt, renewsAt, willRenew }) => ({
        productId,
        state,
        expiresAt,
        renewsAt,
        willRenew,
      }),
    ),
  };
  await persistEntitlements({
    cacheScope: iapkitCacheScope,
    snapshot,
    etag: response.headers.get('ETag'),
    checkedAt: Date.now(),
  });
  return snapshot;
}`}</CodeBlock>
        <Callout kind="note">
          <p>
            <strong>A 304 still makes one Convex query invocation.</strong>{' '}
            Convex returns a time-independent row snapshot and invalidates its
            cached result when a dependent row changes. Fly then evaluates
            expiry against its own current clock on every HTTP request. Cached
            query results and caller-controlled timestamps therefore cannot
            preserve expired access, and a time-only transition is detected on
            the next refresh. The conditional request avoids response-body
            transfer and unnecessary app state replacement; it does not make
            aggressive polling free.
          </p>
          <p>
            A user snapshot supports up to 200 subscription rows. IAPKit reads
            one additional indexed row only to detect overflow and returns{' '}
            <code>400 ENTITLEMENT_SNAPSHOT_TOO_LARGE</code> instead of exposing
            a partial entitlement set.
          </p>
          <p>
            Mobile snapshots are suitable for UI and local feature gating. If a
            developer-owned backend protects paid content, that backend must
            authenticate the user and make the entitlement decision. It also
            owns any optional APNs or FCM delivery.
          </p>
          <p>
            Persist only the fields the UI needs. In particular, avoid retaining
            purchase tokens in general-purpose local storage when product IDs,
            states, and expiry times are sufficient.
          </p>
        </Callout>
      </section>

      <section>
        <AnchorLink id="hosted-capacity" level="h2">
          Hosted capacity and high-volume apps
        </AnchorLink>
        <p>
          The official hosted IAPKit service is open-source infrastructure
          shared by the OpenIAP community. It is free under fair-use safeguards
          and operated on a best-effort basis; it is not unlimited capacity and
          does not include dedicated resources or an SLA.
        </p>
        <p>
          Plan from request frequency and peak concurrency, not DAU alone. One
          million users making one hosted request per day already averages about{' '}
          <strong>11.6 requests per second</strong>, before cold-start,
          release-day, or notification-driven peaks. That average exceeds the
          hosted default per-key steady rate of 10 requests per second.
        </p>
        <p>
          Hosted purchase verification also limits work already in progress to{' '}
          <strong>
            8 handlers per API key, 16 per trusted source IP, and 32 per process
          </strong>
          . The key and source shares make simple credential rotation
          insufficient to monopolize the process from one network source;
          requests beyond any axis receive <code>503 SERVICE_BUSY</code> instead
          of entering an unbounded server queue.
        </p>
        <ul>
          <li>
            Verify after a purchase or restore; do not re-verify every receipt
            on every app start.
          </li>
          <li>
            Persist entitlement snapshots, coalesce concurrent refreshes, and
            revalidate only when stale or explicitly requested by the user.
          </li>
          <li>
            Honor the <code>Retry-After</code> header on <code>429</code> and{' '}
            <code>503</code> with jittered backoff. A <code>304</code> saves
            response transfer but still uses a Convex query invocation.
          </li>
        </ul>
        <Callout kind="important">
          <p>
            <strong>Contact us before a high-volume production launch.</strong>{' '}
            If your organization expects to consume a meaningful share of hosted
            capacity, we ask it to help fund server expansion, monitoring,
            security, and load testing through{' '}
            <a
              href="https://github.com/sponsors/hyodotdev"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Sponsors
            </a>{' '}
            or{' '}
            <a
              href="https://opencollective.com/openiap"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenCollective
            </a>
            . Sponsorship supports shared capacity; it does not automatically
            reserve dedicated resources or create an SLA.
          </p>
          <p>
            For predictable capacity and full operational control,{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
              target="_blank"
              rel="noopener noreferrer"
            >
              self-host the MIT-licensed server
            </a>
            . For capacity planning or a separate written arrangement, contact{' '}
            <a href="mailto:hyo@hyo.dev">hyo@hyo.dev</a>.
          </p>
        </Callout>
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
                <code>kitApi.products</code> /{' '}
                <code>GET /v1/products/&#123;publishableKey&#125;</code>
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
        <Callout kind="warning">
          <p>
            <strong>Client payloads are public app data.</strong> Anyone able to
            call the project's client endpoints may receive them. Never store
            API secrets, credentials, signing keys, or server-authoritative
            entitlement rules in a client payload.
          </p>
          <p>
            A publishable key embedded in an app is extractable and consumes the
            project&apos;s quota, but it cannot perform administrative writes or
            project-wide inspection. Use separate publishable keys for
            independent builds or environments and never put a secret key in the
            app.
          </p>
        </Callout>

        <AnchorLink id="fetch-client-payload-on-app-open" level="h3">
          Cache a known payload
        </AnchorLink>
        <p>
          React Native IAP and Expo IAP export the canonical <code>kitApi</code>{' '}
          helper, and MAUI exposes the equivalent <code>KitApiClient</code>. Use
          the direct payload method when the product ID is already known. Do not
          download the complete payload catalog on every foreground event.
          Product-list pagination is for an explicit catalog refresh.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kitApi } from 'expo-iap';
// React Native IAP apps can import kitApi from 'react-native-iap'.

const platform = Platform.OS === 'ios' ? 'IOS' : 'Android';
const api = kitApi({
  apiKey: '<IAPKIT_PUBLISHABLE_KEY>',
  clientPayloadCache: AsyncStorage,
});

// Cache-first: after the first successful read this performs no request.
const { clientPayload } = await api.clientPayload(
  'premium_monthly',
  platform,
);

// Revalidate once on a cold app launch or an explicit user refresh.
// A matching scoped ETag returns 304 and reuses the persisted body.
const refreshed = await api.clientPayload(
  'premium_monthly',
  platform,
  { refresh: true },
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using System.Linq;
using OpenIap.Maui;

var api = OpenIapClient.KitApi(new KitApiOptions
{
    ApiKey = "<IAPKIT_PUBLISHABLE_KEY>",
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
            until <code>hasMore</code> is <code>false</code>. The same 25-item
            default and 50-item maximum apply without the explicit payload flag;
            that path never queries payload bodies. Catalog changes can
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
            <code>Removed</code>. Responses use a project/key/product-scoped{' '}
            <code>ETag</code>. A matching <code>If-None-Match</code> returns{' '}
            <code>304</code> without reading or returning the 16 KiB body.
          </li>
        </ul>

        <AnchorLink id="cost-and-abuse-guardrails" level="h3">
          Cost and abuse guardrails
        </AnchorLink>
        <p>
          Public verification, product, payload, status, entitlement, and
          user-binding requests, plus publishable-key store-webhook ingress, are
          bounded in Fly memory by API key, source IP, and process-wide token
          buckets before Convex is called. The stores use TTL plus LRU eviction,
          so invalid-key churn cannot grow memory without bound. A 50-item
          payload catalog page is charged as 50 units. Rejections return{' '}
          <code>429</code>, <code>Retry-After</code>, and consistent rate-limit
          headers.
        </p>
        <p>
          These counters do not create a Convex mutation on every mobile
          request. Direct payloads use <code>private, no-cache</code> plus a
          scoped ETag; catalog and secret-admin responses use{' '}
          <code>private, no-store</code>. The current single Fly machine makes
          the process limit effectively global. If IAPKit scales to several
          machines, per-machine allowances multiply, so production should also
          configure Convex daily/monthly warning and disable limits under the
          deployment&apos;s Usage Limits page and a team spending limit under
          Billing.
        </p>
        <p>
          See the{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/COST-SAFETY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            IAPKit cost and abuse safety model
          </a>{' '}
          for the function-call/read counts, Starter and Professional estimates,
          usage-limit recommendations, and remaining multi-machine limitation.
        </p>

        <AnchorLink id="write-client-payload-from-ci" level="h3">
          Write from CI or MCP
        </AnchorLink>
        <p>
          A secret admin key can set or remove payloads programmatically.
          Publishable keys receive <code>403 INSUFFICIENT_SCOPE</code>.
          <code>expectedVersion</code> is optional: pass it for optimistic
          concurrency, or omit it for an atomic last-write-wins update.
        </p>
        <p>
          The matching IAPKit catalog row must exist first. If your automation
          creates the product directly in App Store Connect or Play Console, run
          a secret-authenticated pull sync and wait for the returned job to
          succeed before setting its payload. You may instead create the IAPKit
          row with <code>POST /v1/products</code>. A payload write made before
          either step returns <code>PRODUCT_NOT_FOUND</code>.
        </p>
        <CodeBlock language="bash">{`curl -X POST \\
  "https://kit.openiap.dev/v1/products/sync/ios?direction=pull&dryRun=false" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"

# Poll the returned jobId until status is succeeded.
curl "https://kit.openiap.dev/v1/products/sync/jobs/<jobId>" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"`}</CodeBlock>
        <CodeBlock language="bash">{`curl -X PUT \\
  "https://kit.openiap.dev/v1/products/client-payload/premium_monthly?platform=IOS" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"toml","body":"[access]\\nmax_items = 10","expectedVersion":3}'

curl -X DELETE \\
  "https://kit.openiap.dev/v1/products/client-payload/premium_monthly?platform=IOS&expectedVersion=4" \\
  -H "Authorization: Bearer openiap-kit_sk_<your-secret-key>"`}</CodeBlock>
        <p>
          MCP exposes these routes as <code>iapkit_get_client_payload</code>,{' '}
          <code>iapkit_set_client_payload</code>, and{' '}
          <code>iapkit_remove_client_payload</code>. The read tool returns the
          durable <code>expectedVersion</code> even after deletion.
        </p>

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
            General product-management requests use a 64 KiB envelope. Client
            payload writes use 128 KiB so a fully JSON-escaped body can still
            reach its separate 16 KiB decoded limit. Neither envelope is a
            per-product metadata allowance.
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
          For Apple projects, an uploaded project-level App Review screenshot
          opts eligible draft products into the current version-based review
          workflow. Push Sync creates product-version metadata, uploads the
          private PNG/JPEG through Apple&apos;s reserved asset operations, and
          submits the version through a review submission. If no screenshot is
          configured, the product stops at Ready to Submit as before. Apple
          requirements that need a new app version—including the first
          consumable, non-consumable, auto-renewable subscription, or
          non-renewing subscription—are returned as <code>manualActions</code>,
          not transient sync failures. Removing the project file only stops
          future reuse; it does not remove screenshots already uploaded to App
          Store Connect.
        </p>
        <p>
          Sync is asynchronous —{' '}
          <code>POST /v1/products/sync/&#123;ios|android&#125;</code> enqueues a
          job and returns <code>&#123; jobId, deduped &#125;</code> with HTTP
          202 immediately. The actual catalog walk (App Store Connect REST or
          Play Developer API) runs in the background as a Convex internalAction,
          writing progress and the final result back to a{' '}
          <code>productSyncJobs</code> row. Earlier kit versions held the HTTP
          connection open for the entire sync, which iOS Safari aborted on
          cellular / backgrounded tabs as <code>TypeError: Load failed</code>.
        </p>
        <p>Clients poll the job state:</p>
        <ul>
          <li>
            <code>GET /v1/products/sync/jobs/&#123;jobId&#125;</code> — current
            status (<code>queued</code> / <code>running</code> /{' '}
            <code>succeeded</code> / <code>failed</code>),{' '}
            <code>progress.phase</code>, and on terminal status the{' '}
            <code>result</code> object with <code>pulled</code> /{' '}
            <code>pushed</code> counts and per-product <code>failures</code>{' '}
            (price-tier conflicts, locale issues, missing review notes). When
            more than 200 products fail, <code>failuresTruncated: true</code> is
            set and the array is capped.
          </li>
          <li>
            <code>POST /v1/products/sync/jobs/&#123;jobId&#125;/cancel</code> —
            request a cancel; the worker checks at phase, product-chunk,
            request, upload-operation, and asset-poll boundaries, then performs
            bounded cleanup for any IAPKit-owned review draft.
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
        <p>
          All three sync requests send{' '}
          <code>Authorization: Bearer openiap-kit_sk_...</code>. Secret keys in
          path routes receive <code>410 SECRET_API_KEY_IN_URL</code>;
          publishable path segments remain only on app-facing reads and inbound
          store webhooks whose transport requires them.
        </p>
      </section>

      <section>
        <AnchorLink id="mcp" level="h2">
          MCP server
        </AnchorLink>
        <p>
          <code>@hyodotdev/openiap-mcp-server</code> is a stdio Model Context
          Protocol server with 15 tools covering setup, status checks,
          troubleshooting, product and client-payload CRUD, subscription
          listing, sandbox simulation, analytics, store sync, and full-state
          inspection. It requires a secret admin key:
        </p>
        <CodeBlock language="json">{`{
  "mcpServers": {
    "iapkit": {
      "command": "bunx",
      "args": ["@hyodotdev/openiap-mcp-server"],
      "env": {
        "IAPKIT_API_KEY": "openiap-kit_sk_<your-secret-key>",
        "IAPKIT_BASE_URL": "https://kit.openiap.dev"
      }
    }
  }
}`}</CodeBlock>
        <p>
          Every tool funnels through the same authorization checks as the
          dashboard and REST API. Generated mobile setup snippets contain a
          separate publishable-key placeholder and never reuse the MCP secret.
        </p>
      </section>
    </div>
  );
}

export default KitBackend;
