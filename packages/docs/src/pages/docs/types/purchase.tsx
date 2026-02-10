import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesPurchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Purchase Types"
        description="OpenIAP Purchase type definitions - Purchase, PurchaseState, ActiveSubscription for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/purchase"
        keywords="IAP types, Purchase, PurchaseState, ActiveSubscription, TypeScript, Swift, Kotlin"
      />
      <h1>Purchase Types</h1>
      <p>
        Type definitions for purchase transactions and active subscriptions.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#purchase"><code>Purchase</code></a> - Union of PurchaseIOS and PurchaseAndroid
          </li>
          <li>
            <a href="#purchase-state"><code>PurchaseState</code></a> - Pending, Purchased, Unknown
          </li>
          <li>
            <a href="#active-subscription"><code>ActiveSubscription</code></a> - Unified subscription status view
          </li>
          <li>
            <a href="#renewal-info-ios"><code>renewalInfoIOS</code></a> - iOS renewal details (auto-renew,
            expiration reason)
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="purchase" level="h2">
          Purchase
        </AnchorLink>
        <p>
          Represents a completed or pending purchase transaction. The type is a
          union of <code>PurchaseIOS</code> and <code>PurchaseAndroid</code>,
          discriminated by the <code>platform</code> field.
        </p>

        <AnchorLink id="purchase-state" level="h3">
          PurchaseState
        </AnchorLink>
        <p>Enum representing the current state of a purchase:</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
              <th>Platform</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>Pending</code>
              </td>
              <td>Purchase initiated, awaiting completion</td>
              <td>Android</td>
            </tr>
            <tr>
              <td>
                <code>Purchased</code>
              </td>
              <td>Payment successful, needs validation</td>
              <td>iOS, Android</td>
            </tr>
            <tr>
              <td>
                <code>Unknown</code>
              </td>
              <td>State could not be determined</td>
              <td>Android</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Note: iOS StoreKit 2 only returns <code>Transaction</code> objects on successful purchases,
          so iOS purchases always have <code>Purchased</code> state. See{' '}
          <a href="/docs/updates/notes#gql-1-3-11-google-1-3-20">release notes</a> for details.
        </p>

        <AnchorLink id="purchase-common" level="h3">
          Common Fields
        </AnchorLink>
        <p>These fields are available on both iOS and Android:</p>
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
                <code>id</code>
              </td>
              <td>
                Purchase identifier (primary key). Maps to orderId on Android,
                transactionId on iOS
              </td>
            </tr>
            <tr>
              <td>
                <code>productId</code>
              </td>
              <td>Product identifier that was purchased</td>
            </tr>
            <tr>
              <td>
                <code>ids</code>
              </td>
              <td>Array of SKUs for bundled purchases (optional)</td>
            </tr>
            <tr>
              <td>
                <code>transactionDate</code>
              </td>
              <td>Transaction timestamp (epoch ms)</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
              </td>
              <td>
                JWS token (iOS) or Play purchase token (Android) for server
                validation
              </td>
            </tr>
            <tr>
              <td>
                <code>store</code>
              </td>
              <td>
                Store discriminator: <code>"apple"</code>,{' '}
                <code>"google"</code>, or <code>"horizon"</code>
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>platform</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>
                Use <code>store</code> instead
              </td>
            </tr>
            <tr>
              <td>
                <code>quantity</code>
              </td>
              <td>Number of items purchased</td>
            </tr>
            <tr>
              <td>
                <code>purchaseState</code>
              </td>
              <td>Current purchase state (see PurchaseState above)</td>
            </tr>
            <tr>
              <td>
                <code>isAutoRenewing</code>
              </td>
              <td>Whether subscription will auto-renew</td>
            </tr>
            <tr>
              <td>
                <code>currentPlanId</code>
              </td>
              <td>
                Unified plan identifier. On Android: basePlanId (e.g.,
                "premium"). On iOS: productId (e.g.,
                "com.example.premium_monthly"). <strong>⚠️ Android:</strong> May
                be inaccurate for multi-plan subscriptions. See{' '}
                <a href="/docs/apis/debugging#android-baseplanid-limitation">
                  limitation
                </a>
                .
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The shared <code>id</code> field maps to Google Play&apos;s{' '}
          <code>orderId</code>. When Play omits it—common for consumables—the
          SDK falls back to the long <code>purchaseToken</code> so you retain a
          stable primary key.
        </p>

        <AnchorLink id="purchase-platform" level="h3">
          Platform-Specific Fields
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="purchase-ios" level="h4">
                  PurchaseIOS
                </AnchorLink>
                <p>Additional fields available on iOS:</p>
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
                        <code>quantityIOS</code>
                      </td>
                      <td>Purchase quantity (iOS-specific)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>originalTransactionDateIOS</code>
                      </td>
                      <td>
                        Original purchase timestamp (for renewals/restores)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>originalTransactionIdentifierIOS</code>
                      </td>
                      <td>Original transaction ID (links renewal chain)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>appAccountToken</code>
                      </td>
                      <td>
                        Your server's user identifier (UUID you provided at
                        purchase). Only returned if a valid UUID format was
                        provided during purchase—non-UUID values result in{' '}
                        <code>null</code>.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>expirationDateIOS</code>
                      </td>
                      <td>Subscription expiration timestamp</td>
                    </tr>
                    <tr>
                      <td>
                        <code>webOrderLineItemIdIOS</code>
                      </td>
                      <td>Web order line item ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>environmentIOS</code>
                      </td>
                      <td>Environment: "Sandbox" or "Production"</td>
                    </tr>
                    <tr>
                      <td>
                        <code>storefrontCountryCodeIOS</code>
                      </td>
                      <td>Storefront country code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>appBundleIdIOS</code>
                      </td>
                      <td>App bundle identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionGroupIdIOS</code>
                      </td>
                      <td>Subscription group identifier</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isUpgradedIOS</code>
                      </td>
                      <td>True if this transaction was upgraded</td>
                    </tr>
                    <tr>
                      <td>
                        <code>ownershipTypeIOS</code>
                      </td>
                      <td>Ownership type (purchased, family shared)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionReasonIOS</code>
                      </td>
                      <td>Reason: "PURCHASE" or "RENEWAL"</td>
                    </tr>
                    <tr>
                      <td>
                        <code>revocationDateIOS</code>
                      </td>
                      <td>Revocation timestamp (if refunded)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>revocationReasonIOS</code>
                      </td>
                      <td>Revocation reason</td>
                    </tr>
                    <tr>
                      <td>
                        <code>offerIOS</code>
                      </td>
                      <td>
                        Applied offer details. Contains: <code>id</code>,{' '}
                        <code>type</code>, <code>paymentMode</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>currencyCodeIOS</code>
                      </td>
                      <td>ISO 4217 currency code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>currencySymbolIOS</code>
                      </td>
                      <td>Currency symbol</td>
                    </tr>
                    <tr>
                      <td>
                        <code>countryCodeIOS</code>
                      </td>
                      <td>Country code</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalInfoIOS</code>
                      </td>
                      <td>
                        Subscription renewal information (see RenewalInfoIOS
                        below)
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '1rem' }}>
                  <AnchorLink id="renewal-info-ios" level="h4">
                    RenewalInfoIOS{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                      (from{' '}
                      <a
                        href="https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Product.SubscriptionInfo.RenewalInfo
                      </a>
                      )
                    </span>
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
                          <code>willAutoRenew</code>
                        </td>
                        <td>Whether subscription will automatically renew</td>
                      </tr>
                      <tr>
                        <td>
                          <code>autoRenewPreference</code>
                        </td>
                        <td>
                          Product ID the subscription will renew to (may differ
                          if upgrade/downgrade pending)
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>expirationReason</code>
                        </td>
                        <td>
                          Why subscription expired: "VOLUNTARY",
                          "BILLING_ERROR", "DID_NOT_AGREE_TO_PRICE_INCREASE",
                          "PRODUCT_NOT_AVAILABLE", "UNKNOWN"
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>gracePeriodExpirationDate</code>
                        </td>
                        <td>Grace period end timestamp (epoch ms)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>isInBillingRetry</code>
                        </td>
                        <td>True if retrying after billing failure</td>
                      </tr>
                      <tr>
                        <td>
                          <code>pendingUpgradeProductId</code>
                        </td>
                        <td>Product ID for pending upgrade/downgrade</td>
                      </tr>
                      <tr>
                        <td>
                          <code>priceIncreaseStatus</code>
                        </td>
                        <td>
                          Price increase response: "AGREED", "PENDING", or null
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalDate</code>
                        </td>
                        <td>Expected renewal timestamp (epoch ms)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalOfferId</code>
                        </td>
                        <td>Offer ID for next renewal</td>
                      </tr>
                      <tr>
                        <td>
                          <code>renewalOfferType</code>
                        </td>
                        <td>
                          Offer type: "PROMOTIONAL", "SUBSCRIPTION_OFFER_CODE",
                          "WIN_BACK"
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ),
            android: (
              <>
                <AnchorLink id="purchase-android" level="h4">
                  PurchaseAndroid
                </AnchorLink>
                <p>Additional fields available on Android:</p>
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
                        <code>dataAndroid</code>
                      </td>
                      <td>Raw JSON purchase data for server validation</td>
                    </tr>
                    <tr>
                      <td>
                        <code>transactionId</code>
                      </td>
                      <td>Transaction ID (orderId)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>signatureAndroid</code>
                      </td>
                      <td>INAPP_DATA_SIGNATURE for verification</td>
                    </tr>
                    <tr>
                      <td>
                        <code>autoRenewingAndroid</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isAcknowledgedAndroid</code>
                      </td>
                      <td>
                        Whether purchase has been acknowledged (must be done
                        within 3 days)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>packageNameAndroid</code>
                      </td>
                      <td>Application package name</td>
                    </tr>
                    <tr>
                      <td>
                        <code>developerPayloadAndroid</code>
                      </td>
                      <td>Developer-specified payload string</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedAccountIdAndroid</code>
                      </td>
                      <td>Obfuscated account ID you provided</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedProfileIdAndroid</code>
                      </td>
                      <td>Obfuscated profile ID you provided</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isSuspendedAndroid</code>
                      </td>
                      <td>
                        Whether the subscription is suspended due to payment
                        failure. Suspended subscriptions should NOT grant
                        entitlements - direct users to the subscription center
                        to resolve payment issues. (
                        <a
                          href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Billing Library 8.1.0+
                        </a>
                        )
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>pendingPurchaseUpdateAndroid</code>
                      </td>
                      <td>
                        Pending subscription upgrade/downgrade details. When a user
                        initiates a plan change, this contains the new product IDs
                        and purchase token for the pending transaction. Returns null
                        if no pending update exists. See{' '}
                        <a href="#pending-purchase-update-android">
                          PendingPurchaseUpdateAndroid
                        </a>{' '}
                        below. (
                        <a
                          href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PendingPurchaseUpdate"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Billing Library 5.0+
                        </a>
                        )
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '1rem' }}>
                  <AnchorLink id="pending-purchase-update-android" level="h4">
                    PendingPurchaseUpdateAndroid{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                      (from{' '}
                      <a
                        href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PendingPurchaseUpdate"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Purchase.PendingPurchaseUpdate
                      </a>
                      )
                    </span>
                  </AnchorLink>
                  <p>
                    Contains details about a pending subscription upgrade or downgrade.
                    When a user changes their subscription plan, the new plan may be
                    pending until the current billing period ends.
                  </p>
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
                          <code>products</code>
                        </td>
                        <td>
                          List of product IDs for the pending purchase update.
                          These are the new products the user is switching to.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>purchaseToken</code>
                        </td>
                        <td>
                          Unique token identifying the pending transaction.
                          Use this to track or manage the pending update.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="active-subscription" level="h2">
          ActiveSubscription
        </AnchorLink>
        <p>
          Represents an active subscription returned by{' '}
          <code>getActiveSubscriptions()</code>. Provides a unified view of
          subscription status across platforms.
        </p>

        <AnchorLink id="active-subscription-common" level="h3">
          Common Fields
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
                <code>productId</code>
              </td>
              <td>Subscription product identifier</td>
            </tr>
            <tr>
              <td>
                <code>isActive</code>
              </td>
              <td>Whether the subscription is currently active</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>willExpireSoon</code>{' '}
                <span className="deprecated">deprecated</span>
              </td>
              <td>
                iOS only - returns null on Android. Use{' '}
                <code>daysUntilExpirationIOS</code> for more precise control.
              </td>
            </tr>
            <tr>
              <td>
                <code>transactionId</code>
              </td>
              <td>Transaction identifier for backend validation</td>
            </tr>
            <tr>
              <td>
                <code>purchaseToken</code>
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
              <td>Transaction timestamp (epoch ms)</td>
            </tr>
            <tr>
              <td>
                <code>currentPlanId</code>
              </td>
              <td>
                Unified plan identifier. On Android: basePlanId (e.g.,
                "premium"). On iOS: productId (e.g.,
                "com.example.premium_monthly"). <strong>⚠️ Android:</strong> May
                be inaccurate for multi-plan subscriptions. See{' '}
                <a href="/docs/apis/debugging#android-baseplanid-limitation">
                  limitation
                </a>
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
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>expirationDateIOS</code>
                      </td>
                      <td>Expiration timestamp (epoch ms)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>environmentIOS</code>
                      </td>
                      <td>Environment: "Sandbox" or "Production"</td>
                    </tr>
                    <tr>
                      <td>
                        <code>daysUntilExpirationIOS</code>
                      </td>
                      <td>Days until expiration</td>
                    </tr>
                    <tr>
                      <td>
                        <code>renewalInfoIOS</code>
                      </td>
                      <td>
                        Subscription renewal details (see{' '}
                        <a href="#renewal-info-ios">RenewalInfoIOS</a>)
                      </td>
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
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>autoRenewingAndroid</code>
                      </td>
                      <td>Whether subscription will auto-renew</td>
                    </tr>
                    <tr>
                      <td>
                        <code>basePlanIdAndroid</code>
                      </td>
                      <td>
                        Base plan identifier. <strong>⚠️</strong> May be
                        inaccurate for multi-plan subscriptions. See{' '}
                        <a href="/docs/apis/debugging#android-baseplanid-limitation">
                          limitation
                        </a>
                        .
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>purchaseTokenAndroid</code>
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

export default TypesPurchase;
