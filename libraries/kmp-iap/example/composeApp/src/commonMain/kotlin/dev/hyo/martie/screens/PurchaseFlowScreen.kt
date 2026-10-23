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
import dev.hyo.martie.theme.AppColors
import dev.hyo.martie.utils.swipeToBack
import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.fetchProducts
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import io.github.hyochan.kmpiap.openiap.RequestPurchaseIosProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.PlayIntegrityParamsAndroid
import io.github.hyochan.kmpiap.openiap.VerifyAppOwnershipProps
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.filter

private val PRODUCT_IDS = InAppProductIds

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseFlowScreen(navController: NavController) {
    val scope = rememberCoroutineScope()

    var isConnecting by remember { mutableStateOf(true) }
    var isLoadingProducts by remember { mutableStateOf(false) }
    var isProcessing by remember { mutableStateOf(false) }
    var purchaseResult by remember { mutableStateOf<String?>(null) }
    var catalogResult by remember { mutableStateOf<String?>(null) }
    var initError by remember { mutableStateOf<String?>(null) }
    var ownershipCloudProjectNumber by remember { mutableStateOf("") }
    var ownershipRequestHash by remember { mutableStateOf("") }
    var ownershipResult by remember { mutableStateOf<String?>(null) }
    var isCheckingOwnership by remember { mutableStateOf(false) }

    var connected by remember { mutableStateOf(false) }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }

    val verificationMethod = ExamplePurchaseFlow.verificationMethod
    var showVerificationDialog by remember { mutableStateOf(false) }

    // The app's flow confirms and finishes every purchase; this screen shows the outcome.
    LaunchedEffect(Unit) {
        launch {
            ExamplePurchaseFlow.flow.outcomes
                .filter { it.purchase.productId in PRODUCT_IDS }
                .collect { outcome ->
                    isProcessing = false
                    purchaseResult = outcome.resultText()
                }
        }

        launch {
            kmpIapInstance.purchaseErrorListener.collect { error ->
                isProcessing = false
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
                catalogResult = "Loading products from store..."
                
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
                        catalogResult = """
                            ⚠️ No products found in store!
                            
                            Requested IDs: ${PRODUCT_IDS.joinToString()}
                            
                            Make sure these product IDs exist in Google Play Console
                            and are published/active.
                            
                            For testing, "android.test.purchased" should always work.
                        """.trimIndent()
                    } else {
                        catalogResult = null
                        println("[KMP-IAP Example] Product details: ${products.map { "${it.id}: ${it.price}" }}")
                    }
                } else {
                    catalogResult = """
                        ⏱️ Product loading timed out
                        
                        The store took too long to respond.
                        Please check your internet connection and try again.
                    """.trimIndent()
                    println("[KMP-IAP Example] Product loading timed out after 10 seconds")
                }
                
            } catch (e: Exception) {
                catalogResult = """
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
            
            catalogResult?.let { Text(it, color = AppColors.Secondary) }

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
                                    kmpIapInstance.requestPurchase(
                                        RequestPurchaseProps(
                                            request = RequestPurchaseProps.Request.Purchase(
                                                RequestPurchasePropsByPlatforms(
                                                    apple = RequestPurchaseIosProps(sku = product.id, quantity = 1),
                                                    google = RequestPurchaseAndroidProps(skus = listOf(product.id)),
                                                )
                                            ),
                                            type = ProductQueryType.InApp,
                                        )
                                    )
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
            
            Spacer(modifier = Modifier.height(20.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("App ownership", fontWeight = FontWeight.Bold, color = AppColors.OnSurface)
                    Text(
                        "Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.",
                        fontSize = 12.sp,
                        color = AppColors.Secondary
                    )
                    OutlinedTextField(
                        value = ownershipCloudProjectNumber,
                        onValueChange = { ownershipCloudProjectNumber = it },
                        enabled = !isCheckingOwnership,
                        label = { Text("Google Cloud project number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = ownershipRequestHash,
                        onValueChange = { ownershipRequestHash = it },
                        enabled = !isCheckingOwnership,
                        label = { Text("Request hash") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        enabled = connected && !isCheckingOwnership,
                        onClick = {
                            val projectNumber = ownershipCloudProjectNumber.trim()
                            val requestHash = ownershipRequestHash.trim()
                            if (projectNumber.isEmpty() != requestHash.isEmpty()) {
                                ownershipResult = "Error: ${ErrorCode.DeveloperError.rawValue}\nEnter both Google Cloud project number and Request hash, or leave both empty."
                            } else {
                                val google = if (projectNumber.isEmpty()) null else PlayIntegrityParamsAndroid(
                                    cloudProjectNumber = projectNumber,
                                    requestHash = requestHash
                                )
                                isCheckingOwnership = true
                                ownershipResult = null
                                scope.launch {
                                    try {
                                        val result = kmpIapInstance.verifyAppOwnership(VerifyAppOwnershipProps(google = google))
                                        ownershipResult = """
                                            Status: ${result.status.rawValue}
                                            Store ID: ${result.storeId}
                                            Reason: ${result.reason?.rawValue ?: "none"}
                                            Signed AppTransaction length: ${result.signedAppTransactionIOS?.length ?: 0}
                                            Integrity token length: ${result.integrityTokenAndroid?.length ?: 0}
                                        """.trimIndent()
                                    } catch (error: CancellationException) {
                                        throw error
                                    } catch (error: PurchaseException) {
                                        ownershipResult = "Error: ${error.error.code.rawValue}\n${error.message}"
                                    } catch (error: Exception) {
                                        ownershipResult = "App ownership failed: ${error.message}"
                                    } finally {
                                        isCheckingOwnership = false
                                    }
                                }
                            }
                        }
                    ) {
                        Text(if (isCheckingOwnership) "Checking..." else "Check app ownership")
                    }
                    ownershipResult?.let {
                        Text(it, fontSize = 12.sp, fontFamily = FontFamily.Monospace, color = AppColors.OnSurface)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

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
                        text = "Choose how to verify purchases before completing the transaction",
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
                                    ExamplePurchaseFlow.select(method)
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
                                            VerificationMethod.None -> "Leave purchases unfinished until a method is chosen"
                                            VerificationMethod.Local -> "Verify on device (iOS only)"
                                            VerificationMethod.IAPKitLocal -> "IAPKit routed to IAPKIT_BASE_URL"
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
