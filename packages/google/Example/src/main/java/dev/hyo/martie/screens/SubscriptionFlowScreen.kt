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
import dev.hyo.martie.BuildConfig
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
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import dev.hyo.martie.util.findActivity
import dev.hyo.martie.util.PREMIUM_SUBSCRIPTION_PRODUCT_ID
import dev.hyo.martie.util.SUBSCRIPTION_PREFS_NAME
import dev.hyo.martie.util.resolvePremiumOfferInfo
import dev.hyo.martie.util.savePremiumOffer

// Google Play Billing SubscriptionReplacementMode values
// See: https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.SubscriptionUpdateParams.ReplacementMode
private object ReplacementMode {
    const val UNKNOWN_REPLACEMENT_MODE = 0
    const val WITH_TIME_PRORATION = 1     // Immediate change with prorated credit
    const val CHARGE_PRORATED_PRICE = 2   // Immediate change, charge difference (upgrade only)
    const val WITHOUT_PRORATION = 3       // Immediate change, no proration
    const val CHARGE_FULL_PRICE = 5       // Immediate change, charge full price
    const val DEFERRED = 6                // Change at next billing cycle
    const val KEEP_EXISTING = 7           // Keep existing payment schedule (8.1.0+)
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

    // Platform detection: Horizon vs Play Store (runtime detection)
    val isHorizon = remember { IapConstants.isHorizonOS() }

    // Load subscription SKUs based on platform
    val subscriptionSkus = remember {
        // Use runtime platform detection from Constants
        IapConstants.getSubscriptionSkus()
    }

    var isInitializing by remember { mutableStateOf(true) }

    // Verification states
    var verificationMethod by remember { mutableStateOf(VerificationMethod.None) }
    var isVerifying by remember { mutableStateOf(false) }
    var verificationResultMessage by remember { mutableStateOf<String?>(null) }
    var verificationDropdownExpanded by remember { mutableStateOf(false) }
    // Track which purchase IDs have been processed (to allow re-purchase after failure)
    var processedPurchaseKey by remember { mutableStateOf<String?>(null) }

    // IAPKit API Key from BuildConfig
    val iapkitApiKey: String? = remember {
        runCatching { BuildConfig.IAPKIT_API_KEY.takeIf { it.isNotBlank() } }.getOrNull()
    }

    // Use a dedicated scope for cleanup that won't be cancelled with composition
    val cleanupScope = remember { CoroutineScope(Dispatchers.Main + SupervisorJob()) }

    DisposableEffect(cleanupScope) {
        onDispose {
            cleanupScope.cancel()
        }
    }

