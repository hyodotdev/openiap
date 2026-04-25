import AnchorLink from '../../../components/AnchorLink';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Purchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Purchase"
        description="Purchase type definition and field reference."
        path="/docs/types/purchase"
        keywords="Purchase, OpenIAP types, Purchase"
      />
      <h1>Purchase</h1>
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
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginTop: '0.5rem',
          }}
        >
          Note: iOS StoreKit 2 only returns <code>Transaction</code> objects on
          successful purchases, so iOS purchases always have{' '}
          <code>Purchased</code> state. See{' '}
          <a href="/docs/updates/releases#spec-1-3-11-google-1-3-20-apple-1-3-9">
            release notes
          </a>{' '}
          for details.
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
                Store discriminator: <code>"apple"</code>, <code>"google"</code>
                , or <code>"horizon"</code>
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>platform</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>store</code> instead.
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
                <a href="/docs/features/debugging#android-baseplanid-limitation">
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
                        <code>reasonIOS</code>
                      </td>
                      <td>
                        StoreKit 2 transaction reason (StoreKit raw value)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>reasonStringRepresentationIOS</code>
                      </td>
                      <td>String representation of the reason value</td>
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
                    <tr>
                      <td>
                        <code>advancedCommerceInfoIOS</code>
                      </td>
                      <td>
                        Advanced Commerce API metadata (iOS 18.4+, see{' '}
                        <a href="#advanced-commerce-info-ios">
                          AdvancedCommerceInfoIOS
                        </a>{' '}
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
                      <tr>
                        <td>
                          <code>jsonRepresentation</code>
                        </td>
                        <td>
                          Raw JWS representation of the StoreKit renewal info —
                          useful for server-side validation.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <AnchorLink id="advanced-commerce-info-ios" level="h4">
                    AdvancedCommerceInfoIOS{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                      (iOS 18.4+, from{' '}
                      <a
                        href="https://developer.apple.com/documentation/storekit/transaction/advancedcommerceinfo"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Transaction.AdvancedCommerceInfo
                      </a>
                      )
                    </span>
                  </AnchorLink>
                  <p>
                    Present only for transactions using the Advanced Commerce
                    API with generic SKU purchases.
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
                          <code>items</code>
                        </td>
                        <td>Items purchased in this transaction</td>
                      </tr>
                      <tr>
                        <td>
                          <code>requestReferenceId</code>
                        </td>
                        <td>
                          Request reference identifier for tracking (optional)
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <code>taxCode</code>
                        </td>
                        <td>Tax code for the transaction (optional)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>taxExclusivePrice</code>
                        </td>
                        <td>Price excluding tax, decimal string (optional)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>estimatedTax</code>
                        </td>
                        <td>Estimated tax amount, decimal string (optional)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>taxRate</code>
                        </td>
                        <td>Tax rate applied, decimal string (optional)</td>
                      </tr>
                      <tr>
                        <td>
                          <code>displayName</code>
                        </td>
                        <td>Optional display name</td>
                      </tr>
                      <tr>
                        <td>
                          <code>description</code>
                        </td>
                        <td>Optional description</td>
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
                        Pending subscription upgrade/downgrade details. When a
                        user initiates a plan change, this contains the new
                        product IDs and purchase token for the pending
                        transaction. Returns null if no pending update exists.
                        See{' '}
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
                    Contains details about a pending subscription upgrade or
                    downgrade. When a user changes their subscription plan, the
                    new plan may be pending until the current billing period
                    ends.
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
                          Unique token identifying the pending transaction. Use
                          this to track or manage the pending update.
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
    </div>
  );
}

export default Purchase;
