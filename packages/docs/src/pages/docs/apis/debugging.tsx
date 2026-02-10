import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import IapKitBanner from '../../../components/IapKitBanner';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function DebuggingAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Debugging APIs"
        description="OpenIAP debugging and logging APIs - enable verbose logging and understand common warning messages."
        path="/docs/apis/debugging"
        keywords="debugging, logging, OpenIapLog, basePlanId limitation"
      />
      <h1>Debugging & Logging</h1>
      <p>
        Enable verbose logging to see internal operations, warnings, and debug
        information during development.
      </p>

      <TLDRBox>
        <ul>
          <li>Logging is disabled by default in production</li>
          <li>
            <a href="#enable-logging">Enable with <code>OpenIapLog.enable(true)</code></a>
          </li>
          <li>
            <a href="#common-warnings">Android basePlanId limitation</a>: Use client-side tracking or backend
            validation
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="enable-logging" level="h2">
          Enable Logging
        </AnchorLink>
        <p>
          Logging is <strong>disabled by default</strong> in production. Enable
          it only during development.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <CodeBlock language="swift">{`// Enable logging for debug builds only
#if DEBUG
OpenIapLog.enable(true)
#endif

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
            android: (
              <CodeBlock language="kotlin">{`// Enable logging for debug builds only
if (BuildConfig.DEBUG) {
    OpenIapLog.enable(true)
}

// Or enable unconditionally
OpenIapLog.enable(true)

// Disable logging
OpenIapLog.enable(false)`}</CodeBlock>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="android-baseplanid-limitation" level="h2">
          Android basePlanId Limitation
        </AnchorLink>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Critical Limitation:</strong> On Android, the{' '}
            <code>currentPlanId</code> and <code>basePlanIdAndroid</code> fields
            may return incorrect values for subscription groups with multiple
            base plans.
          </p>
        </div>

        <h4>Root Cause</h4>
        <p>
          Google Play Billing API's <code>Purchase</code> object does NOT
          include <code>basePlanId</code> information. When a subscription group
          has multiple base plans (weekly, monthly, yearly), there is no way to
          determine which specific plan was purchased from the client-side{' '}
          <code>Purchase</code> object.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Warning log you may see:</strong>
          </p>
          <code>
            Multiple offers (3) found for premium_subscription, using first
            basePlanId (may be inaccurate)
          </code>
        </div>

        <h4>What Works Correctly</h4>
        <ul>
          <li>
            <code>productId</code> - Subscription group ID
          </li>
          <li>
            <code>purchaseToken</code> - Purchase token
          </li>
          <li>
            <code>isActive</code> - Subscription active status
          </li>
          <li>
            <code>transactionId</code> - Transaction ID
          </li>
        </ul>

        <h4>What May Be Incorrect</h4>
        <ul>
          <li>
            <code>currentPlanId</code> / <code>basePlanIdAndroid</code> - May
            return first plan instead of purchased plan
          </li>
        </ul>

        <AnchorLink id="solutions" level="h3">
          Solutions
        </AnchorLink>

        <h4>1. Client-side Tracking (Recommended for most apps)</h4>
        <CodeBlock language="typescript">{`// Track basePlanId yourself during the purchase flow

// 1. Store basePlanId BEFORE calling requestPurchase
let purchasedBasePlanId: string | null = null;

const handlePurchase = async (basePlanId: string) => {
  // Use subscriptionOffers (cross-platform standardized type)
  const offers = product.subscriptionOffers ?? [];
  const offer = offers.find(o => o.basePlanIdAndroid === basePlanId && !o.id);

  // Store it before purchase
  purchasedBasePlanId = basePlanId;

  await requestPurchase({
    request: {
      google: {
        skus: [subscriptionGroupId],
        subscriptionOffers: [
          { sku: subscriptionGroupId, offerToken: offer?.offerTokenAndroid },
        ],
      },
    },
    type: 'subs',
  });
};

// 2. Use YOUR tracked value in onPurchaseSuccess
onPurchaseSuccess: async (purchase) => {
  // DON'T rely on purchase.currentPlanId - it may be wrong!
  const actualBasePlanId = purchasedBasePlanId;

  // Save to your backend
  await saveToBackend({
    purchaseToken: purchase.purchaseToken,
    basePlanId: actualBasePlanId,  // Use YOUR tracked value
    productId: purchase.productId,
  });
}`}</CodeBlock>

        <h4>2. IAPKit Backend Validation (Recommended)</h4>
        <IapKitBanner />
        <p>
          Use{' '}
          <code>verifyPurchaseWithProvider</code> with IAPKit to get accurate{' '}
          <code>basePlanId</code> from Google Play Developer API. The response
          includes <code>offerDetails.basePlanId</code>:
        </p>
        <CodeBlock language="typescript">{`import { verifyPurchaseWithProvider } from 'expo-iap';

const result = await verifyPurchaseWithProvider({
  provider: 'iapkit',
  iapkit: {
    apiKey: 'your-iapkit-api-key',
    google: { purchaseToken: purchase.purchaseToken },
  },
});

// Access basePlanId from the response
const basePlanId = result.iapkit?.google?.lineItems?.[0]?.offerDetails?.basePlanId;
console.log('Actual basePlanId:', basePlanId);`}</CodeBlock>

        <h4>3. Single Base Plan Per Subscription Group</h4>
        <p>
          If your subscription group has only one base plan, the{' '}
          <code>basePlanId</code> will always be accurate. This is the simplest
          solution if your product design allows it.
        </p>

        <div className="alert-card alert-card--info">
          <p>
            <strong>Note:</strong> This is a fundamental limitation of Google
            Play Billing API, not a bug in this library. The{' '}
            <code>Purchase</code> object from Google simply does not include{' '}
            <code>basePlanId</code> information.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="common-warnings" level="h2">
          Common Warnings
        </AnchorLink>
        <p>
          When logging is enabled, you may see these warnings about specific
          scenarios:
        </p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Warning</th>
              <th>Meaning</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>Multiple offers found</code>
              </td>
              <td>Multiple base plans exist for subscription</td>
              <td>
                Use client-side tracking or backend validation for accurate
                basePlanId
              </td>
            </tr>
            <tr>
              <td>
                <code>Connection not initialized</code>
              </td>
              <td>IAP operation called before initConnection()</td>
              <td>
                Call{' '}
                <Link to="/docs/apis/connection#init-connection">
                  initConnection()
                </Link>{' '}
                first
              </td>
            </tr>
            <tr>
              <td>
                <code>Transaction not finished</code>
              </td>
              <td>Purchase completed but finishTransaction not called</td>
              <td>
                Call{' '}
                <Link to="/docs/apis/purchase#finish-transaction">
                  finishTransaction()
                </Link>{' '}
                after verification
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default DebuggingAPIs;
