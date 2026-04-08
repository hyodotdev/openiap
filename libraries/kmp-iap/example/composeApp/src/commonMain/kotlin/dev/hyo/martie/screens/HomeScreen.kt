package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import io.github.hyochan.kmpiap.KmpIAP
import dev.hyo.martie.navigation.Screen
import dev.hyo.martie.theme.AppColors
import io.github.hyochan.kmpiap.getCurrentPlatform
import io.github.hyochan.kmpiap.openiap.IapPlatform
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    var storefrontInfo by remember { mutableStateOf<String?>(null) }
    
    // Create IAP instance using constructor
    val kmpIAP = remember { KmpIAP() }
    
    LaunchedEffect(Unit) {
        if (getCurrentPlatform() == IapPlatform.Ios) {
            try {
                val storefront = kmpIAP.getStorefrontIOS()
                storefrontInfo = "Storefront: $storefront"
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.Background)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "KMP IAP Example",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.Primary
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Kotlin Multiplatform in-app purchase library",
                fontSize = 16.sp,
                color = AppColors.Secondary,
                textAlign = TextAlign.Center
            )
            
            storefrontInfo?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = it,
                    fontSize = 14.sp,
                    color = AppColors.Secondary
                )
            }
        }
        
        // Features
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                FeatureItem("✨ Kotlin-first approach with type safety")
                FeatureItem("🎯 Platform-agnostic API design")
                FeatureItem("🛡️ Type-safe error handling")
                FeatureItem("📱 Supports iOS and Android")
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Navigation Cards
        NavigationCard(
            icon = Icons.Default.ShoppingCart,
            title = "In-App Purchase Flow",
            subtitle = "Test one-time product purchases",
            onClick = { navController.navigate(Screen.PurchaseFlow.route) }
        )
        
        NavigationCard(
            icon = Icons.Default.Refresh,
            title = "Subscription Flow",
            subtitle = "Test recurring subscription purchases",
            onClick = { navController.navigate(Screen.SubscriptionFlow.route) }
        )
        
        NavigationCard(
            icon = Icons.Default.ShoppingCart,
            title = "Available Purchases",
            subtitle = "View and restore past purchases",
            onClick = { navController.navigate(Screen.AvailablePurchases.route) }
        )
        
        NavigationCard(
            icon = Icons.Default.Star,
            title = "Offer Code Redemption",
            subtitle = "Redeem promotional codes",
            onClick = { navController.navigate(Screen.OfferCode.route) }
        )

        NavigationCard(
            icon = Icons.Default.AccountCircle,
            title = "Alternative Billing",
            subtitle = "Test alternative billing methods (iOS & Android)",
            onClick = { navController.navigate(Screen.AlternativeBilling.route) }
        )

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
fun FeatureItem(text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            color = AppColors.OnSurface
        )
    }
}

@Composable
fun NavigationCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = AppColors.Primary
            )
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.OnSurface
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = subtitle,
                    fontSize = 14.sp,
                    color = AppColors.Secondary
                )
            }
            
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = AppColors.Secondary
            )
        }
    }
}
