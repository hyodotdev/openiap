package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import dev.hyo.martie.config.AppConfig
import dev.hyo.martie.theme.AppColors
import dev.hyo.martie.utils.swipeToBack
import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.fetchProducts
import io.github.hyochan.kmpiap.requestPurchase
import io.github.hyochan.kmpiap.toPurchaseInput
import io.github.hyochan.kmpiap.getCurrentPlatform
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.ProductAndroid
import io.github.hyochan.kmpiap.openiap.ProductIOS
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseAppleOptions
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseGoogleOptions
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitAppleProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultHorizon
import io.github.hyochan.kmpiap.openiap.SubscriptionOffer
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionIOS
import kotlinx.coroutines.*
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private val SUBSCRIPTION_IDS = listOf(
    "dev.hyo.martie.premium",
    "dev.hyo.martie.premium_year"
)

/**
 * Helper function to format epoch milliseconds to LocalDateTime string
 */
private fun Long.toFormattedDate(): String {
    return Instant.fromEpochMilliseconds(this)
        .toLocalDateTime(TimeZone.currentSystemDefault())
        .toString()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionFlowScreen(navController: NavController) {
    val scope = rememberCoroutineScope()

    // Create IAP instance
    val kmpIAP = remember { KmpIAP() }
    
    var isConnecting by remember { mutableStateOf(true) }
    var isLoadingProducts by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    var purchaseResult by remember { mutableStateOf<String?>(null) }
    var transactionResult by remember { mutableStateOf<String?>(null) }
    var initError by remember { mutableStateOf<String?>(null) }
    
    var connected by remember { mutableStateOf(false) }
    var subscriptions by remember { mutableStateOf<List<Product>>(emptyList()) }
    var activeSubscriptions by remember { mutableStateOf<List<ActiveSubscription>>(emptyList()) }
    var hasActiveSubscription by remember { mutableStateOf(false) }
    var currentError by remember { mutableStateOf<PurchaseError?>(null) }
    var currentPurchase by remember { mutableStateOf<Purchase?>(null) }

    // Verification method selection
    var verificationMethod by remember { mutableStateOf(VerificationMethod.None) }
    var showVerificationDialog by remember { mutableStateOf(false) }
    var verificationResult by remember { mutableStateOf<String?>(null) }

    // Register purchase event listeners
    LaunchedEffect(Unit) {
        launch {
            kmpIAP.purchaseUpdatedListener.collect { purchase ->
                currentPurchase = purchase

                when (purchase.purchaseState) {
                    PurchaseState.Purchased -> {
                        isProcessing = false

                        val dateText = purchase.transactionDate?.let {
                            Instant.fromEpochSeconds(it.toLong()).toLocalDateTime(TimeZone.currentSystemDefault())
                        } ?: "N/A"
                        purchaseResult = """
                    ✅ Subscription successful (${purchase.platform})
                    Product: ${purchase.productId}
                    Transaction ID: ${purchase.id.ifEmpty { "N/A" }}
                    Date: $dateText
                    Receipt: ${purchase.purchaseToken?.take(50) ?: "N/A"}
                """.trimIndent()

                        scope.launch {
                            // Verify purchase based on selected method
                            if (verificationMethod != VerificationMethod.None) {
                                verificationResult = "🔄 Verifying subscription..."
                                try {
                                    when (verificationMethod) {
                                        VerificationMethod.Local -> {
                                            val isIos = getCurrentPlatform() == IapPlatform.Ios
                                            val result = kmpIAP.verifyPurchase(
                                                VerifyPurchaseProps(
                                                    apple = if (isIos) VerifyPurchaseAppleOptions(sku = purchase.productId) else null,
                                                    google = if (!isIos) VerifyPurchaseGoogleOptions(
                                                        sku = purchase.productId,
                                                        accessToken = "your_google_api_access_token", // Obtain from your backend for production use
                                                        packageName = "your.app.package.name", // Your app's package name
                                                        purchaseToken = purchase.purchaseToken ?: "",
                                                        isSub = true
                                                    ) else null
                                                )
                                            )
                                            verificationResult = when (result) {
                                                is VerifyPurchaseResultIOS -> "📱 Local Verification (iOS):\n" +
                                                    "Valid: ${result.isValid}\n" +
                                                    "Receipt: ${result.receiptData.take(50)}..."
                                                is VerifyPurchaseResultAndroid -> "📱 Local Verification (Android):\n" +
                                                    "Product: ${result.productId}\n" +
                                                    "Receipt ID: ${result.receiptId}"
                                                is VerifyPurchaseResultHorizon -> "📱 Horizon Verification:\n" +
                                                    "Success: ${result.success}\n" +
                                                    "Grant Time: ${result.grantTime ?: "N/A"}"
                                            }
                                        }
                                        VerificationMethod.IAPKit -> {
                                            val apiKey = AppConfig.iapkitApiKey
                                            if (apiKey.isEmpty()) {
                                                verificationResult = "❌ IAPKit API key not configured.\n" +
                                                    "Set IAPKIT_API_KEY in .env file."
                                            } else {
                                                val jwsOrToken = purchase.purchaseToken ?: ""
                                                if (jwsOrToken.isEmpty()) {
                                                    verificationResult = "❌ No purchase token available for verification"
                                                } else {
                                                    val isIos = getCurrentPlatform() == IapPlatform.Ios
                                                    val result = kmpIAP.verifyPurchaseWithProvider(
                                                        VerifyPurchaseWithProviderProps(
                                                            provider = PurchaseVerificationProvider.Iapkit,
                                                            iapkit = RequestVerifyPurchaseWithIapkitProps(
                                                                apiKey = apiKey,
                                                                apple = if (isIos) RequestVerifyPurchaseWithIapkitAppleProps(jws = jwsOrToken) else null,
                                                                google = if (!isIos) RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = jwsOrToken) else null
                                                            )
                                                        )
                                                    )
                                                    val iapkitResult = result.iapkit
                                                    val statusEmoji = if (iapkitResult?.isValid == true) "✅" else "⚠️"
                                                    verificationResult = "$statusEmoji IAPKit Verification:\n" +
                                                        "Valid: ${iapkitResult?.isValid ?: false}\n" +
                                                        "State: ${iapkitResult?.state?.rawValue ?: "unknown"}\n" +
                                                        "Store: ${iapkitResult?.store?.rawValue ?: "unknown"}"
                                                }
                                            }
                                        }
                                        else -> {}
                                    }
                                } catch (e: Exception) {
                                    verificationResult = "❌ Verification failed: ${e.message}"
                                }
                            }

                            // Finish the transaction
                            try {
                                kmpIAP.finishTransaction(
                                    purchase = purchase.toPurchaseInput(),
                                    isConsumable = false
                                )
                                purchaseResult = "$purchaseResult\n\n✅ Transaction finished successfully"

                                activeSubscriptions = kmpIAP.getActiveSubscriptions(SUBSCRIPTION_IDS)
                                hasActiveSubscription = kmpIAP.hasActiveSubscriptions(SUBSCRIPTION_IDS)
                            } catch (e: Exception) {
                                purchaseResult = "$purchaseResult\n\n❌ Failed to finish transaction: ${e.message}"
                            }
                        }
                    }
                    PurchaseState.Pending -> {
                        isProcessing = true
                        purchaseResult = "⏳ Subscription is pending user confirmation..."
                    }
                    PurchaseState.Unknown -> {
                        isProcessing = false
                        purchaseResult = null
                    }
                }
            }
        }
        
        launch {
            kmpIAP.purchaseErrorListener.collect { error ->
                isProcessing = false
                currentError = error
                purchaseResult = when (error.code) {
                    ErrorCode.UserCancelled -> "⚠️ Subscription cancelled by user"
                    else -> "❌ Error: ${error.message}\nCode: ${error.code}"
                }
            }
        }
    }
    
    // Initialize connection and load subscriptions
    LaunchedEffect(Unit) {
        scope.launch {
            // Step 1: Initialize connection
            isConnecting = true
            try {
                val connectionResult = kmpIAP.initConnection()
                connected = connectionResult
                
                if (!connectionResult) {
                    initError = "Failed to connect to store"
                    return@launch
                }
                
                // Step 2: Connection successful, load subscriptions immediately
                isConnecting = false
                isLoadingProducts = true
                
                // Load active subscriptions and subscription products in parallel
                val activeSubscriptionsDeferred = async {
                    try {
                        kmpIAP.getActiveSubscriptions(SUBSCRIPTION_IDS)
                    } catch (e: Exception) {
                        println("Failed to get active subscriptions: ${e.message}")
                        emptyList()
                    }
                }
                
                val hasActiveSubDeferred = async {
                    try {
                        kmpIAP.hasActiveSubscriptions(SUBSCRIPTION_IDS)
                    } catch (e: Exception) {
                        println("Failed to check active subscriptions: ${e.message}")
                        false
                    }
                }
                
                val subscriptionProductsDeferred = async {
                    try {
                        kmpIAP.fetchProducts {
                            skus = SUBSCRIPTION_IDS
                            type = ProductQueryType.Subs
                        }
                    } catch (e: Exception) {
                        println("Failed to load subscription products: ${e.message}")
                        throw e
                    }
                }
                
                // Wait for all results with timeout
                val results = withTimeoutOrNull(10000) {
                    Triple(
                        activeSubscriptionsDeferred.await(),
                        hasActiveSubDeferred.await(),
                        subscriptionProductsDeferred.await()
                    )
                } ?: Triple(emptyList(), false, emptyList())
                
                // Process results
                activeSubscriptions = results.first
                hasActiveSubscription = results.second
                val subscriptionProducts = results.third
                
                // Process subscription products - they are already of type Product
                subscriptions = subscriptionProducts
                
                if (subscriptions.isEmpty()) {
                    purchaseResult = "No subscriptions found for IDs: ${SUBSCRIPTION_IDS.joinToString()}"
                }
                
            } catch (e: Exception) {
                purchaseResult = "Initialization error: ${e.message}"
                connected = false
            } finally {
                isConnecting = false
                isLoadingProducts = false
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscription Flow") },
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
            
            Spacer(modifier = Modifier.height(12.dp))

            // Verification Method Selector
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Subscription Verification",
                        fontSize = 14.sp,
                        color = AppColors.Secondary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showVerificationDialog = true },
                        colors = CardDefaults.cardColors(containerColor = AppColors.Background),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${verificationMethod.icon} ${verificationMethod.label}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = AppColors.OnSurface
                            )
                            Text(
                                text = "Tap to change",
                                fontSize = 12.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Active Subscription Status
            if (hasActiveSubscription) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.Success.copy(alpha = 0.1f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Active Subscriptions (${activeSubscriptions.size})",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = AppColors.OnSurface
                        )
                        
                        activeSubscriptions.forEach { activeSub ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Column {
                                Text(
                                    text = "• ${activeSub.productId}",
                                    fontSize = 14.sp,
                                    color = AppColors.OnSurface
                                )
                                
                                // Show iOS-specific info
                                activeSub.expirationDateIOS?.let { expDate ->
                                    val expiration = expDate.toLong().toFormattedDate()
                                    Text(
                                        text = "  Expires: $expiration",
                                        fontSize = 12.sp,
                                        color = AppColors.Secondary
                                    )
                                }
                                
                                activeSub.environmentIOS?.let { env ->
                                    Text(
                                        text = "  Environment: $env",
                                        fontSize = 12.sp,
                                        color = AppColors.Secondary
                                    )
                                }
                                
                                activeSub.daysUntilExpirationIOS?.let { days ->
                                    Text(
                                        text = "  Days until expiration: $days",
                                        fontSize = 12.sp,
                                        color = if (days <= 7) AppColors.Error else AppColors.Secondary
                                    )
                                }

                                // Show renewalInfoIOS details
                                activeSub.renewalInfoIOS?.let { renewalInfo ->
                                    Spacer(modifier = Modifier.height(8.dp))

                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(
                                            containerColor = AppColors.Background
                                        ),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(8.dp)
                                        ) {
                                            Text(
                                                text = "Renewal Info (iOS)",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = AppColors.InfoPurple
                                            )

                                            Spacer(modifier = Modifier.height(4.dp))

                                            // Auto-Renew Status
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = if (renewalInfo.willAutoRenew) "✅ Auto-Renew" else "⚠️ Won't Auto-Renew",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = if (renewalInfo.willAutoRenew) AppColors.Success else AppColors.Orange
                                                )
                                            }

                                            // Pending Upgrade Detection
                                            renewalInfo.pendingUpgradeProductId?.let { upgradeId ->
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "🔵 Upgrade Pending → $upgradeId",
                                                    fontSize = 11.sp,
                                                    color = AppColors.InfoBlue,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }

                                            // Next Renewal Date
                                            renewalInfo.renewalDate?.let { renewalDate ->
                                                Spacer(modifier = Modifier.height(4.dp))
                                                val date = renewalDate.toLong().toFormattedDate()
                                                Text(
                                                    text = "Next Renewal: $date",
                                                    fontSize = 10.sp,
                                                    color = AppColors.Secondary
                                                )
                                            }

                                            // Expiration Reason (if cancelled)
                                            renewalInfo.expirationReason?.let { reason ->
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "Expiration Reason: $reason",
                                                    fontSize = 10.sp,
                                                    color = AppColors.Error
                                                )
                                            }

                                            // Billing Retry Status
                                            if (renewalInfo.isInBillingRetry == true) {
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Column {
                                                    Text(
                                                        text = "🟣 Billing Retry in Progress",
                                                        fontSize = 11.sp,
                                                        color = AppColors.Purple,
                                                        fontWeight = FontWeight.Medium
                                                    )
                                                    renewalInfo.gracePeriodExpirationDate?.let { graceDate ->
                                                        val grace = graceDate.toLong().toFormattedDate()
                                                        Text(
                                                            text = "Grace Period Ends: $grace",
                                                            fontSize = 10.sp,
                                                            color = AppColors.Secondary
                                                        )
                                                    }
                                                }
                                            }

                                            // Price Increase Status
                                            renewalInfo.priceIncreaseStatus?.let { status ->
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "Price Increase: $status",
                                                    fontSize = 10.sp,
                                                    color = AppColors.Secondary
                                                )
                                            }

                                            // Auto-Renew Preference (if different from current product)
                                            renewalInfo.autoRenewPreference?.let { preference ->
                                                if (preference != activeSub.productId) {
                                                    Spacer(modifier = Modifier.height(4.dp))
                                                    Text(
                                                        text = "Will renew as: $preference",
                                                        fontSize = 10.sp,
                                                        color = AppColors.Secondary
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }

                                // Show Android-specific info
                                activeSub.autoRenewingAndroid?.let { autoRenew ->
                                    Text(
                                        text = "  Auto-renewing: ${if (autoRenew) "Yes" else "No"}",
                                        fontSize = 12.sp,
                                        color = AppColors.Secondary
                                    )
                                }

                                if (activeSub.willExpireSoon == true) {
                                    Text(
                                        text = "  ⚠️ Expiring soon!",
                                        fontSize = 12.sp,
                                        color = AppColors.Warning,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(20.dp))
            }

            // Upgrade Detection Section
            activeSubscriptions.firstOrNull { it.renewalInfoIOS?.pendingUpgradeProductId != null }?.let { upgrading ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.UpgradeBackground
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "🔵 Subscription Upgrade Detected",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = AppColors.InfoBlue
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Current Plan: ${upgrading.productId}",
                            fontSize = 14.sp,
                            color = AppColors.OnSurface
                        )

                        upgrading.renewalInfoIOS?.pendingUpgradeProductId?.let { upgradeId ->
                            Text(
                                text = "Upgrading To: $upgradeId",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = AppColors.InfoBlue
                            )
                        }

                        upgrading.renewalInfoIOS?.renewalDate?.let { renewalDate ->
                            val date = renewalDate.toLong().toFormattedDate()
                            Text(
                                text = "Effective Date: $date",
                                fontSize = 12.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
            }

            // Cancellation Detection Section
            activeSubscriptions.firstOrNull {
                val info = it.renewalInfoIOS
                info?.willAutoRenew == false && info.pendingUpgradeProductId == null
            }?.let { cancelled ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.CancellationBackground
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "🟠 Subscription Cancelled",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = AppColors.Orange
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Product: ${cancelled.productId}",
                            fontSize = 14.sp,
                            color = AppColors.OnSurface
                        )

                        Text(
                            text = "Status: Active but won't renew",
                            fontSize = 14.sp,
                            color = AppColors.Secondary
                        )

                        cancelled.expirationDateIOS?.let { expDate ->
                            val expiration = expDate.toLong().toFormattedDate()
                            Text(
                                text = "Expires: $expiration",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = AppColors.Orange
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
            }

            // Subscriptions Section
            Text(
                text = "Available Subscriptions",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.OnSurface
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            if (isLoadingProducts) {
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
            } else if (subscriptions.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (connected) "No subscriptions available" else "Connect to load subscriptions",
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.Secondary
                    )
                }
            } else {
                subscriptions.forEach { subscription ->
                    val isSubscribed = activeSubscriptions.any { it.productId == subscription.id }
                    val activeSubscription = activeSubscriptions.find { it.productId == subscription.id }
                    
                    SubscriptionCard(
                        subscription = subscription,
                        isSubscribed = isSubscribed,
                        activeSubscription = activeSubscription,
                        onSubscribe = {
                            if (!isSubscribed) {
                                scope.launch {
                                    isProcessing = true
                                    purchaseResult = null
                                    try {
                                        val purchase = kmpIAP.requestPurchase {
                                            type = ProductType.Subs
                                            ios {
                                                sku = subscription.id
                                                quantity = 1
                                            }
                                            android {
                                                skus = listOf(subscription.id)
                                            }
                                        }
                                        // Purchase updates will be received through the purchaseUpdatedListener
                                        // The UI will be updated automatically when the listener triggers
                                    } catch (e: Exception) {
                                        purchaseResult = "Subscription failed: ${e.message}"
                                        isProcessing = false
                                    }
                                }
                            }
                        },
                        isProcessing = isProcessing
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
            
            // Purchase Result
            purchaseResult?.let { result ->
                Spacer(modifier = Modifier.height(20.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when {
                            result.contains("✅") -> AppColors.Success.copy(alpha = 0.1f)
                            result.contains("❌") || result.contains("Error", ignoreCase = true) -> AppColors.Error.copy(alpha = 0.1f)
                            result.contains("⚠️") || result.contains("cancelled", ignoreCase = true) -> AppColors.Warning
                            else -> Color.White
                        }
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Subscription Result",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = AppColors.OnSurface
                        )
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Text(
                            text = result,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            color = AppColors.OnSurface
                        )
                    }
                }
            }

            // Verification Result
            verificationResult?.let { result ->
                Spacer(modifier = Modifier.height(12.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when {
                            result.contains("✅") -> AppColors.Success.copy(alpha = 0.1f)
                            result.contains("❌") -> AppColors.Error.copy(alpha = 0.1f)
                            result.contains("🔄") -> AppColors.Primary.copy(alpha = 0.1f)
                            else -> Color.White
                        }
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Verification Result",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = AppColors.OnSurface
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = result,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            color = AppColors.OnSurface
                        )
                    }
                }
            }
        }
    }

    // Verification Method Selection Dialog
    if (showVerificationDialog) {
        AlertDialog(
            onDismissRequest = { showVerificationDialog = false },
            title = {
                Text("Select Verification Method")
            },
            text = {
                Column {
                    Text(
                        text = "Choose how to verify subscriptions after purchase",
                        fontSize = 14.sp,
                        color = AppColors.Secondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))

                    VerificationMethod.entries.forEach { method ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clickable {
                                    verificationMethod = method
                                    verificationResult = null
                                    showVerificationDialog = false
                                },
                            colors = CardDefaults.cardColors(
                                containerColor = if (method == verificationMethod)
                                    AppColors.Primary.copy(alpha = 0.1f)
                                else
                                    AppColors.Background
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = method.icon,
                                    fontSize = 20.sp
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = method.label,
                                        fontWeight = FontWeight.Medium,
                                        color = AppColors.OnSurface
                                    )
                                    Text(
                                        text = when (method) {
                                            VerificationMethod.None -> "Skip verification"
                                            VerificationMethod.Local -> "Verify on device (iOS only)"
                                            VerificationMethod.IAPKit -> "Server-side verification via IAPKit"
                                        },
                                        fontSize = 12.sp,
                                        color = AppColors.Secondary
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showVerificationDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun SubscriptionCard(
    subscription: Product,
    isSubscribed: Boolean,
    activeSubscription: ActiveSubscription? = null,
    onSubscribe: () -> Unit,
    isProcessing: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                // Log subscription product details to console
                println("\n========== SUBSCRIPTION PRODUCT ==========")
                println("ID: ${subscription.id}")
                println("Title: ${subscription.title}")
                println("Description: ${subscription.description}")
                println("Display Price: ${subscription.displayPrice}")
                println("Currency: ${subscription.currency}")
                println("Price: ${subscription.price}")
                println("Type: ${subscription.type}")
                println("Platform: ${subscription.platform}")

                // Platform-specific details
                when (subscription) {
                    is ProductSubscriptionAndroid -> {
                        println("--- Android Specific ---")
                        println("Subscription Offers: ${subscription.subscriptionOffers.size} offers")
                        subscription.subscriptionOffers.forEach { offer ->
                            println("  - Offer: ${offer.id}")
                            println("    Price: ${offer.displayPrice}")
                            println("    Type: ${offer.type}")
                            println("    Payment Mode: ${offer.paymentMode}")
                            offer.basePlanIdAndroid?.let { println("    Base Plan: $it") }
                            offer.offerTokenAndroid?.let { println("    Token: ${it.take(30)}...") }
                        }
                    }
                    is ProductSubscriptionIOS -> {
                        println("--- iOS Specific ---")
                        println("Subscription Info: ${subscription.subscriptionInfoIOS}")
                        subscription.subscriptionOffers?.let { offers ->
                            println("Subscription Offers: ${offers.size} offers")
                            offers.forEach { offer ->
                                println("  - Offer: ${offer.id}")
                                println("    Price: ${offer.displayPrice}")
                                println("    Type: ${offer.type}")
                                println("    Payment Mode: ${offer.paymentMode}")
                                offer.period?.let { println("    Period: ${it.value} ${it.unit}") }
                            }
                        }
                    }
                    is ProductAndroid -> {
                        println("--- Android Specific ---")
                        println("One Time Purchase Offer: ${subscription.oneTimePurchaseOfferDetailsAndroid}")
                    }
                    is ProductIOS -> {
                        println("--- iOS Specific ---")
                        println("Subscription Info: ${subscription.subscriptionInfoIOS}")
                    }
                }

                println("Is Subscribed: $isSubscribed")

                // Log renewal info if available
                activeSubscription?.renewalInfoIOS?.let { renewalInfo ->
                    println("\n--- Renewal Info (iOS) ---")
                    println("willAutoRenew: ${renewalInfo.willAutoRenew}")
                    renewalInfo.pendingUpgradeProductId?.let { println("pendingUpgradeProductId: $it") }
                    renewalInfo.autoRenewPreference?.let { println("autoRenewPreference: $it") }
                    renewalInfo.renewalDate?.let {
                        val date = it.toLong().toFormattedDate()
                        println("renewalDate: $date")
                    }
                    renewalInfo.expirationReason?.let { println("expirationReason: $it") }
                    renewalInfo.gracePeriodExpirationDate?.let {
                        val date = it.toLong().toFormattedDate()
                        println("gracePeriodExpirationDate: $date")
                    }
                    renewalInfo.isInBillingRetry?.let { println("isInBillingRetry: $it") }
                    renewalInfo.priceIncreaseStatus?.let { println("priceIncreaseStatus: $it") }
                    renewalInfo.renewalOfferId?.let { println("renewalOfferId: $it") }
                    renewalInfo.renewalOfferType?.let { println("renewalOfferType: $it") }
                    println("------------------------")
                }
                println("====================================\n")
            },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = subscription.title,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp,
                        color = AppColors.OnSurface
                    )
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = subscription.description,
                        fontSize = 14.sp,
                        color = AppColors.Secondary
                    )
                    
                    // Show subscription period if available (would need to be extracted from platform-specific data)
                    // For now, just show that it's a subscription
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Type: Subscription",
                        fontSize = 12.sp,
                        color = AppColors.Primary,
                        fontWeight = FontWeight.Medium
                    )
                    
                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "ID: ${subscription.id}",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = AppColors.Secondary
                    )
                }

                Column(
                    horizontalAlignment = Alignment.End
                ) {
                    Text(
                        text = subscription.displayPrice,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = AppColors.Primary
                    )
                }
            }

            // Display subscription offers if available
            val subscriptionOffers: List<SubscriptionOffer>? = when (subscription) {
                is ProductSubscriptionAndroid -> subscription.subscriptionOffers.takeIf { it.isNotEmpty() }
                is ProductSubscriptionIOS -> subscription.subscriptionOffers
                else -> null
            }

            subscriptionOffers?.let { offers ->
                Spacer(modifier = Modifier.height(12.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.Background
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = "Available Offers (${offers.size})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.Primary
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        offers.forEachIndexed { index, offer ->
                            if (index > 0) {
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = 6.dp),
                                    color = AppColors.Border.copy(alpha = 0.3f)
                                )
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    // Offer type badge
                                    val offerTypeLabel = when {
                                        offer.paymentMode?.rawValue?.contains("free", ignoreCase = true) == true -> "🎁 Free Trial"
                                        offer.type.rawValue.contains("intro", ignoreCase = true) -> "⭐ Introductory"
                                        offer.type.rawValue.contains("promo", ignoreCase = true) -> "🔥 Promotional"
                                        else -> "💰 ${offer.type.rawValue}"
                                    }

                                    Text(
                                        text = offerTypeLabel,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = when {
                                            offer.paymentMode?.rawValue?.contains("free", ignoreCase = true) == true -> AppColors.Success
                                            offer.type.rawValue.contains("intro", ignoreCase = true) -> AppColors.Orange
                                            else -> AppColors.Primary
                                        }
                                    )

                                    // Offer ID
                                    Text(
                                        text = offer.id.ifEmpty { "Default" },
                                        fontSize = 10.sp,
                                        color = AppColors.Secondary
                                    )

                                    // Period info if available
                                    offer.period?.let { period ->
                                        Text(
                                            text = "${period.value} ${period.unit.rawValue}(s)",
                                            fontSize = 10.sp,
                                            color = AppColors.Secondary
                                        )
                                    }
                                }

                                Text(
                                    text = offer.displayPrice,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.OnSurface
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            
            // Show subscribed status badge if active
            if (isSubscribed) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.Success.copy(alpha = 0.1f)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "✓ Subscribed",
                            color = AppColors.Success,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            } else {
                Button(
                    onClick = onSubscribe,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.Primary
                    )
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                    } else {
                        Text("Subscribe")
                    }
                }
            }
        }
    }
}
