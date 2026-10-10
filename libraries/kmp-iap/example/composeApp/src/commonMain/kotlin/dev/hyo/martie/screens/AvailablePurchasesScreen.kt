package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import dev.hyo.martie.utils.swipeToBack
import dev.hyo.martie.theme.AppColors
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.*
import kotlin.time.Instant
import kotlinx.coroutines.*

@OptIn(ExperimentalMaterial3Api::class, kotlin.time.ExperimentalTime::class)
@Composable
fun AvailablePurchasesScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    
    var isConnecting by remember { mutableStateOf(true) }
    var connected by remember { mutableStateOf(false) }
    var availablePurchases by remember { mutableStateOf<List<Purchase>>(emptyList()) }
    var activePurchases by remember { mutableStateOf<List<Purchase>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Filter active purchases - unique by productId, showing only active items
    fun filterActivePurchases(purchases: List<Purchase>): List<Purchase> {
        return purchases
            .filter { purchase ->
                // Show active purchases (purchased or restored state)
                when (purchase) {
                    is PurchaseIOS -> {
                        val isPurchased = purchase.purchaseState == PurchaseState.Purchased
                        if (!isPurchased) return@filter false

                        val isSubscription = purchase.productId in SubscriptionProductIds

                        if (isSubscription) {
                            // Active subscriptions: check auto-renewing or expiry time
                            if (purchase.isAutoRenewing) {
                                return@filter true  // Always show auto-renewing subscriptions
                            }
                            // For non-auto-renewing, check expiry time
                            purchase.expirationDateIOS?.let { expiryTime ->
                                val expiryDate = Instant.fromEpochMilliseconds(expiryTime.toLong())
                                val now = Instant.fromEpochMilliseconds(currentTimeMillis())
                                return@filter expiryDate > now  // Only show if not expired
                            }
                            return@filter true  // Show if no expiry info
                        } else {
                            // Consumables: always show purchased items that need to be finished
                            return@filter true
                        }
                    }
                    is PurchaseAndroid -> {
                        if (purchase.purchaseState != PurchaseState.Purchased) return@filter false

                        if (purchase.productId in SubscriptionProductIds) {
                            return@filter purchase.autoRenewingAndroid == true || purchase.isAcknowledgedAndroid == true
                        } else {
                            return@filter purchase.productId !in ConsumableProductIds || purchase.isAcknowledgedAndroid != true
                        }
                    }
                }
            }
            .sortedByDescending { it.transactionDate }
            .distinctBy { it.productId }  // Keep only the latest purchase per product (remove duplicates)
    }

    // Initialize connection and load available purchases
    LaunchedEffect(Unit) {
        scope.launch {
            isConnecting = true
            isLoading = true
            try {
                val connectionResult = ensureExampleConnection()
                connected = connectionResult
                
                if (!connectionResult) {
                    errorMessage = "Failed to connect to store"
                    return@launch
                }
                
                // Connection successful, immediately load available purchases
                isConnecting = false
                
                // Load purchases with timeout
                val purchasesResult = withTimeoutOrNull(10000) {
                    kmpIapInstance.getAvailablePurchases()
                }
                
                if (purchasesResult != null) {
                    availablePurchases = purchasesResult
                    activePurchases = filterActivePurchases(purchasesResult)
                    if (activePurchases.isEmpty()) {
                        errorMessage = "No active purchases found"
                    } else {
                        errorMessage = null
                    }
                } else {
                    errorMessage = "Loading purchases timed out"
                }
                
            } catch (e: Exception) {
                errorMessage = "Failed to initialize: ${e.message}"
                connected = false
            } finally {
                isConnecting = false
                isLoading = false
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Available Purchases") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = AppColors.OnSurface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(AppColors.Background)
                .swipeToBack(navController)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Status Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (connected) AppColors.Success else AppColors.Surface
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isConnecting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = if (connected) Color.White else AppColors.Primary
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                    }
                    Text(
                        text = when {
                            isConnecting -> "Connecting..."
                            connected -> "✓ Connected to Store"
                            else -> "Not connected"
                        },
                        fontWeight = FontWeight.Medium,
                        color = if (connected) Color.White else AppColors.OnSurface
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Active Purchases Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = AppColors.Primary),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Active Purchases",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "Your active subscriptions and items",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }

                    IconButton(
                        onClick = {
                            scope.launch {
                                isRefreshing = true
                                try {
                                    val purchases = kmpIapInstance.getAvailablePurchases()
                                    availablePurchases = purchases
                                    activePurchases = filterActivePurchases(purchases)
                                    if (activePurchases.isEmpty()) {
                                        errorMessage = "No active purchases found"
                                    } else {
                                        errorMessage = null
                                    }
                                } catch (e: Exception) {
                                    errorMessage = "Failed to refresh: ${e.message}"
                                } finally {
                                    isRefreshing = false
                                }
                            }
                        },
                        enabled = !isRefreshing && connected
                    ) {
                        if (isRefreshing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                        } else {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = Color.White
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Error Message
            errorMessage?.let { error ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = error,
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.Secondary
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Loading State
            if (isLoading) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                // Active Purchases List
                if (activePurchases.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "🛍️",
                                fontSize = 48.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No active purchases",
                                fontWeight = FontWeight.SemiBold,
                                color = AppColors.OnSurface
                            )
                            Text(
                                text = "Your active subscriptions and items will appear here",
                                fontSize = 12.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                } else {
                    activePurchases.forEach { purchase ->
                        val isSubscription = purchase.productId in SubscriptionProductIds

                        PurchaseCard(purchase = purchase, isSubscription = isSubscription)
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }  // End of else block for activePurchases

                // Purchase History Section
                Spacer(modifier = Modifier.height(24.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Secondary),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Purchase History",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "All your past purchases",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                if (availablePurchases.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "🕐",
                                fontSize = 48.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "No purchase history",
                                fontWeight = FontWeight.SemiBold,
                                color = AppColors.OnSurface
                            )
                            Text(
                                text = "Your purchase history will appear here",
                                fontSize = 12.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                } else {
                    availablePurchases.sortedByDescending { it.transactionDate }.forEach { purchase ->
                        val isSubscription = purchase.productId in SubscriptionProductIds

                        PurchaseCard(purchase = purchase, isSubscription = isSubscription)
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }
            }

            Text(
                text = "Receipts are retained. Open Purchase Flow or Subscription Flow to verify and finish them.",
                modifier = Modifier.padding(vertical = 16.dp),
                color = AppColors.Secondary
            )
        }
    }
}

fun getProductType(productId: String): String {
    return when (productId) {
        in SubscriptionProductIds -> "Subscription"
        in NonConsumableProductIds -> "Non-Consumable"
        in ConsumableProductIds -> "Consumable"
        else -> "Unknown"
    }
}

@Composable
fun PurchaseCard(
    purchase: Purchase,
    isSubscription: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "Product ID: ${purchase.productId}",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = AppColors.OnSurface
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Transaction ID: ${purchase.id}",
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                color = AppColors.Secondary
            )

            val instant = Instant.fromEpochMilliseconds(purchase.transactionDate.toLong())
            Text(
                text = "Date: $instant",
                fontSize = 12.sp,
                color = AppColors.Secondary
            )
            
            // Show transaction state for iOS purchases
            if (purchase is PurchaseIOS) {
                Text(
                    text = "State: ${purchase.purchaseState}",
                    fontSize = 12.sp,
                    color = AppColors.Secondary
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Show product type and acknowledgment status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                val productType = getProductType(purchase.productId)
                Text(
                    text = "Type: $productType",
                    fontSize = 12.sp,
                    color = when (productType) {
                        "Subscription" -> AppColors.Primary
                        "Non-Consumable" -> AppColors.Success
                        else -> AppColors.Secondary
                    },
                    fontWeight = FontWeight.Medium
                )
                
                if (isSubscription && purchase is PurchaseAndroid && purchase.isAcknowledgedAndroid == true) {
                    Text("✓ Acknowledged", fontSize = 12.sp, color = AppColors.Success)
                }
            }
            
        }
    }
}
