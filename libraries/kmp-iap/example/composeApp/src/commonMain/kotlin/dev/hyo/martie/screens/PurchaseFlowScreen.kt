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
import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.fetchProducts
import io.github.hyochan.kmpiap.requestPurchase
import io.github.hyochan.kmpiap.toPurchaseInput
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseAppleOptions
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseGoogleOptions
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitAppleProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitHorizonProps
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultIOS
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseResultHorizon
import io.github.hyochan.kmpiap.getCurrentPlatform
import kotlinx.coroutines.*
import kotlin.time.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private val PRODUCT_IDS = InAppProductIds

/**
 * Verification method for purchase validation
 */
enum class VerificationMethod(val label: String, val icon: String) {
    None("None (Skip)", "❌"),
    Local("Local (Device)", "📱"),
    IAPKit("IAPKit (Server)", "☁️")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseFlowScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    
    // Use global IAP instance for this example
    // This demonstrates using the pre-created singleton instance
    
    var isConnecting by remember { mutableStateOf(true) }
    var isLoadingProducts by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    var purchaseResult by remember { mutableStateOf<String?>(null) }
    var transactionResult by remember { mutableStateOf<String?>(null) }
    var initError by remember { mutableStateOf<String?>(null) }

    var connected by remember { mutableStateOf(false) }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var currentError by remember { mutableStateOf<PurchaseError?>(null) }
    var currentPurchase by remember { mutableStateOf<Purchase?>(null) }

    // Verification method selection
    var verificationMethod by remember { mutableStateOf(VerificationMethod.None) }
    var showVerificationDialog by remember { mutableStateOf(false) }
    var verificationResult by remember { mutableStateOf<String?>(null) }
    
