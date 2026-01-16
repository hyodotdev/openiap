import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Android Types"
        description="OpenIAP Android-specific type definitions - ProductAndroidOneTimePurchaseOfferDetail, SubscriptionOffer, PricingPhase, PricingPhasesAndroid for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/android"
        keywords="IAP types, ProductAndroidOneTimePurchaseOfferDetail, SubscriptionOffer, PricingPhase, PricingPhasesAndroid, Android, Play Billing"
      />
      <h1>Android Types</h1>
      <p>
        Type definitions specific to Android/Google Play Billing for
        subscription offers and pricing phases.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#one-time-purchase-offer-detail">
              <code>ProductAndroidOneTimePurchaseOfferDetail</code>
            </a>{' '}
            - One-time purchase discount offers (Billing Library 7.0+)
          </li>
          <li>
            <a href="#subscription-offer">
              <code>SubscriptionOffer</code>
            </a>{' '}
            - Offer details with offerToken for purchases
          </li>
          <li>
            <a href="#pricing-phase">
              <code>PricingPhase</code>
            </a>{' '}
            - Individual pricing phase (trial, intro, regular)
          </li>
          <li>
            <a href="#pricing-phases-android">
              <code>PricingPhasesAndroid</code>
            </a>{' '}
            - Container for pricing phase list
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="one-time-purchase-offer-detail" level="h2">
          ProductAndroidOneTimePurchaseOfferDetail
        </AnchorLink>
        <p>
          One-time purchase offer details for Android products. Available with{' '}
          <a
            href="https://developer.android.com/google/play/billing/release-notes#7-0-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Play Billing Library 7.0+
          </a>
          . For implementation examples, see the{' '}
          <Link to="/docs/features/discount">Discounts feature guide</Link>.
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
                <code>offerId</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>
                Unique offer identifier. <code>null</code> for base offers
              </td>
            </tr>
            <tr>
              <td>
                <code>offerToken</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Token required for purchase requests</td>
            </tr>
            <tr>
              <td>
                <code>offerTags</code>
              </td>
              <td>
                <code>string[]</code>
              </td>
              <td>Tags for categorizing offers</td>
            </tr>
            <tr>
              <td>
                <code>formattedPrice</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Localized price string (e.g., &quot;$4.99&quot;)</td>
            </tr>
            <tr>
              <td>
                <code>priceAmountMicros</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Price in micro-units (divide by 1,000,000)</td>
            </tr>
            <tr>
              <td>
                <code>priceCurrencyCode</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>ISO 4217 currency code</td>
            </tr>
            <tr>
              <td>
                <code>discountDisplayInfo</code>
              </td>
              <td>
                <code>DiscountDisplayInfoAndroid | null</code>
              </td>
              <td>Discount display information (percentage, badge text)</td>
            </tr>
            <tr>
              <td>
                <code>fullPriceMicros</code>
              </td>
              <td>
                <code>string | null</code>
              </td>
              <td>Original price before discount in micro-units</td>
            </tr>
            <tr>
              <td>
                <code>validTimeWindow</code>
              </td>
              <td>
                <code>
                  <a href="#valid-time-window-android">
                    ValidTimeWindowAndroid
                  </a>{' '}
                  | null
                </code>
              </td>
              <td>Time-limited offer validity window</td>
            </tr>
            <tr>
              <td>
                <code>limitedQuantityInfo</code>
              </td>
              <td>
                <code>
                  <a href="#limited-quantity-info-android">
                    LimitedQuantityInfoAndroid
                  </a>{' '}
                  | null
                </code>
              </td>
              <td>Quantity-limited offer availability</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="valid-time-window-android" level="h3">
          ValidTimeWindowAndroid
        </AnchorLink>
        <p>Defines the validity period for time-limited offers:</p>
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
                <code>startTimeMillis</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Offer start time (Unix timestamp in milliseconds)</td>
            </tr>
            <tr>
              <td>
                <code>endTimeMillis</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>Offer end time (Unix timestamp in milliseconds)</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="limited-quantity-info-android" level="h3">
          LimitedQuantityInfoAndroid
        </AnchorLink>
        <p>Defines availability for quantity-limited offers:</p>
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
                <code>maximumQuantity</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Maximum number of times offer can be redeemed</td>
            </tr>
            <tr>
              <td>
                <code>remainingQuantity</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Remaining redemptions available for this user</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="subscription-offer" level="h2">
          SubscriptionOffer
        </AnchorLink>
        <p>Offer details for subscription purchases:</p>
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
              <td>Product identifier</td>
            </tr>
            <tr>
              <td>
                <code>offerToken</code>
              </td>
              <td>Play Billing offer token (required for purchase)</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Note:</strong> The <code>offerToken</code> must be passed to{' '}
          <code>requestPurchase()</code> when purchasing Android subscriptions.
        </p>
      </section>

      <section>
        <AnchorLink id="pricing-phase" level="h2">
          PricingPhase
        </AnchorLink>
        <p>Pricing phase for Android subscriptions:</p>
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
                <code>billingPeriod</code>
              </td>
              <td>ISO 8601 period (P1W, P1M, P1Y)</td>
            </tr>
            <tr>
              <td>
                <code>formattedPrice</code>
              </td>
              <td>Formatted price string</td>
            </tr>
            <tr>
              <td>
                <code>priceAmountMicros</code>
              </td>
              <td>Price in micro-units (divide by 1,000,000)</td>
            </tr>
            <tr>
              <td>
                <code>priceCurrencyCode</code>
              </td>
              <td>ISO 4217 currency code</td>
            </tr>
            <tr>
              <td>
                <code>billingCycleCount</code>
              </td>
              <td>Number of cycles for this phase</td>
            </tr>
            <tr>
              <td>
                <code>recurrenceMode</code>
              </td>
              <td>
                How this phase recurs (1 = infinite, 2 = finite, 3 =
                non-recurring)
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="recurrence-mode-values" level="h3">
          Recurrence Mode Values
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Description</th>
              <th>Use Case</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>1</code>
              </td>
              <td>INFINITE_RECURRING</td>
              <td>Standard subscription (repeats forever)</td>
            </tr>
            <tr>
              <td>
                <code>2</code>
              </td>
              <td>FINITE_RECURRING</td>
              <td>Limited recurring (e.g., 3 months at intro price)</td>
            </tr>
            <tr>
              <td>
                <code>3</code>
              </td>
              <td>NON_RECURRING</td>
              <td>One-time (e.g., free trial)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="pricing-phases-android" level="h2">
          PricingPhasesAndroid
        </AnchorLink>
        <p>Container for pricing phases:</p>
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
                <code>pricingPhaseList</code>
              </td>
              <td>Array of PricingPhase objects</td>
            </tr>
          </tbody>
        </table>
        <p>
          Subscriptions typically have multiple phases. For example, a
          subscription with a free trial might have:
        </p>
        <ol>
          <li>
            <strong>Phase 1</strong>: Free trial (7 days, recurrenceMode = 3)
          </li>
          <li>
            <strong>Phase 2</strong>: Regular price (monthly, recurrenceMode =
            1)
          </li>
        </ol>
      </section>

      <section>
        <AnchorLink id="android-type-example" level="h2">
          Usage Example
        </AnchorLink>
        <p>
          When fetching Android subscription products, iterate through pricing
          phases and use <code>offerToken</code> for purchases:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { fetchProducts, requestPurchase, ProductSubscription } from 'expo-iap';

