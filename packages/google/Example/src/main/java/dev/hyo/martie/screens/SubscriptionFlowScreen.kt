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
import androidx.compose.foundation.BorderStroke
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import android.app.Activity
import android.content.Context
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.IapConstants
import dev.hyo.martie.screens.uis.*
import dev.hyo.openiap.IapContext
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.store.PurchaseResultStatus
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import dev.hyo.martie.util.findActivity
import dev.hyo.martie.util.PREMIUM_SUBSCRIPTION_PRODUCT_ID
import dev.hyo.martie.util.SUBSCRIPTION_PREFS_NAME
import dev.hyo.martie.util.resolvePremiumOfferInfo
import dev.hyo.martie.util.savePremiumOffer

// Google Play Billing SubscriptionReplacementMode values
private object ReplacementMode {
    const val WITHOUT_PRORATION = 1 // No proration
    const val CHARGE_PRORATED_PRICE = 2 // Charge prorated amount immediately
    const val DEFERRED = 3 // Change takes effect at next billing cycle
    const val WITH_TIME_PRORATION = 4 // Time-based proration
    const val CHARGE_FULL_PRICE = 5 // Charge full price immediately
}

// Helper to format remaining time like "3d 4h" / "2h 12m" / "35m"
private fun formatRemaining(deltaMillis: Long): String {
    if (deltaMillis <= 0) return "0m"
    val totalMinutes = deltaMillis / 60000
    val days = totalMinutes / (60 * 24)
    val hours = (totalMinutes % (60 * 24)) / 60
    val minutes = totalMinutes % 60
    return when {
        days > 0 -> "${days}d ${hours}h"
        hours > 0 -> "${hours}h ${minutes}m"
        else -> "${minutes}m"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionFlowScreen(
    navController: NavController,
    storeParam: OpenIapStore? = null
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val uiScope = rememberCoroutineScope()
    val appContext = remember(context) { context.applicationContext }

    // SharedPreferences to track current offer (necessary since Google doesn't provide offer info)
    val prefs = remember { context.getSharedPreferences(SUBSCRIPTION_PREFS_NAME, Context.MODE_PRIVATE) }
    val iapStore = storeParam ?: remember(appContext) {
        OpenIapStore(appContext)
    }
    val products by iapStore.products.collectAsState()
    val subscriptions by iapStore.subscriptions.collectAsState()
    val purchases by iapStore.availablePurchases.collectAsState()
    val androidProducts = remember(products) { products.filterIsInstance<ProductAndroid>() }
    val androidSubscriptions = remember(subscriptions) { subscriptions.filterIsInstance<ProductSubscriptionAndroid>() }
    val androidPurchases = remember(purchases) { purchases.filterIsInstance<PurchaseAndroid>() }
    val status by iapStore.status.collectAsState()
    val connectionStatus by iapStore.connectionStatus.collectAsState()
    val lastPurchase by iapStore.currentPurchase.collectAsState(initial = null)
    val lastPurchaseAndroid: PurchaseAndroid? = remember(lastPurchase) {
        when (val purchase = lastPurchase) {
            is PurchaseAndroid -> purchase
            else -> null
        }
    }

    // Real-time subscription status (expiry/renewal). This requires server validation.
    data class SubscriptionUiInfo(
        val renewalDate: Long? = null,       // expiryTimeMillis
        val autoRenewing: Boolean = true,
        val gracePeriodEndDate: Long? = null,
        val freeTrialEndDate: Long? = null
    )
    var subStatus by remember { mutableStateOf<Map<String, SubscriptionUiInfo>>(emptyMap()) }
    var now by remember { mutableStateOf(System.currentTimeMillis()) }

    // Load subscription data on screen entry
    LaunchedEffect(Unit) {
            println("SubscriptionFlow: Loading subscription products and purchases")
            iapStore.setActivity(activity)

            // Get fresh purchases first
            iapStore.getAvailablePurchases(null)
            delay(500)

            // Fetch products
            val request = ProductRequest(
                skus = IapConstants.SUBS_SKUS,
                type = ProductQueryType.Subs
            )
            iapStore.fetchProducts(request)

            // Log current state
            val currentPurchases = iapStore.availablePurchases.value
            println("SubscriptionFlow: Found ${currentPurchases.size} purchases")
            currentPurchases.forEach { purchase ->
                if (purchase is PurchaseAndroid) {
                    println("  - ${purchase.productId}: state=${purchase.purchaseState}")
                }
            }
    }

    // Tick clock to update countdown once per second
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            kotlinx.coroutines.delay(1000)
        }
    }

    // TODO: Replace with your backend call to Play Developer API
    suspend fun fetchSubStatusFromServer(productId: String, purchaseToken: String): SubscriptionUiInfo? {
        // Expected mapping of your server response (ReceiptValidationResultAndroid)
        // return SubscriptionUiInfo(
        //   renewalDate = result.renewalDate,
        //   autoRenewing = result.autoRenewing,
        //   gracePeriodEndDate = result.gracePeriodEndDate,
        //   freeTrialEndDate = result.freeTrialEndDate,
        // )
        return null
    }

    // Refresh server-side status when purchases change
    LaunchedEffect(androidPurchases) {
        val map = mutableMapOf<String, SubscriptionUiInfo>()
        androidPurchases
            .filter { it.productId in IapConstants.SUBS_SKUS }
            .forEach { purchase ->
                val token = purchase.purchaseToken ?: return@forEach
                val info = fetchSubStatusFromServer(purchase.productId, token)
                if (info != null) {
                    map[purchase.productId] = info.copy(autoRenewing = purchase.isAutoRenewing)
                }
            }
        subStatus = map
    }
    val statusMessage = status.lastPurchaseResult
    
    // Modal states
    var selectedProduct by remember { mutableStateOf<ProductAndroid?>(null) }
    var selectedPurchase by remember { mutableStateOf<PurchaseAndroid?>(null) }
    
    // Initialize and connect on first composition (spec-aligned names)
    val startupScope = rememberCoroutineScope()
    DisposableEffect(Unit) {
        startupScope.launch {
            try {
                val connected = iapStore.initConnection()
                if (connected) {
                    iapStore.setActivity(activity)
                    println("SubscriptionFlow: Loading subscription products: ${IapConstants.SUBS_SKUS}")
                    val request = ProductRequest(
                        skus = IapConstants.SUBS_SKUS,
                        type = ProductQueryType.Subs
                    )
                    iapStore.fetchProducts(request)
                    iapStore.getAvailablePurchases(null)
                }
            } catch (_: Exception) { }
        }
        
        onDispose {
            // End connection and clear listeners when this screen leaves (per-screen lifecycle)
            startupScope.launch {
                runCatching { iapStore.endConnection() }
                runCatching { iapStore.clear() }
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscription Flow") },
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
                                    iapStore.setActivity(activity)
                                    val request = ProductRequest(
                                        skus = IapConstants.SUBS_SKUS,
                                        type = ProductQueryType.Subs
                                    )
                                    iapStore.fetchProducts(request)
                                } catch (_: Exception) { }
                            }
                        },
                        enabled = !status.isLoading
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
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
                                Icons.Default.Autorenew,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = AppColors.secondary
                            )
                            
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "Subscription Flow",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                
                                Text(
                                    "Manage recurring subscriptions",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary
                                )
                            }
                        }
                        
                        Text(
                            "Purchase and manage auto-renewable subscriptions. View active subscriptions and their renewal status.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = AppColors.textSecondary
                        )
                    }
                }
            }
            statusMessage?.let { result ->
                item("status-message") {
                    PurchaseResultCard(
                        message = result.message,
                        status = result.status,
                        onDismiss = { iapStore.clearStatusMessage() },
                        code = result.code
                    )
                }
            }
            
            // Loading State
            if (status.isLoading) {
                item {
                    LoadingCard()
                }
            }
            
            // Active Subscriptions Section
            // Treat any purchase with matching subscription SKU as subscribed
            val activeSubscriptions = androidPurchases.filter { it.productId in IapConstants.SUBS_SKUS }
            if (activeSubscriptions.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Active Subscriptions")
                }

                items(activeSubscriptions) { subscription ->
                    val info = subStatus[subscription.productId]
                    val fmt = java.text.SimpleDateFormat("MMM dd, yyyy HH:mm", java.util.Locale.getDefault())
                    val statusText = when {
                        info?.freeTrialEndDate != null ->
                            "Free trial ends: ${fmt.format(java.util.Date(info.freeTrialEndDate))} (${formatRemaining(info.freeTrialEndDate - now)})"
                        info?.gracePeriodEndDate != null ->
                            "Grace period ends: ${fmt.format(java.util.Date(info.gracePeriodEndDate))} (${formatRemaining(info.gracePeriodEndDate - now)})"
                        info?.renewalDate != null && (info.autoRenewing) ->
                            "Renews on ${fmt.format(java.util.Date(info.renewalDate))} (${formatRemaining(info.renewalDate - now)})"
                        info?.renewalDate != null && (!info.autoRenewing) ->
                            "Expires on ${fmt.format(java.util.Date(info.renewalDate))} (${formatRemaining(info.renewalDate - now)})"
                        else -> null
                    }

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            ActiveSubscriptionListItem(
                                purchase = subscription,
                                statusText = statusText,
                                onClick = { selectedPurchase = subscription }
                            )

                            // Show upgrade/downgrade option for dev.hyo.martie.premium subscription offers
                            if (subscription.productId == PREMIUM_SUBSCRIPTION_PRODUCT_ID) {
                                // Find the subscription product with offers
                                val premiumSub = androidSubscriptions.find { it.id == PREMIUM_SUBSCRIPTION_PRODUCT_ID }

                                if (premiumSub != null) {
                                    // Get available offers
                                    val monthlyOffer = premiumSub.subscriptionOfferDetailsAndroid.find {
                                        it.basePlanId == IapConstants.PREMIUM_MONTHLY_BASE_PLAN
                                    }
                                    val yearlyOffer = premiumSub.subscriptionOfferDetailsAndroid.find {
                                        it.basePlanId == IapConstants.PREMIUM_YEARLY_BASE_PLAN
                                    }

                                    // Log purchase details for debugging
                                    println("SubscriptionFlow: Current purchase details - productId: ${subscription.productId}, token: ${subscription.purchaseToken?.take(10)}")
                                    println("SubscriptionFlow: Purchase state: ${subscription.purchaseState}")

                                    // Resolve the active offer for this subscription
                                    val premiumOfferInfo = resolvePremiumOfferInfo(prefs, subscription)
                                    val currentOfferBasePlanId = premiumOfferInfo?.basePlanId
                                        ?: IapConstants.PREMIUM_MONTHLY_BASE_PLAN

                                    val currentOfferDisplay = premiumOfferInfo?.displayName ?: when (currentOfferBasePlanId) {
                                        IapConstants.PREMIUM_MONTHLY_BASE_PLAN -> "Monthly Plan (premium)"
                                        IapConstants.PREMIUM_YEARLY_BASE_PLAN -> "Yearly Plan (premium-year)"
                                        else -> "Base Plan: $currentOfferBasePlanId"
                                    }

                                    println(
                                        "SubscriptionFlow: Current offer for ${subscription.productId}: $currentOfferBasePlanId ($currentOfferDisplay)"
                                    )

                                    val currentOffer = when (currentOfferBasePlanId) {
                                        IapConstants.PREMIUM_MONTHLY_BASE_PLAN -> monthlyOffer
                                        IapConstants.PREMIUM_YEARLY_BASE_PLAN -> yearlyOffer
                                        else -> listOfNotNull(monthlyOffer, yearlyOffer)
                                            .firstOrNull { it.basePlanId == currentOfferBasePlanId }
                                    }

                                    val targetOffer = when (currentOfferBasePlanId) {
                                        IapConstants.PREMIUM_MONTHLY_BASE_PLAN -> yearlyOffer
                                        IapConstants.PREMIUM_YEARLY_BASE_PLAN -> monthlyOffer
                                        else -> when (currentOffer) {
                                            monthlyOffer -> yearlyOffer
                                            yearlyOffer -> monthlyOffer
                                            else -> null
                                        }
                                    }

                                    val isMonthly = currentOfferBasePlanId == IapConstants.PREMIUM_MONTHLY_BASE_PLAN

                                    // Display current offer information
                                    Spacer(modifier = Modifier.height(12.dp))
                                    HorizontalDivider(
                                        modifier = Modifier.fillMaxWidth(),
                                        thickness = 1.dp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Show current active offer
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Check,
                                            contentDescription = null,
                                            modifier = Modifier.size(20.dp),
                                            tint = AppColors.success
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(
                                                text = "Current Plan: $currentOfferDisplay",
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontWeight = FontWeight.Medium
                                            )
                                            currentOffer?.let { offer ->
                                                val price = offer.pricingPhases.pricingPhaseList.firstOrNull()?.formattedPrice ?: ""
                                                Text(
                                                    text = "Base Plan ID: ${offer.basePlanId} • $price",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = AppColors.textSecondary
                                                )
                                            }
                                        }

                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = AppColors.primary.copy(alpha = 0.12f),
                                            modifier = Modifier.padding(start = 12.dp)
                                        ) {
                                            Text(
                                                text = currentOfferBasePlanId,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = AppColors.primary
                                            )
                                        }
                                    }

                                    // Only show upgrade button if both offers exist
                                    if (monthlyOffer != null && yearlyOffer != null && currentOffer != null && targetOffer != null) {
                                        Spacer(modifier = Modifier.height(12.dp))

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = if (isMonthly) "Upgrade to Yearly Plan" else "Switch to Monthly Plan",
                                                    style = MaterialTheme.typography.titleSmall,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                                val targetPrice = targetOffer.pricingPhases.pricingPhaseList.firstOrNull()?.formattedPrice ?: ""
                                                Text(
                                                    text = "${targetOffer.basePlanId} - $targetPrice",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = AppColors.textSecondary
                                                )
                                                if (isMonthly) {
                                                    Text(
                                                        text = "Save with annual billing",
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = AppColors.success
                                                    )
                                                }
                                            }

                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        try {
                                                            iapStore.setActivity(activity)

                                                            val purchaseToken = subscription.purchaseToken
                                                            if (purchaseToken == null) {
                                                                iapStore.postStatusMessage(
                                                                    message = "Cannot change plan: missing purchase token",
                                                                    status = PurchaseResultStatus.Error,
                                                                    productId = PREMIUM_SUBSCRIPTION_PRODUCT_ID
                                                                )
                                                                return@launch
                                                            }

                                                            println("SubscriptionFlow: Changing from ${currentOffer.basePlanId} to ${targetOffer.basePlanId} with token: ${purchaseToken.take(10)}...")

                                                            // For same subscription with different offers, use CHARGE_FULL_PRICE
                                                            // This is often the only supported mode for offer changes
                                                            val replacementMode = ReplacementMode.CHARGE_FULL_PRICE

                                                            println("SubscriptionFlow: Using replacement mode: $replacementMode")

                                                            // Request subscription offer change (same product, different offer)
                                                            val offerInputs = listOf(
                                                                AndroidSubscriptionOfferInput(
                                                                    sku = PREMIUM_SUBSCRIPTION_PRODUCT_ID,
                                                                    offerToken = targetOffer.offerToken
                                                                )
                                                            )
                                                            val props = RequestPurchaseProps(
                                                                request = RequestPurchaseProps.Request.Subscription(
                                                                    RequestSubscriptionPropsByPlatforms(
                                                                        android = RequestSubscriptionAndroidProps(
                                                                            isOfferPersonalized = null,
                                                                            obfuscatedAccountIdAndroid = null,
                                                                            obfuscatedProfileIdAndroid = null,
                                                                            purchaseTokenAndroid = purchaseToken,
                                                                            replacementModeAndroid = replacementMode,
                                                                            skus = listOf(PREMIUM_SUBSCRIPTION_PRODUCT_ID),
                                                                            subscriptionOffers = offerInputs
                                                                        )
                                                                    )
                                                                ),
                                                                type = ProductQueryType.Subs
                                                            )

                                                            val result = iapStore.requestPurchase(props)
                                                            val purchases = when (result) {
                                                                is dev.hyo.openiap.RequestPurchaseResultPurchases -> result.value.orEmpty()
                                                                is dev.hyo.openiap.RequestPurchaseResultPurchase -> result.value?.let { listOf(it) }.orEmpty()
                                                                else -> emptyList()
                                                            }

                                                            if (purchases.isNotEmpty()) {
                                                                // Save the new offer to SharedPreferences
                                                                val newOfferBasePlanId = targetOffer.basePlanId
                                                                prefs.savePremiumOffer(PREMIUM_SUBSCRIPTION_PRODUCT_ID, newOfferBasePlanId)
                                                                println("SubscriptionFlow: Subscription change successful, saved offer: $newOfferBasePlanId")

                                                                iapStore.postStatusMessage(
                                                                    message = if (isMonthly) "Upgraded to yearly plan successfully" else "Switched to monthly plan",
                                                                    status = PurchaseResultStatus.Success,
                                                                    productId = PREMIUM_SUBSCRIPTION_PRODUCT_ID
                                                                )
                                                                // Immediately refresh purchases
                                                                iapStore.getAvailablePurchases(null)
                                                                // Also refresh after a delay to catch any delayed updates
                                                                delay(2000)
                                                                iapStore.getAvailablePurchases(null)
                                                                // Refresh products to update subscription status
                                                                scope.launch {
                                                                    val request = ProductRequest(
                                                                        skus = IapConstants.SUBS_SKUS,
                                                                        type = ProductQueryType.Subs
                                                                    )
                                                                    iapStore.fetchProducts(request)
                                                                }
                                                            }
                                                        } catch (e: Exception) {
                                                            println("SubscriptionFlow: Error changing subscription: ${e.message}")
                                                            e.printStackTrace()

                                                            // If upgrade fails, show more helpful message
                                                            val errorMessage = when {
                                                                e.message?.contains("replacement mode") == true ->
                                                                    "Subscriptions may not be in the same group. Contact support."
                                                                e.message?.contains("DEVELOPER_ERROR") == true ->
                                                                    "Invalid subscription configuration. Check Play Console settings."
                                                                else ->
                                                                    "Subscription change failed: ${e.message}"
                                                            }

                                                            iapStore.postStatusMessage(
                                                                message = errorMessage,
                                                                status = PurchaseResultStatus.Error,
                                                                productId = PREMIUM_SUBSCRIPTION_PRODUCT_ID
                                                            )
                                                        }
                                                    }
                                                },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (isMonthly) AppColors.success else AppColors.secondary
                                        ),
                                        enabled = !status.isPurchasing(PREMIUM_SUBSCRIPTION_PRODUCT_ID)
                                    ) {
                                        if (status.isPurchasing(PREMIUM_SUBSCRIPTION_PRODUCT_ID)) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(16.dp),
                                                color = MaterialTheme.colorScheme.onPrimary,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Text(if (isMonthly) "Upgrade" else "Switch")
                                        }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Available Subscription Products
            if (androidProducts.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Available Subscriptions")
                }
                
                items(androidProducts) { product ->
                    ProductCard(
                        product = product,
                        isPurchasing = status.isPurchasing(product.id),
                        isSubscribed = androidPurchases.any { it.productId == product.id && it.purchaseState == PurchaseState.Purchased },
                        onPurchase = {
                            // Prevent re-purchase if already subscribed
                            val alreadySubscribed = androidPurchases.any { it.productId == product.id && it.purchaseState == PurchaseState.Purchased }
                            if (alreadySubscribed) {
                                iapStore.postStatusMessage(
                                    message = "Already subscribed to ${product.id}",
                                    status = PurchaseResultStatus.Info,
                                    productId = product.id
                                )
                                return@ProductCard
                            }
                            scope.launch {
                                iapStore.setActivity(activity)

                                val props = if (product.type == ProductType.Subs) {
                                    RequestPurchaseProps(
                                        request = RequestPurchaseProps.Request.Subscription(
                                            RequestSubscriptionPropsByPlatforms(
                                                android = RequestSubscriptionAndroidProps(
                                                    isOfferPersonalized = null,
                                                    obfuscatedAccountIdAndroid = null,
                                                    obfuscatedProfileIdAndroid = null,
                                                    purchaseTokenAndroid = null,
                                                    replacementModeAndroid = null,
                                                    skus = listOf(product.id),
                                                    subscriptionOffers = null
                                                )
                                            )
                                        ),
                                        type = ProductQueryType.Subs
                                    )
                                } else {
                                    RequestPurchaseProps(
                                        request = RequestPurchaseProps.Request.Purchase(
                                            RequestPurchasePropsByPlatforms(
                                                android = RequestPurchaseAndroidProps(
                                                    isOfferPersonalized = null,
                                                    obfuscatedAccountIdAndroid = null,
                                                    obfuscatedProfileIdAndroid = null,
                                                    skus = listOf(product.id)
                                                )
                                            )
                                        ),
                                        type = ProductQueryType.InApp
                                    )
                                }

                                val result = iapStore.requestPurchase(props)
                                val purchases = when (result) {
                                    is dev.hyo.openiap.RequestPurchaseResultPurchases -> result.value.orEmpty()
                                    is dev.hyo.openiap.RequestPurchaseResultPurchase -> result.value?.let { listOf(it) }.orEmpty()
                                    else -> emptyList()
                                }
                                // If this is a new subscription to dev.hyo.martie.premium, save the offer
                                if (purchases.isNotEmpty() && product.id == PREMIUM_SUBSCRIPTION_PRODUCT_ID) {
                                    // Default to monthly offer for new purchases
                                    // In a production app, you'd want to let the user select the offer
                                    val defaultOffer = IapConstants.PREMIUM_MONTHLY_BASE_PLAN
                                    prefs.savePremiumOffer(PREMIUM_SUBSCRIPTION_PRODUCT_ID, defaultOffer)
                                    println("SubscriptionFlow: New subscription purchase completed, saved offer: $defaultOffer")
                                }
                            }
                        },
                        onClick = {
                            selectedProduct = product
                        },
                        onDetails = {
                            selectedProduct = product
                        }
                    )
                }
            } else if (!status.isLoading && androidProducts.isEmpty()) {
                item {
                    EmptyStateCard(
                        message = "No subscription products available",
                        icon = Icons.Default.Autorenew
                    )
                }
            }
            
            // Subscription Management Info
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.info.copy(alpha = 0.1f)
                    )
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
                                "Subscription Management",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        
                        Text(
                            "• Subscriptions auto-renew until cancelled\n" +
                            "• Manage subscriptions in Google Play Store\n" +
                            "• Cancellation takes effect at the end of the current billing period\n" +
                            "• Family sharing may be available for some subscriptions",
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.textSecondary
                        )
                    }
                }
            }
        }
    }

    // Auto-handle purchase: validate on server then finish (expo-iap style)
    // IMPORTANT: Implement real server-side receipt validation in validateReceiptOnServer()
    suspend fun validateReceiptOnServer(purchase: PurchaseAndroid): Boolean {
        // TODO: Replace with your real backend API call
        // e.g., POST purchase.purchaseToken to your server and verify
        return true
    }

    LaunchedEffect(lastPurchaseAndroid?.id) {
        val purchase = lastPurchaseAndroid ?: return@LaunchedEffect
        try {
            // 1) Server-side validation (replace with your backend call)
            val valid = validateReceiptOnServer(purchase)
            if (!valid) {
                iapStore.postStatusMessage(
                    message = "Receipt validation failed",
                    status = PurchaseResultStatus.Error,
                    productId = purchase.productId
                )
                return@LaunchedEffect
            }
            // 2) Determine consumable vs non-consumable (subs -> false)
            val product = products.find { it.id == purchase.productId }
            val isConsumable = product?.let {
                it.type == ProductType.InApp &&
                        (it.id.contains("consumable", true) || it.id.contains("bulb", true))
            } == true

            // 3) Ensure connection (quick retry)
            if (!connectionStatus) {
                runCatching { iapStore.initConnection() }
                val started = System.currentTimeMillis()
                while (!iapStore.isConnected.value && System.currentTimeMillis() - started < 1500) {
                    kotlinx.coroutines.delay(100)
                }
            }

            // 4) Finish transaction
            try {
                iapStore.finishTransaction(purchase, isConsumable)
                iapStore.getAvailablePurchases(null)
                iapStore.postStatusMessage(
                    message = "Transaction finished successfully",
                    status = PurchaseResultStatus.Success,
                    productId = purchase.productId
                )
            } catch (e: Exception) {
                iapStore.postStatusMessage(
                    message = "finishTransaction failed: ${e.message}",
                    status = PurchaseResultStatus.Error,
                    productId = purchase.productId
                )
            }
        } catch (e: Exception) {
            iapStore.postStatusMessage(
                message = e.message ?: "Failed to finish purchase",
                status = PurchaseResultStatus.Error,
                productId = purchase.productId
            )
        }
    }

    // Product Detail Modal
    selectedProduct?.let { product ->
        ProductDetailModal(
            product = product,
            onDismiss = { selectedProduct = null },
            onPurchase = {
                uiScope.launch {
                    iapStore.setActivity(activity)
                    val props = if (product.type == ProductType.Subs) {
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(
                                    android = RequestSubscriptionAndroidProps(
                                        isOfferPersonalized = null,
                                        obfuscatedAccountIdAndroid = null,
                                        obfuscatedProfileIdAndroid = null,
                                        purchaseTokenAndroid = null,
                                        replacementModeAndroid = null,
                                        skus = listOf(product.id),
                                        subscriptionOffers = null
                                    )
                                )
                            ),
                            type = ProductQueryType.Subs
                        )
                    } else {
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(
                                    android = RequestPurchaseAndroidProps(
                                        isOfferPersonalized = null,
                                        obfuscatedAccountIdAndroid = null,
                                        obfuscatedProfileIdAndroid = null,
                                        skus = listOf(product.id)
                                    )
                                )
                            ),
                            type = ProductQueryType.InApp
                        )
                    }
                    iapStore.requestPurchase(props)
                }
            },
            isPurchasing = status.isPurchasing(product.id)
        )
    }
    
    // Purchase Detail Modal
    selectedPurchase?.let { purchase ->
        PurchaseDetailModal(
            purchase = purchase,
            onDismiss = { selectedPurchase = null }
        )
    }
}

// Moved to reusable component at: screens/uis/ActiveSubscriptionListItem.kt
