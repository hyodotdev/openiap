import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RequestPurchaseProps() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="RequestPurchaseProps"
        description="RequestPurchaseProps type definition and field reference."
        path="/docs/types/request-purchase-props"
        keywords="RequestPurchaseProps, OpenIAP types, Request Purchase Props"
      />
      <h1>RequestPurchaseProps</h1>
      <section>
        <AnchorLink id="request-types" level="h2">
          Request Types
        </AnchorLink>
        <p>
          Types used when initiating purchases via{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase()</code>
          </Link>
          .
        </p>
        <p>
          Discriminated input to <code>requestPurchase</code> (
          <code>type: &apos;in-app&apos; | &apos;subs&apos;</code>).{' '}
          <strong>iOS:</strong> maps to <code>Product.purchase(options:)</code>{' '}
          (
          <a
            href="https://developer.apple.com/documentation/storekit/product/purchase(options:)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ). <strong>Android:</strong> maps to{' '}
          <code>BillingClient.launchBillingFlow</code> (
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#launchBillingFlow(android.app.Activity,com.android.billingclient.api.BillingFlowParams)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/purchase(options:)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.purchase(options:)
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · BillingFlowParams
          </a>
        </p>

        <AnchorLink id="request-purchase-props" level="h3">
          RequestPurchaseProps
        </AnchorLink>
        <p>
          Top-level arguments for{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase()</code>
          </Link>
          . Wraps platform-specific props with a type discriminator.
        </p>

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
                <code>request</code>
              </td>
              <td>
                <Link to="/docs/types/request-purchase-props#request-purchase-props-by-platforms">
                  <code>RequestPurchasePropsByPlatforms</code>
                </Link>{' '}
                | <code>RequestSubscriptionPropsByPlatforms</code>
              </td>
              <td>
                Platform-specific parameters matching <code>type</code>.
                Generated native types expose a purchase/subscription union (or
                separate <code>requestPurchase</code> and{' '}
                <code>requestSubscription</code> fields) so a subscription
                cannot be encoded as a one-time request.
              </td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                <code>"in-app" | "subs"</code>
              </td>
              <td>Purchase type discriminator</td>
            </tr>
            <tr>
              <td>
                <code>useAlternativeBilling</code>
              </td>
              <td>
                <code>boolean?</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use{' '}
                <Link to="/docs/apis/android/enable-billing-program-android">
                  <code>enableBillingProgramAndroid</code>
                </Link>{' '}
                in{' '}
                <Link to="/docs/types/alternative-billing-types">
                  <code>InitConnectionConfig</code>
                </Link>{' '}
                instead. This flag only logs debug info and has no effect.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-purchase-example" level="h4">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Standard in-app purchase
await requestPurchase({
  request: {
    apple: { sku: 'premium' },
    google: { skus: ['premium'] }
  },
  type: 'in-app'
});

// Subscription purchase
await requestPurchase({
  request: {
    apple: { sku: 'monthly_sub' },
    google: { skus: ['monthly_sub'] }
  },
  type: 'subs'
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Standard in-app purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: .purchase(RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "premium")
        )),
        type: .inApp
    )
)

// Subscription purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: .subscription(RequestSubscriptionPropsByPlatforms(
            apple: RequestSubscriptionIosProps(sku: "monthly_sub")
        )),
        type: .subs
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Standard in-app purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("premium"))
            )
        ),
        type = ProductQueryType.InApp
    )
)

// Subscription purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Subscription(
            RequestSubscriptionPropsByPlatforms(
                google = RequestSubscriptionAndroidProps(skus = listOf("monthly_sub"))
            )
        ),
        type = ProductQueryType.Subs
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Standard in-app purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps.inApp((
    apple: RequestPurchaseIosProps(sku: 'premium'),
    google: RequestPurchaseAndroidProps(skus: ['premium']),
    useAlternativeBilling: null,
  )),
);

// Subscription purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps.subs((
    apple: RequestSubscriptionIosProps(sku: 'monthly_sub'),
    google: RequestSubscriptionAndroidProps(skus: ['monthly_sub']),
    useAlternativeBilling: null,
  )),
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Standard in-app purchase
await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(
    new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { "premium" },
            },
        },
        Type = ProductQueryType.InApp,
    });

