import AnchorLink from '../../../components/AnchorLink';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function VerifyPurchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="VerifyPurchase Types"
        description="VerifyPurchase Types type definition and field reference."
        path="/docs/types/verify-purchase"
        keywords="VerifyPurchase Types, OpenIAP types, Verify Purchase  Types"
      />
      <h1>VerifyPurchase Types</h1>
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
                Apple App Store verification options. Contains: <code>sku</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                Google Play verification options. Contains: <code>sku</code>,{' '}
                <code>packageName</code>, <code>purchaseToken</code>,{' '}
                <code>accessToken</code>, <code>isSub</code>
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
                        <code>deferredDate</code>
                      </td>
                      <td>
                        Deferred replacement date (when an upgrade/downgrade
                        will take effect)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>deferredSku</code>
                      </td>
                      <td>SKU the subscription will switch to on deferral</td>
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
                        <code>parentProductId</code>
                      </td>
                      <td>
                        Parent subscription product ID (when this purchase is a
                        base-plan child)
                      </td>
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
                        <code>receiptId</code>
                      </td>
                      <td>Google Play receipt identifier</td>
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
                        <code>termSku</code>
                      </td>
                      <td>SKU associated with the subscription term</td>
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
    </div>
  );
}

export default VerifyPurchase;
