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
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestSubscriptionAndroidProps
import dev.hyo.openiap.RequestSubscriptionPropsByPlatforms
import dev.hyo.openiap.utils.toPurchaseInput
import dev.hyo.martie.util.findActivity

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

    // Use a dedicated scope for cleanup that won't be cancelled with composition
    val cleanupScope = remember { CoroutineScope(Dispatchers.Main + SupervisorJob()) }

    DisposableEffect(cleanupScope) {
        onDispose {
            cleanupScope.cancel()
        }
    }

    // Initialize and connect on first composition (spec-aligned names)
    LaunchedEffect(Unit) {
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
    
    // Simple helper: simulate server-side receipt validation
    suspend fun validateReceiptOnServer(purchase: PurchaseAndroid): Boolean {
        // TODO: Replace with your real backend API call
        // e.g., POST purchase.purchaseToken to your server and verify
        return true
    }

    // Auto-handle purchase: validate on server then finish
    // IMPORTANT: Implement real server-side receipt validation in validateReceiptOnServer()
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
