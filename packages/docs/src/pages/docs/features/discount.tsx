import { Link } from 'react-router-dom';
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
        This feature requires Google Play Billing Library 8.0+ and allows you to
        show original prices, discount percentages, and promotional offers.
      </p>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Platform Support:</strong> This feature is currently
          Android-only. iOS App Store handles discounts differently through
          promotional offers and introductory prices for subscriptions.
        </p>
      </div>

      <div className="alert-card alert-card--info">
        <p>
          <strong>Standardized API:</strong> Read{' '}
          <code>ProductAndroid.discountOffers</code>. Each{' '}
          <Link to="/docs/types/discount-offer">DiscountOffer</Link> exposes
          common price fields and Android-only details through the{' '}
          <code>Android</code> suffix (for example,{' '}
          <code>offerTokenAndroid</code>). The older{' '}
          <code>oneTimePurchaseOfferDetailsAndroid</code> field is deprecated.
        </p>
      </div>

      <section>
        <AnchorLink id="overview" level="h2">
          Overview
        </AnchorLink>
        <p>
          Google Play Billing Library 8.0+ introduced support for one-time
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
          The <code>discountOffers</code> field contains standardized{' '}
          <code>DiscountOffer</code> values. The following excerpts use the
          generated field names:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`interface ProductAndroid {
  discountOffers?: DiscountOffer[] | null;
}

interface DiscountOffer {
  id?: string | null;
  displayPrice: string;                    // "$4.99"
  price: number;                           // 4.99
  currency: string;                        // "USD"
  type: DiscountOfferType;                 // "one-time"
  offerTokenAndroid?: string | null;
  offerTagsAndroid?: string[] | null;
  fullPriceMicrosAndroid?: string | null;  // "9990000"
  percentageDiscountAndroid?: number | null;
  discountAmountMicrosAndroid?: string | null;
  formattedDiscountAmountAndroid?: string | null;
  validTimeWindowAndroid?: ValidTimeWindowAndroid | null;
  limitedQuantityInfoAndroid?: LimitedQuantityInfoAndroid | null;
  preorderDetailsAndroid?: PreorderDetailsAndroid | null;
  rentalDetailsAndroid?: RentalDetailsAndroid | null;
  purchaseOptionIdAndroid?: string | null;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not support one-time purchase discounts in the same way.
// For iOS subscription offers, use SubscriptionOffer instead.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`data class ProductAndroid(
    val discountOffers: List<DiscountOffer>? = null,
    // ...
)

