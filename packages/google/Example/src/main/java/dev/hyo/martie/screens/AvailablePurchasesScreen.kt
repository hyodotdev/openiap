package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.BuildConfig
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.martie.util.PREMIUM_SUBSCRIPTION_PRODUCT_ID
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.store.PurchaseResultStatus
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AvailablePurchasesScreen(
    navController: NavController
) {
    val iapStore = currentOpenIapStore()
    val purchases by iapStore.availablePurchases.collectAsState()
    val status by iapStore.status.collectAsState()
    val connectionStatus by iapStore.isConnected.collectAsState()
    val statusMessage = status.lastPurchaseResult

    val androidPurchases = remember(purchases) { purchases.filterIsInstance<PurchaseAndroid>() }
    val accountStoreName = remember {
        when (BuildConfig.OPENIAP_STORE) {
            "amazon" -> "Amazon Appstore"
            "horizon" -> "Meta Horizon"
            else -> "Google"
        }
    }

    // Modal state
    var selectedPurchase by remember { mutableStateOf<PurchaseAndroid?>(null) }
    var isInitializing by remember { mutableStateOf(true) }
    var initError by remember { mutableStateOf<String?>(null) }

    // Initialize and connect on first composition (spec-aligned names)
    LaunchedEffect(Unit) {
        try {
            val connected = iapStore.initConnection()
            if (connected) {
                iapStore.getAvailablePurchases(null)
            } else {
                initError = "Failed to connect to billing service"
            }
        } catch (e: Exception) {
            initError = e.message ?: "Failed to initialize IAP connection"
        } finally {
            isInitializing = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Available Purchases") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    val scope = rememberCoroutineScope()
                    IconButton(
                        onClick = {
                            scope.launch {
                                try {
                                    val restored = iapStore.getAvailablePurchases(null)
                                    iapStore.postStatusMessage(
                                        message = "Restored ${restored.size} purchases",
                                        status = PurchaseResultStatus.Success
                                    )
                                } catch (e: Exception) {
                                    iapStore.postStatusMessage(
                                        message = e.message ?: "Restore failed",
                                        status = PurchaseResultStatus.Error
                                    )
                                }
                            }
                        },
                        enabled = !isInitializing && !status.isLoading
                    ) {
                        Icon(Icons.Default.Restore, contentDescription = "Restore")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.background
                )
            )
        }
    ) { paddingValues ->
        val scope = rememberCoroutineScope()
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(AppColors.background),
            contentPadding = PaddingValues(vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header Card
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
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
                                Icons.Default.Restore,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = AppColors.success
                            )
                            
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "Available Purchases",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                
                                Text(
                                    "View and restore purchases",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary
                                )
                            }
                        }
                        
                        Text(
                            "View all your active purchases including consumables not yet consumed, non-consumables, and active subscriptions. Tap 'Restore' to recover purchases from your $accountStoreName account.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppColors.textSecondary
                        )
                    }
                }
            }
            
            // Loading State
            if (isInitializing || status.isLoading) {
                item {
                    LoadingCard()
                }
            }

            // Initialization Error
            initError?.let { errorMsg ->
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = AppColors.danger.copy(alpha = 0.1f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Error,
                                contentDescription = null,
                                tint = AppColors.danger
                            )
                            Text(
                                errorMsg,
                                color = AppColors.danger,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }

            statusMessage?.let { result ->
                item("status-message") {
                    PurchaseResultCard(
                        message = result.message,
                        status = result.status,
                        onDismiss = { iapStore.clearStatusMessage() }
                    )
                }
            }
            
            // Group purchases by type
            val consumables = androidPurchases.filter { 
                !it.isAutoRenewing && (
                    it.productId.contains("consumable", ignoreCase = true) ||
                    it.productId.contains("bulb", ignoreCase = true)
                )
            }
            val nonConsumables = androidPurchases.filter { 
                !it.isAutoRenewing && 
                it.productId != PREMIUM_SUBSCRIPTION_PRODUCT_ID &&
                !(
                    it.productId.contains("consumable", ignoreCase = true) ||
                    it.productId.contains("bulb", ignoreCase = true)
                )
            }
            val subscriptions = androidPurchases.filter { 
                it.isAutoRenewing || it.productId == PREMIUM_SUBSCRIPTION_PRODUCT_ID
            }
            
            item {
                Text(
                    "Receipts are retained. Open Purchase Flow or Subscription Flow to verify and finish them.",
                    modifier = Modifier.padding(horizontal = 16.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = AppColors.textSecondary
                )
            }

            // Active Subscriptions
            if (subscriptions.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Active Subscriptions (${subscriptions.size})")
                }
                
                items(subscriptions) { purchase ->
                    ActiveSubscriptionListItem(
                        purchase = purchase,
                        onClick = { selectedPurchase = purchase }
                    )
                }
            }
            
            // Non-Consumables
            if (nonConsumables.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Non-Consumables (${nonConsumables.size})")
                }
                
                items(nonConsumables) { purchase ->
                    PurchaseItemCard(
                        purchase = purchase,
                        type = PurchaseType.NonConsumable,
                        onClick = { selectedPurchase = purchase }
                    )
                }
            }
            
            // Pending Consumables
            if (consumables.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Pending Consumables (${consumables.size})")
                }
                
                items(consumables) { purchase ->
                    PurchaseItemCard(
                        purchase = purchase,
                        type = PurchaseType.Consumable,
                        onClick = { selectedPurchase = purchase }
                    )
                }
            }
            
            // Empty State
            if (androidPurchases.isEmpty() && !isInitializing && !status.isLoading) {
                item {
                    EmptyStateCard(
                        message = "No purchases found. Try restoring purchases from your $accountStoreName account.",
                        icon = Icons.Default.ShoppingBag
                    )
                }
            }
            
            // Statistics Card
            if (androidPurchases.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = AppColors.surfaceVariant
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "Purchase Summary",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceAround
                            ) {
                                StatisticItem(
                                    count = androidPurchases.size,
                                    label = "Total",
                                    color = AppColors.primary
                                )
                                StatisticItem(
                                    count = subscriptions.size,
                                    label = "Subscriptions",
                                    color = AppColors.secondary
                                )
                                StatisticItem(
                                    count = nonConsumables.size,
                                    label = "Owned",
                                    color = AppColors.success
                                )
                                StatisticItem(
                                    count = consumables.size,
                                    label = "Pending",
                                    color = AppColors.warning
                                )
                            }
                        }
                    }
                }
            }
            
            // Action Buttons
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { scope.launch { iapStore.getAvailablePurchases(null) } },
                        modifier = Modifier.weight(1f),
                        enabled = !isInitializing && !status.isLoading
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Refresh")
                    }
                    
                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    val restored = iapStore.getAvailablePurchases(null)
                                    iapStore.postStatusMessage(
                                        message = "Restored ${restored.size} purchases",
                                        status = PurchaseResultStatus.Success
                                    )
                                } catch (e: Exception) {
                                    iapStore.postStatusMessage(
                                        message = e.message ?: "Restore failed",
                                        status = PurchaseResultStatus.Error
                                    )
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isInitializing && !status.isLoading
                    ) {
                        Icon(Icons.Default.Restore, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Restore")
                    }
                }
            }
        }
    }
    
    // Purchase Detail Modal
    selectedPurchase?.let { purchase ->
        PurchaseDetailModal(
            purchase = purchase,
            onDismiss = { selectedPurchase = null }
        )
    }
}

