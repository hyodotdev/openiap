package dev.hyo.martie.screens

import android.app.Activity
import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.IapConstants
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.openiap.IapContext
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.store.PurchaseResultStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import dev.hyo.openiap.utils.toPurchaseInput
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import dev.hyo.martie.util.findActivity
import dev.hyo.martie.BuildConfig

enum class VerificationMethod(val displayName: String) {
    None("❌ None (Skip)"),
    Local("📱 Local (Device)"),
    IAPKit("☁️ IAPKit (Server)")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseFlowScreen(
    navController: NavController,
    storeParam: OpenIapStore? = null
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val uiScope = rememberCoroutineScope()
    val appContext = remember(context) { context.applicationContext }
    val iapStore = storeParam ?: remember(appContext) {
        OpenIapStore(appContext)
    }
    val products by iapStore.products.collectAsState()
    val purchases by iapStore.availablePurchases.collectAsState()
    val androidProducts = remember(products) { products.filterIsInstance<ProductAndroid>() }
    val androidPurchases = remember(purchases) { purchases.filterIsInstance<PurchaseAndroid>() }
    val status by iapStore.status.collectAsState()
    val lastPurchase by iapStore.currentPurchase.collectAsState(initial = null)
    val lastPurchaseAndroid: PurchaseAndroid? = remember(lastPurchase) {
        when (val purchase = lastPurchase) {
            is PurchaseAndroid -> purchase
            else -> null
        }
    }
    val connectionStatus by iapStore.connectionStatus.collectAsState()
    val clipboard = LocalClipboardManager.current
    val statusMessage = status.lastPurchaseResult
    // Modal states
    var selectedProduct by remember { mutableStateOf<ProductAndroid?>(null) }
    var selectedPurchase by remember { mutableStateOf<PurchaseAndroid?>(null) }
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

    // Initialize and connect on first composition (spec-aligned names)
    LaunchedEffect(Unit) {
        // Enable OpenIapLog for debugging
        dev.hyo.openiap.OpenIapLog.isEnabled = true

        try {
            val connected = iapStore.initConnection()
            if (connected) {
                iapStore.setActivity(activity)
                val request = ProductRequest(
                    skus = IapConstants.INAPP_SKUS,
                    type = ProductQueryType.InApp
                )
                iapStore.fetchProducts(request)
                iapStore.getAvailablePurchases(null)
            } else {
                iapStore.postStatusMessage(
                    message = "Failed to connect to billing service",
                    status = PurchaseResultStatus.Error
                )
            }
        } catch (e: Exception) {
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
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Purchase Flow") },
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
                                        skus = IapConstants.INAPP_SKUS,
                                        type = ProductQueryType.InApp
                                    )
                                    iapStore.fetchProducts(request)
                                } catch (_: Exception) { }
                            }
                        },
                        enabled = !isInitializing && !status.isLoading
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
                                Icons.Default.ShoppingCart,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = AppColors.primary
                            )
                            
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "Purchase Flow",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                
                                Text(
                                    "Test product purchases",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary
                                )
                            }
                        }
                        
                        Text(
                            "Purchase consumable and non-consumable products. Events are handled through OpenIapStore callbacks.",
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

            // Loading State
            if (isInitializing || status.isLoading) {
                item {
                    LoadingCard()
                }
            }
            
            statusMessage?.let { result ->
                item("status-message") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PurchaseResultCard(
                            message = result.message,
                            status = result.status,
                            onDismiss = { iapStore.clearStatusMessage() },
                            code = result.code
                        )
                        if (result.status == PurchaseResultStatus.Success) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.End
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        lastPurchaseAndroid?.let { p ->
                                            val json = p.toJson().toString()
                                            clipboard.setText(AnnotatedString(json))
                                        }
                                    },
                                    enabled = lastPurchaseAndroid != null
                                ) { Text("Copy Result") }
                                Spacer(modifier = Modifier.width(8.dp))
                                OutlinedButton(
                                    onClick = { lastPurchaseAndroid?.let { selectedPurchase = it } },
                                    enabled = lastPurchaseAndroid != null
                                ) { Text("Details") }
                            }
                        }
                    }
                }
            }

            // Products Section
            if (androidProducts.isNotEmpty()) {
                item {
                    SectionHeaderView(title = "Available Products")
                }

                items(androidProducts) { androidProduct ->
                    ProductCard(
                        product = androidProduct,
                        isPurchasing = status.isPurchasing(androidProduct.id),
                        onPurchase = {
                            scope.launch {
                                iapStore.setActivity(activity)
                                if (androidProduct.type == ProductType.Subs) {
                                    val props = RequestPurchaseProps(
                                        request = RequestPurchaseProps.Request.Subscription(
                                            RequestSubscriptionPropsByPlatforms(
                                                android = RequestSubscriptionAndroidProps(
                                                    skus = listOf(androidProduct.id)
                                                )
                                            )
                                        ),
                                        type = ProductQueryType.Subs
                                    )
                                    iapStore.requestPurchase(props)
                                } else {
                                    val props = RequestPurchaseProps(
                                        request = RequestPurchaseProps.Request.Purchase(
                                            RequestPurchasePropsByPlatforms(
                                                android = RequestPurchaseAndroidProps(
                                                    skus = listOf(androidProduct.id)
                                                )
                                            )
                                        ),
                                        type = ProductQueryType.InApp
                                    )
                                    iapStore.requestPurchase(props)
                                }
                            }
                        },
                        onClick = {
                            selectedProduct = androidProduct
                        },
                        onDetails = {
                            selectedProduct = androidProduct
                        }
                    )
                }
            } else if (!isInitializing && !status.isLoading) {
                item {
                    EmptyStateCard(
                        message = "No products available",
                        icon = Icons.Default.ShoppingBag
                    )
                }
            }

            // Instructions Card
            item {
                InstructionCard()
            }
            
            // Actions
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
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

                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    val request = ProductRequest(
                                        skus = IapConstants.INAPP_SKUS,
                                        type = ProductQueryType.InApp
                                    )
                                    iapStore.fetchProducts(request)
                                } catch (_: Exception) { }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isInitializing && !status.isLoading
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Refresh")
                    }
                }
            }
        }
    }
    
    // Verification helper functions
    suspend fun verifyWithIapkit(purchase: PurchaseAndroid, apiKey: String): Boolean {
        val token = purchase.purchaseToken
            ?: throw IllegalStateException("Purchase token is required for IAPKit verification")

        println("PurchaseFlow: IAPKit verification params:")
        println("  - purchaseToken: ${token.take(6)}… (redacted)")

        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = token
            )
        )
        val result = verifyPurchaseWithIapkit(props, "PurchaseFlowScreen")
        return result.isValid
    }

    // Local verification: For Android, we just check if the purchase state is authentic
    // Real local verification should use Google Play Billing's acknowledgment
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
            println("PurchaseFlow: Skipping already processed purchase: $purchaseKey")
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
                    println("PurchaseFlow: Starting IAPKit verification for ${purchase.productId}")
                    try {
                        val result = verifyWithIapkit(purchase, apiKey)
                        println("PurchaseFlow: IAPKit verification result: $result")
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
                        println("PurchaseFlow: IAPKit verification error: ${e.message}")
                        e.printStackTrace()
                        verificationResultMessage = "❌ IAPKit verification error: ${e.message}"
                        iapStore.postStatusMessage(
                            message = "Verification error: ${e.message}. Finishing transaction anyway for testing.",
                            status = PurchaseResultStatus.Error,
                            productId = purchase.productId
                        )
                        // For testing: return true to continue with finishTransaction
                        println("PurchaseFlow: [TEST MODE] Continuing with finishTransaction despite verification error")
                        true
                    } finally {
                        isVerifying = false
                    }
                }
            }

            if (!isValid) {
                println("PurchaseFlow: Verification failed – not finishing transaction")
                // Mark as processed so the same purchase isn't re-processed
                processedPurchaseKey = purchaseKey
                return@LaunchedEffect
            }

            // 2) Determine consumable vs non-consumable
            val product = products.find { it.id == purchase.productId }
            val isConsumable = product?.let {
                it.type == ProductType.InApp &&
                        (it.id.contains("consumable", true) || it.id.contains("bulb", true))
            } == true

            // 3) Ensure connection (retry briefly if needed)
            if (!connectionStatus) {
                runCatching { iapStore.initConnection() }
                val started = System.currentTimeMillis()
                while (!iapStore.isConnected.first() && System.currentTimeMillis() - started < 1500) {
                    delay(100)
                }
            }

            // 4) Finish transaction
            val purchaseInput = purchase.toPurchaseInput()
            try {
                iapStore.finishTransaction(purchaseInput, isConsumable)
                iapStore.getAvailablePurchases(null)  // Reload purchases after finishing
                iapStore.postStatusMessage(
                    message = "Purchase finished successfully",
                    status = PurchaseResultStatus.Success,
                    productId = purchase.productId
                )
                selectedProduct = null
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
                    if (product.type == ProductType.Subs) {
                        val props = RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(
                                    android = RequestSubscriptionAndroidProps(
                                        skus = listOf(product.id)
                                    )
                                )
                            ),
                            type = ProductQueryType.Subs
                        )
                        iapStore.requestPurchase(props)
                    } else {
                        val props = RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(
                                    android = RequestPurchaseAndroidProps(
                                        skus = listOf(product.id)
                                    )
                                )
                            ),
                            type = ProductQueryType.InApp
                        )
                        iapStore.requestPurchase(props)
                    }
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