    // Load subscription data on screen entry
    LaunchedEffect(Unit) {
        // Enable OpenIapLog for debugging
        dev.hyo.openiap.OpenIapLog.isEnabled = true

        try {
            println("SubscriptionFlow: Loading subscription products and purchases")
            println("SubscriptionFlow: Is Horizon = $isHorizon")
            println("SubscriptionFlow: Subscription SKUs = $subscriptionSkus")

            val connected = iapStore.initConnection()
            if (connected) {
                iapStore.setActivity(activity)

            // TEST: Use getActiveSubscriptions instead of getAvailablePurchases for example usage
            println("SubscriptionFlow: Testing getActiveSubscriptions...")
            try {
                val activeSubscriptions = iapStore.getActiveSubscriptions(subscriptionSkus)
                println("SubscriptionFlow: getActiveSubscriptions returned ${activeSubscriptions.size} subscriptions")
                activeSubscriptions.forEach { sub ->
                    println("  - ${sub.productId}: active=${sub.isActive}, autoRenew=${sub.autoRenewingAndroid}")
                }
            } catch (e: Exception) {
                println("SubscriptionFlow: getActiveSubscriptions FAILED: ${e.message}")
                e.printStackTrace()
            }
            delay(500)

            // Fetch products
            val request = ProductRequest(
                skus = subscriptionSkus,
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

            // Log product offers
            delay(500)
            val currentProducts = iapStore.products.value
            println("SubscriptionFlow: Found ${currentProducts.size} products")
            currentProducts.forEach { product ->
                if (product is ProductAndroid) {
                    println("  - Product: ${product.id}")
                    println("    Title: ${product.title}")
                    println("    Price: ${product.displayPrice}")
                    product.subscriptionOfferDetailsAndroid?.forEachIndexed { index, offer ->
                        println("    Offer $index:")
                        println("      Base Plan: ${offer.basePlanId}")
                        println("      Offer ID: ${offer.offerId}")
                        println("      Offer Token: ${offer.offerToken.take(20)}...")
                        offer.pricingPhases.pricingPhaseList.forEachIndexed { phaseIndex, phase ->
                            println("      Phase $phaseIndex: ${phase.formattedPrice} for ${phase.billingPeriod}")
                        }
                    }
                }
            }
        } else {
            iapStore.postStatusMessage(
                message = "Failed to connect to billing service",
                status = PurchaseResultStatus.Error
            )
        }
        } catch (e: Exception) {
            println("SubscriptionFlow: Initialization error: ${e.message}")
            e.printStackTrace()
            iapStore.postStatusMessage(
                message = "Failed to initialize: ${e.message}",
                status = PurchaseResultStatus.Error
            )
        } finally {
            isInitializing = false
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            // Use dedicated cleanup scope to avoid cancellation race
            cleanupScope.launch {
                runCatching { iapStore.endConnection() }
                runCatching { iapStore.clear() }
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
        // Expected mapping of your server response (VerifyPurchaseResultAndroid)
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
            .filter { it.productId in subscriptionSkus }
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

    // Auto-refresh purchases after successful purchase (like React Native implementation)
    LaunchedEffect(statusMessage?.productId, statusMessage?.status) {
        if (statusMessage?.status == PurchaseResultStatus.Success) {
            println("SubscriptionFlow: Purchase success detected, refreshing purchases...")
            println("SubscriptionFlow: Success message productId: ${statusMessage.productId}")
            delay(1000) // Wait 1 second for server to process
            try {
                iapStore.getAvailablePurchases(null)
            } catch (e: Exception) {
                println("SubscriptionFlow: Error refreshing purchases: ${e.message}")
            }
        }
    }

    // Log purchases whenever they change
    LaunchedEffect(androidPurchases.size) {
        println("SubscriptionFlow: Purchases changed, count=${androidPurchases.size}")
        androidPurchases.forEach { purchase ->
            println("SubscriptionFlow: - Purchase: productId=${purchase.productId}, state=${purchase.purchaseState}")
        }
    }

    // Auto-refresh purchases after products are loaded (like React Native implementation)
    LaunchedEffect(androidSubscriptions.size) {
        if (androidSubscriptions.isNotEmpty() && androidPurchases.isEmpty()) {
            println("SubscriptionFlow: Products loaded, checking for existing purchases...")
            delay(500)
            iapStore.getAvailablePurchases(null)
        }
    }

    // Modal states
    var selectedProduct by remember { mutableStateOf<ProductAndroid?>(null) }
    var selectedPurchase by remember { mutableStateOf<PurchaseAndroid?>(null) }

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
                                        skus = subscriptionSkus,
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

            // Verification Method Card
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
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                Icons.Default.VerifiedUser,
                                contentDescription = null,
                                tint = AppColors.secondary
                            )
                            Text(
                                "Purchase Verification",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        ExposedDropdownMenuBox(
                            expanded = verificationDropdownExpanded,
                            onExpandedChange = { verificationDropdownExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = verificationMethod.displayName,
                                onValueChange = {},
                                readOnly = true,
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = verificationDropdownExpanded)
                                },
                                colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor()
                            )
                            ExposedDropdownMenu(
                                expanded = verificationDropdownExpanded,
                                onDismissRequest = { verificationDropdownExpanded = false }
                            ) {
                                VerificationMethod.entries.forEach { method ->
                                    DropdownMenuItem(
                                        text = { Text(method.displayName) },
                                        onClick = {
                                            verificationMethod = method
                                            verificationDropdownExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        if (verificationMethod == VerificationMethod.IAPKit) {
                            if (iapkitApiKey != null) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = AppColors.success,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        "API Key configured",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = AppColors.success
                                    )
                                }
                            } else {
                                Card(
                                    colors = CardDefaults.cardColors(
                                        containerColor = AppColors.warning.copy(alpha = 0.1f)
                                    ),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.Warning,
                                                contentDescription = null,
                                                tint = AppColors.warning,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                "API Key not configured",
                                                style = MaterialTheme.typography.bodySmall,
                                                fontWeight = FontWeight.SemiBold,
                                                color = AppColors.warning
                                            )
                                        }
                                        Text(
                                            "Set IAPKIT_API_KEY in:",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = AppColors.textSecondary
                                        )
                                        Text(
                                            "• local.properties → iapkit.api.key=xxx",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = AppColors.textSecondary
                                        )
                                        Text(
                                            "• Or build.gradle → buildConfigField",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = AppColors.textSecondary
                                        )
                                    }
                                }
                            }
                        }

                        verificationResultMessage?.let { message ->
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = AppColors.background
                                ),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    message,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary,
                                    modifier = Modifier.padding(8.dp)
                                )
                            }
                        }
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
            if (isInitializing || status.isLoading) {
                item {
                    LoadingCard()
                }
            }
            
            // Active Subscriptions Section
            // Only show purchased subscriptions (filter out pending, failed, etc.)
            val activeSubscriptions = androidPurchases.filter {
                it.productId in subscriptionSkus &&
                    it.purchaseState == PurchaseState.Purchased
            }
            if (activeSubscriptions.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Active Subscriptions")
                }

                items(activeSubscriptions) { subscription ->
                    // Platform-specific premium subscription detection
                    val isPremium = if (isHorizon) {
                        // Horizon: Both premium and premium_year are premium subscriptions
                        subscription.productId == IapConstants.PREMIUM_PRODUCT_ID ||
                        subscription.productId == IapConstants.PREMIUM_YEARLY_PRODUCT_ID_PLAY
                    } else {
                        // Play: Only premium product ID (premium_year is separate)
                        subscription.productId == IapConstants.PREMIUM_PRODUCT_ID
                    }
                    val isPremiumYearlyPlay = subscription.productId == IapConstants.PREMIUM_YEARLY_PRODUCT_ID_PLAY
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

                            // Show upgrade/downgrade between monthly and yearly plans (works for both Play and Horizon)
                            if (isPremium) {
                                // Get the premium subscription product with all offers
                                val premiumSub = androidSubscriptions.find { it.id == IapConstants.PREMIUM_PRODUCT_ID }

                                if (premiumSub != null) {
                                    // Get monthly and yearly offers
                                    // On Horizon: offers are distinguished by billing period (P1M vs P1Y)
                                    // On Play: offers can use base plan IDs or billing periods
                                    val monthlyOffer = premiumSub.subscriptionOfferDetailsAndroid?.find { offer ->
                                        // Check base plan ID first (Play Store style)
                                        offer.basePlanId == IapConstants.PREMIUM_MONTHLY_BASE_PLAN ||
                                        // Or check billing period (Horizon style)
                                        offer.pricingPhases.pricingPhaseList.lastOrNull()?.billingPeriod == "P1M"
                                    }
                                    val yearlyOffer = premiumSub.subscriptionOfferDetailsAndroid?.find { offer ->
                                        // Check base plan ID first (Play Store style)
                                        offer.basePlanId == IapConstants.PREMIUM_YEARLY_BASE_PLAN ||
                                        // Or check billing period (Horizon style)
                                        offer.pricingPhases.pricingPhaseList.lastOrNull()?.billingPeriod == "P1Y"
                                    }

                                    // Determine which plan user is currently on
                                    // Try to resolve from SharedPreferences first
                                    val currentOfferInfo = resolvePremiumOfferInfo(prefs, subscription)

                                    // Detect current plan
                                    // On Horizon: all offers have same base plan ID, use billing period to distinguish
                                    // On Play: base plan ID differs (premium vs premium-year)
                                    val isMonthlyPlan = if (currentOfferInfo != null) {
                                        when {
                                            // If billing period is available (Horizon), use that
                                            currentOfferInfo.billingPeriod != null ->
                                                currentOfferInfo.billingPeriod == "P1M"
                                            // Otherwise use base plan ID (Play Store)
                                            else ->
                                                currentOfferInfo.basePlanId == IapConstants.PREMIUM_MONTHLY_BASE_PLAN
                                        }
                                    } else {
                                        // Default to monthly
                                        true
                                    }

                                    val currentOffer = if (isMonthlyPlan) monthlyOffer else yearlyOffer
                                    val targetOffer = if (isMonthlyPlan) yearlyOffer else monthlyOffer

                                    // Only show upgrade UI if both offers exist
                                    if (monthlyOffer != null && yearlyOffer != null && currentOffer != null && targetOffer != null) {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    HorizontalDivider(
                                        modifier = Modifier.fillMaxWidth(),
                                        thickness = 1.dp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Current plan display
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
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "Current Plan: ${if (isMonthlyPlan) "Monthly" else "Yearly"}",
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontWeight = FontWeight.Medium
                                            )
                                            val billingPeriod = currentOffer.pricingPhases.pricingPhaseList.lastOrNull()?.billingPeriod ?: ""
                                            val price = currentOffer.pricingPhases.pricingPhaseList.lastOrNull()?.formattedPrice ?: ""
                                            Text(
                                                text = "Billing: $billingPeriod • $price",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.textSecondary
                                            )
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = AppColors.primary.copy(alpha = 0.12f)
                                        ) {
                                            Text(
                                                text = if (isMonthlyPlan) "1 month" else "12 months",
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = AppColors.primary
                                            )
                                        }
                                    }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        // Upgrade/Downgrade button
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = if (isMonthlyPlan) "Upgrade to Yearly Plan" else "Switch to Monthly Plan",
                                                    style = MaterialTheme.typography.titleSmall,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                                val targetPrice = targetOffer.pricingPhases.pricingPhaseList.firstOrNull()?.formattedPrice ?: ""
                                                Text(
                                                    text = "${targetOffer.basePlanId} - $targetPrice",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = AppColors.textSecondary
                                                )
                                                if (isMonthlyPlan) {
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
                                                                    productId = IapConstants.PREMIUM_PRODUCT_ID
                                                                )
                                                                return@launch
                                                            }

                                                            println("SubscriptionFlow [Horizon/Play]: Changing from ${currentOffer.basePlanId} to ${targetOffer.basePlanId} with token: ${purchaseToken.take(10)}...")

                                                            // Request subscription offer change (same product, different offer)
                                                            // Using new subscriptionProductReplacementParams API (8.1.0+)
                                                            val offerInputs = listOf(
                                                                AndroidSubscriptionOfferInput(
                                                                    sku = IapConstants.PREMIUM_PRODUCT_ID,
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
                                                                            // New 8.1.0+ API: per-product replacement params
                                                                            subscriptionProductReplacementParams = SubscriptionProductReplacementParamsAndroid(
                                                                                oldProductId = IapConstants.PREMIUM_PRODUCT_ID,
                                                                                replacementMode = SubscriptionReplacementModeAndroid.ChargeFullPrice
                                                                            ),
                                                                            skus = listOf(IapConstants.PREMIUM_PRODUCT_ID),
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
                                                                prefs.savePremiumOffer(IapConstants.PREMIUM_PRODUCT_ID, newOfferBasePlanId)
                                                                println("SubscriptionFlow: Subscription change successful, saved offer: $newOfferBasePlanId")

                                                                // Don't post success message here - let LaunchedEffect handle verification
                                                                // The purchase listener will update lastPurchaseAndroid which triggers verification
                                                            }
                                                        } catch (e: Exception) {
                                                            println("SubscriptionFlow: Error changing subscription: ${e.message}")
                                                            e.printStackTrace()

                                                            iapStore.postStatusMessage(
                                                                message = "Subscription change failed: ${e.message}",
                                                                status = PurchaseResultStatus.Error,
                                                                productId = IapConstants.PREMIUM_PRODUCT_ID
                                                            )
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (isMonthlyPlan) AppColors.success else AppColors.secondary
                                                ),
                                                enabled = !status.isPurchasing(IapConstants.PREMIUM_PRODUCT_ID)
                                            ) {
                                                if (status.isPurchasing(IapConstants.PREMIUM_PRODUCT_ID)) {
                                                    CircularProgressIndicator(
                                                        modifier = Modifier.size(16.dp),
                                                        color = MaterialTheme.colorScheme.onPrimary,
                                                        strokeWidth = 2.dp
                                                    )
                                                } else {
                                                    Text(if (isMonthlyPlan) "Upgrade" else "Switch")
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Play Store: Show upgrade/downgrade option for dev.hyo.martie.premium subscription offers
                            if (!isHorizon && subscription.productId == PREMIUM_SUBSCRIPTION_PRODUCT_ID) {
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

                                                                // Don't post success message here - let LaunchedEffect handle verification
                                                                // The purchase listener will update lastPurchaseAndroid which triggers verification
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
                            // Check if already subscribed to this product
                            val alreadySubscribed = androidPurchases.any { it.productId == product.id && it.purchaseState == PurchaseState.Purchased }
                            if (alreadySubscribed) {
                                iapStore.postStatusMessage(
                                    message = "Already subscribed to ${product.id}",
                                    status = PurchaseResultStatus.Info,
                                    productId = product.id
                                )
                                return@ProductCard
                            }

                            // Check if subscribed to other premium product (for upgrade/downgrade)
                            // Note: In Horizon, purchasing Tier 1 (premium) automatically upgrades to Tier 2 (premium_year)
                            val otherPremiumSubscription = androidPurchases.find { purchase ->
                                purchase.purchaseState == PurchaseState.Purchased &&
                                purchase.productId in listOf(IapConstants.PREMIUM_PRODUCT_ID, IapConstants.PREMIUM_YEARLY_PRODUCT_ID_PLAY) &&
                                purchase.productId != product.id
                            }

                            scope.launch {
                                iapStore.setActivity(activity)

                                val props = if (product.type == ProductType.Subs) {
                                    // Determine if this is an upgrade or downgrade
                                    val purchaseToken = otherPremiumSubscription?.purchaseToken
                                    val replacementMode = if (purchaseToken != null) {
                                        // Use CHARGE_FULL_PRICE (5) for immediate change
                                        println("SubscriptionFlow: Changing subscription from ${otherPremiumSubscription.productId} to ${product.id}")
                                        5 // CHARGE_FULL_PRICE
                                    } else {
                                        println("SubscriptionFlow: New subscription: ${product.id}")
                                        null
                                    }

                                    // Platform-specific offer selection
                                    val subscriptionOffers = if (isHorizon && product.id == "dev.hyo.martie.premium" && product is ProductAndroid) {
                                        // HORIZON ONLY: Premium product has multiple offers (MONTHLY and ANNUAL)
                                        // We default to MONTHLY offer for initial purchase
                                        val monthlyOffer = product.subscriptionOfferDetailsAndroid?.find { offer ->
                                            offer.pricingPhases.pricingPhaseList.any { phase ->
                                                phase.billingPeriod == "P1M"
                                            }
                                        }
                                        if (monthlyOffer != null) {
                                            println("SubscriptionFlow: Using MONTHLY offer token: ${monthlyOffer.offerToken}")
                                            listOf(AndroidSubscriptionOfferInput(
                                                offerToken = monthlyOffer.offerToken,
                                                sku = product.id
                                            ))
                                        } else {
                                            println("SubscriptionFlow: No MONTHLY offer found, using default")
                                            null
                                        }
                                    } else {
                                        // PLAY STORE: Uses base plan IDs, no special offer selection needed
                                        null
                                    }

                                    RequestPurchaseProps(
                                        request = RequestPurchaseProps.Request.Subscription(
                                            RequestSubscriptionPropsByPlatforms(
                                                android = RequestSubscriptionAndroidProps(
                                                    isOfferPersonalized = null,
                                                    obfuscatedAccountIdAndroid = null,
                                                    obfuscatedProfileIdAndroid = null,
                                                    purchaseTokenAndroid = purchaseToken,
                                                    replacementModeAndroid = replacementMode,
                                                    skus = listOf(product.id),
                                                    subscriptionOffers = subscriptionOffers
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
            } else if (!isInitializing && !status.isLoading && androidProducts.isEmpty()) {
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

    // Verification helper functions
    suspend fun verifyWithIapkit(purchase: PurchaseAndroid, apiKey: String): Boolean {
        val token = purchase.purchaseToken
            ?: throw IllegalStateException("Purchase token is required for IAPKit verification")

        println("SubscriptionFlow: IAPKit verification params:")
        println("  - purchaseToken: $token")

        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = token
            )
        )
        val result = verifyPurchaseWithIapkit(props, "SubscriptionFlowScreen")
        return result.isValid
    }

    // Local verification: For Android, we just check if the purchase state is authentic
    fun verifyLocally(purchase: PurchaseAndroid): Boolean {
        return purchase.purchaseState == PurchaseState.Purchased
    }

    // Auto-handle purchase: validate then finish
    // Use a unique key combining purchase ID and transaction date to ensure re-trigger on new purchases
    // This fixes the issue where Buy button doesn't work after verification failure
    val purchaseKey = lastPurchaseAndroid?.let { "${it.id}_${it.transactionDate}" }
    LaunchedEffect(purchaseKey) {
        val purchase = lastPurchaseAndroid ?: return@LaunchedEffect

        // Skip if we've already processed this exact purchase
        if (purchaseKey == processedPurchaseKey) {
            println("SubscriptionFlow: Skipping already processed purchase: $purchaseKey")
            return@LaunchedEffect
        }

        // Clear any premature "success" message from purchase listener
        // We will only show the final result after verification completes
        iapStore.clearStatusMessage()

        try {
            // 1) Perform verification based on selected method
            val isValid = when (verificationMethod) {
                VerificationMethod.None -> {
                    verificationResultMessage = "✅ No verification (skipped)"
                    true
                }
                VerificationMethod.Local -> {
                    isVerifying = true
                    verificationResultMessage = "🔍 Verifying locally..."
                    try {
                        val result = verifyLocally(purchase)
                        verificationResultMessage = if (result) "✅ Local verification passed" else "❌ Local verification failed"
                        result
                    } catch (e: Exception) {
                        verificationResultMessage = "❌ Local verification error: ${e.message}"
                        false
                    } finally {
                        isVerifying = false
                    }
                }
                VerificationMethod.IAPKit -> {
                    val apiKey = iapkitApiKey
                    if (apiKey == null) {
                        verificationResultMessage = "❌ IAPKit API Key not configured"
                        iapStore.postStatusMessage(
                            message = "IAPKit API Key not configured. Set iapkit.api.key in local.properties",
                            status = PurchaseResultStatus.Error,
                            productId = purchase.productId
                        )
                        // Mark as processed so user can retry
                        processedPurchaseKey = purchaseKey
                        return@LaunchedEffect
                    }
                    isVerifying = true
                    verificationResultMessage = "☁️ Verifying with IAPKit..."
                    println("SubscriptionFlow: Starting IAPKit verification for ${purchase.productId}")
                    try {
                        val result = verifyWithIapkit(purchase, apiKey)
                        println("SubscriptionFlow: IAPKit verification result: $result")
                        verificationResultMessage = if (result) "✅ IAPKit verification passed" else "❌ IAPKit verification failed"
                        if (!result) {
                            // Post error with auto-refund notice
                            iapStore.postStatusMessage(
                                message = "Verification failed. Purchase not acknowledged - will be auto-refunded within 3 days.",
                                status = PurchaseResultStatus.Error,
                                productId = purchase.productId
                            )
                        }
                        result
                    } catch (e: Exception) {
                        println("SubscriptionFlow: IAPKit verification error: ${e.message}")
                        e.printStackTrace()
                        verificationResultMessage = "❌ IAPKit verification error: ${e.message}"
                        iapStore.postStatusMessage(
                            message = "Verification error: ${e.message}. Finishing transaction anyway for testing.",
                            status = PurchaseResultStatus.Error,
                            productId = purchase.productId
                        )
                        // For testing: return true to continue with finishTransaction
                        println("SubscriptionFlow: [TEST MODE] Continuing with finishTransaction despite verification error")
                        true
                    } finally {
                        isVerifying = false
                    }
                }
            }

            if (!isValid) {
                println("SubscriptionFlow: Verification failed – not finishing transaction")
                // Mark as processed so the same purchase isn't re-processed
                processedPurchaseKey = purchaseKey
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
        } finally {
            // Mark as processed so user can retry if needed
            processedPurchaseKey = purchaseKey
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
