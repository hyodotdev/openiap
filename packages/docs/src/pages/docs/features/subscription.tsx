import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Subscription() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription</h1>
      <p>
        This guide covers subscription purchasing, offers, and ongoing
        subscription management in your app.
      </p>

      <section>
        <AnchorLink id="subscription-offers" level="h2">
          Subscription Offers
        </AnchorLink>
        <p>
          Subscription offers represent different pricing plans for the same
          subscription product:
        </p>
        <ul>
          <li>
            <strong>Base Plan:</strong> The standard pricing for a subscription
          </li>
          <li>
            <strong>Introductory Offers:</strong> Special pricing for new
            subscribers (free trial, discounted period)
          </li>
          <li>
            <strong>Promotional Offers:</strong> Limited-time discounts
            configured in the app stores
          </li>
        </ul>
      </section>

      <section>
        <h3>Platform Differences</h3>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iOS</td>
              <td>
                Base plan is used by default. Introductory offers are
                automatically applied when eligible. Promotional offers require
                server-side signature via <code>withOffer</code>.
              </td>
            </tr>
            <tr>
              <td>Android</td>
              <td>
                Subscription offers are <strong>required</strong> when
                purchasing. You must pass <code>subscriptionOffers</code> with
                offer tokens from <code>fetchProducts()</code>.
              </td>
            </tr>
          </tbody>
        </table>

        <div className="alert-card alert-card--info">
          <p style={{ margin: 0 }}>
            <strong>ℹ️ Tip:</strong> Always fetch products first; offers only
            exist after <code>{"fetchProducts({ type: 'subs' })"}</code>.
          </p>
        </div>

        <h3>Platform Implementation</h3>

        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="ios-overview" level="h3">
                  iOS Overview
                </AnchorLink>
                <p>
                  iOS handles subscription offers differently - the base plan is
                  used by default, and promotional offers are optional.
                </p>
                <ul>
                  <li>
                    <strong>Introductory Offers:</strong> Automatically applied
                    when user is eligible (no code needed)
                  </li>
                  <li>
                    <strong>Promotional Offers:</strong> Requires server-side
                    signature generation
                  </li>
                </ul>

                <AnchorLink id="ios-fetch-offers" level="h3">
                  Fetching Subscription Info
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

// Fetch subscription products
const subscriptions = await fetchProducts({
  skus: ['premium_monthly'],
  type: 'subs',
});

const subscription = subscriptions.find((s) => s.id === 'premium_monthly');

// Check for introductory offer
if (subscription?.subscriptionInfoIOS?.introductoryOffer) {
  const intro = subscription.subscriptionInfoIOS.introductoryOffer;
  console.log('Intro offer:', intro.displayPrice);
  console.log('Payment mode:', intro.paymentMode); // free-trial, pay-as-you-go, pay-up-front
  console.log('Period:', intro.period.unit, intro.periodCount);
}

