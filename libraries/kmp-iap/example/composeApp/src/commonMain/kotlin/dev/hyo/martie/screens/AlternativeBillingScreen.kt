package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.*
import io.github.hyochan.kmpiap.requestPurchase
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private val PRODUCT_IDS = listOf("dev.hyo.martie.10bulbs", "dev.hyo.martie.30bulbs")

/**
 * Alternative Billing Example
 *
 * Demonstrates alternative billing flows for iOS and Android:
 *
 * iOS (Alternative Billing):
 * - Redirects users to external website
 * - No onPurchaseUpdated callback when using external URL
 * - User completes purchase on external website
 * - Must implement deep link to return to app
 *
 * Android (Alternative Billing Only):
 * - Step 1: Check availability with checkAlternativeBillingAvailabilityAndroid()
 * - Step 2: Show information dialog with showAlternativeBillingDialogAndroid()
 * - Step 3: Process payment in your payment system
 * - Step 4: Create token with createAlternativeBillingTokenAndroid()
 * - Must report token to Google Play backend within 24 hours
 * - No onPurchaseUpdated callback
 *
 * Android (User Choice Billing):
 * - Call requestPurchase() normally
 * - Google shows selection dialog automatically
 * - If user selects Google Play: onPurchaseUpdated callback
 * - If user selects alternative: No callback (manual flow required)
 *
 * Android (External Payments - Billing Library 8.3.0+):
 * - Japan only - side-by-side choice billing
 * - Enable with InitConnectionConfig.enableBillingProgramAndroid
 * - Use developerBillingOption in requestPurchase
 * - Listen via developerProvidedBillingListener for external token
 * - Report externalTransactionToken to Google within 24 hours
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlternativeBillingScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var externalUrl by remember { mutableStateOf("https://openiap.dev") }
    var selectedProduct by remember { mutableStateOf<ProductCommon?>(null) }
    var billingProgram by remember { mutableStateOf(BillingProgramAndroid.ExternalOffer) }
    var showModeSelector by remember { mutableStateOf(false) }
    var purchaseResult by remember { mutableStateOf("") }
    var lastPurchase by remember { mutableStateOf<Purchase?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isReconnecting by remember { mutableStateOf(false) }
    var connected by remember { mutableStateOf(false) }
    var products by remember { mutableStateOf<List<ProductCommon>>(emptyList()) }
    var currentPlatform by remember { mutableStateOf("") }

    // Detect platform and initialize connection
    LaunchedEffect(Unit) {
        currentPlatform = getPlatformName()

        try {
            val config = if (currentPlatform == "Android") {
                InitConnectionConfig(enableBillingProgramAndroid = billingProgram)
            } else null

            connected = kmpIapInstance.initConnection(config)

            if (connected) {
                // Fetch products
                val result = kmpIapInstance.fetchProducts(
                    ProductRequest(
                        skus = PRODUCT_IDS,
                        type = ProductQueryType.InApp
                    )
                )
                products = when (result) {
                    is FetchProductsResultProducts -> result.value
                    is FetchProductsResultSubscriptions -> result.value
                    is FetchProductsResultAll -> result.value?.mapNotNull { productOrSubscription ->
                        when (productOrSubscription) {
                            is ProductOrSubscription.ProductItem -> productOrSubscription.value
                            is ProductOrSubscription.ProductSubscriptionItem -> productOrSubscription.value
                        }
                    }
                } ?: emptyList()
            }
        } catch (e: Exception) {
            purchaseResult = "❌ Connection failed: ${e.message}"
        }
    }

    // Listen for purchase updates
    LaunchedEffect(Unit) {
        launch {
            kmpIapInstance.purchaseUpdatedListener.collect { purchase ->
                lastPurchase = purchase
                isProcessing = false

                val dateText = purchase.transactionDate?.let {
                    Instant.fromEpochSeconds(it.toLong())
                        .toLocalDateTime(TimeZone.currentSystemDefault())
                } ?: "N/A"

                purchaseResult = """
                    ✅ Purchase successful
                    Product: ${purchase.productId}
                    Transaction ID: ${purchase.id}
                    Date: $dateText
                """.trimIndent()

                // Finish transaction
                scope.launch {
                    try {
                        kmpIapInstance.finishTransaction(
                            purchase = purchase,
                            isConsumable = true
                        )
                    } catch (e: Exception) {
                        println("Failed to finish transaction: ${e.message}")
                    }
                }
            }
        }
    }

    // Listen for purchase errors
    LaunchedEffect(Unit) {
        launch {
            kmpIapInstance.purchaseErrorListener.collect { error ->
                isProcessing = false
                purchaseResult = "❌ Purchase failed: ${error.message}"
            }
        }
    }

    // Listen for developer provided billing (External Payments - Android 8.3.0+)
    // Note: On Android, listen to kmpIapInstance.developerProvidedBillingListener
    // to receive DeveloperProvidedBillingDetailsAndroid with externalTransactionToken
    // when user selects developer billing in External Payments mode.
    // This is done via platform-specific code since the listener is Android-only.

    // Reconnect with new billing program
    fun reconnectWithProgram(program: BillingProgramAndroid) {
        scope.launch {
            try {
                isReconnecting = true
                purchaseResult = "Reconnecting with new billing program..."

                // End current connection
                kmpIapInstance.endConnection()

                // Wait for cleanup
                kotlinx.coroutines.delay(500)

                // Reinitialize with new program
                val config = if (currentPlatform == "Android") {
                    InitConnectionConfig(enableBillingProgramAndroid = program)
                } else null

                connected = kmpIapInstance.initConnection(config)

                purchaseResult = "✅ Reconnected with ${
                    when (program) {
                        BillingProgramAndroid.UserChoiceBilling -> "User Choice Billing"
                        BillingProgramAndroid.ExternalOffer -> "External Offer"
                        BillingProgramAndroid.ExternalPayments -> "External Payments (Japan)"
                        BillingProgramAndroid.ExternalContentLink -> "External Content Link"
                        BillingProgramAndroid.Unspecified -> "Unspecified"
                    }
                } mode"

                // Reload products
                if (connected) {
                    val result = kmpIapInstance.fetchProducts(
                        ProductRequest(
                            skus = PRODUCT_IDS,
                            type = ProductQueryType.InApp
                        )
                    )
                    products = when (result) {
                    is FetchProductsResultProducts -> result.value
                    is FetchProductsResultSubscriptions -> result.value
                    is FetchProductsResultAll -> result.value?.mapNotNull { productOrSubscription ->
                        when (productOrSubscription) {
                            is ProductOrSubscription.ProductItem -> productOrSubscription.value
                            is ProductOrSubscription.ProductSubscriptionItem -> productOrSubscription.value
                        }
                    }
                } ?: emptyList()
                }
            } catch (e: Exception) {
                purchaseResult = "❌ Reconnection failed: ${e.message}"
            } finally {
                isReconnecting = false
            }
        }
    }

    // Handle iOS alternative billing purchase
    fun handleIOSAlternativeBillingPurchase(product: ProductCommon) {
        scope.launch {
            if (externalUrl.trim().isEmpty()) {
                purchaseResult = "❌ Please enter a valid external purchase URL"
                return@launch
            }

            isProcessing = true

            try {
                // For iOS 18.2+, present notice sheet first if available
                if (kmpIapInstance.canPresentExternalPurchaseNoticeIOS()) {
                    purchaseResult = "📋 Presenting external purchase notice..."

                    val noticeResult = kmpIapInstance.presentExternalPurchaseNoticeSheetIOS()

                    if (noticeResult.error != null) {
                        purchaseResult = "❌ Notice error: ${noticeResult.error}"
                        isProcessing = false
                        return@launch
                    }

                    if (noticeResult.result == ExternalPurchaseNoticeAction.Dismissed) {
                        purchaseResult = "ℹ️ User dismissed external purchase notice"
                        isProcessing = false
                        return@launch
                    }

                    // User chose to continue
                }

                purchaseResult = "🌐 Opening external purchase link..."

                val result = kmpIapInstance.presentExternalPurchaseLinkIOS(externalUrl)

                purchaseResult = if (result.error?.contains("opened in Safari") == true) {
                    """
                        🌐 External purchase link opened in Safari

                        Product: ${product.id}
                        URL: $externalUrl

                        ⚠️ Important:
                        - User was redirected to external website
                        - Complete purchase on your website
                        - Implement server-side validation
                        - Use deep linking to return user to app
                        - Purchase completion must be verified via backend
                    """.trimIndent()
                } else {
                    "❌ Error: ${result.error}"
                }
            } catch (e: Exception) {
                purchaseResult = "❌ Error: ${e.message}"
            } finally {
                isProcessing = false
            }
        }
    }

    // Handle Android External Offer / Alternative Billing (3-step flow)
    fun handleAndroidExternalOffer(product: ProductCommon) {
        scope.launch {
            isProcessing = true
            purchaseResult = "Checking alternative billing availability..."

            try {
                // Step 1: Check availability
                val isAvailable = kmpIapInstance.checkAlternativeBillingAvailabilityAndroid()

                if (!isAvailable) {
                    purchaseResult = "❌ Alternative billing not available"
                    isProcessing = false
                    return@launch
                }

                purchaseResult = "Showing information dialog..."

                // Step 2: Show information dialog
                val userAccepted = kmpIapInstance.showAlternativeBillingDialogAndroid()

                if (!userAccepted) {
                    purchaseResult = "ℹ️ User cancelled"
                    isProcessing = false
                    return@launch
                }

                purchaseResult = "Creating token..."

                // Step 2.5: In production, process payment here with your payment system

                // Step 3: Create token (after successful payment)
                val token = kmpIapInstance.createAlternativeBillingTokenAndroid()

                if (token != null) {
                    purchaseResult = """
                        ✅ External Offer billing completed (DEMO)

                        Product: ${product.id}
                        Token: ${token.take(20)}...

                        ⚠️ Important:
                        1. Process payment with your payment system
                        2. Report token to Google Play backend within 24 hours
                        3. No onPurchaseUpdated callback
                    """.trimIndent()
                } else {
                    purchaseResult = "❌ Failed to create reporting token"
                }
            } catch (e: Exception) {
                purchaseResult = "❌ Error: ${e.message}"
            } finally {
                isProcessing = false
            }
        }
    }

    // Handle Android User Choice Billing (7.0+)
    fun handleAndroidUserChoiceBilling(product: ProductCommon) {
        scope.launch {
            isProcessing = true
            purchaseResult = "Showing user choice dialog..."

            try {
                kmpIapInstance.requestPurchase {
                    type = ProductType.InApp
                    android {
                        skus = listOf(product.id)
                    }
                }

                purchaseResult = """
                    🔄 User choice dialog shown

                    Product: ${product.id}

                    If user selects:
                    - Google Play: onPurchaseUpdated callback
                    - Alternative: userChoiceBillingListener callback

                    ⚠️ Billing Library 7.0+ required
                """.trimIndent()
            } catch (e: Exception) {
                purchaseResult = "❌ Error: ${e.message}"
                isProcessing = false
            }
        }
    }

    // Handle Android External Payments (Billing Library 8.3.0+ - Japan only)
    fun handleAndroidExternalPayments(product: ProductCommon) {
        scope.launch {
            isProcessing = true
            purchaseResult = "Showing side-by-side choice dialog..."

            try {
                kmpIapInstance.requestPurchase {
                    type = ProductType.InApp
                    android {
                        skus = listOf(product.id)
                        developerBillingOption = DeveloperBillingOptionParamsAndroid(
                            billingProgram = BillingProgramAndroid.ExternalPayments,
                            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                            linkUri = externalUrl
                        )
                    }
                }

                purchaseResult = """
                    🔄 External Payments dialog shown

                    Product: ${product.id}
                    External URL: $externalUrl

                    If user selects:
                    - Google Play: onPurchaseUpdated callback
                    - Developer billing: developerProvidedBillingListener callback

                    ⚠️ Japan users only
                    ⚠️ Billing Library 8.3.0+ required
                """.trimIndent()
            } catch (e: Exception) {
                purchaseResult = "❌ Error: ${e.message}"
                isProcessing = false
            }
        }
    }

    // Handle Android External Content Link (8.2.0+)
    fun handleAndroidExternalContentLink(product: ProductCommon) {
        scope.launch {
            isProcessing = true
            purchaseResult = "Launching external content link..."

            try {
                kmpIapInstance.launchExternalLinkAndroid(
                    LaunchExternalLinkParamsAndroid(
                        billingProgram = BillingProgramAndroid.ExternalContentLink,
                        launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                        linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
                        linkUri = externalUrl
                    )
                )

                purchaseResult = """
                    🔄 External Content Link launched

                    Product: ${product.id}
                    External URL: $externalUrl

                    ⚠️ Billing Library 8.2.0+ required
                    ⚠️ No purchase callback - handle via deep link
                """.trimIndent()
            } catch (e: Exception) {
                purchaseResult = "❌ Error: ${e.message}"
                isProcessing = false
            }
        }
    }

    // Handle purchase based on platform and billing program
    fun handlePurchase(product: ProductCommon) {
        if (currentPlatform == "iOS") {
            handleIOSAlternativeBillingPurchase(product)
        } else if (currentPlatform == "Android") {
            when (billingProgram) {
                BillingProgramAndroid.UserChoiceBilling -> handleAndroidUserChoiceBilling(product)
                BillingProgramAndroid.ExternalOffer -> handleAndroidExternalOffer(product)
                BillingProgramAndroid.ExternalPayments -> handleAndroidExternalPayments(product)
                BillingProgramAndroid.ExternalContentLink -> handleAndroidExternalContentLink(product)
                BillingProgramAndroid.Unspecified -> {
                    purchaseResult = "❌ Please select a billing program"
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Alternative Billing") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFFF9800),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        if (!connected) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Connecting to Store...")
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFF5F5F5))
                    .padding(paddingValues)
                    .verticalScroll(scrollState)
                    .swipeToBack(navController)
                    .padding(16.dp)
            ) {
                // Platform info
                Text(
                    text = if (currentPlatform == "iOS")
                        "External purchase links (iOS 16.0+)"
                    else
                        "Google Play alternative billing",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.background(
                        Color(0xFFFF9800),
                        RoundedCornerShape(8.dp)
                    ).padding(8.dp).fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Info Card
                InfoCard(currentPlatform, billingProgram)

                Spacer(modifier = Modifier.height(16.dp))

                // Mode Selector (Android only)
                if (currentPlatform == "Android") {
                    ModeSelectorCard(
                        billingProgram = billingProgram,
                        onModeClick = { showModeSelector = true }
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // External URL Input (iOS and Android External Payments/Content Link)
                val needsExternalUrl = currentPlatform == "iOS" ||
                    (currentPlatform == "Android" && billingProgram in listOf(
                        BillingProgramAndroid.ExternalPayments,
                        BillingProgramAndroid.ExternalContentLink
                    ))
                if (needsExternalUrl) {
                    ExternalUrlCard(
                        url = externalUrl,
                        onUrlChange = { externalUrl = it }
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Reconnecting Status
                if (isReconnecting) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFFFF3CD)
                        )
                    ) {
                        Text(
                            text = "🔄 Reconnecting with new billing mode...",
                            modifier = Modifier.padding(16.dp),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Connection Status
                ConnectionStatusCard(connected, currentPlatform, billingProgram)

                Spacer(modifier = Modifier.height(16.dp))

                // Products
                Text(
                    text = "Select Product",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(8.dp))

                if (products.isEmpty()) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier.padding(20.dp).fillMaxWidth(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Loading products...")
                        }
                    }
                } else {
                    products.forEach { product ->
                        ProductCard(
                            product = product,
                            isSelected = selectedProduct?.id == product.id,
                            onClick = { selectedProduct = product }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Product Details & Action
                selectedProduct?.let { product ->
                    ProductDetailsCard(product)
                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = { handlePurchase(product) },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        enabled = !isProcessing && connected,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFFF9800)
                        )
                    ) {
                        Text(
                            text = when {
                                isProcessing -> "Processing..."
                                currentPlatform == "iOS" -> "🛒 Buy (External URL)"
                                billingProgram == BillingProgramAndroid.UserChoiceBilling -> "🛒 Buy (User Choice)"
                                billingProgram == BillingProgramAndroid.ExternalOffer -> "🛒 Buy (External Offer)"
                                billingProgram == BillingProgramAndroid.ExternalPayments -> "🛒 Buy (External Payments)"
                                billingProgram == BillingProgramAndroid.ExternalContentLink -> "🛒 Buy (External Link)"
                                else -> "🛒 Buy"
                            },
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Purchase Result
                if (purchaseResult.isNotEmpty()) {
                    PurchaseResultCard(
                        result = purchaseResult,
                        onDismiss = {
                            purchaseResult = ""
                            lastPurchase = null
                        }
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Last Purchase
                lastPurchase?.let { purchase ->
                    LastPurchaseCard(purchase)
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Instructions
                InstructionsCard()
            }
        }
    }

    // Mode Selector Modal (Android)
    if (showModeSelector) {
        AlertDialog(
            onDismissRequest = { showModeSelector = false },
            title = { Text("Select Billing Program") },
            text = {
                Column {
                    ModeSelectorOption(
                        title = "User Choice Billing (7.0+)",
                        description = "Users choose between Google Play and your payment system via dialog.",
                        isSelected = billingProgram == BillingProgramAndroid.UserChoiceBilling,
                        onClick = {
                            billingProgram = BillingProgramAndroid.UserChoiceBilling
                            showModeSelector = false
                            reconnectWithProgram(BillingProgramAndroid.UserChoiceBilling)
                        }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ModeSelectorOption(
                        title = "External Offer (8.2.0+)",
                        description = "Only your payment system available. 3-step manual flow required.",
                        isSelected = billingProgram == BillingProgramAndroid.ExternalOffer,
                        onClick = {
                            billingProgram = BillingProgramAndroid.ExternalOffer
                            showModeSelector = false
                            reconnectWithProgram(BillingProgramAndroid.ExternalOffer)
                        }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ModeSelectorOption(
                        title = "External Payments (8.3.0+, Japan)",
                        description = "Side-by-side choice in purchase dialog. Japan users only.",
                        isSelected = billingProgram == BillingProgramAndroid.ExternalPayments,
                        onClick = {
                            billingProgram = BillingProgramAndroid.ExternalPayments
                            showModeSelector = false
                            reconnectWithProgram(BillingProgramAndroid.ExternalPayments)
                        }
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    ModeSelectorOption(
                        title = "External Content Link (8.2.0+)",
                        description = "Launch external link for digital content offers.",
                        isSelected = billingProgram == BillingProgramAndroid.ExternalContentLink,
                        onClick = {
                            billingProgram = BillingProgramAndroid.ExternalContentLink
                            showModeSelector = false
                            reconnectWithProgram(BillingProgramAndroid.ExternalContentLink)
                        }
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showModeSelector = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun InfoCard(platform: String, billingProgram: BillingProgramAndroid) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFF3E0)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "ℹ️ How It Works",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = Color(0xFFE65100)
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (platform == "iOS") {
                Text(
                    text = """
                        • Enter your external purchase URL
                        • Tap Purchase on any product
                        • User will be redirected to the external URL
                        • Complete purchase on your website
                        • No onPurchaseUpdated callback
                        • Implement deep link to return to app
                    """.trimIndent(),
                    fontSize = 13.sp,
                    color = Color(0xFF5D4037),
                    lineHeight = 20.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = """
                        ⚠️ iOS 16.0+ required
                        ⚠️ Valid external URL needed
                    """.trimIndent(),
                    fontSize = 12.sp,
                    color = Color(0xFFD84315),
                    lineHeight = 18.sp
                )
            } else {
                val infoText = when (billingProgram) {
                    BillingProgramAndroid.UserChoiceBilling -> """
                        • User Choice Billing (7.0+)
                        • Users choose between:
                          - Google Play (30% fee)
                          - Your payment system (lower fee)
                        • Google shows selection dialog
                        • If Google Play: onPurchaseUpdated
                        • If alternative: userChoiceBillingListener
                    """.trimIndent()
                    BillingProgramAndroid.ExternalOffer -> """
                        • External Offer Mode (8.2.0+)
                        • Users CANNOT use Google Play billing
                        • Only your payment system available
                        • 3-step manual flow required
                        • No onPurchaseUpdated callback
                        • Must report to Google within 24h
                    """.trimIndent()
                    BillingProgramAndroid.ExternalPayments -> """
                        • External Payments Mode (8.3.0+)
                        • Japan users only
                        • Side-by-side choice in purchase dialog
                        • If Google Play: onPurchaseUpdated
                        • If developer: developerProvidedBillingListener
                        • Report externalTransactionToken to Google
                    """.trimIndent()
                    BillingProgramAndroid.ExternalContentLink -> """
                        • External Content Link (8.2.0+)
                        • Launch external URL for digital content
                        • No purchase flow - direct link launch
                        • Handle return via deep link
                        • For content offers and promotions
                    """.trimIndent()
                    BillingProgramAndroid.Unspecified -> """
                        • No billing program selected
                        • Please select a billing program
                    """.trimIndent()
                }

                val warningText = when (billingProgram) {
                    BillingProgramAndroid.UserChoiceBilling -> """
                        ⚠️ Billing Library 7.0+ required
                        ⚠️ Requires approval from Google
                        ⚠️ Must report tokens within 24 hours
                    """.trimIndent()
                    BillingProgramAndroid.ExternalOffer -> """
                        ⚠️ Billing Library 8.2.0+ required
                        ⚠️ Requires approval from Google
                        ⚠️ Must report tokens within 24 hours
                    """.trimIndent()
                    BillingProgramAndroid.ExternalPayments -> """
                        ⚠️ Billing Library 8.3.0+ required
                        ⚠️ Japan users only
                        ⚠️ Report token within 24 hours
                    """.trimIndent()
                    BillingProgramAndroid.ExternalContentLink -> """
                        ⚠️ Billing Library 8.2.0+ required
                        ⚠️ Must provide valid external URL
                    """.trimIndent()
                    BillingProgramAndroid.Unspecified -> """
                        ⚠️ Select a billing program to continue
                    """.trimIndent()
                }

                Text(
                    text = infoText,
                    fontSize = 13.sp,
                    color = Color(0xFF5D4037),
                    lineHeight = 20.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = warningText,
                    fontSize = 12.sp,
                    color = Color(0xFFD84315),
                    lineHeight = 18.sp
                )
            }
        }
    }
}

@Composable
private fun ModeSelectorCard(
    billingProgram: BillingProgramAndroid,
    onModeClick: () -> Unit
) {
    Column {
        Text(
            text = "Billing Program",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onModeClick() }
        ) {
            Row(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = when (billingProgram) {
                        BillingProgramAndroid.UserChoiceBilling -> "User Choice Billing (7.0+)"
                        BillingProgramAndroid.ExternalOffer -> "External Offer (8.2.0+)"
                        BillingProgramAndroid.ExternalPayments -> "External Payments (8.3.0+, Japan)"
                        BillingProgramAndroid.ExternalContentLink -> "External Content Link (8.2.0+)"
                        BillingProgramAndroid.Unspecified -> "Not Selected"
                    },
                    fontSize = 14.sp
                )
                Text("▼", fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
private fun ExternalUrlCard(url: String, onUrlChange: (String) -> Unit) {
    Column {
        Text(
            text = "External Purchase URL",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = url,
            onValueChange = onUrlChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("https://your-payment-site.com/checkout") },
            singleLine = true
        )
        Text(
            text = "This URL will be opened when a user taps Purchase",
            fontSize = 12.sp,
            color = Color.Gray,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun ConnectionStatusCard(
    connected: Boolean,
    platform: String,
    billingProgram: BillingProgramAndroid
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Store Connection:",
                fontSize = 14.sp,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = if (connected) "✅ Connected" else "❌ Disconnected",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (connected) Color(0xFF4CAF50) else Color(0xFFF44336)
            )
            if (platform == "Android") {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Current program: ${billingProgram.rawValue.uppercase().replace("-", "_")}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
        }
    }
}

@Composable
private fun ProductCard(product: ProductCommon, isSelected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(
                width = 2.dp,
                color = if (isSelected) Color(0xFFFF9800) else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFFFF3E0) else Color.White
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = product.title,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = product.displayPrice,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color(0xFFFF9800)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = product.description,
                fontSize = 14.sp,
                color = Color.Gray
            )
            if (isSelected) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = Color(0xFFFF9800),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = "✓ Selected",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductDetailsCard(product: ProductCommon) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Product Details",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            DetailRow("ID:", product.id)
            DetailRow("Title:", product.title)
            DetailRow("Price:", product.displayPrice)
            DetailRow("Type:", product.type.rawValue)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 14.sp, color = Color.Gray)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun PurchaseResultCard(result: String, onDismiss: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE8F5E9)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Purchase Result",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", color = Color(0xFFFF9800), fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = result,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun LastPurchaseCard(purchase: Purchase) {
    Column {
        Text(
            text = "Last Purchase",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Product: ${purchase.productId}", fontSize = 14.sp)
                Text("Transaction: ${purchase.id}", fontSize = 14.sp)
                val dateText = purchase.transactionDate?.let {
                    Instant.fromEpochSeconds(it.toLong())
                        .toLocalDateTime(TimeZone.currentSystemDefault())
                        .toString()
                } ?: "N/A"
                Text("Date: $dateText", fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = """
                        ℹ️ Transaction auto-finished for testing.
                        PRODUCTION: Validate on backend first!
                    """.trimIndent(),
                    fontSize = 12.sp,
                    color = Color(0xFFFF9800),
                    lineHeight = 18.sp
                )
            }
        }
    }
}

@Composable
private fun InstructionsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE3F2FD)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Testing Instructions:",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = Color(0xFF1565C0)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = """
                    1. Select a product from the list
                    2. Tap the purchase button
                    3. Follow the platform-specific flow
                    4. Check the purchase result
                    5. Verify token/URL behavior
                """.trimIndent(),
                fontSize = 12.sp,
                lineHeight = 18.sp
            )
        }
    }
}

@Composable
private fun ModeSelectorOption(
    title: String,
    description: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(
                width = 2.dp,
                color = if (isSelected) Color(0xFFFF9800) else Color.Gray.copy(alpha = 0.3f),
                shape = RoundedCornerShape(8.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFFFF3E0) else Color.White
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                fontSize = 13.sp,
                color = Color.Gray
            )
        }
    }
}

// Platform detection helper
expect fun getPlatformName(): String
