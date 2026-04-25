import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ActiveSubscription() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ActiveSubscription"
        description="ActiveSubscription type definition and field reference."
        path="/docs/types/active-subscription"
        keywords="ActiveSubscription, OpenIAP types, Active Subscription"
      />
      <h1>ActiveSubscription</h1>
      <section>
        <AnchorLink id="active-subscription" level="h2">
          ActiveSubscription
        </AnchorLink>
        <p>
          Represents an active subscription returned by{' '}
          <Link to="/docs/apis/get-active-subscriptions">
            <code>getActiveSubscriptions()</code>
          </Link>
          . Provides a unified view of subscription status across platforms.
        </p>

        <AnchorLink id="active-subscription-common" level="h3">
          Common Fields
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
                <code>productId</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Subscription product identifier</td>
            </tr>
            <tr>
              <td>
                <code>isActive</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Whether the subscription is currently active</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>
                  willExpireSoon
                </code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                <strong>Deprecated.</strong> iOS only — returns null on Android.
                Use <code>daysUntilExpirationIOS</code> for more precise
                control.
              </td>
            </tr>
            <tr>
              <td>
                <code>transactionId</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Transaction identifier for backend validation</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                JWS token (iOS) or purchase token (Android) for server
                validation
              </td>
            </tr>
            <tr>
              <td>
                <code>transactionDate</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Transaction timestamp (epoch ms)</td>
            </tr>
            <tr>
              <td>
                <code>currentPlanId</code>
              </td>
              <td>
                <code>string?</code>
              </td>
              <td>
                Unified plan identifier. On Android: basePlanId (e.g.,
                "premium"). On iOS: productId (e.g.,
                "com.example.premium_monthly"). <strong>⚠️ Android:</strong> May
                be inaccurate for multi-plan subscriptions. See{' '}
                <Link to="/docs/features/debugging#android-baseplanid-limitation">
                  limitation
                </Link>
                .
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="active-subscription-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="active-subscription-ios" level="h4">
                  ActiveSubscriptionIOS
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
                        <code>expirationDateIOS</code>
                      </td>
                      <td>
                        <code>number?</code>
                      </td>
                      <td>Expiration timestamp (epoch ms)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>environmentIOS</code>
                      </td>
                      <td>
                        <code>"Sandbox" | "Production"</code>
                      </td>
                      <td>StoreKit environment</td>
                    </tr>
                    <tr>
                      <td>
                        <code>daysUntilExpirationIOS</code>
                      </td>
                      <td>
                        <code>number?</code>
                      </td>
                      <td>Days until expiration</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalInfoIOS</code>
                      </td>
                      <td>
                        <Link to="/docs/types/ios/renewal-info-ios">
                          <code>RenewalInfoIOS?</code>
                        </Link>
                      </td>
                      <td>Subscription renewal details</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="active-subscription-android" level="h4">
                  ActiveSubscriptionAndroid
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
                        <code>autoRenewingAndroid</code>
                      </td>
                      <td>
                        <code>boolean?</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>basePlanIdAndroid</code>
                      </td>
                      <td>
                        <code>string?</code>
                      </td>
                      <td>
                        Base plan identifier. <strong>⚠️</strong> May be
                        inaccurate for multi-plan subscriptions. See{' '}
                        <Link to="/docs/features/debugging#android-baseplanid-limitation">
                          limitation
                        </Link>
                        .
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>purchaseTokenAndroid</code>
                      </td>
                      <td>
                        <code>string?</code>
                      </td>
                      <td>Purchase token for upgrade/downgrade operations</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="active-subscription-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Check for pending upgrades
if (subscription.renewalInfoIOS?.pendingUpgradeProductId) {
  console.log('Upgrade pending to:', subscription.renewalInfoIOS.pendingUpgradeProductId);
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew === false) {
  console.log('Subscription will not auto-renew');
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Check for pending upgrades
if let pendingProductId = subscription.renewalInfoIOS?.pendingUpgradeProductId {
    print("Upgrade pending to: \\(pendingProductId)")
}

// Check if subscription is cancelled
if subscription.renewalInfoIOS?.willAutoRenew == false {
    print("Subscription will not auto-renew")
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Check for pending upgrades
subscription.renewalInfoIOS?.pendingUpgradeProductId?.let { pendingProductId ->
    println("Upgrade pending to: $pendingProductId")
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew == false) {
    println("Subscription will not auto-renew")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Check for pending upgrades
if (subscription.renewalInfoIOS?.pendingUpgradeProductId != null) {
  print('Upgrade pending to: \${subscription.renewalInfoIOS!.pendingUpgradeProductId}');
}

// Check if subscription is cancelled
if (subscription.renewalInfoIOS?.willAutoRenew == false) {
  print('Subscription will not auto-renew');
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Check for pending upgrades
if subscription.renewal_info_ios != null:
    if subscription.renewal_info_ios.pending_upgrade_product_id != "":
        print("Upgrade pending to: %s" % subscription.renewal_info_ios.pending_upgrade_product_id)

# Check if subscription is cancelled
if subscription.renewal_info_ios != null:
    if subscription.renewal_info_ios.will_auto_renew == false:
        print("Subscription will not auto-renew")`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default ActiveSubscription;