// Check for promotional offers
if (subscription?.discountsIOS) {
  subscription.discountsIOS.forEach((discount) => {
    console.log('Promo:', discount.identifier, discount.localizedPrice);
  });
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap

let iapStore = OpenIapStore.shared

// Fetch subscription products
try await iapStore.fetchProducts(skus: ["premium_monthly"], type: .subs)

let subscription = iapStore.iosProducts.first { $0.id == "premium_monthly" }

// Check for introductory offer
if let introOffer = subscription?.subscriptionInfoIOS?.introductoryOffer {
    print("Intro offer: \\(introOffer.displayPrice)")
    print("Payment mode: \\(introOffer.paymentMode)")
    print("Period: \\(introOffer.period.unit) x \\(introOffer.periodCount)")
}

// Check for promotional offers
if let discounts = subscription?.discountsIOS {
    for discount in discounts {
        print("Promo: \\(discount.identifier) - \\(discount.localizedPrice)")
    }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

// KMP iOS target
val iapStore = OpenIapStore.shared

// Fetch subscription products
iapStore.fetchProducts(
    skus = listOf("premium_monthly"),
    type = ProductQueryType.Subs
)

val subscription = iapStore.iosProducts
    .filterIsInstance<ProductIOS>()
    .find { it.id == "premium_monthly" }

// Check for introductory offer
subscription?.subscriptionInfoIOS?.introductoryOffer?.let { introOffer ->
    println("Intro offer: \${introOffer.displayPrice}")
    println("Payment mode: \${introOffer.paymentMode}")
    println("Period: \${introOffer.period.unit} x \${introOffer.periodCount}")
}

// Check for promotional offers
subscription?.discountsIOS?.forEach { discount ->
    println("Promo: \${discount.identifier} - \${discount.localizedPrice}")
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Fetch subscription products
final subscriptions = await iap.getSubscriptions(['premium_monthly']);
final subscription = subscriptions.firstWhere(
  (s) => s.productId == 'premium_monthly',
);

// Check for introductory offer (iOS)
if (subscription.introductoryPriceIOS != null) {
  final intro = subscription.introductoryPriceIOS!;
  print('Intro price: \${intro.localizedPrice}');
  print('Period: \${intro.subscriptionPeriod}');
  print('Cycles: \${intro.numberOfPeriods}');
}

// Check for promotional offers (iOS)
if (subscription.discountsIOS != null) {
  for (final discount in subscription.discountsIOS!) {
    print('Promo: \${discount.identifier} - \${discount.localizedPrice}');
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-introductory-offers" level="h3">
                  Introductory Offers
                </AnchorLink>
                <p>
                  iOS automatically applies introductory prices (free trials,
                  intro pricing) configured in App Store Connect. No additional
                  code is needed - users will see the introductory offer when
                  eligible.
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`const displayIntroOffer = (subscription: ProductSubscription) => {
  const offer = subscription.subscriptionInfoIOS?.introductoryOffer;
  if (!offer) return 'No intro offer available';

  switch (offer.paymentMode) {
    case 'free-trial':
      return \`\${offer.periodCount} \${offer.period.unit.toLowerCase()}(s) free trial\`;
    case 'pay-as-you-go':
      return \`\${offer.displayPrice} for \${offer.periodCount} \${offer.period.unit.toLowerCase()}(s)\`;
    case 'pay-up-front':
      return \`\${offer.displayPrice} for first \${offer.periodCount} \${offer.period.unit.toLowerCase()}(s)\`;
  }
};

// Check eligibility
const isEligible = await isEligibleForIntroOfferIOS('premium_monthly');
if (isEligible) {
  console.log(displayIntroOffer(subscription));
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`func displayIntroOffer(_ subscription: ProductIOS) -> String? {
    guard let offer = subscription.subscriptionInfoIOS?.introductoryOffer else {
        return nil
    }

    switch offer.paymentMode {
    case "free-trial":
        return "\\(offer.periodCount) \\(offer.period.unit.lowercased())(s) free trial"
    case "pay-as-you-go":
        return "\\(offer.displayPrice) for \\(offer.periodCount) \\(offer.period.unit.lowercased())(s)"
    case "pay-up-front":
        return "\\(offer.displayPrice) for first \\(offer.periodCount) \\(offer.period.unit.lowercased())(s)"
    default:
        return nil
    }
}

// Check eligibility
let isEligible = try await iapStore.isEligibleForIntroOfferIOS(sku: "premium_monthly")
if isEligible, let offerText = displayIntroOffer(subscription) {
    print(offerText)
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

// KMP iOS target
fun displayIntroOffer(subscription: ProductIOS): String? {
    val offer = subscription.subscriptionInfoIOS?.introductoryOffer
        ?: return null

    return when (offer.paymentMode) {
        "free-trial" -> "\${offer.periodCount} \${offer.period.unit.lowercase()}(s) free trial"
        "pay-as-you-go" -> "\${offer.displayPrice} for \${offer.periodCount} \${offer.period.unit.lowercase()}(s)"
        "pay-up-front" -> "\${offer.displayPrice} for first \${offer.periodCount} \${offer.period.unit.lowercase()}(s)"
        else -> null
    }
}

// Check eligibility
val isEligible = iapStore.isEligibleForIntroOfferIOS(sku = "premium_monthly")
if (isEligible) {
    subscription?.let { displayIntroOffer(it)?.let(::println) }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`String? displayIntroOffer(IAPItem subscription) {
  final offer = subscription.introductoryPriceIOS;
  if (offer == null) return null;

  // Display intro offer details
  return '\${offer.localizedPrice} for \${offer.numberOfPeriods} \${offer.subscriptionPeriod}';
}

// Check eligibility
final isEligible = await iap.isEligibleForIntroOfferIOS('premium_monthly');
if (isEligible) {
  print(displayIntroOffer(subscription));
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-promotional-offers" level="h3">
                  Promotional Offers
                </AnchorLink>
                <p>
                  Promotional offers require server-side signature generation.
                  These offers are for existing or lapsed subscribers.
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

// Purchase with promotional offer
const purchaseWithPromoOffer = async (
  subscriptionId: string,
  offerId: string,
) => {
  // 1. Generate signature on your backend
  const nonce = generateUUID();
  const timestamp = Date.now();

  const { keyIdentifier, signature } = await fetch(
    'https://your-server.com/generate-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        productId: subscriptionId,
        offerId,
        nonce,
        timestamp,
      }),
    },
  ).then((res) => res.json());

  // 2. Purchase with the promotional offer
  await requestPurchase({
    request: {
      ios: {
        sku: subscriptionId,
        withOffer: {
          identifier: offerId,
          keyIdentifier,
          nonce,
          signature,
          timestamp,
        },
      },
      android: { skus: [subscriptionId] },
    },
    type: 'subs',
  });
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap

func purchaseWithPromoOffer(
    subscriptionId: String,
    offerId: String
) async throws {
    // 1. Generate signature on your backend
    let nonce = UUID().uuidString
    let timestamp = Int64(Date().timeIntervalSince1970 * 1000)

    let signatureResponse = try await generateSignatureOnServer(
        productId: subscriptionId,
        offerId: offerId,
        nonce: nonce,
        timestamp: timestamp
    )

    // 2. Purchase with the promotional offer
    _ = try await iapStore.requestPurchase(
        sku: subscriptionId,
        type: .subs,
        withOffer: DiscountOfferInputIOS(
            identifier: offerId,
            keyIdentifier: signatureResponse.keyIdentifier,
            nonce: nonce,
            signature: signatureResponse.signature,
            timestamp: timestamp
        ),
        autoFinish: false
    )
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

// KMP iOS target
suspend fun purchaseWithPromoOffer(
    subscriptionId: String,
    offerId: String
) {
    // 1. Generate signature on your backend
    val nonce = java.util.UUID.randomUUID().toString()
    val timestamp = System.currentTimeMillis()

    val signatureResponse = generateSignatureOnServer(
        productId = subscriptionId,
        offerId = offerId,
        nonce = nonce,
        timestamp = timestamp
    )

    // 2. Purchase with the promotional offer
    iapStore.requestPurchase(
        sku = subscriptionId,
        type = ProductQueryType.Subs,
        withOffer = DiscountOfferInputIOS(
            identifier = offerId,
            keyIdentifier = signatureResponse.keyIdentifier,
            nonce = nonce,
            signature = signatureResponse.signature,
            timestamp = timestamp
        ),
        autoFinish = false
    )
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`Future<void> purchaseWithPromoOffer(
  String subscriptionId,
  String offerId,
) async {
  // 1. Generate signature on your backend
  final nonce = generateUUID();
  final timestamp = DateTime.now().millisecondsSinceEpoch;

  final response = await http.post(
    Uri.parse('https://your-server.com/generate-signature'),
    body: jsonEncode({
      'productId': subscriptionId,
      'offerId': offerId,
      'nonce': nonce,
      'timestamp': timestamp,
    }),
  );
  final signature = jsonDecode(response.body);

  // 2. Purchase with the promotional offer
  await iap.requestSubscription(
    sku: subscriptionId,
    withOfferIOS: DiscountOfferIOS(
      identifier: offerId,
      keyIdentifier: signature['keyIdentifier'],
      nonce: nonce,
      signature: signature['signature'],
      timestamp: timestamp,
    ),
  );
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-purchase" level="h3">
                  Purchase Subscription
                </AnchorLink>
                <p>
                  For iOS, simply request the purchase. Introductory offers are
                  applied automatically when eligible.
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

const purchaseSubscription = async (subscriptionId: string) => {
  // iOS: Base plan with auto-applied intro offer
  await requestPurchase({
    request: {
      ios: { sku: subscriptionId },
      android: { skus: [subscriptionId] },
    },
    type: 'subs',
  });
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap

func purchaseSubscription(subscriptionId: String) async throws {
    // iOS: Simply request purchase
    // Intro offer is applied automatically when eligible
    _ = try await iapStore.requestPurchase(
        sku: subscriptionId,
        type: .subs,
        autoFinish: false
    )
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

// KMP iOS target
suspend fun purchaseSubscription(subscriptionId: String) {
    // Simply request purchase
    // Intro offer is applied automatically when eligible
    iapStore.requestPurchase(
        sku = subscriptionId,
        type = ProductQueryType.Subs,
        autoFinish = false
    )
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`Future<void> purchaseSubscription(String subscriptionId) async {
  // iOS: Simply request purchase
  // Intro offer is applied automatically when eligible
  await iap.requestSubscription(sku: subscriptionId);
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>
              </>
            ),
            android: (
              <>
                <AnchorLink id="android-overview" level="h3">
                  Android Overview
                </AnchorLink>
                <p>
                  Android requires explicit specification of subscription offers
                  when purchasing. Each offer is identified by an{' '}
                  <code>offerToken</code> obtained from{' '}
                  <code>fetchProducts()</code>.
                </p>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>⚠️ Required:</strong> Android subscriptions must
                    include <code>subscriptionOffers</code> in the purchase
                    request. Without it, the purchase will fail with:
                  </p>
                  <code>
                    The number of skus (1) must match: the number of offerTokens
                    (0)
                  </code>
                </div>

                <AnchorLink id="android-offer-structure" level="h3">
                  Offer Structure
                </AnchorLink>
                <p>
                  Each <code>subscriptionOfferDetailsAndroid</code> item
                  contains:
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`interface SubscriptionOfferDetailsAndroid {
  basePlanId: string;      // Base plan identifier
  offerId?: string | null; // Offer ID (null for base plan)
  offerTags: string[];     // Tags for categorization
  offerToken: string;      // Required for purchase
  pricingPhases: {
    pricingPhaseList: Array<{
      formattedPrice: string;      // e.g., "$9.99"
      priceAmountMicros: number;   // Price in micros
      priceCurrencyCode: string;   // e.g., "USD"
      billingPeriod: string;       // e.g., "P1M" (1 month)
      billingCycleCount: number;   // Number of cycles
      recurrenceMode: number;      // 1=infinite, 2=finite, 3=non-recurring
    }>;
  };
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only - use Kotlin for Android implementation`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`data class SubscriptionOfferDetailsAndroid(
    val basePlanId: String,       // Base plan identifier
    val offerId: String? = null,  // Offer ID (null for base plan)
    val offerTags: List<String>,  // Tags for categorization
    val offerToken: String,       // Required for purchase
    val pricingPhases: PricingPhasesAndroid
)

data class PricingPhaseAndroid(
    val formattedPrice: String,      // e.g., "$9.99"
    val priceAmountMicros: Long,     // Price in micros
    val priceCurrencyCode: String,   // e.g., "USD"
    val billingPeriod: String,       // e.g., "P1M" (1 month)
    val billingCycleCount: Int,      // Number of cycles
    val recurrenceMode: Int          // 1=infinite, 2=finite, 3=non-recurring
)`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`class SubscriptionOfferDetailsAndroid {
  final String basePlanId;      // Base plan identifier
  final String? offerId;        // Offer ID (null for base plan)
  final List<String> offerTags; // Tags for categorization
  final String offerToken;      // Required for purchase
  final PricingPhasesAndroid pricingPhases;
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="android-fetch-offers" level="h3">
                  Fetching Offer Tokens
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

// Fetch subscription products
const subscriptions = await fetchProducts({
  skus: ['premium_monthly'],
  type: 'subs',
});

const subscription = subscriptions.find((s) => s.id === 'premium_monthly');

// Access Android offer details
if (subscription?.subscriptionOfferDetailsAndroid) {
  subscription.subscriptionOfferDetailsAndroid.forEach((offer) => {
    console.log('Base Plan:', offer.basePlanId);
    console.log('Offer ID:', offer.offerId ?? 'Base plan');
    console.log('Offer Token:', offer.offerToken);

    // Check pricing phases
    offer.pricingPhases.pricingPhaseList.forEach((phase) => {
      if (phase.priceAmountMicros === 0) {
        console.log(\`Free trial: \${phase.billingPeriod}\`);
      } else if (phase.recurrenceMode === 2) {
        console.log(\`Intro: \${phase.formattedPrice} for \${phase.billingPeriod}\`);
      } else {
        console.log(\`Regular: \${phase.formattedPrice} per \${phase.billingPeriod}\`);
      }
    });
  });
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only - use Kotlin for Android implementation`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

val iapStore = OpenIapStore.getInstance(context)

// Fetch subscription products
val request = ProductRequest(
    skus = listOf("premium_monthly"),
    type = ProductQueryType.Subs
)
iapStore.fetchProducts(request)

// Access Android offer details
val subscriptions = iapStore.subscriptions.value
    .filterIsInstance<ProductSubscriptionAndroid>()

val subscription = subscriptions.find { it.id == "premium_monthly" }

subscription?.subscriptionOfferDetailsAndroid?.forEach { offer ->
    println("Base Plan: \${offer.basePlanId}")
    println("Offer ID: \${offer.offerId ?: "Base plan"}")
    println("Offer Token: \${offer.offerToken}")

    // Check pricing phases
    offer.pricingPhases.pricingPhaseList.forEach { phase ->
        when {
            phase.priceAmountMicros == 0L ->
                println("Free trial: \${phase.billingPeriod}")
            phase.recurrenceMode == 2 ->
                println("Intro: \${phase.formattedPrice} for \${phase.billingPeriod}")
            else ->
                println("Regular: \${phase.formattedPrice} per \${phase.billingPeriod}")
        }
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Fetch subscription products
final subscriptions = await iap.getSubscriptions(['premium_monthly']);
final subscription = subscriptions.firstWhere(
  (s) => s.productId == 'premium_monthly',
);

// Access Android offer details
if (subscription.subscriptionOfferDetailsAndroid != null) {
  for (final offer in subscription.subscriptionOfferDetailsAndroid!) {
    print('Base Plan: \${offer.basePlanId}');
    print('Offer ID: \${offer.offerId ?? "Base plan"}');
    print('Offer Token: \${offer.offerToken}');

    // Check pricing phases
    for (final phase in offer.pricingPhases?.pricingPhaseList ?? []) {
      if (phase.priceAmountMicros == 0) {
        print('Free trial: \${phase.billingPeriod}');
      } else if (phase.recurrenceMode == 2) {
        print('Intro: \${phase.formattedPrice} for \${phase.billingPeriod}');
      } else {
        print('Regular: \${phase.formattedPrice} per \${phase.billingPeriod}');
      }
    }
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="android-purchase" level="h3">
                  Purchase with Offers
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

const purchaseSubscription = async (subscriptionId: string) => {
  const subscription = subscriptions.find((s) => s.id === subscriptionId);
  if (!subscription) return;

  // Build subscriptionOffers from fetched data
  const subscriptionOffers = (
    subscription.subscriptionOfferDetailsAndroid ?? []
  )
    .filter((offer) => offer?.offerToken)
    .map((offer) => ({
      sku: subscriptionId,
      offerToken: offer!.offerToken,
    }));

  if (subscriptionOffers.length === 0) {
    console.error('No subscription offers available');
    return;
  }

  await requestPurchase({
    request: {
      ios: { sku: subscriptionId },
      android: {
        skus: [subscriptionId],
        subscriptionOffers, // Required for Android
      },
    },
    type: 'subs',
  });
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only - use Kotlin for Android implementation`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.models.*

suspend fun purchaseSubscription(subscriptionId: String) {
    val subscription = iapStore.subscriptions.value
        .filterIsInstance<ProductSubscriptionAndroid>()
        .find { it.id == subscriptionId }
        ?: return

    // Build subscriptionOffers from fetched data
    val subscriptionOffers = subscription.subscriptionOfferDetailsAndroid
        ?.mapNotNull { offer ->
            offer.offerToken?.let { token ->
                AndroidSubscriptionOfferInput(
                    sku = subscriptionId,
                    offerToken = token
                )
            }
        } ?: emptyList()

    if (subscriptionOffers.isEmpty()) {
        println("No subscription offers available")
        return
    }

    val props = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Subscription(
            RequestSubscriptionPropsByPlatforms(
                android = RequestSubscriptionAndroidProps(
                    skus = listOf(subscriptionId),
                    subscriptionOffers = subscriptionOffers // Required
                )
            )
        ),
        type = ProductQueryType.Subs
    )

    iapStore.requestPurchase(props)
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`Future<void> purchaseSubscription(String subscriptionId) async {
  final subscriptions = await iap.getSubscriptions([subscriptionId]);
  final subscription = subscriptions.firstWhere(
    (s) => s.productId == subscriptionId,
  );

  // Build subscriptionOffers from fetched data
  final subscriptionOffers = subscription.subscriptionOfferDetailsAndroid
      ?.where((offer) => offer.offerToken != null)
      .map((offer) => SubscriptionOfferAndroid(
            sku: subscriptionId,
            offerToken: offer.offerToken!,
          ))
      .toList() ?? [];

  if (subscriptionOffers.isEmpty) {
    print('No subscription offers available');
    return;
  }

  await iap.requestSubscription(
    sku: subscriptionId,
    subscriptionOffers: subscriptionOffers, // Required
  );
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="android-select-offer" level="h3">
                  Selecting Specific Offers
                </AnchorLink>
                <p>
                  You can select specific offers (base plan, intro, promo) based
                  on your needs:
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`type OfferType = 'base' | 'introductory' | 'promotional';

const selectOffer = (
  subscription: ProductSubscription,
  offerType: OfferType,
) => {
  const offers = subscription.subscriptionOfferDetailsAndroid ?? [];

  switch (offerType) {
    case 'base':
      // Base plan has no offerId
      return offers.find((offer) => !offer.offerId);
    case 'introductory':
      // Find offer with free trial or intro pricing
      return offers.find((offer) =>
        offer.pricingPhases.pricingPhaseList.some(
          (phase) => phase.priceAmountMicros === 0 || phase.recurrenceMode === 2,
        ),
      );
    case 'promotional':
      // Find offer with specific tags
      return offers.find((offer) =>
        offer.offerTags.some((tag) => tag.includes('promo')),
      );
  }
};

// Purchase with selected offer
const purchaseWithOffer = async (
  subscriptionId: string,
  offerType: OfferType,
) => {
  const subscription = subscriptions.find((s) => s.id === subscriptionId);
  if (!subscription) return;

  const selectedOffer = selectOffer(subscription, offerType);
  if (!selectedOffer) {
    console.error('Selected offer not found');
    return;
  }

  await requestPurchase({
    request: {
      ios: { sku: subscriptionId },
      android: {
        skus: [subscriptionId],
        subscriptionOffers: [{
          sku: subscriptionId,
          offerToken: selectedOffer.offerToken,
        }],
      },
    },
    type: 'subs',
  });
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only - use Kotlin for Android implementation`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`enum class OfferType { Base, Introductory, Promotional }

fun selectOffer(
    subscription: ProductSubscriptionAndroid,
    offerType: OfferType
): SubscriptionOfferDetailsAndroid? {
    val offers = subscription.subscriptionOfferDetailsAndroid ?: return null

    return when (offerType) {
        OfferType.Base -> offers.find { it.offerId == null }
        OfferType.Introductory -> offers.find { offer ->
            offer.pricingPhases.pricingPhaseList.any { phase ->
                phase.priceAmountMicros == 0L || phase.recurrenceMode == 2
            }
        }
        OfferType.Promotional -> offers.find { offer ->
            offer.offerTags.any { it.contains("promo", true) }
        }
    }
}

// Purchase with selected offer
suspend fun purchaseWithOffer(
    subscriptionId: String,
    offerType: OfferType
) {
    val subscription = iapStore.subscriptions.value
        .filterIsInstance<ProductSubscriptionAndroid>()
        .find { it.id == subscriptionId }
        ?: return

    val selectedOffer = selectOffer(subscription, offerType)
        ?: run {
            println("Selected offer not found")
            return
        }

    val props = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Subscription(
            RequestSubscriptionPropsByPlatforms(
                android = RequestSubscriptionAndroidProps(
                    skus = listOf(subscriptionId),
                    subscriptionOffers = listOf(
                        AndroidSubscriptionOfferInput(
                            sku = subscriptionId,
                            offerToken = selectedOffer.offerToken
                        )
                    )
                )
            )
        ),
        type = ProductQueryType.Subs
    )

    iapStore.requestPurchase(props)
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`enum OfferType { base, introductory, promotional }

SubscriptionOfferDetailsAndroid? selectOffer(
  IAPItem subscription,
  OfferType offerType,
) {
  final offers = subscription.subscriptionOfferDetailsAndroid;
  if (offers == null) return null;

  switch (offerType) {
    case OfferType.base:
      return offers.firstWhere(
        (offer) => offer.offerId == null,
        orElse: () => offers.first,
      );
    case OfferType.introductory:
      return offers.firstWhere(
        (offer) => offer.pricingPhases?.pricingPhaseList?.any(
          (phase) => phase.priceAmountMicros == 0 || phase.recurrenceMode == 2,
        ) ?? false,
        orElse: () => null,
      );
    case OfferType.promotional:
      return offers.firstWhere(
        (offer) => offer.offerTags?.any((tag) => tag.contains('promo')) ?? false,
        orElse: () => null,
      );
  }
}

// Purchase with selected offer
Future<void> purchaseWithOffer(
  String subscriptionId,
  OfferType offerType,
) async {
  final subscriptions = await iap.getSubscriptions([subscriptionId]);
  final subscription = subscriptions.firstWhere(
    (s) => s.productId == subscriptionId,
  );

  final selectedOffer = selectOffer(subscription, offerType);
  if (selectedOffer == null) {
    print('Selected offer not found');
    return;
  }

  await iap.requestSubscription(
    sku: subscriptionId,
    subscriptionOffers: [
      SubscriptionOfferAndroid(
        sku: subscriptionId,
        offerToken: selectedOffer.offerToken!,
      ),
    ],
  );
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="handling-subscription" level="h2">
          Handling Subscription
        </AnchorLink>
        <p>
          After a successful subscription purchase, you need to handle the
          subscription lifecycle including verification, status checking, and
          renewal management.
        </p>

        <AnchorLink id="ios-vs-android" level="h3">
          iOS vs Android
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Aspect</th>
              <th>iOS</th>
              <th>Android</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Purchase Data</td>
              <td>
                Can get purchase data from <code>Transaction.all</code>{' '}
                (including expired). Client can check expiry/renewal info.
              </td>
              <td>
                Client cannot access expiry time. Must use Google Play Developer
                API for subscription status.
              </td>
            </tr>
            <tr>
              <td>Cancellation Status</td>
              <td>
                <code>renewalInfo.willAutoRenew</code> available client-side
              </td>
              <td>
                No client-side API. Must use Google Play Developer API to detect
                cancellation.
              </td>
            </tr>
            <tr>
              <td>Server Validation</td>
              <td>Recommended for security</td>
              <td>
                <strong>Mandatory</strong> for proper subscription management
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="subscription-scenarios" level="h3">
          Subscription Scenarios
        </AnchorLink>
        <p>
          Understanding how subscriptions behave in different scenarios is
          crucial for proper implementation:
        </p>

        <h4>Cancellation Scenario</h4>
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>User cancels subscription on Day 1</li>
            <li>
              Subscription remains valid until Day 30 (end of billing period)
            </li>
            <li>
              <code>getAvailablePurchases()</code> still returns this purchase
            </li>
            <li>
              iOS: <code>renewalInfo.willAutoRenew = false</code> (client-side)
              <br />
              Android: Must check via Google Play Developer API (server-side
              only)
            </li>
          </ol>
        </div>

        <h4>Restore Purchase Scenarios</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Day 15</strong> (still valid)
              </td>
              <td>Purchase returned, access granted until Day 30 ✓</td>
            </tr>
            <tr>
              <td>
                <strong>Day 35</strong> (expired)
              </td>
              <td>
                iOS: <code>currentEntitlements</code> returns empty
                <br />
                Android: <code>queryPurchases</code> returns empty
                <br />
                No access granted ✓
              </td>
            </tr>
          </tbody>
        </table>

        <h4>Refund Scenario (Tricky Case)</h4>
        <div className="alert-card alert-card--warning">
          <p>
            <strong>⚠️ Important:</strong> When a user requests and receives a
            refund:
          </p>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>User purchases subscription</li>
            <li>User requests refund from Apple/Google</li>
            <li>Refund is approved</li>
            <li>
              <code>getAvailablePurchases()</code> may still return the purchase
              temporarily
            </li>
          </ol>
          <p style={{ marginTop: '0.5rem' }}>
            <strong>Without server validation:</strong> App grants access ✗
            (incorrect - refunded!)
            <br />
            <strong>With server validation:</strong> Server detects refund →
            denies access ✓
          </p>
        </div>

        <AnchorLink id="when-to-validate" level="h3">
          When to Validate
        </AnchorLink>
        <p>Server-side validation is needed:</p>
        <ul>
          <li>
            <strong>After purchase</strong> - Verify purchase is legitimate
          </li>
          <li>
            <strong>On restore</strong> - Check current status
            (active/cancelled/refunded/expired)
          </li>
          <li>
            <strong>Periodically</strong> - Detect refunds and cancellations for
            active subscriptions
          </li>
        </ul>

        <div className="alert-card alert-card--info">
          <p>
            <strong>ℹ️ Android Limitation:</strong> While{' '}
            <code>getAvailablePurchases()</code> can retrieve purchase history,
            Android clients cannot access expiry time, cancellation status, or
            refund information. For complete subscription management, consider:
          </p>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>
              Google Play Developer API - Get expiry, renewal dates, grace
              periods
            </li>
            <li>
              RTDN (Real-time Developer Notifications) - Instant updates on
              renewals, cancellations, refunds
            </li>
            <li>
              Server-side purchase records - Track subscription state history
            </li>
          </ul>
        </div>

        <AnchorLink id="verify-subscription" level="h3">
          Verify Subscription
        </AnchorLink>
        <p>
          Always verify subscription purchases on your server before granting
          access to premium content.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchase, type Purchase } from 'expo-iap';
import { Platform } from 'react-native';

const verifySubscription = async (purchase: Purchase) => {
  const result = await verifyPurchase({
    purchase,
    serverUrl: Platform.select({
      ios: 'https://your-server.com/api/verify-ios',
      android: 'https://your-server.com/api/verify-android',
    })!,
  });

  if (result.isValid) {
    // Grant premium access
    return true;
  }
  return false;
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func verifySubscription(_ purchase: PurchaseIOS) async -> Bool {
    let iapStore = OpenIapStore.shared

    do {
        let result = try await iapStore.verifyPurchase(
            purchase: purchase,
            serverUrl: "https://your-server.com/api/verify-ios"
        )
        return result.isValid
    } catch {
        print("Verification error: \\(error.localizedDescription)")
        return false
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

suspend fun verifySubscription(purchase: PurchaseAndroid): Boolean {
    return try {
        val result = iapStore.verifyPurchase(
            purchase = purchase,
            serverUrl = "https://your-server.com/api/verify-android"
        )
        result.isValid
    } catch (e: Exception) {
        println("Verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<bool> verifySubscription(ProductPurchase purchase) async {
  final iap = FlutterInappPurchase.instance;

  try {
    final result = await iap.verifyPurchase(
      purchase: purchase,
      serverUrl: Platform.isIOS
          ? 'https://your-server.com/api/verify-ios'
          : 'https://your-server.com/api/verify-android',
    );
    return result.isValid;
  } catch (e) {
    print('Verification error: $e');
    return false;
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="check-active-subscriptions" level="h3">
          Check Active Subscriptions
        </AnchorLink>
        <p>Check if the user has an active subscription to determine access.</p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getActiveSubscriptions, hasActiveSubscriptions } from 'expo-iap';

// Check if user has any active subscription
const hasActive = await hasActiveSubscriptions();
if (hasActive) {
  console.log('User has premium access');
}

// Get all active subscriptions
const activeSubscriptions = await getActiveSubscriptions();
activeSubscriptions.forEach((sub) => {
  console.log('Active subscription:', sub.productId);
  console.log('Expires:', sub.expirationDate);
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

let iapStore = OpenIapStore.shared

// Check if user has any active subscription
let hasActive = try await iapStore.hasActiveSubscriptions()
if hasActive {
    print("User has premium access")
}

// Get all active subscriptions
let activeSubscriptions = try await iapStore.getActiveSubscriptions()
for subscription in activeSubscriptions {
    print("Active subscription: \\(subscription.productId)")
    if let expiration = subscription.expirationDate {
        print("Expires: \\(expiration)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore

// Check if user has any active subscription
val hasActive = iapStore.hasActiveSubscriptions()
if (hasActive) {
    println("User has premium access")
}

// Get all active subscriptions
val activeSubscriptions = iapStore.getActiveSubscriptions()
activeSubscriptions.forEach { subscription ->
    println("Active subscription: \${subscription.productId}")
    subscription.expirationDate?.let { expiration ->
        println("Expires: $expiration")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Check if user has any active subscription
final hasActive = await iap.hasActiveSubscriptions();
if (hasActive) {
  print('User has premium access');
}

// Get all active subscriptions
final activeSubscriptions = await iap.getActiveSubscriptions();
for (final subscription in activeSubscriptions) {
  print('Active subscription: \${subscription.productId}');
  if (subscription.expirationDate != null) {
    print('Expires: \${subscription.expirationDate}');
  }
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="manage-subscriptions" level="h3">
          Manage Subscriptions
        </AnchorLink>
        <p>
          Allow users to manage their subscriptions through the platform's
          native UI.
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { deepLinkToSubscriptions } from 'expo-iap';

// Open subscription management page
const manageSubscriptions = async () => {
  await deepLinkToSubscriptions();
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

let iapStore = OpenIapStore.shared

// Open subscription management page
func manageSubscriptions() async {
    try await iapStore.deepLinkToSubscriptionsIOS()
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore

// Open subscription management page
fun manageSubscriptions() {
    iapStore.deepLinkToSubscriptions()
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// Open subscription management page
Future<void> manageSubscriptions() async {
  await iap.deepLinkToSubscriptions();
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="see-also" level="h2">
          See Also
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/features/subscription-upgrade-downgrade">
              Subscription Upgrade/Downgrade
            </Link>{' '}
            - Change subscription plans
          </li>
          <li>
            <Link to="/docs/lifecycle/subscription">
              Subscription Lifecycle
            </Link>{' '}
            - Understand subscription states and transitions
          </li>
          <li>
            <Link to="/tutorials#verify-purchase">Verify Purchase</Link> -
            Server-side verification guides
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Subscription;