data class DiscountOffer(
    val id: String? = null,
    val displayPrice: String,
    val price: Double,
    val currency: String,
    val type: DiscountOfferType,
    val offerTokenAndroid: String? = null,
    val offerTagsAndroid: List<String>? = null,
    val fullPriceMicrosAndroid: String? = null,
    val percentageDiscountAndroid: Int? = null,
    val discountAmountMicrosAndroid: String? = null,
    val formattedDiscountAmountAndroid: String? = null,
    val validTimeWindowAndroid: ValidTimeWindowAndroid? = null,
    val limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid? = null,
    val preorderDetailsAndroid: PreorderDetailsAndroid? = null,
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    val purchaseOptionIdAndroid: String? = null
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`data class ProductAndroid(
    val discountOffers: List<DiscountOffer>? = null,
    // ...
)

data class DiscountOffer(
    val id: String? = null,
    val displayPrice: String,
    val price: Double,
    val currency: String,
    val type: DiscountOfferType,
    val offerTokenAndroid: String? = null,
    val offerTagsAndroid: List<String>? = null,
    val fullPriceMicrosAndroid: String? = null,
    val percentageDiscountAndroid: Int? = null,
    val discountAmountMicrosAndroid: String? = null,
    val formattedDiscountAmountAndroid: String? = null,
    val validTimeWindowAndroid: ValidTimeWindowAndroid? = null,
    val limitedQuantityInfoAndroid: LimitedQuantityInfoAndroid? = null,
    val preorderDetailsAndroid: PreorderDetailsAndroid? = null,
    val rentalDetailsAndroid: RentalDetailsAndroid? = null,
    val purchaseOptionIdAndroid: String? = null
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`class ProductAndroid {
  final List<DiscountOffer>? discountOffers;
  // ...
}

class DiscountOffer {
  final String? id;
  final String displayPrice;                    // "\$4.99"
  final double price;                           // 4.99
  final String currency;                        // "USD"
  final DiscountOfferType type;
  final String? offerTokenAndroid;
  final List<String>? offerTagsAndroid;
  final String? fullPriceMicrosAndroid;          // "9990000"
  final int? percentageDiscountAndroid;
  final String? discountAmountMicrosAndroid;
  final String? formattedDiscountAmountAndroid;
  final ValidTimeWindowAndroid? validTimeWindowAndroid;
  final LimitedQuantityInfoAndroid? limitedQuantityInfoAndroid;
  final PreorderDetailsAndroid? preorderDetailsAndroid;
  final RentalDetailsAndroid? rentalDetailsAndroid;
  final String? purchaseOptionIdAndroid;
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using System.Collections.Generic;

public sealed record ProductAndroid
{
    public IReadOnlyList<DiscountOffer>? DiscountOffers { get; init; }
    // ...
}

public sealed record DiscountOffer
{
    public string? Id { get; init; }
    public required string DisplayPrice { get; init; }              // "$4.99"
    public required double Price { get; init; }                     // 4.99
    public required string Currency { get; init; }                  // "USD"
    public required DiscountOfferType Type { get; init; }
    public string? OfferTokenAndroid { get; init; }
    public IReadOnlyList<string>? OfferTagsAndroid { get; init; }
    public string? FullPriceMicrosAndroid { get; init; }            // "9990000"
    public int? PercentageDiscountAndroid { get; init; }
    public string? DiscountAmountMicrosAndroid { get; init; }
    public string? FormattedDiscountAmountAndroid { get; init; }
    public ValidTimeWindowAndroid? ValidTimeWindowAndroid { get; init; }
    public LimitedQuantityInfoAndroid? LimitedQuantityInfoAndroid { get; init; }
    public PreorderDetailsAndroid? PreorderDetailsAndroid { get; init; }
    public RentalDetailsAndroid? RentalDetailsAndroid { get; init; }
    public string? PurchaseOptionIdAndroid { get; init; }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`class ProductAndroid:
    var discount_offers: Array[DiscountOffer] = []
    # ...

class DiscountOffer:
    var id: Variant = null
    var display_price: String = ""                  # "$4.99"
    var price: float = 0.0                          # 4.99
    var currency: String = ""                       # "USD"
    var type: DiscountOfferType
    var offer_token_android: Variant = null
    var offer_tags_android: Array[String] = []
    var full_price_micros_android: Variant = null   # "9990000"
    var percentage_discount_android: Variant = null
    var discount_amount_micros_android: Variant = null
    var formatted_discount_amount_android: Variant = null
    var valid_time_window_android: ValidTimeWindowAndroid
    var limited_quantity_info_android: LimitedQuantityInfoAndroid
    var preorder_details_android: PreorderDetailsAndroid
    var rental_details_android: RentalDetailsAndroid
    var purchase_option_id_android: Variant = null`}</CodeBlock>
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
          one-time offers will be included in the <code>discountOffers</code>{' '}
          array:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

const products = await fetchProducts({
  skus: ['premium_feature', 'coins_100'],
});

products.forEach((product) => {
  if (product.platform !== 'android') return;

  const offers = product.discountOffers;

  if (offers && offers.length > 0) {
    const firstOffer = offers[0];
    const hasDiscount =
      firstOffer.percentageDiscountAndroid != null ||
      firstOffer.discountAmountMicrosAndroid != null;

    console.log('Product:', product.id);
    console.log('Display Price:', firstOffer.displayPrice);

    if (hasDiscount) {
      const fullPriceMicros = parseInt(
        firstOffer.fullPriceMicrosAndroid || '0',
        10,
      );
      const fullPrice = fullPriceMicros / 1_000_000;

      console.log('Original Price:', fullPrice);
      console.log(
        'Discount:',
        firstOffer.percentageDiscountAndroid != null
          ? \`\${firstOffer.percentageDiscountAndroid}% OFF\`
          : firstOffer.formattedDiscountAmountAndroid,
      );
    }
  }
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// iOS does not support one-time purchase discounts.
// Products are fetched the same way, but discount fields will not be present.`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore

val iapStore = OpenIapStore(context)

val result = iapStore.fetchProducts(
    ProductRequest(
        skus = listOf("premium_feature", "coins_100"),
        type = ProductQueryType.InApp
    )
)
val products = (result as? FetchProductsResultProducts)
    ?.value
    .orEmpty()
    .filterIsInstance<ProductAndroid>()

products.forEach { product ->
    val offers = product.discountOffers

    if (!offers.isNullOrEmpty()) {
        val firstOffer = offers.first()
        val hasDiscount =
            firstOffer.percentageDiscountAndroid != null ||
                firstOffer.discountAmountMicrosAndroid != null

        println("Product: \${product.id}")
        println("Display Price: \${firstOffer.displayPrice}")

        if (hasDiscount) {
            val fullPriceMicros =
                firstOffer.fullPriceMicrosAndroid?.toLongOrNull() ?: 0L
            val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0

            println("Original Price: $fullPrice")
            println(
                "Discount: " +
                    (firstOffer.percentageDiscountAndroid?.let { "$it% OFF" }
                        ?: firstOffer.formattedDiscountAmountAndroid)
            )
        }
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

val kmpIAP = KmpIAP()

val result = kmpIAP.fetchProducts(
    ProductRequest(
        skus = listOf("premium_feature", "coins_100"),
        type = ProductQueryType.InApp
    )
)
val products = (result as? FetchProductsResultProducts)
    ?.value
    .orEmpty()
    .filterIsInstance<ProductAndroid>()

products.forEach { product ->
    val offers = product.discountOffers

    if (!offers.isNullOrEmpty()) {
        val firstOffer = offers.first()
        val hasDiscount =
            firstOffer.percentageDiscountAndroid != null ||
                firstOffer.discountAmountMicrosAndroid != null

        println("Product: \${product.id}")
        println("Display Price: \${firstOffer.displayPrice}")

        if (hasDiscount) {
            val fullPriceMicros =
                firstOffer.fullPriceMicrosAndroid?.toLongOrNull() ?: 0L
            val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0

            println("Original Price: $fullPrice")
            println(
                "Discount: " +
                    (firstOffer.percentageDiscountAndroid?.let { "$it% OFF" }
                        ?: firstOffer.formattedDiscountAmountAndroid)
            )
        }
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final products = await FlutterInappPurchase.instance.fetchProducts<Product>(
  skus: ['premium_feature', 'coins_100'],
);

for (final product in products) {
  if (product is! ProductAndroid) continue;
  final offers = product.discountOffers;

  if (offers != null && offers.isNotEmpty) {
    final firstOffer = offers.first;
    final hasDiscount =
        firstOffer.percentageDiscountAndroid != null ||
        firstOffer.discountAmountMicrosAndroid != null;

    print('Product: \${product.id}');
    print('Display Price: \${firstOffer.displayPrice}');

    if (hasDiscount) {
      final fullPriceMicros =
          int.tryParse(firstOffer.fullPriceMicrosAndroid ?? '0') ?? 0;
      final fullPrice = fullPriceMicros / 1000000;

      print('Original Price: $fullPrice');
      final discountText = firstOffer.percentageDiscountAndroid != null
          ? '\${firstOffer.percentageDiscountAndroid}% OFF'
          : firstOffer.formattedDiscountAmountAndroid;
      print('Discount: $discountText');
    }
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using System;
using OpenIap.Maui;
using System.Linq;

var result = await ((QueryResolver)OpenIapClient.Instance).FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "premium_feature", "coins_100" },
    Type = ProductQueryType.InApp,
});

var products = result is FetchProductsResultProducts productResult
    ? productResult.Value?.OfType<ProductAndroid>() ?? Enumerable.Empty<ProductAndroid>()
    : Enumerable.Empty<ProductAndroid>();

foreach (var product in products)
{
    var firstOffer = product.DiscountOffers?.FirstOrDefault();
    if (firstOffer is null)
    {
        continue;
    }

    Console.WriteLine($"Product: {product.Id}");
    Console.WriteLine($"Display Price: {firstOffer.DisplayPrice}");

    var hasDiscount = firstOffer.PercentageDiscountAndroid is not null
        || firstOffer.DiscountAmountMicrosAndroid is not null;
    if (hasDiscount)
    {
        var fullPriceMicros = long.TryParse(
            firstOffer.FullPriceMicrosAndroid,
            out var micros)
            ? micros
            : 0;
        var fullPrice = fullPriceMicros / 1_000_000.0;
        var discountText = firstOffer.PercentageDiscountAndroid is { } percent
            ? $"{percent}% OFF"
            : firstOffer.FormattedDiscountAmountAndroid;

        Console.WriteLine($"Original Price: {fullPrice}");
        Console.WriteLine($"Discount: {discountText}");
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`var request = ProductRequest.new()
request.skus = ["premium_feature", "coins_100"]
request.type = ProductQueryType.IN_APP
var products = await iap.fetch_products(request)

for product in products:
    var offers = product.discount_offers

    if offers and offers.size() > 0:
        var first_offer = offers[0]
        var has_discount = (
            first_offer.percentage_discount_android != null
            or first_offer.discount_amount_micros_android != null
        )

        print("Product: %s" % product.id)
        print("Display Price: %s" % first_offer.display_price)

        if has_discount:
            var full_price_micros = (
                int(first_offer.full_price_micros_android)
                if first_offer.full_price_micros_android else 0
            )
            var full_price = full_price_micros / 1000000.0

            print("Original Price: %.2f" % full_price)
            if first_offer.percentage_discount_android != null:
                print("Discount: %d%% OFF" % first_offer.percentage_discount_android)
            else:
                print("Discount: %s" % first_offer.formatted_discount_amount_android)`}</CodeBlock>
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
  const offers = product.discountOffers;
  const firstOffer = offers?.[0];
  const hasDiscount =
    firstOffer?.percentageDiscountAndroid != null ||
    firstOffer?.discountAmountMicrosAndroid != null;

  // Calculate original price for strikethrough
  const fullPriceMicros = parseInt(
    firstOffer?.fullPriceMicrosAndroid || '0',
    10,
  );
  const fullPrice = fullPriceMicros / 1_000_000;
  const currency = firstOffer?.currency || '';

  // Build discount text
  const getDiscountText = () => {
    if (!hasDiscount) return null;
    if (firstOffer?.percentageDiscountAndroid != null) {
      return \`\${firstOffer.percentageDiscountAndroid}% OFF\`;
    }
    if (firstOffer?.formattedDiscountAmountAndroid) {
      return \`\${firstOffer.formattedDiscountAmountAndroid} OFF\`;
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
          {firstOffer?.displayPrice ?? product.displayPrice}
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
    val firstOffer = product.discountOffers?.firstOrNull()
    val hasDiscount =
        firstOffer?.percentageDiscountAndroid != null ||
            firstOffer?.discountAmountMicrosAndroid != null

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
                if (hasDiscount && firstOffer?.fullPriceMicrosAndroid != null) {
                    val fullPriceMicros =
                        firstOffer.fullPriceMicrosAndroid?.toLongOrNull() ?: 0L
                    val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0
                    Text(
                        text = "\${firstOffer.currency} \${String.format("%.2f", fullPrice)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough
                    )
                }

                // Current (discounted) price
                Text(
                    text = firstOffer?.displayPrice ?: product.displayPrice,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (hasDiscount) Color(0xFF34C759) else MaterialTheme.colorScheme.primary
                )

                // Discount badge
                if (hasDiscount) {
                    val discountText = when {
                        firstOffer?.percentageDiscountAndroid != null ->
                            "\${firstOffer.percentageDiscountAndroid}% OFF"
                        firstOffer?.formattedDiscountAmountAndroid != null ->
                            "\${firstOffer.formattedDiscountAmountAndroid} OFF"
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
            kmp: (
              <CodeBlock language="kotlin">{`@Composable
fun ProductCard(
    product: ProductAndroid,
    onPurchase: () -> Unit
) {
    val firstOffer = product.discountOffers?.firstOrNull()
    val hasDiscount =
        firstOffer?.percentageDiscountAndroid != null ||
            firstOffer?.discountAmountMicrosAndroid != null

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
                if (hasDiscount && firstOffer?.fullPriceMicrosAndroid != null) {
                    val fullPriceMicros =
                        firstOffer.fullPriceMicrosAndroid?.toLongOrNull() ?: 0L
                    val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0
                    Text(
                        text = "\${firstOffer.currency} \${String.format("%.2f", fullPrice)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough
                    )
                }

                // Current (discounted) price
                Text(
                    text = firstOffer?.displayPrice ?: product.displayPrice,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (hasDiscount) Color(0xFF34C759) else MaterialTheme.colorScheme.primary
                )

                // Discount badge
                if (hasDiscount) {
                    val discountText = when {
                        firstOffer?.percentageDiscountAndroid != null ->
                            "\${firstOffer.percentageDiscountAndroid}% OFF"
                        firstOffer?.formattedDiscountAmountAndroid != null ->
                            "\${firstOffer.formattedDiscountAmountAndroid} OFF"
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System.Linq;

public sealed record ProductCardViewModel
{
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required string Price { get; init; }
    public string? OriginalPrice { get; init; }
    public string? DiscountBadge { get; init; }
}

ProductCardViewModel BuildProductCard(ProductAndroid product)
{
    var firstOffer = product.DiscountOffers?.FirstOrDefault();
    var hasDiscount = firstOffer?.PercentageDiscountAndroid is not null
        || firstOffer?.DiscountAmountMicrosAndroid is not null;

    var originalPrice = firstOffer is { FullPriceMicrosAndroid: { } fullPriceMicros }
        && long.TryParse(fullPriceMicros, out var micros)
        ? $"{firstOffer.Currency} {micros / 1_000_000.0:F2}"
        : null;

    var badge = firstOffer?.PercentageDiscountAndroid is { } percent
        ? $"{percent}% OFF"
        : firstOffer?.FormattedDiscountAmountAndroid is { } amount
            ? $"{amount} OFF"
            : hasDiscount ? "SALE" : null;

    return new ProductCardViewModel
    {
        Title = product.Title,
        Description = product.Description,
        Price = firstOffer?.DisplayPrice ?? product.DisplayPrice,
        OriginalPrice = originalPrice,
        DiscountBadge = badge,
    };
}

async Task PurchaseAsync(ProductAndroid product)
{
    await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { product.Id },
                OfferToken = product.DiscountOffers?
                    .FirstOrDefault()?.OfferTokenAndroid,
            },
        },
        Type = ProductQueryType.InApp,
    });
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

    var offers = product.discount_offers
    var first_offer = offers[0] if offers and offers.size() > 0 else null
    var has_discount = (
        first_offer != null
        and (
            first_offer.percentage_discount_android != null
            or first_offer.discount_amount_micros_android != null
        )
    )

    title_label.text = product.title
    price_label.text = first_offer.display_price if first_offer else product.display_price

    if has_discount and first_offer.full_price_micros_android:
        var full_price_micros = int(first_offer.full_price_micros_android)
        var full_price = full_price_micros / 1000000.0
        original_price_label.text = "%s %.2f" % [first_offer.currency, full_price]
        original_price_label.visible = true

        # Set discount badge text
        if first_offer.percentage_discount_android != null:
            discount_badge.text = "%d%% OFF" % first_offer.percentage_discount_android
        elif first_offer.formatted_discount_amount_android:
            discount_badge.text = "%s OFF" % first_offer.formatted_discount_amount_android
        else:
            discount_badge.text = "SALE"
        discount_badge.visible = true

        # Green color for discounted price
        price_label.modulate = Color(0.2, 0.78, 0.35)
    else:
        original_price_label.visible = false
        discount_badge.visible = false

func _on_buy_button_pressed() -> void:
    var offers = product.discount_offers
    if offers and offers.size() > 0:
        emit_signal("purchase_requested", product, offers[0].offer_token_android)`}</CodeBlock>
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
              <CodeBlock language="typescript">{`function checkOfferValidity(offer: DiscountOffer) {
  const timeWindow = offer.validTimeWindowAndroid;

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

fun checkOfferValidity(offer: DiscountOffer): OfferValidity {
    val timeWindow = offer.validTimeWindowAndroid
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
            kmp: (
              <CodeBlock language="kotlin">{`data class OfferValidity(
    val isValid: Boolean,
    val message: String
)

fun checkOfferValidity(offer: DiscountOffer): OfferValidity {
    val timeWindow = offer.validTimeWindowAndroid
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using System;

public sealed record OfferValidity(bool IsValid, string Message);

OfferValidity CheckOfferValidity(DiscountOffer offer)
{
    var timeWindow = offer.ValidTimeWindowAndroid;
    if (timeWindow is null)
    {
        return new OfferValidity(true, "Always available");
    }

    var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    var startTime = long.TryParse(timeWindow.StartTimeMillis, out var start)
        ? start
        : 0;
    var endTime = long.TryParse(timeWindow.EndTimeMillis, out var end)
        ? end
        : 0;

    if (now < startTime)
    {
        var startsIn = DateTimeOffset.FromUnixTimeMilliseconds(startTime);
        return new OfferValidity(false, $"Starts on {startsIn:d}");
    }

    if (now > endTime)
    {
        return new OfferValidity(false, "Offer expired");
    }

    var endsIn = endTime - now;
    var hoursLeft = (int)(endsIn / (1000 * 60 * 60));
    var daysLeft = hoursLeft / 24;

    return daysLeft > 0
        ? new OfferValidity(true, $"Ends in {daysLeft} days")
        : new OfferValidity(true, $"Ends in {hoursLeft} hours");
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func check_offer_validity(offer: DiscountOffer) -> Dictionary:
    var time_window = offer.valid_time_window_android

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
              <CodeBlock language="typescript">{`function checkQuantityAvailability(offer: DiscountOffer) {
  const quantityInfo = offer.limitedQuantityInfoAndroid;

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

fun checkQuantityAvailability(offer: DiscountOffer): QuantityAvailability {
    val quantityInfo = offer.limitedQuantityInfoAndroid
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
            kmp: (
              <CodeBlock language="kotlin">{`data class QuantityAvailability(
    val isAvailable: Boolean,
    val message: String?
)

fun checkQuantityAvailability(offer: DiscountOffer): QuantityAvailability {
    val quantityInfo = offer.limitedQuantityInfoAndroid
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
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;

public sealed record QuantityAvailability(bool IsAvailable, string? Message);

QuantityAvailability CheckQuantityAvailability(DiscountOffer offer)
{
    var quantityInfo = offer.LimitedQuantityInfoAndroid;
    if (quantityInfo is null)
    {
        return new QuantityAvailability(true, null);
    }

    var maximumQuantity = quantityInfo.MaximumQuantity;
    var remainingQuantity = quantityInfo.RemainingQuantity;

    if (remainingQuantity <= 0)
    {
        return new QuantityAvailability(false, "Sold out - limit reached");
    }

    if (remainingQuantity <= 3)
    {
        return new QuantityAvailability(true, $"Only {remainingQuantity} left!");
    }

    return new QuantityAvailability(
        true,
        $"{remainingQuantity} of {maximumQuantity} available");
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func check_quantity_availability(offer: DiscountOffer) -> Dictionary:
    var quantity_info = offer.limited_quantity_info_android

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
          When purchasing a discounted product, pass the selected offer's{' '}
          <code>offerTokenAndroid</code> to the Android purchase request:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

async function purchaseWithOffer(
  product: ProductAndroid,
  offerIndex: number = 0
) {
  const offers = product.discountOffers;

  if (!offers || offers.length === 0) {
    throw new Error('No offers available for this product');
  }

  const selectedOffer = offers[offerIndex];

  await requestPurchase({
    type: 'in-app',
    request: {
      google: {
        skus: [product.id],
        // Pass the standardized offer's Android token.
        offerToken: selectedOffer.offerTokenAndroid,
      },
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
    product: ProductAndroid,
    offerIndex: Int = 0
) {
    val offers = product.discountOffers
        ?: throw IllegalStateException("No offers available")

    val selectedOffer = offers.getOrNull(offerIndex)
        ?: throw IllegalStateException("Invalid offer index")

    iapStore.requestPurchase(
        RequestPurchaseProps(
            type = ProductQueryType.InApp,
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(product.id),
                        // Pass the standardized offer's Android token.
                        offerToken = selectedOffer.offerTokenAndroid
                    )
                )
            )
        )
    )
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`suspend fun purchaseWithOffer(
    product: ProductAndroid,
    offerIndex: Int = 0
) {
    val offers = product.discountOffers
        ?: throw IllegalStateException("No offers available")

    val selectedOffer = offers.getOrNull(offerIndex)
        ?: throw IllegalStateException("Invalid offer index")

    kmpIAP.requestPurchase(
        RequestPurchaseProps(
            type = ProductQueryType.InApp,
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(product.id),
                        // Pass the standardized offer's Android token.
                        offerToken = selectedOffer.offerTokenAndroid
                    )
                )
            )
        )
    )
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;
using System;
using System.Linq;

async Task PurchaseWithOfferAsync(ProductAndroid product, int offerIndex = 0)
{
    var offers = product.DiscountOffers
        ?? throw new InvalidOperationException("No offers available");

    var selectedOffer = offers.ElementAtOrDefault(offerIndex)
        ?? throw new ArgumentOutOfRangeException(nameof(offerIndex));

    await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(new RequestPurchaseProps
    {
        Type = ProductQueryType.InApp,
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { product.Id },
                // Pass the standardized offer's Android token.
                OfferToken = selectedOffer.OfferTokenAndroid,
            },
        },
    });
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func purchase_with_offer(product: ProductAndroid, offer_index: int = 0) -> void:
    var offers = product.discount_offers

    if not offers or offers.size() == 0:
        push_error("No offers available for this product")
        return

    if offer_index >= offers.size():
        push_error("Invalid offer index")
        return

    var selected_offer = offers[offer_index]

    var props = RequestPurchaseProps.new()
    props.type = ProductQueryType.IN_APP
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product.id]
    props.request.google.offer_token = selected_offer.offer_token_android

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
            Library 8.0+. Make sure your app uses a compatible version of the
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

      <section>
        <AnchorLink id="references" level="h2">
          Native References
        </AnchorLink>
        <ul>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.OneTimePurchaseOfferDetails"
              target="_blank"
              rel="noopener noreferrer"
            >
              ProductDetails.OneTimePurchaseOfferDetails
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-0-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Billing Library 8.0 release notes
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Discount;
