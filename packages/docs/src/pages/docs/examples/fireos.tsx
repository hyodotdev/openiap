import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';
import VideoSlot from './VideoSlot';

const FIREOS_VIDEO_BASE = '/examples/amazon/videos';
const FIREOS_POSTER = '/examples/amazon/home.webp';
const FIREOS_VIDEO_VERSION = 'v=20260526-corrected';

function fireOsVideo(fileName: string) {
  return `${FIREOS_VIDEO_BASE}/${fileName}?${FIREOS_VIDEO_VERSION}`;
}

function CodeLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to}>
      <code>{children}</code>
    </Link>
  );
}

function FireOSExample() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Fire OS Example"
        description="Run and record the OpenIAP Fire OS example flavor for Amazon Appstore IAP purchases, subscriptions, restore flows, and IAPKit verification."
        path="/docs/example/fireos"
        keywords="OpenIAP Fire OS example, Amazon Appstore IAP, Fire tablet IAP, Amazon RVS, IAPKit verification"
      />
      <h1>Fire OS Example</h1>
      <p>
        The Fire OS example is the shared Android Kotlin/Compose app compiled
        with the <code>amazon</code> flavor. It links the Amazon Appstore SDK,
        uses Amazon product IDs, maps Amazon receipt IDs into the OpenIAP
        purchase model, and verifies purchases through IAPKit when managed
        verification is enabled.
      </p>
      <blockquote className="info-note">
        <strong>Goal for the Amazon walkthrough:</strong> prove the app is using
        the Amazon Appstore adapter end to end: product catalog lookup, one-SKU
        purchase launch, purchase update handling, Amazon receipt ID based
        verification, restore, and fulfillment.
      </blockquote>

      <section>
        <AnchorLink id="overview" level="h2">
          Demo Overview
        </AnchorLink>
        <p>
          Start the article/video with the store context: this is the{' '}
          <code>amazon</code> flavor running on a real Fire OS tablet, using the
          same OpenIAP screen flow that the Apple, Google, Horizon OS, and Fire
          OS example pages will share.
        </p>
        <div className="example-action-layout">
          <VideoSlot
            title="Overview"
            description="App launch, Fire OS store context, and the feature menu used throughout the walkthrough."
            src={fireOsVideo('fireos-overview.mp4')}
            poster={FIREOS_POSTER}
          />
          <div className="example-action-copy">
            <p>
              Use this clip to orient viewers before touching any purchase
              button. The home screen confirms the Amazon Appstore adapter is
              selected and shows the three menus that matter for the demo:
              purchase flow, subscription flow, and available purchases.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Moment</th>
                  <th>What to call out</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Launch</td>
                  <td>
                    The badge reads <strong>Amazon Fire OS</strong>, proving the
                    Amazon flavor is installed instead of the Google or Horizon
                    flavor.
                  </td>
                </tr>
                <tr>
                  <td>Navigation</td>
                  <td>
                    Each menu is a focused recording target: one for products,
                    one for subscriptions, and one for restore/entitlement
                    recovery.
                  </td>
                </tr>
                <tr>
                  <td>Shared workflow</td>
                  <td>
                    The native sample uses <code>OpenIapStore</code>, but the
                    same operation names are exposed by the framework SDKs.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="amazon-proof-points" level="h2">
          Amazon Proof Points
        </AnchorLink>
        <p>
          These are the details the video should make obvious before the article
          moves into framework code. They map directly to the Amazon flavor
          implementation in <code>packages/google/openiap/src/amazon</code> and
          the Compose screens under <code>packages/google/Example</code>.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>What Fire OS proves</th>
              <th>Where it appears</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Adapter selection</td>
              <td>
                The <code>amazon</code> flavor loads the Amazon module instead
                of Play Billing or Horizon.
              </td>
              <td>Home badge and Fire OS copy.</td>
            </tr>
            <tr>
              <td>User context</td>
              <td>
                <CodeLink to="/docs/apis/init-connection">
                  initConnection
                </CodeLink>{' '}
                registers Amazon IAP callbacks and requests Amazon user data for
                receipt verification.
              </td>
              <td>First load of each purchase screen.</td>
            </tr>
            <tr>
              <td>Catalog</td>
              <td>
                <CodeLink to="/docs/apis/fetch-products">
                  fetchProducts
                </CodeLink>{' '}
                maps Amazon consumables, entitlements, and subscriptions into
                OpenIAP product types.
              </td>
              <td>Product and subscription rows.</td>
            </tr>
            <tr>
              <td>Receipt identity</td>
              <td>
                Amazon <code>receiptId</code> is exposed through the Android
                purchase shape as the purchase token/id used by downstream
                verification and fulfillment.
              </td>
              <td>Purchase details and verification payload.</td>
            </tr>
            <tr>
              <td>Fulfillment</td>
              <td>
                <CodeLink to="/docs/apis/finish-transaction">
                  finishTransaction
                </CodeLink>{' '}
                calls Amazon fulfillment with the receipt ID after validation.
              </td>
              <td>Purchase flow and unfinished transaction restore flow.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="purchase-flow" level="h2">
          Purchase Flow
        </AnchorLink>
        <div className="example-action-layout">
          <VideoSlot
            title="Purchase Flow"
            description="Consumable product screen, product fetch, purchase action, and verification result area."
            src={fireOsVideo('fireos-inapp.mp4')}
            poster={FIREOS_POSTER}
          />
          <div className="example-action-copy">
            <p>
              This menu covers consumables and non-consumables. The screen calls{' '}
              <CodeLink to="/docs/apis/init-connection">
                initConnection
              </CodeLink>
              , then fetches <code>IapConstants.INAPP_SKUS</code> with{' '}
              <CodeLink to="/docs/apis/fetch-products">fetchProducts</CodeLink>.
              In the video, show the verification selector first, then the
              product rows, and then the <strong>Buy</strong> action.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Load products</td>
                  <td>
                    <CodeLink to="/docs/apis/fetch-products">
                      fetchProducts
                    </CodeLink>{' '}
                    with <code>ProductQueryType.InApp</code>.
                  </td>
                  <td>
                    Amazon Appstore product data is normalized into OpenIAP
                    products such as <code>dev.hyo.martie.10bulbs</code>,{' '}
                    <code>dev.hyo.martie.30bulbs</code>, and{' '}
                    <code>dev.hyo.martie.certified</code>.
                  </td>
                </tr>
                <tr>
                  <td>Start purchase</td>
                  <td>
                    <CodeLink to="/docs/apis/request-purchase">
                      requestPurchase
                    </CodeLink>{' '}
                    with <code>RequestPurchaseProps.Request.Purchase</code>.
                  </td>
                  <td>
                    Amazon accepts one SKU per purchase request, so each row
                    launches a single Amazon Appstore purchase sheet.
                  </td>
                </tr>
                <tr>
                  <td>Handle update</td>
                  <td>
                    The screen watches <code>currentPurchase</code> and the
                    latest <code>PurchaseAndroid</code>.
                  </td>
                  <td>
                    This is where the app waits for the store result instead of
                    treating the button tap itself as proof of purchase.
                  </td>
                </tr>
                <tr>
                  <td>Verify and finish</td>
                  <td>
                    Verify, then call{' '}
                    <CodeLink to="/docs/apis/finish-transaction">
                      finishTransaction
                    </CodeLink>{' '}
                    and refresh{' '}
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>
                    .
                  </td>
                  <td>
                    Consumables are consumed; non-consumables are fulfilled.
                    Access should be unlocked only after the verification result
                    is accepted.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              The demo can keep moving in test-mode recordings, but a production
              app should not unlock premium access after a failed IAPKit or
              server verification response.
            </p>
            <blockquote className="info-note">
              For narration, call out that Amazon product requests are still
              regular OpenIAP <code>in-app</code> requests. The store-specific
              work is hidden inside the Amazon adapter; the app code continues
              to fetch, request, verify, finish, and refresh.
            </blockquote>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="subscription-flow" level="h2">
          Subscription Flow
        </AnchorLink>
        <div className="example-action-layout">
          <VideoSlot
            title="Subscription Flow"
            description="Subscription product screen, offer list, subscription action, and expected Amazon tester requirements."
            src={fireOsVideo('fireos-subscription.mp4')}
            poster={FIREOS_POSTER}
          />
          <div className="example-action-copy">
            <p>
              This menu demonstrates recurring products. The Fire OS build loads
              the Amazon-compatible subscription IDs from{' '}
              <code>IapConstants.getSubscriptionSkus()</code>, checks current
              subscription state, fetches product metadata, and then launches
              the subscription purchase request. The screen does not need an
              Amazon-only receipt alias layer; it uses the same OpenIAP
              subscription calls as the Play, Horizon, Expo, and React Native
              examples.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Check state</td>
                  <td>
                    <CodeLink to="/docs/apis/get-active-subscriptions">
                      getActiveSubscriptions
                    </CodeLink>{' '}
                    with the subscription SKU list.
                  </td>
                  <td>
                    The example logs active status before rendering offers, so
                    the video can separate "what is currently active" from "what
                    can be purchased". Fire OS returns the same{' '}
                    <code>ActiveSubscription</code> shape, with Amazon receipt
                    handling contained inside the adapter.
                  </td>
                </tr>
                <tr>
                  <td>Load offers</td>
                  <td>
                    <CodeLink to="/docs/apis/fetch-products">
                      fetchProducts
                    </CodeLink>{' '}
                    with <code>ProductQueryType.Subs</code>.
                  </td>
                  <td>
                    Monthly and annual products such as{' '}
                    <code>dev.hyo.martie.premium</code> and{' '}
                    <code>dev.hyo.martie.premium_year</code> are displayed as
                    normalized subscription products.
                  </td>
                </tr>
                <tr>
                  <td>Start subscription</td>
                  <td>
                    <CodeLink to="/docs/apis/request-purchase">
                      requestPurchase
                    </CodeLink>{' '}
                    with <code>RequestPurchaseProps.Request.Subscription</code>.
                  </td>
                  <td>
                    The same screen shape is used for Play, Horizon, and Amazon,
                    but the Fire OS build launches the Amazon Appstore purchase
                    sheet. The adapter correlates the in-flight response with
                    the requested SKU so the app keeps filtering by its normal
                    subscription product IDs.
                  </td>
                </tr>
                <tr>
                  <td>Finalize</td>
                  <td>
                    Verify the purchase, call{' '}
                    <CodeLink to="/docs/apis/finish-transaction">
                      finishTransaction
                    </CodeLink>
                    , then refresh{' '}
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>
                    .
                  </td>
                  <td>
                    Subscriptions are not consumed like bulbs. Finishing records
                    the store fulfillment while the app keeps entitlement state
                    driven by verified subscription status.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Live subscription purchases require an Amazon Appstore tester,
              matching catalog products, and an eligible signed-in Amazon
              account on the Fire OS device.
            </p>
            <blockquote className="info-note">
              The subscription clip should show that the Fire OS build uses
              Amazon-specific management language. Avoid Play Store cancellation
              copy when recording the Amazon walkthrough.
            </blockquote>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="available-purchases" level="h2">
          Available Purchases
        </AnchorLink>
        <div className="example-action-layout">
          <VideoSlot
            title="Available Purchases"
            description="Restore and available-purchase screen for entitlement recovery and receipt inspection."
            src={fireOsVideo('fireos-available-purchases.mp4')}
            poster={FIREOS_POSTER}
          />
          <div className="example-action-copy">
            <p>
              This menu is the entitlement recovery story. On entry, on refresh,
              and on restore, the screen calls{' '}
              <CodeLink to="/docs/apis/get-available-purchases">
                getAvailablePurchases
              </CodeLink>
              . The Amazon adapter backs that with purchase updates from the
              Amazon Appstore account.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Refresh</td>
                  <td>
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>
                    .
                  </td>
                  <td>
                    The app can rebuild entitlement state after launch or after
                    a network/store reconnect.
                  </td>
                </tr>
                <tr>
                  <td>Restore</td>
                  <td>
                    The restore button also uses{' '}
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>{' '}
                    and reports the restored count.
                  </td>
                  <td>
                    This is the Fire OS recovery path for reinstalls, device
                    changes, and Amazon account changes.
                  </td>
                </tr>
                <tr>
                  <td>Group purchases</td>
                  <td>
                    The screen groups active subscriptions, owned
                    non-consumables, and pending consumables.
                  </td>
                  <td>
                    The split gives the article clear talking points: active
                    access, permanent ownership, and transactions that still
                    need fulfillment.
                  </td>
                </tr>
                <tr>
                  <td>Finish unfinished</td>
                  <td>
                    Unfinished rows call{' '}
                    <CodeLink to="/docs/apis/finish-transaction">
                      finishTransaction
                    </CodeLink>{' '}
                    after validation.
                  </td>
                  <td>
                    This shows why restore and verification are not enough by
                    themselves: the store transaction must still be fulfilled or
                    consumed.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              When the list is empty, the explanation is still useful: the
              screen is demonstrating the same restore and entitlement recovery
              API that app teams should run after login, reinstall, account
              switch, and transaction finish.
            </p>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          IAPKit Verification
        </AnchorLink>
        <div className="example-action-layout">
          <VideoSlot
            title="Verification"
            description="IAPKit verification wiring, local app state, and where Amazon RVS-backed results appear."
            src={fireOsVideo('fireos-verification.mp4')}
            poster={FIREOS_POSTER}
          />
          <div className="example-action-copy">
            <p>
              This clip supports both the purchase and subscription menus. It
              shows where the app switches from a local demo state to managed
              validation through IAPKit and Amazon Receipt Verification Service.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API key</td>
                  <td>
                    Add <code>iapkit.api.key</code> before building when you
                    want managed verification against{' '}
                    <a
                      href={IAPKIT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link"
                      onClick={trackIapKitClick}
                    >
                      kit.openiap.dev
                    </a>
                    .
                  </td>
                </tr>
                <tr>
                  <td>Amazon payload</td>
                  <td>
                    Provider-level Fire OS verification uses{' '}
                    <CodeLink to="/docs/features/validation#verify-purchase-with-provider">
                      verifyPurchaseWithProvider
                    </CodeLink>{' '}
                    with an <code>iapkit.amazon</code> payload. The Amazon
                    native provider requires a <code>receiptId</code> and can
                    resolve <code>userId</code> from Amazon user data when the
                    caller does not pass one.
                  </td>
                </tr>
                <tr>
                  <td>Unlock decision</td>
                  <td>
                    Grant access only after verification succeeds; do not trust
                    a client-only premium flag or a button tap.
                  </td>
                </tr>
                <tr>
                  <td>Finish order</td>
                  <td>
                    Verification should happen before{' '}
                    <CodeLink to="/docs/apis/finish-transaction">
                      finishTransaction
                    </CodeLink>
                    , because finishing tells the store that the purchase was
                    fulfilled.
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="warning-box">
              <strong>Production rule</strong>
              <p>
                Verification is the gate; finishing is the receipt lifecycle
                cleanup. Do not call <code>finishTransaction</code> as the only
                proof that content should be unlocked.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="amazon-readiness" level="h2">
          Amazon Readiness
        </AnchorLink>
        <p>
          Before publishing the article or sharing the video with Amazon, verify
          these items so the demo reads as an Amazon Appstore integration rather
          than a generic Android screen recording.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Checklist</th>
              <th>Expected state</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Build flavor</td>
              <td>
                Use <code>:Example:assembleAmazonDebug</code> so the app links
                the Amazon Appstore SDK and loads the Amazon OpenIAP module.
              </td>
            </tr>
            <tr>
              <td>Catalog IDs</td>
              <td>
                Amazon catalog entries should match the example SKUs:
                consumables <code>dev.hyo.martie.10bulbs</code> /{' '}
                <code>dev.hyo.martie.30bulbs</code>, entitlement{' '}
                <code>dev.hyo.martie.certified</code>, and subscriptions{' '}
                <code>dev.hyo.martie.premium</code> /{' '}
                <code>dev.hyo.martie.premium_year</code>. If Amazon App Tester
                or a subscription group uses another internal SKU, update the
                catalog instead of adding app-side alias code.
              </td>
            </tr>
            <tr>
              <td>Subscription grouping</td>
              <td>
                Amazon subscriptions can be organized through store-side groups
                and terms, similar to the way Apple and Google structure
                subscription families. The OpenIAP example should still receive
                the requested SKU as <code>productId</code> and the active plan
                as <code>currentPlanId</code>, so the same entitlement code
                works across native Android, Expo, and React Native.
              </td>
            </tr>
            <tr>
              <td>Tester account</td>
              <td>
                The Fire OS tablet must be signed in with an Amazon account that
                can exercise the configured Appstore test catalog.
              </td>
            </tr>
            <tr>
              <td>Verification key</td>
              <td>
                Set <code>iapkit.api.key</code> in{' '}
                <code>packages/google/local.properties</code> before recording
                the IAPKit clip.
              </td>
            </tr>
            <tr>
              <td>Sandbox receipts</td>
              <td>
                Use the IAPKit Amazon payload with <code>sandbox: true</code>{' '}
                for tester receipts so Amazon RVS validation is routed to the
                correct environment.
              </td>
            </tr>
            <tr>
              <td>Kit entitlement identity</td>
              <td>
                Kit verification stores and checks entitlements from the
                verified receipt. Keep the Amazon receipt SKU aligned with the
                app-facing OpenIAP SKU, otherwise server-side entitlement checks
                can disagree with the client purchase response. Treat Kit or
                store restore APIs as the source of truth for subscription
                status.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="framework-handoff" level="h2">
          Framework Handoff
        </AnchorLink>
        <p>
          The Fire OS video is recorded from the native Kotlin sample so the
          Amazon adapter behavior is visible. App teams can move the same
          lifecycle into framework SDKs without inventing new operation names.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Flow</th>
              <th>Shared API</th>
              <th>Framework note</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Product and subscription loading</td>
              <td>
                <CodeLink to="/docs/apis/fetch-products">
                  fetchProducts
                </CodeLink>
              </td>
              <td>
                Available in Expo, React Native, Flutter, Kotlin Multiplatform,
                .NET MAUI, and Godot with the same OpenIAP operation name.
              </td>
            </tr>
            <tr>
              <td>Starting a purchase</td>
              <td>
                <CodeLink to="/docs/apis/request-purchase">
                  requestPurchase
                </CodeLink>
              </td>
              <td>
                The request shape changes by language, but the flow stays the
                same: pass one Amazon SKU, wait for the purchase update, then
                verify.
              </td>
            </tr>
            <tr>
              <td>Restore and entitlement recovery</td>
              <td>
                <CodeLink to="/docs/apis/get-available-purchases">
                  getAvailablePurchases
                </CodeLink>
              </td>
              <td>
                Use this after launch, after restore, and after finishing a
                transaction to rebuild local entitlement state.
              </td>
            </tr>
            <tr>
              <td>Managed verification</td>
              <td>
                <CodeLink to="/docs/features/validation#verify-purchase-with-provider">
                  verifyPurchaseWithProvider
                </CodeLink>
              </td>
              <td>
                For Amazon, pass the IAPKit Amazon payload with the receipt ID;
                the provider path can resolve the Amazon user ID when supported
                by the platform adapter.
              </td>
            </tr>
            <tr>
              <td>Final fulfillment</td>
              <td>
                <CodeLink to="/docs/apis/finish-transaction">
                  finishTransaction
                </CodeLink>
              </td>
              <td>
                Finish after verification. Consumables are consumed; owned
                products and subscriptions are fulfilled without consuming.
              </td>
            </tr>
          </tbody>
        </table>
        <CodeBlock language="typescript">{`import {
  type Purchase,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  verifyPurchaseWithProvider,
} from 'expo-iap';
// React Native uses the same top-level API names from 'react-native-iap'.

const products = await fetchProducts({
  skus: ['dev.hyo.martie.10bulbs'],
  type: 'in-app',
});
const [product] = products ?? [];
if (!product) throw new Error('Amazon product not found');

await requestPurchase({
  request: { google: { skus: [product.id] } },
  type: 'in-app',
});

async function onPurchaseUpdated(purchase: Purchase) {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      amazon: {
        receiptId: purchase.purchaseToken ?? purchase.id,
        sandbox: true,
      },
    },
  });

  if (result.iapkit?.isValid) {
    await finishTransaction({ purchase, isConsumable: true });
    await getAvailablePurchases();
  }
}`}</CodeBlock>
        <p>
          In Expo and React Native, Android purchase request props are named{' '}
          <code>google</code> because they share the Android request shape; the
          Fire OS build selects the Amazon native module underneath. Flutter,
          Kotlin Multiplatform, .NET MAUI, and Godot expose the same operations
          as instance, suspend, async, or script calls. The article can
          therefore show Fire OS once at the store layer, then point each
          framework section back to the same OpenIAP lifecycle.
        </p>
      </section>

      <section>
        <AnchorLink id="video-script" level="h2">
          Video Script
        </AnchorLink>
        <p>
          Keep each clip short, but make the action and the evidence visible.
          This structure gives a joint article/video a clean sequence instead of
          a raw list of recordings.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Clip</th>
              <th>Open with</th>
              <th>Close on</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Overview</td>
              <td>
                Show the Amazon Fire OS badge and explain that this is the
                Amazon flavor of the shared OpenIAP example app.
              </td>
              <td>
                Land on the three menus: purchase flow, subscription flow, and
                available purchases.
              </td>
            </tr>
            <tr>
              <td>Purchase Flow</td>
              <td>
                Show the verification selector, then the Amazon product rows.
              </td>
              <td>
                Show the purchase result or the tester/catalog requirement if
                the store sheet cannot proceed.
              </td>
            </tr>
            <tr>
              <td>Subscription Flow</td>
              <td>
                Show monthly and annual subscription rows loaded through
                OpenIAP.
              </td>
              <td>
                Show the Amazon-specific subscription management language.
              </td>
            </tr>
            <tr>
              <td>Available Purchases</td>
              <td>Tap refresh or restore.</td>
              <td>
                Show restored count, grouped purchase rows, or the empty state
                with the Amazon Appstore account wording.
              </td>
            </tr>
            <tr>
              <td>IAPKit Verification</td>
              <td>Show the configured IAPKit option.</td>
              <td>
                Explain that Amazon receipts go through the{' '}
                <code>iapkit.amazon</code> payload before the app finishes the
                transaction.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="build-run" level="h2">
          Build and Run
        </AnchorLink>
        <p>
          Source: <code>packages/google/Example/</code>
        </p>
        <CodeBlock language="bash">{`cd packages/google
./gradlew :Example:assembleAmazonDebug
./gradlew :Example:installAmazonDebug

adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1`}</CodeBlock>
        <p>
          Live Amazon purchases require Amazon Appstore tester setup, matching
          product IDs, and a Fire OS device signed in with an eligible Amazon
          account. The debug build is still useful for adapter wiring, UI
          walkthroughs, and video capture.
        </p>
      </section>

      <section>
        <AnchorLink id="iapkit-key" level="h2">
          IAPKit Key
        </AnchorLink>
        <p>
          IAPKit is the managed verification backend for this example. Configure
          the project key from{' '}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
            onClick={trackIapKitClick}
          >
            kit.openiap.dev
          </a>{' '}
          before recording the verification clip.
        </p>
        <CodeBlock language="properties">{`# packages/google/local.properties
iapkit.api.key=openiap-kit_<your-key>`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="recording-script" level="h2">
          Recording Script
        </AnchorLink>
        <p>
          Record each feature separately so the article can embed short clips
          beside the matching explanation.
        </p>
        <CodeBlock language="bash">{`mkdir -p packages/docs/public/examples/amazon/videos

adb shell screenrecord /sdcard/fireos-overview.mp4
adb pull /sdcard/fireos-overview.mp4 \\
  packages/docs/public/examples/amazon/videos/fireos-overview.mp4

adb shell screenrecord /sdcard/fireos-inapp.mp4
adb pull /sdcard/fireos-inapp.mp4 \\
  packages/docs/public/examples/amazon/videos/fireos-inapp.mp4

adb shell screenrecord /sdcard/fireos-subscription.mp4
adb pull /sdcard/fireos-subscription.mp4 \\
  packages/docs/public/examples/amazon/videos/fireos-subscription.mp4

adb shell screenrecord /sdcard/fireos-available-purchases.mp4
adb pull /sdcard/fireos-available-purchases.mp4 \\
  packages/docs/public/examples/amazon/videos/fireos-available-purchases.mp4

adb shell screenrecord /sdcard/fireos-verification.mp4
adb pull /sdcard/fireos-verification.mp4 \\
  packages/docs/public/examples/amazon/videos/fireos-verification.mp4`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="source" level="h2">
          Source
        </AnchorLink>
        <p>
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/packages/google/Example"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            View Fire OS Example on GitHub
          </a>
        </p>
      </section>
    </div>
  );
}

export default FireOSExample;