    // Register purchase event listeners
    LaunchedEffect(Unit) {
        launch {
            kmpIapInstance.purchaseUpdatedListener.collect { purchase ->
                currentPurchase = purchase

                when (purchase.purchaseState) {
                    PurchaseState.Purchased -> {
                        isProcessing = false

                        println(
                            "[KMP-IAP Example] Purchase succeeded: " +
                                "productId=${purchase.productId}, credential=${credentialStatus(purchase.purchaseToken)}"
                        )

                        val dateText = Instant.fromEpochMilliseconds(purchase.transactionDate.toLong())
                            .toLocalDateTime(TimeZone.currentSystemDefault())
                        purchaseResult = """
                    ✅ Purchase successful (${purchase.store})
                    Product: ${purchase.productId}
                    Transaction ID: ${purchase.id.ifEmpty { "N/A" }}
                    Date: $dateText
                    Purchase credential: ${credentialStatus(purchase.purchaseToken)}
                """.trimIndent()

                        scope.launch {
                            // Verify purchase based on selected method
                            if (verificationMethod != VerificationMethod.None) {
                                verificationResult = "🔄 Verifying purchase..."
                                try {
                                    when (verificationMethod) {
                                        VerificationMethod.Local -> {
                                            val isIos = getCurrentPlatform() == IapPlatform.Ios
                                            val result = kmpIapInstance.verifyPurchase(
                                                VerifyPurchaseProps(
                                                    apple = if (isIos) VerifyPurchaseAppleOptions(sku = purchase.productId) else null,
                                                    google = if (!isIos) VerifyPurchaseGoogleOptions(
                                                        sku = purchase.productId,
                                                        accessToken = "your_google_api_access_token", // Obtain from your backend for production use
                                                        packageName = "your.app.package.name", // Your app's package name
                                                        purchaseToken = purchase.purchaseToken ?: "",
                                                        isSub = false
                                                    ) else null
                                                )
                                            )
                                            verificationResult = when (result) {
                                                is VerifyPurchaseResultIOS -> "📱 Local Verification (iOS):\n" +
                                                    "Valid: ${result.isValid}\n" +
                                                    "Purchase credential: ${credentialStatus(purchase.purchaseToken)}"
                                                is VerifyPurchaseResultAndroid -> "📱 Local Verification (Android):\n" +
                                                    "Product: ${result.productId}\n" +
                                                    "Receipt ID: ${credentialStatus(result.receiptId)}"
                                                is VerifyPurchaseResultHorizon -> "📱 Horizon Verification:\n" +
                                                    "Valid: ${result.isValid}\n" +
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
                                                    val result = kmpIapInstance.verifyPurchaseWithProvider(
                                                        VerifyPurchaseWithProviderProps(
                                                            provider = PurchaseVerificationProvider.Iapkit,
                                                            iapkit = RequestVerifyPurchaseWithIapkitProps(
                                                                apiKey = apiKey,
                                                                apple = if (isIos) RequestVerifyPurchaseWithIapkitAppleProps(jws = jwsOrToken) else null,
                                                                google = if (!isIos && purchase.store == IapStore.Google) RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = jwsOrToken) else null,
                                                                horizon = if (purchase.store == IapStore.Horizon) RequestVerifyPurchaseWithIapkitHorizonProps(sku = purchase.productId) else null,
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
                                kmpIapInstance.finishTransaction(
                                    purchase = purchase.toPurchaseInput(),
                                    isConsumable = true
                                )
                                purchaseResult = "$purchaseResult\n\n✅ Transaction finished successfully"
                            } catch (e: Exception) {
                                purchaseResult = "$purchaseResult\n\n❌ Failed to finish transaction: ${e.message}"
                            }
                        }
                    }
                    PurchaseState.Pending -> {
                        isProcessing = true
                        purchaseResult = "⏳ Purchase is pending user confirmation..."
                    }
                    PurchaseState.Unknown -> {
                        isProcessing = false
                        purchaseResult = null
                    }
                }
            }
        }
        
        launch {
            kmpIapInstance.purchaseErrorListener.collect { error ->
                isProcessing = false
                currentError = error
                purchaseResult = when (error.code) {
                    ErrorCode.UserCancelled -> "⚠️ Purchase cancelled by user"
                    else -> "❌ Error: ${error.message}\nCode: ${error.code}"
                }
            }
        }
    }
    // Initialize connection and load products
    LaunchedEffect(Unit) {
        scope.launch {
            // Step 1: Initialize connection
            isConnecting = true
            try {
                val connectionResult = kmpIapInstance.initConnection()
                connected = connectionResult
                
                if (!connectionResult) {
                    initError = "Failed to connect to store"
                    return@launch
                }
                
                // Step 2: Connection successful, load products immediately
                isConnecting = false
                isLoadingProducts = true
                purchaseResult = "Loading products from store..."
                
                // Load products with timeout
                val loadJob = async {
                    try {
                        println("[KMP-IAP Example] Requesting products: ${PRODUCT_IDS.joinToString()}")
                        val result = kmpIapInstance.fetchProducts {
                            skus = PRODUCT_IDS
                            type = ProductQueryType.InApp
                        }
                        println("[KMP-IAP Example] Products loaded: ${result.size} products")
                        result
                    } catch (e: Exception) {
                        println("[KMP-IAP Example] Error loading products: ${e.message}")
                        throw e
                    }
                }
                
                // Wait for products or timeout after 10 seconds
                val productsResult = withTimeoutOrNull(10000) {
                    loadJob.await()
                }
                
                if (productsResult != null) {
                    products = productsResult
                    if (products.isEmpty()) {
                        purchaseResult = """
                            ⚠️ No products found in store!
                            
                            Requested IDs: ${PRODUCT_IDS.joinToString()}
                            
                            Make sure these product IDs exist in Google Play Console
                            and are published/active.
                            
                            For testing, "android.test.purchased" should always work.
                        """.trimIndent()
                    } else {
                        purchaseResult = null // Clear message when products load
                        println("[KMP-IAP Example] Product details: ${products.map { "${it.id}: ${it.price}" }}")
                    }
                } else {
                    purchaseResult = """
                        ⏱️ Product loading timed out
                        
                        The store took too long to respond.
                        Please check your internet connection and try again.
                    """.trimIndent()
                    println("[KMP-IAP Example] Product loading timed out after 10 seconds")
                }
                
            } catch (e: Exception) {
                purchaseResult = """
                    ❌ Failed to initialize: ${e.message}
                    
                    Check logcat for more details.
                """.trimIndent()
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
                title = { Text("In-App Purchase Flow") },
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
            // Init Error
            initError?.let { error ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Error),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = error,
                        modifier = Modifier.padding(16.dp),
                        color = Color.White
                    )
                }
                
                Spacer(modifier = Modifier.height(20.dp))
            }
            
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
                        text = "Purchase Verification",
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
            
            // Products Section
            Text(
                text = "Available Products",
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
            } else if (products.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AppColors.Surface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (connected) "No products available" else "Connect to load products",
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.Secondary
                    )
                }
            } else {
                products.forEach { product ->
                    ProductCard(
                        product = product,
                        onPurchase = {
                            scope.launch {
                                isProcessing = true
                                purchaseResult = null
                                try {
                                    val purchase = kmpIapInstance.requestPurchase {
                                        apple {
                                            sku = product.id
                                            quantity = 1
                                        }
                                        google {
                                            skus = listOf(product.id)
                                        }
                                    }
                                    // Purchase updates will be received through the Flow
                                } catch (e: PurchaseException) {
                                    if (e.error.code != ErrorCode.UserCancelled) {
                                        purchaseResult = "Purchase failed: ${e.message}"
                                    }
                                    isProcessing = false
                                } catch (e: Exception) {
                                    purchaseResult = "Purchase failed: ${e.message}"
                                    isProcessing = false
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
                            text = "Purchase Result",
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
                        text = "Choose how to verify purchases after completion",
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
fun ProductCard(
    product: Product,
    onPurchase: () -> Unit,
    isProcessing: Boolean
) {
    var showDetailsDialog by remember { mutableStateOf(false) }

    // Get Android-specific offer details via smart cast
    val androidOffers = (product as? io.github.hyochan.kmpiap.openiap.ProductAndroid)?.discountOffers

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { showDetailsDialog = true },
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
                        text = product.title,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = AppColors.OnSurface
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = product.description,
                        fontSize = 14.sp,
                        color = AppColors.Secondary
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "ID: ${product.id}",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = AppColors.Secondary
                    )

                    // Show offer count if available (Android only)
                    androidOffers?.let { offers ->
                        if (offers.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "${offers.size} offer(s) available",
                                fontSize = 12.sp,
                                color = AppColors.Primary
                            )
                        }
                    }
                }

                Column(
                    horizontalAlignment = Alignment.End
                ) {
                    Text(
                        text = product.displayPrice,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = AppColors.Primary
                    )

                    // Show discount if available (Android only)
                    androidOffers?.firstOrNull()?.percentageDiscountAndroid?.let { percent ->
                        Text(
                            text = "$percent% OFF",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.Success
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onPurchase,
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
                    Text("Purchase")
                }
            }
        }
    }

    // Product Details Dialog
    if (showDetailsDialog) {
        AlertDialog(
            onDismissRequest = { showDetailsDialog = false },
            title = {
                Text(
                    text = product.title,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState())
                ) {
                    // Basic Info
                    ProductDetailSection("Basic Info") {
                        ProductDetailRow("Product ID", product.id)
                        ProductDetailRow("Price", product.displayPrice)
                        ProductDetailRow("Currency", product.currency)
                        ProductDetailRow("Type", product.type.rawValue)
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // One-Time Purchase Offers (Android only)
                    androidOffers?.let { offers ->
                        if (offers.isNotEmpty()) {
                            ProductDetailSection("One-Time Purchase Offers (${offers.size})") {
                                offers.forEachIndexed { index, offer ->
                                    if (index > 0) {
                                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                                    }

                                    Text(
                                        text = "Offer ${index + 1}${offer.id?.let { " ($it)" } ?: ""}",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 14.sp,
                                        color = AppColors.Primary
                                    )

                                    Spacer(modifier = Modifier.height(4.dp))

                                    ProductDetailRow("Price", offer.displayPrice)
                                    ProductDetailRow("Numeric price", offer.price.toString())
                                    ProductDetailRow("Currency", offer.currency)

                                    offer.id?.let { ProductDetailRow("Offer ID", it) }
                                    offer.fullPriceMicrosAndroid?.let { ProductDetailRow("Full Price (micros)", it) }

                                    offer.offerTagsAndroid?.takeIf { it.isNotEmpty() }?.let {
                                        ProductDetailRow("Tags", it.joinToString(", "))
                                    }

                                    // Discount Info
                                    if (
                                        offer.percentageDiscountAndroid != null ||
                                        offer.formattedDiscountAmountAndroid != null
                                    ) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Discount Info:",
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = AppColors.Success
                                        )
                                        offer.percentageDiscountAndroid?.let {
                                            ProductDetailRow("  Percentage", "$it%")
                                        }
                                        offer.formattedDiscountAmountAndroid?.let {
                                            ProductDetailRow("  Amount", it)
                                        }
                                        offer.discountAmountMicrosAndroid?.let {
                                            ProductDetailRow("  Amount (micros)", it)
                                        }
                                    }

                                    // Limited Quantity
                                    offer.limitedQuantityInfoAndroid?.let { limitInfo ->
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Limited Quantity:",
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = AppColors.Warning
                                        )
                                        ProductDetailRow("  Maximum", limitInfo.maximumQuantity.toString())
                                        ProductDetailRow("  Remaining", limitInfo.remainingQuantity.toString())
                                    }

                                    // Valid Time Window
                                    offer.validTimeWindowAndroid?.let { window ->
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Valid Time Window:",
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = AppColors.Secondary
                                        )
                                        ProductDetailRow("  Start", window.startTimeMillis)
                                        ProductDetailRow("  End", window.endTimeMillis)
                                    }

                                    // Preorder Details
                                    offer.preorderDetailsAndroid?.let { preorder ->
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Preorder Details:",
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = AppColors.Primary
                                        )
                                        ProductDetailRow("  Release Time", preorder.preorderReleaseTimeMillis)
                                        ProductDetailRow("  Presale End", preorder.preorderPresaleEndTimeMillis)
                                    }

                                    // Rental Details
                                    offer.rentalDetailsAndroid?.let { rental ->
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Rental Details:",
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 12.sp,
                                            color = AppColors.Secondary
                                        )
                                        ProductDetailRow("  Period", rental.rentalPeriod)
                                        rental.rentalExpirationPeriod?.let {
                                            ProductDetailRow("  Expiration", it)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Note for iOS
                    if (product is io.github.hyochan.kmpiap.openiap.ProductIOS) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "iOS Product",
                            fontSize = 12.sp,
                            color = AppColors.Secondary
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showDetailsDialog = false }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
internal fun ProductDetailSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Text(
        text = title,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        color = AppColors.OnSurface
    )
    Spacer(modifier = Modifier.height(8.dp))
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.Background),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            content()
        }
    }
}

@Composable
internal fun ProductDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = AppColors.Secondary
        )
        Text(
            text = value,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            color = AppColors.OnSurface
        )
    }
}

private fun credentialStatus(value: String?): String = if (value.isNullOrEmpty()) "missing" else "present"
