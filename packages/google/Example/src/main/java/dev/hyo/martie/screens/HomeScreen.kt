package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.BuildConfig
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.FeatureCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(navController: NavController) {
    // Use BuildConfig to determine which billing system is included in this build
    // This ensures UI messages match the actual compiled implementation
    val storeLabel = when (BuildConfig.OPENIAP_STORE) {
        "amazon" -> "Amazon Fire OS"
        "horizon" -> "Horizon OS"
        else -> "Android"
    }

    val testText = when (BuildConfig.OPENIAP_STORE) {
        "amazon" -> "Test in-app purchases and subscription features with Amazon Appstore IAP integration."
        "horizon" -> "Test in-app purchases and subscription features with Meta Horizon Billing integration."
        else -> "Test in-app purchases and subscription features with Google Play Billing integration."
    }

    val testingNotesText =
        when (BuildConfig.OPENIAP_STORE) {
            "amazon" -> {
                "• Use test accounts configured for Amazon Appstore IAP\n" +
                "• Products must be configured in Amazon Developer Console\n" +
                "• App Tester or an Appstore test distribution is required for live IAP\n" +
                "• Device must be signed in with an Amazon test account"
            }
            "horizon" -> {
            "• Use test accounts configured in Meta Quest Developer Center\n" +
            "• Products must be configured in Horizon Store\n" +
            "• App must be uploaded to Meta Quest Developer Center\n" +
            "• Device must be signed in with a test account"
            }
            else -> {
            "• Use test accounts configured in Google Play Console\n" +
            "• Products must be configured in Play Console\n" +
            "• App must be uploaded to Play Console (at least internal testing)\n" +
            "• Device must be signed in with a test account"
            }
        }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("OpenIAP Example") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = AppColors.background)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .background(AppColors.background),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Spacer(modifier = Modifier.height(0.dp))
            
            // Header Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .clickable { navController.navigate("all_products") },
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Default.ShoppingBag,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = AppColors.primary
                        )
                        
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = AppColors.secondary.copy(alpha = 0.2f)
                            ) {
                                Text(
                                    storeLabel,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                    
                    Text(
                        testText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.textSecondary
                    )
                }
            }
            
            // Two cards per row; a lazy grid inside this scrolling column needs a fixed height.
            Column(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    FeatureCard(
                        title = "Purchase\nFlow",
                        subtitle = "Buy consumables & non-consumables",
                        icon = Icons.Default.ShoppingCart,
                        color = AppColors.primary,
                        onClick = { navController.navigate("purchase_flow") },
                        modifier = Modifier.weight(1f)
                    )
                    FeatureCard(
                        title = "Subscription\nFlow",
                        subtitle = "Manage subscriptions",
                        icon = Icons.Default.Autorenew,
                        color = AppColors.secondary,
                        onClick = { navController.navigate("subscription_flow") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    FeatureCard(
                        title = "Available\nPurchases",
                        subtitle = "View active & restore",
                        icon = Icons.Default.Restore,
                        color = AppColors.success,
                        onClick = { navController.navigate("available_purchases") },
                        modifier = Modifier.weight(1f)
                    )
                    FeatureCard(
                        title = "Offer\nCode",
                        subtitle = "Redeem promo codes",
                        icon = Icons.Default.LocalOffer,
                        color = AppColors.warning,
                        onClick = { navController.navigate("offer_code") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    FeatureCard(
                        title = "Alternative\nBilling",
                        subtitle = "Test alternative payment",
                        icon = Icons.Default.Payment,
                        color = AppColors.info,
                        onClick = { navController.navigate("alternative_billing") },
                        modifier = Modifier.weight(1f)
                    )
                    FeatureCard(
                        title = "App\nOwnership",
                        subtitle = "Check the app came from its store",
                        icon = Icons.Default.Verified,
                        color = AppColors.secondary,
                        onClick = { navController.navigate("app_ownership") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Testing Notes Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.info.copy(alpha = 0.1f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = null,
                            tint = AppColors.info
                        )
                        Text(
                            "Testing Notes",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    
                    Text(
                        testingNotesText,
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
