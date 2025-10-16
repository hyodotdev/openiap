package dev.hyo.martie.screens.uis

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.util.SUBSCRIPTION_PREFS_NAME
import dev.hyo.martie.util.resolvePremiumOfferInfo
import dev.hyo.openiap.PurchaseAndroid

@Composable
fun ActiveSubscriptionListItem(
    purchase: PurchaseAndroid,
    statusText: String? = null,
    onClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val prefs = remember(context) {
        context.getSharedPreferences(SUBSCRIPTION_PREFS_NAME, Context.MODE_PRIVATE)
    }
    val premiumOfferInfo = remember(purchase.productId, purchase.purchaseToken, purchase.dataAndroid) {
        resolvePremiumOfferInfo(prefs, purchase)
    }

    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.outlinedCardColors(
            containerColor = AppColors.cardBackground
        ),
        border = BorderStroke(1.dp, AppColors.secondary.copy(alpha = 0.35f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Display SKU title (human-readable name) as main title
                val displayTitle = when (purchase.productId) {
                    "dev.hyo.martie.premium" -> "Premium Subscription"
                    "dev.hyo.martie.premium_year" -> "Premium Yearly"
                    "dev.hyo.martie.10bulbs" -> "10 Light Bulbs"
                    "dev.hyo.martie.30bulbs" -> "30 Light Bulbs"
                    "dev.hyo.martie.certified" -> "Certified Badge"
                    else -> purchase.productId.substringAfterLast('.').replace('_', ' ')
                        .replaceFirstChar { it.uppercase() }
                }

                Text(
                    displayTitle,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )

                // Show plan info and product ID below
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (premiumOfferInfo != null) {
                        Text(
                            "Plan: ${premiumOfferInfo.displayName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.textSecondary
                        )
                    }
                    Text(
                        "Product ID: ${purchase.productId}",
                        style = MaterialTheme.typography.labelSmall,
                        color = AppColors.textSecondary.copy(alpha = 0.7f)
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = AppColors.success.copy(alpha = 0.12f)
                    ) {
                        Text(
                            "ACTIVE",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = AppColors.success
                        )
                    }

                    if (purchase.isAutoRenewing) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.secondary.copy(alpha = 0.12f)
                        ) {
                            Text(
                                "AUTO-RENEWING",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = AppColors.secondary
                            )
                        }
                    }

                    premiumOfferInfo?.let { offer ->
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.primary.copy(alpha = 0.12f)
                        ) {
                            Text(
                                offer.basePlanId,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = AppColors.primary
                            )
                        }
                    }
                }

                Text(
                    "Purchased: ${java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date(purchase.transactionDate.toLong()))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.textSecondary
                )

                if (statusText != null) {
                    Text(
                        statusText,
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                }
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = AppColors.textSecondary.copy(alpha = 0.7f),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