enum class PurchaseType {
    Consumable,
    NonConsumable,
    Subscription,
}

@Composable
fun PurchaseItemCard(
    purchase: PurchaseAndroid,
    type: PurchaseType,
    onClick: () -> Unit
) {
    val (backgroundColor, iconColor, icon) = when (type) {
        PurchaseType.Subscription -> Triple(
            AppColors.secondary.copy(alpha = 0.1f),
            AppColors.secondary,
            Icons.Default.Autorenew
        )
        PurchaseType.NonConsumable -> Triple(
            AppColors.success.copy(alpha = 0.1f),
            AppColors.success,
            Icons.Default.CheckCircle
        )
        PurchaseType.Consumable -> Triple(
            AppColors.warning.copy(alpha = 0.1f),
            AppColors.warning,
            Icons.Default.Schedule
        )
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(24.dp)
                )
                
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        purchase.productId,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    Text(
                        "Purchased: ${java.text.SimpleDateFormat("MMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date(purchase.transactionDate.toLong()))}",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                    
                    if (purchase.isAutoRenewing) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = AppColors.secondary.copy(alpha = 0.2f)
                        ) {
                            Text(
                                "AUTO-RENEWING",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.secondary
                            )
                        }
                    }
                }
            }
            
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = AppColors.textSecondary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun StatisticItem(
    count: Int,
    label: String,
    color: Color
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            count.toString(),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = AppColors.textSecondary
        )
    }
}