// Fetch subscription products
const subscriptions = await fetchProducts({
  request: { skus: ['premium_monthly'] },
  type: 'subs',
});

const subscription = subscriptions[0];

// Access Android subscription offers
if ('subscriptionOfferDetailsAndroid' in subscription) {
  const offers = subscription.subscriptionOfferDetailsAndroid;

  offers?.forEach((offer, idx) => {
    console.log(\`Offer \${idx + 1}: \${offer.basePlanId}\`);
    console.log('  Token:', offer.offerToken);

    // Iterate through pricing phases
    offer.pricingPhases?.pricingPhaseList?.forEach((phase, phaseIdx) => {
      console.log(\`  Phase \${phaseIdx + 1}:\`);
      console.log('    Period:', phase.billingPeriod);
      console.log('    Price:', phase.formattedPrice);
      console.log('    Recurrence:', phase.recurrenceMode);
    });
  });

  // Build subscription offers for purchase
  const subscriptionOffers = offers
    ?.filter((offer) => offer?.offerToken)
    .map((offer) => ({
      sku: subscription.id,
      offerToken: offer.offerToken,
    }));

  // Purchase with offerToken (required for Android subscriptions)
  await requestPurchase({
    request: {
      google: {
        skus: [subscription.id],
        subscriptionOffers,
      },
    },
    type: 'subs',
  });
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.types.*

// Fetch subscription products
val subscriptions = openIapModule.fetchProducts(
    skus = listOf("premium_monthly"),
    type = ProductQueryType.Subs
)

val subscription = subscriptions.firstOrNull() ?: return

// Access Android subscription offers
subscription.subscriptionOfferDetailsAndroid?.forEachIndexed { idx, offer ->
    println("Offer \${idx + 1}: \${offer.basePlanId}")
    println("  Token: \${offer.offerToken}")

    // Iterate through pricing phases
    offer.pricingPhases.pricingPhaseList.forEachIndexed { phaseIdx, phase ->
        println("  Phase \${phaseIdx + 1}:")
        println("    Period: \${phase.billingPeriod}")
        println("    Price: \${phase.formattedPrice}")
        println("    Recurrence: \${phase.recurrenceMode}")
    }
}

// Build subscription offers for purchase
val subscriptionOffers = subscription.subscriptionOfferDetailsAndroid
    ?.filter { it.offerToken.isNotEmpty() }
    ?.map { offer ->
        SubscriptionOfferAndroid(
            sku = subscription.id,
            offerToken = offer.offerToken
        )
    }

// Purchase with offerToken (required for Android subscriptions)
openIapModule.requestPurchase(
    sku = subscription.id,
    subscriptionOffers = subscriptionOffers
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Fetch subscription products
final subscriptions = await FlutterInappPurchase.instance.getSubscriptions(
  ['premium_monthly'],
);

final subscription = subscriptions.first;

// Access Android subscription offers
if (subscription is ProductSubscriptionAndroid) {
  final offers = subscription.subscriptionOfferDetailsAndroid;

  for (var i = 0; i < offers.length; i++) {
    final offer = offers[i];
    print('Offer \${i + 1}: \${offer.basePlanId}');
    print('  Token: \${offer.offerToken}');

    // Iterate through pricing phases
    final phases = offer.pricingPhases.pricingPhaseList;
    for (var j = 0; j < phases.length; j++) {
      final phase = phases[j];
      print('  Phase \${j + 1}:');
      print('    Period: \${phase.billingPeriod}');
      print('    Price: \${phase.formattedPrice}');
      print('    Recurrence: \${phase.recurrenceMode}');
    }
  }

  // Build subscription offers for purchase
  final subscriptionOffers = offers
      .where((offer) => offer.offerToken.isNotEmpty)
      .map((offer) => SubscriptionOfferAndroid(
            sku: subscription.id,
            offerToken: offer.offerToken,
          ))
      .toList();

  // Purchase with offerToken (required for Android subscriptions)
  await FlutterInappPurchase.instance.requestSubscription(
    sku: subscription.id,
    subscriptionOffers: subscriptionOffers,
  );
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Fetch subscription products
var request = ProductRequest.new()
request.skus = ["premium_monthly"]
request.type = ProductQueryType.SUBS
var subscriptions = await iap.fetch_products(request)

var subscription = subscriptions[0]

# Access Android subscription offers
var offers = subscription.subscription_offer_details_android

for i in range(offers.size()):
    var offer = offers[i]
    print("Offer %d: %s" % [i + 1, offer.base_plan_id])
    print("  Token: %s" % offer.offer_token)

    # Iterate through pricing phases
    var phases = offer.pricing_phases.pricing_phase_list
    for j in range(phases.size()):
        var phase = phases[j]
        print("  Phase %d:" % [j + 1])
        print("    Period: %s" % phase.billing_period)
        print("    Price: %s" % phase.formatted_price)
        print("    Recurrence: %d" % phase.recurrence_mode)

# Build subscription offers for purchase
var subscription_offers = []
for offer in offers:
    if offer.offer_token != "":
        var sub_offer = SubscriptionOfferAndroid.new()
        sub_offer.sku = subscription.id
        sub_offer.offer_token = offer.offer_token
        subscription_offers.append(sub_offer)

# Purchase with offerToken (required for Android subscriptions)
var props = RequestPurchaseProps.new()
props.request = RequestSubscriptionPropsByPlatforms.new()
props.request.google = RequestSubscriptionAndroidProps.new()
props.request.google.skus = [subscription.id]
props.request.google.subscription_offers = subscription_offers
props.type = ProductType.SUBS
await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="base-plan-limitation" level="h2">
          basePlanId Limitation
        </AnchorLink>
        <p>
          <strong>Important:</strong> While Google Play Console allows creating
          multiple base plans for a single subscription product, the{' '}
          <code>basePlanId</code> is not exposed by the Play Billing Library.
          See{' '}
          <Link to="/docs/apis/debugging#android-baseplanid-limitation">
            detailed limitation and solutions
          </Link>
          .
        </p>
        <p>
          When you have multiple base plans (e.g., monthly and yearly), each
          generates separate <code>SubscriptionOffer</code> objects. Use the{' '}
          <code>offerToken</code> to differentiate between them during purchase.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Workaround</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Parse <code>billingPeriod</code>
              </td>
              <td>
                Use the billing period (P1M, P1Y) to identify monthly vs yearly
              </td>
            </tr>
            <tr>
              <td>Use tags/metadata</td>
              <td>
                Add identifying info in Google Play Console that can be parsed
              </td>
            </tr>
            <tr>
              <td>Separate product IDs</td>
              <td>
                Create separate subscription products for each billing period
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default TypesAndroid;
