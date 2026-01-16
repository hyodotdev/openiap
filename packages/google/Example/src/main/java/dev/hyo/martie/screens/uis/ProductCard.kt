package dev.hyo.martie.screens.uis

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.hyo.martie.models.AppColors
import dev.hyo.openiap.DiscountOffer
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductType
import java.util.Locale

@Composable
fun ProductCard(
    product: ProductAndroid,
    isPurchasing: Boolean = false,
    onPurchase: () -> Unit,
    onClick: () -> Unit = {},
    onDetails: () -> Unit = onClick,
    isSubscribed: Boolean = false
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Prefer a cleaner title (avoid app suffix in parentheses if present)
                val mainTitle = product.displayName ?: product.title.substringBefore(" (")
                Text(
                    mainTitle,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                
                Text(
                    product.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.textSecondary
                )
                
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = when (product.type) {
                            ProductType.Subs -> AppColors.secondary
                            else -> AppColors.primary
                        }.copy(alpha = 0.2f)
                    ) {
                        Text(
                            product.type.rawValue.uppercase(Locale.getDefault()),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = when (product.type) {
                                ProductType.Subs -> AppColors.secondary
                                else -> AppColors.primary
                            }
                        )
                    }
                    
                    if (isSubscribed) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.success.copy(alpha = 0.2f)
                        ) {
                            Text(
                                "SUBSCRIBED",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = AppColors.success
                            )
                        }
                    }
                }

                // Show product SKU below badges, allow wrapping to avoid ugly cuts
                Text(
                    product.id,
                    style = MaterialTheme.typography.labelSmall,
                    color = AppColors.textSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Check for discount using new standardized DiscountOffer type (preferred)
                val standardizedDiscount = product.discountOffers?.firstOrNull()
                // Fall back to deprecated type for backward compatibility
                val legacyOffer = product.oneTimePurchaseOfferDetailsAndroid?.firstOrNull()
                val discountInfo = legacyOffer?.discountDisplayInfo

                // Use standardized type if available, otherwise fall back to legacy
                val hasDiscount = standardizedDiscount != null || discountInfo != null

                if (hasDiscount) {
                    // Show original price with strikethrough
                    val fullPriceMicros = standardizedDiscount?.fullPriceMicrosAndroid?.toLongOrNull()
                        ?: legacyOffer?.fullPriceMicros?.toLongOrNull()
                    if (fullPriceMicros != null) {
                        val fullPrice = fullPriceMicros.toDouble() / 1_000_000.0
                        val currencyCode = standardizedDiscount?.currency ?: legacyOffer?.priceCurrencyCode ?: ""
                        Text(
                            "$currencyCode ${String.format("%.2f", fullPrice)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppColors.textSecondary,
                            textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough
                        )
                    }
                }

                Text(
                    product.displayPrice,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (hasDiscount) AppColors.success else AppColors.primary
                )

                // Show discount badge using standardized type or legacy
                if (hasDiscount) {
                    val discountText = when {
                        // Prefer standardized DiscountOffer fields
                        standardizedDiscount?.percentageDiscountAndroid != null ->
                            "${standardizedDiscount.percentageDiscountAndroid}% OFF"
                        standardizedDiscount?.formattedDiscountAmountAndroid != null ->
                            "${standardizedDiscount.formattedDiscountAmountAndroid} OFF"
                        // Fall back to legacy discountDisplayInfo
                        discountInfo?.percentageDiscount != null ->
                            "${discountInfo.percentageDiscount}% OFF"
                        discountInfo?.discountAmount != null ->
                            "${discountInfo.discountAmount?.formattedDiscountAmount} OFF"
                        else -> "SALE"
                    }
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = AppColors.danger.copy(alpha = 0.2f)
                    ) {
                        Text(
                            discountText,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.danger
                        )
                    }
                }

                if (isPurchasing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = onDetails,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Details")
                        }
                        Button(
                            onClick = onPurchase,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Buy")
                        }
                    }
                }
            }
        }
    }
}
