import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Discount() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Discounts"
        description="Handle Google Play one-time product discounts - display original prices, discount badges, and promotional offers."
        path="/docs/features/discount"
        keywords="discount, sale, promotion, one-time purchase, Google Play"
      />
      <h1>Discounts</h1>
      <p>
        Display and handle discounted one-time purchase products on Google Play.
        This feature requires Google Play Billing Library 7.0+ and allows you to
        show original prices, discount percentages, and promotional offers.
      </p>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Platform Support:</strong> This feature is currently
          Android-only. iOS App Store handles discounts differently through
          promotional offers and introductory prices for subscriptions.
        </p>
      </div>

      <section>
        <AnchorLink id="overview" level="h2">
          Overview
        </AnchorLink>
        <p>
          Google Play Billing Library 7.0+ introduced support for one-time
          purchase discounts. When you configure a discount in Google Play
          Console, the library provides:
        </p>
        <ul>
          <li>
            <strong>Multiple Offers</strong> - Products can have multiple offers
            with different prices
          </li>
          <li>
            <strong>Discount Information</strong> - Percentage or fixed amount
            discounts
          </li>
          <li>
            <strong>Full Price</strong> - Original price before discount for
            strikethrough display
          </li>
          <li>
            <strong>Time Windows</strong> - Start and end times for limited-time
            offers
          </li>
          <li>
            <strong>Quantity Limits</strong> - Maximum and remaining quantities
            for limited offers
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="data-structure" level="h2">
          Data Structure
        </AnchorLink>
        <p>
          The <code>oneTimePurchaseOfferDetailsAndroid</code> field is now an
          array containing all available offers for a product:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface ProductAndroidOneTimePurchaseOfferDetail {
  // Offer identification
  offerId: string | null;
  offerToken: string;
  offerTags: string[];

  // Pricing
  formattedPrice: string;      // "$4.99"
  priceCurrencyCode: string;   // "USD"
  priceAmountMicros: string;   // "4990000"

  // Discount information (only for discounted offers)
  fullPriceMicros: string | null;           // Original price: "9990000"
  discountDisplayInfo: DiscountDisplayInfoAndroid | null;

  // Time and quantity limits
  validTimeWindow: ValidTimeWindowAndroid | null;
  limitedQuantityInfo: LimitedQuantityInfoAndroid | null;

  // Special offer types
  preorderDetailsAndroid: PreorderDetailsAndroid | null;
  rentalDetailsAndroid: RentalDetailsAndroid | null;
}

interface DiscountDisplayInfoAndroid {
  percentageDiscount: number | null;  // 50 for 50% off
  discountAmount: DiscountAmountAndroid | null;
}

interface DiscountAmountAndroid {
  discountAmountMicros: string;       // "5000000"
  formattedDiscountAmount: string;    // "$5.00"
}

interface ValidTimeWindowAndroid {
  startTimeMillis: string;
  endTimeMillis: string;
}

interface LimitedQuantityInfoAndroid {
  maximumQuantity: number;
  remainingQuantity: number;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not support one-time purchase discounts in the same way.
// For iOS promotional offers, see the Subscription feature documentation.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class ProductAndroidOneTimePurchaseOfferDetail(
    // Offer identification
    val offerId: String?,
    val offerToken: String,
    val offerTags: List<String>,

    // Pricing
    val formattedPrice: String,      // "$4.99"
    val priceCurrencyCode: String,   // "USD"
    val priceAmountMicros: String,   // "4990000"

    // Discount information (only for discounted offers)
    val fullPriceMicros: String?,           // Original price: "9990000"
    val discountDisplayInfo: DiscountDisplayInfoAndroid?,

    // Time and quantity limits
    val validTimeWindow: ValidTimeWindowAndroid?,
    val limitedQuantityInfo: LimitedQuantityInfoAndroid?,

    // Special offer types
    val preorderDetailsAndroid: PreorderDetailsAndroid?,
    val rentalDetailsAndroid: RentalDetailsAndroid?
)

