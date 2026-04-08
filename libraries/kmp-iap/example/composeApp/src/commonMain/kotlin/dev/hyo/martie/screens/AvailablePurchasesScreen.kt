package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*
import io.github.hyochan.kmpiap.toPurchaseInput
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.datetime.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AvailablePurchasesScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    val json = remember { Json { prettyPrint = true; ignoreUnknownKeys = true } }
    
    // Create IAP instance
    val kmpIAP = remember { KmpIAP() }
    
    var isConnecting by remember { mutableStateOf(true) }
    var connected by remember { mutableStateOf(false) }
    var availablePurchases by remember { mutableStateOf<List<Purchase>>(emptyList()) }
    var activePurchases by remember { mutableStateOf<List<Purchase>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var consumeResult by remember { mutableStateOf<String?>(null) }
    var consumingPurchaseId by remember { mutableStateOf<String?>(null) }

    // Filter active purchases - unique by productId, showing only active items
    fun filterActivePurchases(purchases: List<Purchase>): List<Purchase> {
        return purchases
            .filter { purchase ->
                // Show active purchases (purchased or restored state)
                when (purchase) {
                    is PurchaseIOS -> {
                        val isPurchased = purchase.purchaseState == PurchaseState.Purchased
                        if (!isPurchased) return@filter false

                        // Determine if it's a subscription
                        val isSubscription = purchase.productId.contains("premium") ||
                                           purchase.productId.contains("subscription") ||
                                           purchase.productId.contains("sub_")

                        if (isSubscription) {
                            // Active subscriptions: check auto-renewing or expiry time
                            if (purchase.isAutoRenewing) {
                                return@filter true  // Always show auto-renewing subscriptions
                            }
                            // For non-auto-renewing, check expiry time
                            purchase.expirationDateIOS?.let { expiryTime ->
                                val expiryDate = Instant.fromEpochMilliseconds(expiryTime.toLong())
                                val now = kotlinx.datetime.Clock.System.now()
                                return@filter expiryDate > now  // Only show if not expired
                            }
                            return@filter true  // Show if no expiry info
                        } else {
                            // Consumables: always show purchased items that need to be finished
                            return@filter true
                        }
                    }
                    is PurchaseAndroid -> {
                        // Determine if it's a subscription
                        val isSubscription = purchase.productId.contains("premium") ||
                                           purchase.productId.contains("subscription") ||
                                           purchase.productId.contains("sub_")

                        if (isSubscription) {
                            // Subscriptions: show if purchased state (regardless of acknowledgment)
                            // Auto-renewing subscriptions should always show
                            val isPurchased = purchase.purchaseState == PurchaseState.Purchased
                            return@filter isPurchased && (purchase.autoRenewingAndroid == true || purchase.isAcknowledgedAndroid == true)
                        } else {
                            // Consumables: show only non-acknowledged purchases
                            return@filter purchase.isAcknowledgedAndroid != true
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
                val connectionResult = kmpIAP.initConnection()
                connected = connectionResult
                
                if (!connectionResult) {
                    errorMessage = "Failed to connect to store"
                    return@launch
                }
                
                // Connection successful, immediately load available purchases
                isConnecting = false
                
                // Load purchases with timeout
                val purchasesResult = withTimeoutOrNull(10000) {
                    kmpIAP.getAvailablePurchases()
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
                                    val purchases = kmpIAP.getAvailablePurchases()
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
                        val isSubscription = purchase.productId.contains("premium") ||
                                           purchase.productId.contains("subscription") ||
                                           purchase.productId.contains("sub_")

                        // Only show finish button if purchase needs to be finished
                        val showFinishButton = needsFinishButton(purchase)

                        PurchaseCard(
                            purchase = purchase,
                            isSubscription = isSubscription,
                            isAcknowledged = !showFinishButton,
                            onAction = {
                                // Prevent multiple clicks
                                if (consumingPurchaseId != null) return@PurchaseCard

                                scope.launch {
                                    consumingPurchaseId = purchase.id
                                    try {
                                        // Debug log
                                        when (purchase) {
                                            is PurchaseIOS -> {
                                                println("🔷 Finishing transaction: id=${purchase.id}, productId=${purchase.productId}, state=${purchase.purchaseState}, isAutoRenewing=${purchase.isAutoRenewing}")
                                            }
                                            else -> {
                                                println("🔷 Finishing transaction: id=${purchase.id}, productId=${purchase.productId}")
                                            }
                                        }

                                        kmpIAP.finishTransaction(purchase.toPurchaseInput(), isConsumable = !isSubscription)

                                        val action = if (isSubscription) "acknowledged" else "consumed"
                                        consumeResult = "✅ Purchase $action: ${purchase.productId}"

                                        // Wait a bit before refreshing to let the system process
                                        kotlinx.coroutines.delay(1000)

                                        // Refresh the purchases list
                                        try {
                                            val refreshed = kmpIAP.getAvailablePurchases()
                                            availablePurchases = refreshed
                                            activePurchases = filterActivePurchases(refreshed)
                                        } catch (e: Exception) {
                                            println("Failed to refresh purchases: ${e.message}")
                                        }
                                    } catch (e: Exception) {
                                        val action = if (isSubscription) "acknowledge" else "consume"
                                        println("❌ Failed to finish transaction: ${e.message}")
                                        consumeResult = "❌ Failed to $action: ${e.message}"
                                    } finally {
                                        consumingPurchaseId = null
                                    }
                                }
                            },
                            isProcessing = consumingPurchaseId == purchase.id,
                            showAction = showFinishButton  // Only show button if needs finishing
                        )
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
                        val isSubscription = purchase.productId.contains("premium") ||
                                           purchase.productId.contains("subscription") ||
                                           purchase.productId.contains("sub_")

                        val isAcknowledged = when (purchase) {
                            is PurchaseAndroid -> purchase.isAcknowledgedAndroid == true
                            is PurchaseIOS -> false // iOS purchases show as Purchased; finished state not tracked via PurchaseState
                        }

                        PurchaseCard(
                            purchase = purchase,
                            isSubscription = isSubscription,
                            isAcknowledged = isAcknowledged,
                            onAction = { },
                            isProcessing = false,
                            showAction = false  // Don't show action buttons in history
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }
            }

            // Consume Result
            consumeResult?.let { result ->
                Spacer(modifier = Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (result.contains("✅")) 
                            AppColors.Success.copy(alpha = 0.1f) 
                        else 
                            AppColors.Error.copy(alpha = 0.1f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = result,
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.OnSurface
                    )
                }
            }
        }
    }
}

// Helper to determine product type
fun getProductType(productId: String): String {
    return when {
        productId.contains("premium") ||
        productId.contains("subscription") ||
        productId.contains("sub_") -> "Subscription"

        productId.contains("pro") ||
        productId.contains("unlock") ||
        productId.contains("remove") ||
        productId.contains("certified") ||
        productId.contains("lifetime") -> "Non-Consumable"

        else -> "Consumable"
    }
}

// Check if purchase needs finish button (not acknowledged)
fun needsFinishButton(purchase: Purchase): Boolean {
    return when (purchase) {
        is PurchaseIOS -> {
            // For iOS: Don't show button for:
            // 1. Auto-renewing subscriptions (managed by system)
            // 2. Non-consumable purchases (permanent purchases)

            // Check if it's a subscription
            val isSubscription = purchase.productId.contains("premium") ||
                               purchase.productId.contains("subscription") ||
                               purchase.productId.contains("sub_")

            if (isSubscription && purchase.isAutoRenewing) {
                // Auto-renewing subscriptions should not be manually finished
                return false
            }

            // Check if it's a non-consumable (permanent purchase)
            // Non-consumables typically have identifiers like "pro", "unlock", "remove_ads", etc.
            val isNonConsumable = purchase.productId.contains("pro") ||
                                 purchase.productId.contains("unlock") ||
                                 purchase.productId.contains("remove") ||
                                 purchase.productId.contains("certified") ||
                                 purchase.productId.contains("lifetime")

            if (isNonConsumable) {
                // Non-consumable purchases are permanent and don't need to be finished
                return false
            }

            // Show button only for consumables (e.g., coins, bulbs, etc.)
            true
        }
        is PurchaseAndroid -> {
            // For Android: show button if not acknowledged
            purchase.isAcknowledgedAndroid != true
        }
    }
}

@Composable
fun PurchaseCard(
    purchase: Purchase,
    isSubscription: Boolean,
    isAcknowledged: Boolean,
    onAction: () -> Unit,
    isProcessing: Boolean,
    showAction: Boolean = true
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                // Log purchase details to console in JSON format
                println("\n========== PURCHASE DETAILS (JSON) ==========")
                val json = Json {
                    prettyPrint = true
                    encodeDefaults = true
                }

                // Use toJson() method from Purchase interface
                val purchaseMap = purchase.toJson()
                val jsonString = buildString {
                    appendLine("{")
                    purchaseMap.entries.forEachIndexed { index, (key, value) ->
                        append("  \"$key\": ")
                        when (value) {
                            is String -> append("\"$value\"")
                            is Number -> append(value)
                            is Boolean -> append(value)
                            null -> append("null")
                            else -> append("\"$value\"")
                        }
                        if (index < purchaseMap.size - 1) append(",")
                        appendLine()
                    }
                    append("}")
                }
                println(jsonString)
                println("Is Subscription: $isSubscription")
                println("Is Acknowledged: $isAcknowledged")
                println("====================================\n")
            },
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

            val instant = kotlinx.datetime.Instant.fromEpochSeconds(purchase.transactionDate.toLong())
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
                
                if (isSubscription && isAcknowledged) {
                    val statusText = when (purchase) {
                        is PurchaseAndroid -> "✓ Acknowledged"
                        is PurchaseIOS -> "✓ Finished"
                    }
                    Text(
                        text = statusText,
                        fontSize = 12.sp,
                        color = AppColors.Success,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            // Show button only if showAction is true
            if (showAction) {
                Spacer(modifier = Modifier.height(8.dp))

                // Show button based on acknowledgment status
                if (isSubscription && isAcknowledged) {
                    // Show disabled state for already acknowledged subscriptions
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = AppColors.Surface
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            val statusText = when (purchase) {
                                is PurchaseAndroid -> "Already Acknowledged"
                                is PurchaseIOS -> "Already Finished"
                            }
                            Text(
                                text = statusText,
                                color = AppColors.Secondary
                            )
                        }
                    }
                } else {
                    Button(
                        onClick = onAction,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isProcessing,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSubscription) AppColors.Secondary else AppColors.Primary
                        )
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                        } else {
                            val buttonText = if (isSubscription) {
                                when (purchase) {
                                    is PurchaseAndroid -> "Acknowledge Subscription"
                                    is PurchaseIOS -> "Finish Transaction"
                                }
                            } else {
                                "Consume Purchase"
                            }
                            Text(buttonText)
                        }
                    }
                }
            }
        }
    }
}
