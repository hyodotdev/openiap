import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import DataTable from '../../../components/DataTable';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface PlatformBehaviorRow {
  platform: string;
  result: string;
}

const PLATFORM_BEHAVIOR_ROWS: PlatformBehaviorRow[] = [
  {
    platform: 'App Store: iOS 16+, macOS 14+, tvOS 16+, watchOS 9+, visionOS',
    result:
      'StoreKit verifies AppTransaction. A verified acquisition returns licensed; a reported revocation returns unlicensed. An unverified transaction returns unknown with verification-failed.',
  },
  {
    platform: 'Google Play',
    result:
      'Collects a standard Play Integrity token. Returns unknown with backend-verification-required until your backend decodes the token and decides whether access is allowed.',
  },
  {
    platform:
      "Older Apple runtimes, Amazon, Horizon, VegaOS, Expo's Onside integration",
    result:
      'Returns unknown with unsupported. Community providers must implement the capability; a provider without a handler rejects with feature-not-supported.',
  },
];

export default function VerifyAppOwnership() {
  useScrollToHash();
  return (
    <div className="doc-page">
      <SEO
        title="verifyAppOwnership"
        description="Verify app acquisition with StoreKit AppTransaction or collect Play Integrity evidence for backend licensing checks."
        path="/docs/apis/verify-app-ownership"
      />
      <h1>verifyAppOwnership</h1>
      <p>
        Check ownership of the app download separately from in-app purchases.
        Use this at launch for a paid app; keep{' '}
        <Link to="/docs/features/validation">verifyPurchase</Link> for products
        bought inside the app.
      </p>
      <p>
        Available in Client Protocol 1.0.1, openiap-apple 4.0.1, and
        openiap-google 4.0.1. Rebuild your native app after upgrading its SDK.
      </p>
      <p>
        Follow your framework setup, including initConnection when required for
        provider setup. Godot on Android requires a successful connection.
        Native StoreKit and Play Integrity checks do not need a product catalog.
        Google Play requires a linked Cloud project with Play Integrity enabled.
      </p>

      <AnchorLink id="shared-flow" level="h2">
        One app-level verification flow
      </AnchorLink>
      <p>
        All SDKs expose the same operation and generated result contract. Your
        app calls verifyAppOwnership once, then handles licensed, unlicensed, or
        unknown. The native adapter owns StoreKit and Play Integrity calls; your
        UI does not branch on the operating system.
      </p>
      <p>
        For server-controlled access, send the complete result to your
        authenticated backend on either platform. It verifies
        signedAppTransactionIOS on Apple or decodes integrityTokenAndroid on
        Play, then returns the same status vocabulary. A collected Play token
        remains unknown until this step succeeds. For device-only Apple access,
        the verified local status is available immediately.
      </p>
      <AnchorLink id="platform-behavior" level="h2">
        Platform behavior
      </AnchorLink>
      <DataTable
        rows={PLATFORM_BEHAVIOR_ROWS}
        rowKey={(row) => row.platform}
        columns={[
          { header: 'Platform', cell: (row) => row.platform },
          { header: 'Result', cell: (row) => row.result },
        ]}
      />
      <p>
        Local Apple verdicts require an Xcode 27 build to check revocation.
        Earlier builds return unknown with backend-verification-required and
        signed evidence. Your backend can check revocation. Local checks alone
        cannot provide complete piracy protection.
      </p>

      <AnchorLink id="signature" level="h2">
        Signature
      </AnchorLink>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`verifyAppOwnership(options?: VerifyAppOwnershipProps): Promise<AppOwnershipVerificationResult>`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func verifyAppOwnership(_ options: VerifyAppOwnershipProps? = nil) async throws -> AppOwnershipVerificationResult`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIap.verifyAppOwnership(options) // generated suspend handler`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun verifyAppOwnership(options: VerifyAppOwnershipProps? = null): AppOwnershipVerificationResult`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<AppOwnershipVerificationResult> verifyAppOwnership({PlayIntegrityParamsAndroid? google});`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<AppOwnershipVerificationResult> VerifyAppOwnershipAsync(VerifyAppOwnershipProps? options = null);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func verify_app_ownership(options = null) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        Custom Dart classes using <code>implements QueryResolver</code> must add
        this method. Classes extending QueryResolver inherit an unsupported
        default; FlutterInappPurchase already implements the capability.
      </p>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        The optional{' '}
        <Link to="/docs/types/app-ownership-verification#verify-app-ownership-props">
          <code>VerifyAppOwnershipProps</code>
        </Link>{' '}
        contains <code>google</code> (
        <Link to="/docs/types/app-ownership-verification#play-integrity-params-android">
          <code>PlayIntegrityParamsAndroid</code>
        </Link>
        ), required for Google Play and ignored on Apple platforms. It carries
        the Cloud project number and a backend request hash.
      </p>
      <p>
        Each call prepares a token provider and requests one token. Avoid
        polling: Google limits preparations per app instance and applies project
        quotas. Preparation and token collection have a combined 60-second
        timeout.
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/app-ownership-verification#app-ownership-verification-result">
          <code>AppOwnershipVerificationResult</code>
        </Link>{' '}
        — the <code>status</code> (licensed, unlicensed, or unknown), the{' '}
        <code>storeId</code>, a <code>reason</code> when unknown, and the store
        evidence to send to your backend.
      </p>
      <p>
        Invalid Google parameters reject with developer-error. Cancellation
        propagates. Service outages and throttling return unknown with
        service-error. Godot emits purchase_error and returns null for invalid
        input or bridge failures.
      </p>

      <AnchorLink id="test-examples" level="h2">
        Try the example apps
      </AnchorLink>
      <p>
        The two native examples and all six framework examples expose
        <strong> App ownership</strong> in their purchase or Store screen.
        Select <strong>Check app ownership</strong> to see the status, store,
        reason, and evidence lengths. For Google Play, enter the linked Cloud
        project number and a request hash from your backend. Leave both fields
        empty on Apple; unsupported stores return unknown with unsupported.
        These free test apps verify API wiring; they do not verify paid-app
        acquisition or refund outcomes.
      </p>

      <AnchorLink id="example" level="h2">
        Launch example
      </AnchorLink>
      <p>
        Generate requestDigest from your backend challenge.
        verifyOwnershipOnBackend and applyAppAccessPolicy are functions you
        implement in your app.
      </p>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {initConnection, verifyAppOwnership} from 'expo-iap';
// The same API is exported from react-native-iap.
if (!(await initConnection())) throw new Error("Store connection unavailable");

// Your backend issues a fresh challenge bound to the signed-in session.
const google = {cloudProjectNumber: '123456789012', requestHash: requestDigest};
const evidence = await verifyAppOwnership({google});
// One backend entry point verifies the platform's evidence and request binding.
const decision = await verifyOwnershipOnBackend(evidence);
applyAppAccessPolicy(decision.status); // licensed | unlicensed | unknown`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if not await GodotIapPlugin.init_connection():
    return
var result = await GodotIapPlugin.verify_app_ownership({
    "google": {"cloudProjectNumber": "123456789012", "requestHash": request_digest}
})
if result != null:
    # The backend verifies Apple or Play evidence and returns a common verdict.
    var decision = await verify_ownership_on_backend(result.to_dict())
    apply_app_access_policy(decision.status)
`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="backend-verification" level="h2">
        Backend verification
      </AnchorLink>
      <p>
        <strong>Google Play:</strong> authenticate the app&apos;s backend
        request, then call Google&apos;s decodeIntegrityToken API using server
        credentials. Verify requestPackageName, timestampMillis, and requestHash
        against the expected app and the original request. Bind the challenge to
        the session and reject reuse. Never put Google credentials in a shipped
        app.
      </p>
      <p>
        After those checks, map appLicensingVerdict LICENSED to licensed,
        UNLICENSED to unlicensed, and UNEVALUATED or a missing verdict to
        unknown. Also require your expected package, signing certificate,
        version policy, and PLAY_RECOGNIZED app integrity verdict. Device
        integrity is a separate policy decision; a licensing verdict alone does
        not establish app or device integrity. A failed identity or
        request-binding check must not grant access even when the decoded
        licensing field says LICENSED.
      </p>
      <p>
        <strong>Apple:</strong> verify signedAppTransactionIOS using
        Apple&apos;s signed-data verifier and trusted roots. Check the bundle
        ID, App Store app ID, environment, and revocation metadata before
        granting backend access. Reject test environments for production
        entitlements. Use the app&apos;s device-verification fields when
        enforcing device binding.
      </p>
      <p>
        Return your decision through the developer&apos;s authenticated backend.
        This API collects evidence and performs the StoreKit local check; it
        does not call IAPKit or create a hosted licensing endpoint.
      </p>
      <p>
        <a href="https://developer.android.com/google/play/integrity/standard">
          Standard Play Integrity requests
        </a>{' '}
        ·{' '}
        <a href="https://developer.android.com/google/play/integrity/verdicts">
          Play Integrity verdicts
        </a>{' '}
        ·{' '}
        <a href="https://developer.apple.com/documentation/storekit/apptransaction">
          Apple AppTransaction
        </a>
      </p>

      <AnchorLink id="testing" level="h2">
        Testing app ownership
      </AnchorLink>
      <p>
        A free app can exercise the API and acquisition evidence, but licensed
        does not prove a price was paid. Sandbox, Xcode, and fixture results
        verify test behavior rather than a production paid-app purchase.
      </p>
      <p>
        To validate paid-app access, use a paid store listing and test accounts
        with and without an entitlement. Check purchase and refund or revocation
        outcomes where the store supports them. Google Play also needs the
        linked Cloud project and your backend token decoder.
      </p>

      <AnchorLink id="offline-behavior" level="h2">
        Offline behavior
      </AnchorLink>
      <p>
        StoreKit may verify cached app evidence offline. Play needs connectivity
        to collect and decode a fresh token. Network failures return unknown
        with network-error, not unlicensed. The SDK does not persist a license
        decision. Your app owns any grace period based on a previous
        server-verified decision, its expiry, and the retry policy. Do not
        repeatedly request tokens or permanently lock out an owner after a
        transient failure.
      </p>
    </div>
  );
}
