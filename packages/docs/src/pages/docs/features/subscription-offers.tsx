import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionOffers() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription Offers</h1>
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

      <section>
        <AnchorLink id="platform-differences" level="h2">
          Platform Differences
        </AnchorLink>
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
          <p>
            <strong>ℹ️ Tip:</strong> Always fetch products first; offers only
            exist after <code>{"fetchProducts({ type: 'subs' })"}</code>.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="platform-implementation" level="h2">
          Platform Implementation
        </AnchorLink>

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
                      <CodeBlock language="kotlin">{`// iOS-only - use in KMP iOS target
// For Android, see the Android tab`}</CodeBlock>
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
                      <CodeBlock language="kotlin">{`// iOS-only feature`}</CodeBlock>
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
                      <CodeBlock language="kotlin">{`// iOS-only feature - promotional offers with signatures
// For Android, use offer tokens instead`}</CodeBlock>
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
                      <CodeBlock language="kotlin">{`// iOS-only - use in KMP iOS target`}</CodeBlock>
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
    </div>
  );
}

export default SubscriptionOffers;