// Subscription purchase
await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(
    new RequestPurchaseProps
    {
        RequestSubscription = new RequestSubscriptionPropsByPlatforms
        {
            Google = new RequestSubscriptionAndroidProps
            {
                Skus = new[] { "monthly_sub" },
            },
        },
        Type = ProductQueryType.Subs,
    });`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Standard in-app purchase
var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "premium"
props.request.google = RequestPurchaseAndroidProps.new()
props.request.google.skus = ["premium"]
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)

# Subscription purchase
var subs_props = RequestPurchaseProps.new()
subs_props.request_subscription = RequestSubscriptionPropsByPlatforms.new()
subs_props.request_subscription.apple = RequestSubscriptionIosProps.new()
subs_props.request_subscription.apple.sku = "monthly_sub"
subs_props.request_subscription.google = RequestSubscriptionAndroidProps.new()
subs_props.request_subscription.google.skus = ["monthly_sub"]
subs_props.type = ProductQueryType.SUBS
await iap.request_purchase(subs_props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases (in-app).
        </p>
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
              <td>Apple purchase parameters (RequestPurchaseIosProps)</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>Google purchase parameters (RequestPurchaseAndroidProps)</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>ios</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>apple</code> instead.
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>android</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>google</code> instead.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific request structure for subscriptions.</p>
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
                Apple subscription parameters (RequestSubscriptionIosProps)
              </td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                Google subscription parameters (RequestSubscriptionAndroidProps)
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>ios</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>apple</code> instead.
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>android</code>
              </td>
              <td>
                <strong>Deprecated.</strong> Use <code>google</code> instead.
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="platform-specific-request-props" level="h3">
          Platform-Specific Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="request-purchase-ios-props" level="h4">
                  RequestPurchaseIosProps
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
                        <code>sku</code>
                      </td>
                      <td>Product identifier to purchase (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>
                          andDangerouslyFinishTransactionAutomatically
                        </code>
                      </td>
                      <td>
                        Auto-finish transaction without validation (use with
                        caution)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>appAccountToken</code>
                      </td>
                      <td>
                        UUID linking purchase to your server's user.{' '}
                        <strong>Must be a valid UUID format</strong> (e.g.,{' '}
                        <code>550e8400-e29b-41d4-a716-446655440000</code>). If a
                        non-UUID value is provided, Apple will silently return{' '}
                        <code>null</code> for this field in the purchase
                        response.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>quantity</code>
                      </td>
                      <td>Number of items to purchase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>withOffer</code>
                      </td>
                      <td>
                        Signed iOS subscription promotional offer input (
                        <code>DiscountOfferInputIOS</code>)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>advancedCommerceData</code>
                      </td>
                      <td>
                        Attribution data token for StoreKit 2's{' '}
                        <a
                          href="https://developer.apple.com/documentation/storekit/product/purchaseoption/custom(key:value:)"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Product.PurchaseOption.custom
                        </a>{' '}
                        API. Used for campaign tokens, affiliate IDs, or other
                        attribution data. (iOS 15+)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="request-purchase-android-props" level="h4">
                  RequestPurchaseAndroidProps
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
                        <code>skus</code>
                      </td>
                      <td>Array of product identifiers (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>offerToken</code>
                      </td>
                      <td>
                        Offer token for one-time purchase discounts (8.0+). Pass
                        the <code>offerToken</code> from{' '}
                        <code>oneTimePurchaseOfferDetailsAndroid</code> or{' '}
                        <code>discountOffers</code> to apply a discount.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedAccountId</code>
                      </td>
                      <td>Obfuscated user account ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedProfileId</code>
                      </td>
                      <td>Obfuscated user profile ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isOfferPersonalized</code>
                      </td>
                      <td>True if offer is personalized (EU compliance)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>developerBillingOption</code>
                      </td>
                      <td>
                        Developer billing option params for External Payments or
                        Billing Choice. Billing Choice is available in OpenIAP
                        Spec 2.1.0 / openiap-google 2.3.0 and requires Play
                        Billing 9.1.0+. In-app flows require only{' '}
                        <code>billingProgram</code>. See{' '}
                        <Link to="/docs/types/billing-programs#developer-billing-option-params">
                          DeveloperBillingOptionParamsAndroid
                        </Link>
                        .
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="subscription-request-props" level="h3">
          Subscription Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="request-subscription-ios-props" level="h4">
                  RequestSubscriptionIosProps
                </AnchorLink>
                <p>
                  iOS subscriptions extend{' '}
                  <Link to="/docs/types/request-purchase-props#request-purchase-ios-props">
                    <code>RequestPurchaseIosProps</code>
                  </Link>{' '}
                  with these additional subscription-only fields:
                </p>
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
                        <code>winBackOffer</code>
                      </td>
                      <td>
                        Win-back offer to re-engage churned subscribers (iOS
                        18+).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>promotionalOfferJWS</code>
                      </td>
                      <td>
                        JWS-signed promotional offer (iOS 15+, WWDC 2025).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>billingPlanType</code>
                      </td>
                      <td>
                        StoreKit 26.4 billing plan for auto-renewable
                        subscriptions: <code>monthly</code> for monthly billing
                        with commitment or <code>up-front</code> for full-period
                        payment. Omit on older OS versions and do not pass{' '}
                        <code>unknown</code>. See{' '}
                        <Link to="/docs/types/ios/subscription-billing-plan-ios">
                          SubscriptionBillingPlanTypeIOS
                        </Link>
                        .
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>compactJWS</code>
                      </td>
                      <td>
                        Compact JWS string for overriding introductory offer
                        eligibility (iOS 15+, WWDC 2025). Generate it on your
                        server and omit it to let the system decide.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="request-subscription-android-props" level="h4">
                  RequestSubscriptionAndroidProps
                </AnchorLink>
                <p>
                  Extends RequestPurchaseAndroidProps with subscription-specific
                  fields:
                </p>
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
                        <code>purchaseToken</code>
                      </td>
                      <td>Existing subscription token for upgrade/downgrade</td>
                    </tr>
                    <tr>
                      <td>
                        <code>originalExternalTransactionId</code>
                      </td>
                      <td>
                        Original transaction ID when replacing a subscription
                        purchased through developer billing (9.1.0+). Use this
                        instead of <code>purchaseToken</code> for that flow.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code style={{ textDecoration: 'line-through' }}>
                          replacementMode
                        </code>
                      </td>
                      <td>
                        <strong>Deprecated.</strong> Use{' '}
                        <code>subscriptionProductReplacementParams</code> for
                        item-level replacement (Billing Library 8.1.0+).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOffers</code>
                      </td>
                      <td>
                        Array of offers to apply. Each contains:{' '}
                        <code>sku</code>, <code>offerToken</code>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionProductReplacementParams</code>
                      </td>
                      <td>
                        Item-level replacement params for subscription
                        upgrades/downgrades (Billing Library 8.1.0+).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>developerBillingOption</code>
                      </td>
                      <td>
                        Developer billing option params for External Payments
                        (8.3.0+) or Billing Choice (9.1.0+). See{' '}
                        <Link to="/docs/types/billing-programs#developer-billing-option-params">
                          DeveloperBillingOptionParamsAndroid
                        </Link>
                        .
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

export default RequestPurchaseProps;