data class DiscountDisplayInfoAndroid(
    val percentageDiscount: Int?,  // 50 for 50% off
    val discountAmount: DiscountAmountAndroid?
)

data class DiscountAmountAndroid(
    val discountAmountMicros: String,       // "5000000"
    val formattedDiscountAmount: String     // "$5.00"
)

data class ValidTimeWindowAndroid(
    val startTimeMillis: String,
    val endTimeMillis: String
)

data class LimitedQuantityInfoAndroid(
    val maximumQuantity: Int,
    val remainingQuantity: Int
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class ProductAndroidOneTimePurchaseOfferDetail {
  // Offer identification
  final String? offerId;
  final String offerToken;
  final List<String> offerTags;

  // Pricing
  final String formattedPrice;      // "\$4.99"
  final String priceCurrencyCode;   // "USD"
  final String priceAmountMicros;   // "4990000"

  // Discount information (only for discounted offers)
  final String? fullPriceMicros;           // Original price: "9990000"
  final DiscountDisplayInfoAndroid? discountDisplayInfo;

  // Time and quantity limits
  final ValidTimeWindowAndroid? validTimeWindow;
  final LimitedQuantityInfoAndroid? limitedQuantityInfo;
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`class_name ProductAndroidOneTimePurchaseOfferDetail

# Offer identification
var offer_id: String          # May be empty
var offer_token: String       # Required for purchase
var offer_tags: Array[String] # Tags for categorization

# Pricing
var formatted_price: String       # "$4.99"
var price_currency_code: String   # "USD"
var price_amount_micros: String   # "4990000"

# Discount information (only for discounted offers)
var full_price_micros: String     # Original price: "9990000"
var discount_display_info: DiscountDisplayInfoAndroid

# Time and quantity limits
var valid_time_window: ValidTimeWindowAndroid
var limited_quantity_info: LimitedQuantityInfoAndroid`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="fetching-products" level="h2">
          Fetching Products with Discounts
        </AnchorLink>
        <p>
          Fetch products normally using <code>fetchProducts</code>. Discounted
          offers will be included in the{' '}
          <code>oneTimePurchaseOfferDetailsAndroid</code> array:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

const products = await fetchProducts({
  skus: ['premium_feature', 'coins_100'],
});

products.forEach((product) => {
  const offers = product.oneTimePurchaseOfferDetailsAndroid;

  if (offers && offers.length > 0) {
    const firstOffer = offers[0];
    const hasDiscount = firstOffer.discountDisplayInfo != null;

    console.log('Product:', product.id);
    console.log('Display Price:', product.displayPrice);

    if (hasDiscount) {
      const discount = firstOffer.discountDisplayInfo;
      const fullPriceMicros = parseInt(firstOffer.fullPriceMicros || '0', 10);
      const fullPrice = fullPriceMicros / 1_000_000;

      console.log('Original Price:', fullPrice);
      console.log('Discount:', discount?.percentageDiscount + '% OFF');
    }
  }
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not support one-time purchase discounts.
// Products are fetched the same way, but discount fields will not be present.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore

val iapStore = OpenIapStore.shared

val products = iapStore.fetchProducts(
    ProductRequest(
        skus = listOf("premium_feature", "coins_100"),
        type = ProductQueryType.InApp
    )
)

products.forEach { product ->
    val offers = product.oneTimePurchaseOfferDetailsAndroid

    if (!offers.isNullOrEmpty()) {
        val firstOffer = offers.first()
        val hasDiscount = firstOffer.discountDisplayInfo != null

        println("Product: \${product.id}")
        println("Display Price: \${product.displayPrice}")

        if (hasDiscount) {
            val discount = firstOffer.discountDisplayInfo
            val fullPriceMicros = firstOffer.fullPriceMicros?.toLongOrNull() ?: 0L
            val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0

            println("Original Price: $fullPrice")
            println("Discount: \${discount?.percentageDiscount}% OFF")
        }
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final products = await FlutterInappPurchase.instance.getProducts(
  ['premium_feature', 'coins_100'],
);

for (final product in products) {
  final offers = product.oneTimePurchaseOfferDetailsAndroid;

  if (offers != null && offers.isNotEmpty) {
    final firstOffer = offers.first;
    final hasDiscount = firstOffer.discountDisplayInfo != null;

    print('Product: \${product.productId}');
    print('Display Price: \${product.localizedPrice}');

    if (hasDiscount) {
      final discount = firstOffer.discountDisplayInfo!;
      final fullPriceMicros = int.tryParse(firstOffer.fullPriceMicros ?? '0') ?? 0;
      final fullPrice = fullPriceMicros / 1000000;

      print('Original Price: $fullPrice');
      print('Discount: \${discount.percentageDiscount}% OFF');
    }
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var request = ProductRequest.new()
request.skus = ["premium_feature", "coins_100"]
request.type = ProductQueryType.IN_APP
var products = await iap.fetch_products(request)

for product in products:
    var offers = product.one_time_purchase_offer_details_android

    if offers and offers.size() > 0:
        var first_offer = offers[0]
        var has_discount = first_offer.discount_display_info != null

        print("Product: %s" % product.id)
        print("Display Price: %s" % product.display_price)

        if has_discount:
            var discount = first_offer.discount_display_info
            var full_price_micros = int(first_offer.full_price_micros) if first_offer.full_price_micros else 0
            var full_price = full_price_micros / 1000000.0

            print("Original Price: %.2f" % full_price)
            print("Discount: %d%% OFF" % discount.percentage_discount)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="displaying-discounts" level="h2">
          Displaying Discounts in UI
        </AnchorLink>
        <p>
          Show discount information to users with strikethrough original prices
          and discount badges:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { View, Text, StyleSheet } from 'react-native';
import type { ProductAndroid } from 'expo-iap';

function ProductCard({ product }: { product: ProductAndroid }) {
  const offers = product.oneTimePurchaseOfferDetailsAndroid;
  const firstOffer = offers?.[0];
  const discount = firstOffer?.discountDisplayInfo;
  const hasDiscount = discount != null;

  // Calculate original price for strikethrough
  const fullPriceMicros = parseInt(firstOffer?.fullPriceMicros || '0', 10);
  const fullPrice = fullPriceMicros / 1_000_000;
  const currency = firstOffer?.priceCurrencyCode || '';

  // Build discount text
  const getDiscountText = () => {
    if (!discount) return null;
    if (discount.percentageDiscount) {
      return \`\${discount.percentageDiscount}% OFF\`;
    }
    if (discount.discountAmount) {
      return \`\${discount.discountAmount.formattedDiscountAmount} OFF\`;
    }
    return 'SALE';
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.description}>{product.description}</Text>

      <View style={styles.priceContainer}>
        {/* Original price with strikethrough */}
        {hasDiscount && fullPriceMicros > 0 && (
          <Text style={styles.originalPrice}>
            {currency} {fullPrice.toFixed(2)}
          </Text>
        )}

        {/* Current (discounted) price */}
        <Text style={[styles.price, hasDiscount && styles.discountedPrice]}>
          {product.displayPrice}
        </Text>

        {/* Discount badge */}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{getDiscountText()}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  discountedPrice: {
    color: '#34C759', // Green for discounted price
  },
  discountBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not support one-time purchase discounts in the same way.
// For subscription promotional offers on iOS, see the Subscription documentation.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`@Composable
fun ProductCard(
    product: ProductAndroid,
    onPurchase: () -> Unit
) {
    val firstOffer = product.oneTimePurchaseOfferDetailsAndroid?.firstOrNull()
    val discountInfo = firstOffer?.discountDisplayInfo
    val hasDiscount = discountInfo != null

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = product.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = product.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Original price with strikethrough
                if (hasDiscount && firstOffer?.fullPriceMicros != null) {
                    val fullPriceMicros = firstOffer.fullPriceMicros?.toLongOrNull() ?: 0L
                    val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0
                    Text(
                        text = "\${firstOffer.priceCurrencyCode} \${String.format("%.2f", fullPrice)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough
                    )
                }

                // Current (discounted) price
                Text(
                    text = product.displayPrice,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (hasDiscount) Color(0xFF34C759) else MaterialTheme.colorScheme.primary
                )

                // Discount badge
                if (hasDiscount) {
                    val discountText = when {
                        discountInfo?.percentageDiscount != null ->
                            "\${discountInfo.percentageDiscount}% OFF"
                        discountInfo?.discountAmount != null ->
                            "\${discountInfo.discountAmount?.formattedDiscountAmount} OFF"
                        else -> "SALE"
                    }
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color(0xFFFF3B30).copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = discountText,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFF3B30)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onPurchase,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Buy Now")
            }
        }
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Product card with discount display (Godot Control)
extends PanelContainer

@onready var title_label = $VBox/TitleLabel
@onready var price_label = $VBox/PriceContainer/PriceLabel
@onready var original_price_label = $VBox/PriceContainer/OriginalPriceLabel
@onready var discount_badge = $VBox/PriceContainer/DiscountBadge
@onready var buy_button = $VBox/BuyButton

var product: ProductAndroid

func setup(p: ProductAndroid) -> void:
    product = p

    var offers = product.one_time_purchase_offer_details_android
    var first_offer = offers[0] if offers and offers.size() > 0 else null
    var discount = first_offer.discount_display_info if first_offer else null
    var has_discount = discount != null

    title_label.text = product.title
    price_label.text = product.display_price

    if has_discount and first_offer.full_price_micros:
        var full_price_micros = int(first_offer.full_price_micros)
        var full_price = full_price_micros / 1000000.0
        original_price_label.text = "%s %.2f" % [first_offer.price_currency_code, full_price]
        original_price_label.visible = true

        # Set discount badge text
        if discount.percentage_discount:
            discount_badge.text = "%d%% OFF" % discount.percentage_discount
        elif discount.discount_amount:
            discount_badge.text = "%s OFF" % discount.discount_amount.formatted_discount_amount
        else:
            discount_badge.text = "SALE"
        discount_badge.visible = true

        # Green color for discounted price
        price_label.modulate = Color(0.2, 0.78, 0.35)
    else:
        original_price_label.visible = false
        discount_badge.visible = false

func _on_buy_button_pressed() -> void:
    var offers = product.one_time_purchase_offer_details_android
    if offers and offers.size() > 0:
        emit_signal("purchase_requested", product, offers[0].offer_token)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="time-limited-offers" level="h2">
          Time-Limited Offers
        </AnchorLink>
        <p>
          Check if an offer has a time window and display countdown or
          expiration information:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`function checkOfferValidity(offer: ProductAndroidOneTimePurchaseOfferDetail) {
  const timeWindow = offer.validTimeWindow;

  if (!timeWindow) {
    return { isValid: true, message: 'Always available' };
  }

  const now = Date.now();
  const startTime = parseInt(timeWindow.startTimeMillis, 10);
  const endTime = parseInt(timeWindow.endTimeMillis, 10);

  if (now < startTime) {
    const startsIn = new Date(startTime);
    return {
      isValid: false,
      message: \`Starts on \${startsIn.toLocaleDateString()}\`,
    };
  }

  if (now > endTime) {
    return { isValid: false, message: 'Offer expired' };
  }

  const endsIn = endTime - now;
  const hoursLeft = Math.floor(endsIn / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);

  if (daysLeft > 0) {
    return { isValid: true, message: \`Ends in \${daysLeft} days\` };
  }

  return { isValid: true, message: \`Ends in \${hoursLeft} hours\` };
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not have time-limited one-time purchase offers.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class OfferValidity(
    val isValid: Boolean,
    val message: String
)

fun checkOfferValidity(offer: ProductAndroidOneTimePurchaseOfferDetail): OfferValidity {
    val timeWindow = offer.validTimeWindow
        ?: return OfferValidity(true, "Always available")

    val now = System.currentTimeMillis()
    val startTime = timeWindow.startTimeMillis.toLongOrNull() ?: 0L
    val endTime = timeWindow.endTimeMillis.toLongOrNull() ?: 0L

    if (now < startTime) {
        val startsIn = java.util.Date(startTime)
        return OfferValidity(false, "Starts on \${startsIn}")
    }

    if (now > endTime) {
        return OfferValidity(false, "Offer expired")
    }

    val endsIn = endTime - now
    val hoursLeft = (endsIn / (1000 * 60 * 60)).toInt()
    val daysLeft = hoursLeft / 24

    return if (daysLeft > 0) {
        OfferValidity(true, "Ends in $daysLeft days")
    } else {
        OfferValidity(true, "Ends in $hoursLeft hours")
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func check_offer_validity(offer: ProductAndroidOneTimePurchaseOfferDetail) -> Dictionary:
    var time_window = offer.valid_time_window

    if not time_window:
        return {"is_valid": true, "message": "Always available"}

    var now = Time.get_unix_time_from_system() * 1000
    var start_time = int(time_window.start_time_millis)
    var end_time = int(time_window.end_time_millis)

    if now < start_time:
        var starts_in = Time.get_datetime_dict_from_unix_time(start_time / 1000)
        return {
            "is_valid": false,
            "message": "Starts on %04d-%02d-%02d" % [starts_in.year, starts_in.month, starts_in.day]
        }

    if now > end_time:
        return {"is_valid": false, "message": "Offer expired"}

    var ends_in = end_time - now
    var hours_left = int(ends_in / (1000 * 60 * 60))
    var days_left = hours_left / 24

    if days_left > 0:
        return {"is_valid": true, "message": "Ends in %d days" % days_left}

    return {"is_valid": true, "message": "Ends in %d hours" % hours_left}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="limited-quantity-offers" level="h2">
          Limited Quantity Offers
        </AnchorLink>
        <p>
          Some offers have quantity limits. Check remaining availability before
          displaying:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`function checkQuantityAvailability(offer: ProductAndroidOneTimePurchaseOfferDetail) {
  const quantityInfo = offer.limitedQuantityInfo;

  if (!quantityInfo) {
    return { isAvailable: true, message: null };
  }

  const { maximumQuantity, remainingQuantity } = quantityInfo;

  if (remainingQuantity <= 0) {
    return {
      isAvailable: false,
      message: 'Sold out - limit reached',
    };
  }

  if (remainingQuantity <= 3) {
    return {
      isAvailable: true,
      message: \`Only \${remainingQuantity} left!\`,
    };
  }

  return {
    isAvailable: true,
    message: \`\${remainingQuantity} of \${maximumQuantity} available\`,
  };
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not have limited quantity one-time purchase offers.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class QuantityAvailability(
    val isAvailable: Boolean,
    val message: String?
)

fun checkQuantityAvailability(offer: ProductAndroidOneTimePurchaseOfferDetail): QuantityAvailability {
    val quantityInfo = offer.limitedQuantityInfo
        ?: return QuantityAvailability(true, null)

    val (maximumQuantity, remainingQuantity) = quantityInfo

    if (remainingQuantity <= 0) {
        return QuantityAvailability(false, "Sold out - limit reached")
    }

    if (remainingQuantity <= 3) {
        return QuantityAvailability(true, "Only $remainingQuantity left!")
    }

    return QuantityAvailability(true, "$remainingQuantity of $maximumQuantity available")
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func check_quantity_availability(offer: ProductAndroidOneTimePurchaseOfferDetail) -> Dictionary:
    var quantity_info = offer.limited_quantity_info

    if not quantity_info:
        return {"is_available": true, "message": null}

    var maximum_quantity = quantity_info.maximum_quantity
    var remaining_quantity = quantity_info.remaining_quantity

    if remaining_quantity <= 0:
        return {"is_available": false, "message": "Sold out - limit reached"}

    if remaining_quantity <= 3:
        return {"is_available": true, "message": "Only %d left!" % remaining_quantity}

    return {"is_available": true, "message": "%d of %d available" % [remaining_quantity, maximum_quantity]}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="purchasing-with-offer" level="h2">
          Purchasing with Specific Offer
        </AnchorLink>
        <p>
          When purchasing a discounted product, use the <code>offerToken</code>{' '}
          from the specific offer you want to apply:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

async function purchaseWithOffer(
  product: ProductAndroid,
  offerIndex: number = 0
) {
  const offers = product.oneTimePurchaseOfferDetailsAndroid;

  if (!offers || offers.length === 0) {
    throw new Error('No offers available for this product');
  }

  const selectedOffer = offers[offerIndex];

  await requestPurchase({
    type: 'inapp',
    request: {
      skus: [product.id],
      // Include offerToken for discounted purchases
      offerToken: selectedOffer.offerToken,
    },
  });
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not use offer tokens for one-time purchases.
// Simply request the purchase with the product ID.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun purchaseWithOffer(
    activity: Activity,
    product: ProductAndroid,
    offerIndex: Int = 0
) {
    val offers = product.oneTimePurchaseOfferDetailsAndroid
        ?: throw IllegalStateException("No offers available")

    val selectedOffer = offers.getOrNull(offerIndex)
        ?: throw IllegalStateException("Invalid offer index")

    iapStore.requestPurchase(
        activity = activity,
        props = RequestPurchaseProps(
            type = "inapp",
            request = RequestPurchasePropsByPlatforms(
                android = RequestPurchaseAndroidProps(
                    skus = listOf(product.id),
                    offerToken = selectedOffer.offerToken
                )
            )
        )
    )
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func purchase_with_offer(product: ProductAndroid, offer_index: int = 0) -> void:
    var offers = product.one_time_purchase_offer_details_android

    if not offers or offers.size() == 0:
        push_error("No offers available for this product")
        return

    if offer_index >= offers.size():
        push_error("Invalid offer index")
        return

    var selected_offer = offers[offer_index]

    var props = RequestPurchaseProps.new()
    props.type = ProductType.IN_APP
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product.id]
    props.request.google.offer_token = selected_offer.offer_token

    await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="google-play-console" level="h2">
          Setting Up Discounts in Google Play Console
        </AnchorLink>
        <p>To create discounted offers for one-time products:</p>
        <ol>
          <li>Go to Google Play Console &gt; Monetization &gt; Products</li>
          <li>Select your one-time product or create a new one</li>
          <li>
            In the product details, look for the <strong>Offers</strong> section
          </li>
          <li>
            Click <strong>Add offer</strong> to create a promotional offer
          </li>
          <li>
            Configure:
            <ul>
              <li>
                <strong>Discount type</strong>: Percentage or fixed amount
              </li>
              <li>
                <strong>Discount value</strong>: The discount percentage or
                amount
              </li>
              <li>
                <strong>Time window</strong>: Start and end dates (optional)
              </li>
              <li>
                <strong>Quantity limit</strong>: Maximum purchases per user
                (optional)
              </li>
            </ul>
          </li>
          <li>
            Save and publish your changes - it may take a few hours for changes
            to propagate
          </li>
        </ol>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Note:</strong> Discount features require Google Play Billing
            Library 7.0+. Make sure your app uses a compatible version of the
            OpenIAP library.
          </p>
        </div>
      </section>

      <section>
        <AnchorLink id="best-practices" level="h2">
          Best Practices
        </AnchorLink>
        <ul>
          <li>
            <strong>Always show original price</strong> - Display the
            strikethrough original price next to the discounted price to
            highlight the value
          </li>
          <li>
            <strong>Use urgency indicators</strong> - Show countdown timers for
            time-limited offers
          </li>
          <li>
            <strong>Handle multiple offers</strong> - If a product has multiple
            offers, let users choose or automatically select the best discount
          </li>
          <li>
            <strong>Graceful degradation</strong> - If discount info is not
            available, display the regular price without errors
          </li>
          <li>
            <strong>Cache carefully</strong> - Discount offers can change; fetch
            fresh product data periodically
          </li>
          <li>
            <strong>Test with license testers</strong> - Use Google Play Console
            license testers to verify discount display before release
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Discount;
