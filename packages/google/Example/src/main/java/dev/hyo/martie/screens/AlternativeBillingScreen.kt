package dev.hyo.martie.screens

import android.app.Activity
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.IapConstants
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.store.PurchaseResultStatus
import kotlinx.coroutines.launch
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.AlternativeBillingModeAndroid
import dev.hyo.openiap.InitConnectionConfig
import dev.hyo.openiap.BillingProgramAndroid
import dev.hyo.openiap.LaunchExternalLinkParamsAndroid
import dev.hyo.openiap.ExternalLinkLaunchModeAndroid
import dev.hyo.openiap.ExternalLinkTypeAndroid
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.DeveloperBillingLaunchModeAndroid
import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.martie.util.findActivity
import kotlinx.coroutines.delay

// Billing mode options including new 8.2.0+ Billing Programs
private enum class BillingModeOption {
    ALTERNATIVE_ONLY,       // Legacy 6.2+ API
    USER_CHOICE,           // Legacy 7.0+ API
    BILLING_PROGRAMS,      // New 8.2.0+ API (recommended)
    EXTERNAL_PAYMENTS      // New 8.3.0+ API (Japan only)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlternativeBillingScreen(navController: NavController) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val appContext = remember(context) { context.applicationContext }

    // Platform detection (runtime detection)
    val isHorizon = remember { dev.hyo.martie.IapConstants.isHorizonOS() }

    var selectedMode by remember { mutableStateOf(BillingModeOption.BILLING_PROGRAMS) }
    var isModeDropdownExpanded by remember { mutableStateOf(false) }
    var selectedBillingProgram by remember { mutableStateOf(BillingProgramAndroid.ExternalOffer) }

    // Initialize store - use default constructor for auto-detection (compatible with both Play and Horizon)
    val iapStore = remember {
        android.util.Log.d("AlternativeBillingScreen", "Creating OpenIapStore with auto-detection")
        dev.hyo.openiap.OpenIapLog.isEnabled = true

        // Use default constructor which auto-detects platform (Play or Horizon)
        // Alternative billing mode will be set via initConnection config
        OpenIapStore(appContext)
    }

    // User Choice Billing listener (remembered to properly add/remove)
    val userChoiceListener = remember {
        dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener { details ->
            android.util.Log.d("UserChoiceEvent", "=== User Choice Billing Event ===")
            android.util.Log.d("UserChoiceEvent", "External Token: ${details.externalTransactionToken}")
            android.util.Log.d("UserChoiceEvent", "Products: ${details.products}")
            android.util.Log.d("UserChoiceEvent", "==============================")

            // Show result in UI
            iapStore.postStatusMessage(
                message = "User selected alternative billing\nToken: ${details.externalTransactionToken.take(20)}...\nProducts: ${details.products.joinToString()}",
                status = dev.hyo.openiap.store.PurchaseResultStatus.Info,
                productId = details.products.firstOrNull()
            )

            // TODO: Process payment with your payment system
            // Then create token and report to backend
        }
    }

    // Developer Provided Billing listener (remembered to properly add/remove)
    val developerBillingListener = remember {
        dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener { details ->
            android.util.Log.d("DeveloperBillingEvent", "=== Developer Provided Billing Event ===")
            android.util.Log.d("DeveloperBillingEvent", "External Token: ${details.externalTransactionToken}")
            android.util.Log.d("DeveloperBillingEvent", "========================================")

            // Show result in UI
            iapStore.postStatusMessage(
                message = "User selected developer billing (External Payments)\n\n" +
                        "Token: ${details.externalTransactionToken.take(30)}...\n\n" +
                        "⚠️ Next steps:\n" +
                        "1. Process payment with your payment gateway\n" +
                        "2. Report token to Google within 24 hours",
                status = dev.hyo.openiap.store.PurchaseResultStatus.Info,
                productId = null
            )

            // TODO: Process payment with your payment system
            // Then report externalTransactionToken to Google within 24 hours
        }
    }

    // Set up User Choice Billing listener when mode changes (Play only)
    LaunchedEffect(selectedMode) {
        if (isHorizon) return@LaunchedEffect // These listeners are not supported on Horizon

        if (selectedMode == BillingModeOption.USER_CHOICE) {
            iapStore.addUserChoiceBillingListener(userChoiceListener)
        } else {
            iapStore.removeUserChoiceBillingListener(userChoiceListener)
        }
    }

    // Set up Developer Provided Billing listener for External Payments (8.3.0+, Play only)
    LaunchedEffect(selectedMode) {
        if (isHorizon) return@LaunchedEffect // External Payments is not supported on Horizon

        if (selectedMode == BillingModeOption.EXTERNAL_PAYMENTS) {
            iapStore.addDeveloperProvidedBillingListener(developerBillingListener)
        } else {
            iapStore.removeDeveloperProvidedBillingListener(developerBillingListener)
        }
    }

    val products by iapStore.products.collectAsState()
    val androidProducts = remember(products) { products.filterIsInstance<ProductAndroid>() }
    val status by iapStore.status.collectAsState()
    val lastPurchase by iapStore.currentPurchase.collectAsState(initial = null)
    val connectionStatus by iapStore.connectionStatus.collectAsState()
    val statusMessage = status.lastPurchaseResult

    var selectedProduct by remember { mutableStateOf<ProductAndroid?>(null) }

    // AUTO-FINISH TRANSACTION FOR TESTING
    // PRODUCTION: Validate purchase on your backend server first!
    LaunchedEffect(lastPurchase) {
        lastPurchase?.let { purchase ->
            try {
                val purchaseAndroid = purchase as? PurchaseAndroid
                if (purchaseAndroid != null) {
                    android.util.Log.d("AlternativeBilling", "Auto-finishing transaction for testing")
                    iapStore.finishTransaction(purchaseAndroid, true)
                }
            } catch (e: Exception) {
                android.util.Log.e("AlternativeBilling", "Auto-finish failed: ${e.message}")
            }
        }
    }

    // Initialize connection when mode changes
    LaunchedEffect(selectedMode, selectedBillingProgram) {
        try {
            android.util.Log.d("AlternativeBillingScreen", "Initializing with mode: $selectedMode")

            // IMPORTANT: End existing connection first before creating new one
            android.util.Log.d("AlternativeBillingScreen", "Ending existing connection...")
            iapStore.endConnection()
            delay(500) // Give it time to fully disconnect

            // Set activity
            iapStore.setActivity(activity)

            // Create config based on selected mode
            val config = when (selectedMode) {
                BillingModeOption.USER_CHOICE -> InitConnectionConfig(
                    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
                )
                BillingModeOption.ALTERNATIVE_ONLY -> InitConnectionConfig(
                    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
                )
                BillingModeOption.BILLING_PROGRAMS -> {
                    // For 8.2.0+ Billing Programs, enable the program before connection
                    android.util.Log.d("AlternativeBillingScreen", "Enabling billing program: $selectedBillingProgram")
                    iapStore.enableBillingProgram(selectedBillingProgram)
                    null // No special config needed, program is enabled separately
                }
                BillingModeOption.EXTERNAL_PAYMENTS -> {
                    // For 8.3.0+ External Payments (Japan only), enable the program before connection
                    android.util.Log.d("AlternativeBillingScreen", "Enabling External Payments program")
                    iapStore.enableBillingProgram(BillingProgramAndroid.ExternalPayments)
                    null // No special config needed, program is enabled separately
                }
            }

            android.util.Log.d("AlternativeBillingScreen", "Reconnecting with config: $config")
            val connected = iapStore.initConnection(config)
            android.util.Log.d("AlternativeBillingScreen", "Connection result: $connected")

            if (connected) {
                android.util.Log.d("AlternativeBillingScreen", "Fetching products...")
                val request = ProductRequest(
                    skus = IapConstants.INAPP_SKUS,
                    type = ProductQueryType.InApp
                )
                iapStore.fetchProducts(request)
            } else {
                android.util.Log.e("AlternativeBillingScreen", "Failed to connect to billing service")
            }
        } catch (e: Exception) {
            android.util.Log.e("AlternativeBillingScreen", "Connection error: ${e.message}", e)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                runCatching { iapStore.endConnection() }
                runCatching { iapStore.clear() }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Alternative Billing") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            // Horizon Info Banner (Alternative Billing is now supported!)
            if (isHorizon) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = AppColors.primary.copy(alpha = 0.1f))
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = AppColors.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "Testing Meta Horizon Alternative Billing",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = AppColors.primary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Alternative Billing APIs are available through Horizon Billing Compatibility Library. Testing if they work correctly.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary
                                )
                            }
                        }
                    }
                }
            }

            // Mode Selection Dropdown
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            "Billing Mode",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )

                        ExposedDropdownMenuBox(
                            expanded = isModeDropdownExpanded,
                            onExpandedChange = {
                                isModeDropdownExpanded = it
                            }
                        ) {
                            OutlinedTextField(
                                value = when (selectedMode) {
                                    BillingModeOption.ALTERNATIVE_ONLY -> "Alternative Billing Only (Legacy)"
                                    BillingModeOption.USER_CHOICE -> "User Choice Billing (Legacy)"
                                    BillingModeOption.BILLING_PROGRAMS -> "Billing Programs (8.2.0+)"
                                    BillingModeOption.EXTERNAL_PAYMENTS -> "External Payments (8.3.0+ Japan)"
                                },
                                onValueChange = {},
                                readOnly = true,
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = isModeDropdownExpanded)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(),
                                colors = OutlinedTextFieldDefaults.colors()
                            )

                            ExposedDropdownMenu(
                                expanded = isModeDropdownExpanded,
                                onDismissRequest = { isModeDropdownExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text("Billing Programs (8.2.0+)")
                                            Text(
                                                "Recommended - New API",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.success
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = BillingModeOption.BILLING_PROGRAMS
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Star, contentDescription = null, tint = AppColors.success)
                                    }
                                )
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text("Alternative Billing Only")
                                            Text(
                                                "Legacy 6.2+ API",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.textSecondary
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = BillingModeOption.ALTERNATIVE_ONLY
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.ShoppingCart, contentDescription = null)
                                    }
                                )
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text("User Choice Billing")
                                            Text(
                                                "Legacy 7.0+ API",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.textSecondary
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = BillingModeOption.USER_CHOICE
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Person, contentDescription = null)
                                    }
                                )
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text("External Payments (8.3.0+)")
                                            Text(
                                                "Japan only - Side-by-side choice",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.primary
                                            )
                                        }
                                    },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = BillingModeOption.EXTERNAL_PAYMENTS
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Language, contentDescription = null, tint = AppColors.primary)
                                    }
                                )
                            }
                        }

                        // Billing Program Type selector (only for BILLING_PROGRAMS mode)
                        if (selectedMode == BillingModeOption.BILLING_PROGRAMS) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                "Program Type",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Medium
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.padding(top = 8.dp)
                            ) {
                                FilterChip(
                                    selected = selectedBillingProgram == BillingProgramAndroid.ExternalOffer,
                                    onClick = { selectedBillingProgram = BillingProgramAndroid.ExternalOffer },
                                    label = { Text("External Offer") }
                                )
                                FilterChip(
                                    selected = selectedBillingProgram == BillingProgramAndroid.ExternalContentLink,
                                    onClick = { selectedBillingProgram = BillingProgramAndroid.ExternalContentLink },
                                    label = { Text("External Content Link") }
                                )
                            }
                        }
                    }
                }
            }

            // Info Card
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.warning.copy(alpha = 0.1f))
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
                                when (selectedMode) {
                                    BillingModeOption.BILLING_PROGRAMS -> Icons.Default.Star
                                    BillingModeOption.EXTERNAL_PAYMENTS -> Icons.Default.Language
                                    else -> Icons.Default.Info
                                },
                                contentDescription = null,
                                tint = when (selectedMode) {
                                    BillingModeOption.BILLING_PROGRAMS -> AppColors.success
                                    BillingModeOption.EXTERNAL_PAYMENTS -> AppColors.primary
                                    else -> AppColors.warning
                                }
                            )
                            Text(
                                when (selectedMode) {
                                    BillingModeOption.BILLING_PROGRAMS -> "Billing Programs (8.2.0+)"
                                    BillingModeOption.ALTERNATIVE_ONLY -> "Alternative Billing Only (Legacy)"
                                    BillingModeOption.USER_CHOICE -> "User Choice Billing (Legacy)"
                                    BillingModeOption.EXTERNAL_PAYMENTS -> "External Payments (8.3.0+ Japan)"
                                },
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Text(
                            when (selectedMode) {
                                BillingModeOption.BILLING_PROGRAMS -> {
                                    "Billing Programs API (8.2.0+):\n\n" +
                                    "✨ NEW: Recommended approach\n\n" +
                                    "• Program Types:\n" +
                                    "  - ExternalOffer: Alternative payment\n" +
                                    "  - ExternalContentLink: Reader/music apps\n\n" +
                                    "• Flow:\n" +
                                    "  1. enableBillingProgram() before init\n" +
                                    "  2. isBillingProgramAvailable() check\n" +
                                    "  3. launchExternalLink() to browser\n" +
                                    "  4. Process payment in your system\n" +
                                    "  5. createBillingProgramReportingDetails()\n\n" +
                                    "• Must report token to Google within 24h"
                                }
                                BillingModeOption.ALTERNATIVE_ONLY -> {
                                    "Alternative Billing Only Mode (Legacy):\n\n" +
                                    "⚠️ Deprecated in 8.2.0+\n\n" +
                                    "• Users CANNOT use Google Play billing\n" +
                                    "• Only your payment system is available\n" +
                                    "• Requires manual 3-step flow:\n" +
                                    "  1. Check availability\n" +
                                    "  2. Show info dialog\n" +
                                    "  3. Process payment → Create token\n\n" +
                                    "• No onPurchaseUpdated callback\n" +
                                    "• Must report to Google within 24h"
                                }
                                BillingModeOption.USER_CHOICE -> {
                                    "User Choice Billing Mode (Legacy):\n\n" +
                                    "• Users CAN choose between:\n" +
                                    "  - Google Play (30% fee)\n" +
                                    "  - Your payment system (lower fee)\n" +
                                    "• Google shows selection dialog automatically\n" +
                                    "• If user selects Google Play:\n" +
                                    "  → onPurchaseUpdated callback\n" +
                                    "• If user selects alternative:\n" +
                                    "  → UserChoiceBillingListener callback\n" +
                                    "  → Process payment → Report to Google"
                                }
                                BillingModeOption.EXTERNAL_PAYMENTS -> {
                                    "External Payments (8.3.0+ Japan Only):\n\n" +
                                    "🇯🇵 NEW: Japan-only program\n\n" +
                                    "• Side-by-side choice in purchase dialog\n" +
                                    "• Different from User Choice Billing:\n" +
                                    "  - Shows during requestPurchase()\n" +
                                    "  - Not a separate dialog\n\n" +
                                    "• Flow:\n" +
                                    "  1. enableBillingProgram(ExternalPayments)\n" +
                                    "  2. addDeveloperProvidedBillingListener()\n" +
                                    "  3. requestPurchase(developerBillingOption)\n" +
                                    "  4. User sees side-by-side choice\n" +
                                    "  5a. Google Play → onPurchaseSuccess\n" +
                                    "  5b. Developer → DeveloperProvidedBillingListener\n" +
                                    "  6. Process payment with your gateway\n" +
                                    "  7. Report token to Google within 24h"
                                }
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = AppColors.textSecondary
                        )
                    }
                }
            }

            // Connection Status
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (connectionStatus) AppColors.success.copy(alpha = 0.1f)
                        else AppColors.danger.copy(alpha = 0.1f)
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            if (connectionStatus) Icons.Default.CheckCircle else Icons.Default.Error,
                            contentDescription = null,
                            tint = if (connectionStatus) AppColors.success else AppColors.danger
                        )
                        Column {
                            Text(
                                "Connection Status",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                if (connectionStatus) {
                                    "Connected (${when (selectedMode) {
                                        BillingModeOption.BILLING_PROGRAMS -> "Billing Programs"
                                        BillingModeOption.ALTERNATIVE_ONLY -> "Alternative Only"
                                        BillingModeOption.USER_CHOICE -> "User Choice"
                                        BillingModeOption.EXTERNAL_PAYMENTS -> "External Payments"
                                    }})"
                                } else "Disconnected",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                    }
                }
            }

            // Purchase Result
            if (statusMessage != null) {
                item {
                    PurchaseResultCard(
                        message = statusMessage.message,
                        status = statusMessage.status,
                        code = statusMessage.code?.toString(),
                        onDismiss = { iapStore.clearStatusMessage() }
                    )
                }
            }

            // Products Section
            item {
                SectionHeaderView(title = "Select Product")
            }

            if (status.isLoading && androidProducts.isEmpty()) {
                item {
                    LoadingCard()
                }
            } else if (androidProducts.isEmpty()) {
                item {
                    EmptyStateCard(
                        icon = Icons.Default.ShoppingCart,
                        message = "No products available"
                    )
                }
            } else {
                items(androidProducts) { product ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .clickable { selectedProduct = product },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (selectedProduct?.id == product.id)
                                AppColors.primary.copy(alpha = 0.1f)
                            else
                                AppColors.cardBackground
                        ),
                        border = if (selectedProduct?.id == product.id)
                            androidx.compose.foundation.BorderStroke(2.dp, AppColors.primary)
                        else null
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
                                    product.title ?: product.id,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    product.description ?: "",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.textSecondary
                                )
                            }
                            Text(
                                product.displayPrice ?: product.price?.toString() ?: "",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.primary
                            )
                        }
                    }
                }
            }

            // Product Details & Action Button (right after product selection)
            if (selectedProduct != null) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Product Details Card
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    "Product Details",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                                DetailRow("ID", selectedProduct!!.id)
                                DetailRow("Title", selectedProduct!!.title ?: "N/A")
                                DetailRow("Description", selectedProduct!!.description ?: "N/A")
                                DetailRow("Price", selectedProduct!!.displayPrice ?: "N/A")
                                DetailRow("Currency", selectedProduct!!.currency ?: "N/A")
                                DetailRow("Type", selectedProduct!!.type.toString())
                            }
                        }

                        // Show button based on selected mode
                        when (selectedMode) {
                            BillingModeOption.BILLING_PROGRAMS -> {
                                // Billing Programs (8.2.0+) Button
                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                iapStore.setActivity(activity)

                                                // Step 1: Check availability
                                                val availabilityResult = iapStore.isBillingProgramAvailable(selectedBillingProgram)
                                                if (!availabilityResult.isAvailable) {
                                                    iapStore.postStatusMessage(
                                                        "Billing program not available: $selectedBillingProgram\n\nPossible causes:\n• Requires Billing Library 8.2.0+\n• Not configured in Play Console\n• Region restrictions",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                // Step 2: Launch external link
                                                val currentActivity = activity
                                                if (currentActivity == null) {
                                                    iapStore.postStatusMessage(
                                                        "Activity not available",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                val launched = iapStore.launchExternalLink(
                                                    currentActivity,
                                                    LaunchExternalLinkParamsAndroid(
                                                        billingProgram = selectedBillingProgram,
                                                        launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                                                        linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
                                                        linkUri = "https://example.com/checkout?product=${selectedProduct!!.id}"
                                                    )
                                                )

                                                if (!launched) {
                                                    iapStore.postStatusMessage(
                                                        "Failed to launch external link",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                // Step 3: Process payment (DEMO - not implemented)
                                                android.util.Log.d("BillingPrograms", "⚠️ Payment processing not implemented - this is a demo")

                                                // Step 4: Create reporting details
                                                val reportingDetails = iapStore.createBillingProgramReportingDetails(selectedBillingProgram)
                                                iapStore.postStatusMessage(
                                                    "✅ Billing Programs flow completed (DEMO)\n\n" +
                                                    "Program: ${reportingDetails.billingProgram}\n" +
                                                    "Token: ${reportingDetails.externalTransactionToken.take(20)}...\n\n" +
                                                    "⚠️ Next steps:\n" +
                                                    "1. Process payment in your system\n" +
                                                    "2. Report token to Google within 24h",
                                                    PurchaseResultStatus.Info,
                                                    selectedProduct!!.id
                                                )
                                            } catch (e: Exception) {
                                                android.util.Log.e("BillingPrograms", "Error: ${e.message}", e)
                                                iapStore.postStatusMessage(
                                                    "Error: ${e.message}",
                                                    PurchaseResultStatus.Error
                                                )
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !status.isLoading && connectionStatus,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AppColors.success
                                    )
                                ) {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text("Buy (Billing Programs 8.2.0+)")
                                }
                            }

                            BillingModeOption.ALTERNATIVE_ONLY -> {
                                // Alternative Billing Only Button (Legacy)
                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                iapStore.setActivity(activity)

                                                // Step 1: Check availability
                                                @Suppress("DEPRECATION")
                                                val isAvailable = iapStore.checkAlternativeBillingAvailability()
                                                if (!isAvailable) {
                                                    iapStore.postStatusMessage(
                                                        "Alternative billing not available",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                // Step 2: Show information dialog
                                                val currentActivity = activity
                                                if (currentActivity == null) {
                                                    iapStore.postStatusMessage(
                                                        "Activity not available",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                @Suppress("DEPRECATION")
                                                val dialogAccepted = iapStore.showAlternativeBillingInformationDialog(currentActivity)
                                                if (!dialogAccepted) {
                                                    iapStore.postStatusMessage(
                                                        "User canceled",
                                                        PurchaseResultStatus.Info
                                                    )
                                                    return@launch
                                                }

                                                // Step 2.5: Process payment (DEMO - not implemented)
                                                android.util.Log.d("AlternativeBilling", "⚠️ Payment processing not implemented")

                                                // Step 3: Create token
                                                @Suppress("DEPRECATION")
                                                val token = iapStore.createAlternativeBillingReportingToken()
                                                if (token != null) {
                                                    iapStore.postStatusMessage(
                                                        "Alternative billing completed (DEMO)\nToken: ${token.take(20)}...\n⚠️ Backend reporting required",
                                                        PurchaseResultStatus.Info,
                                                        selectedProduct!!.id
                                                    )
                                                } else {
                                                    iapStore.postStatusMessage(
                                                        "Failed to create reporting token",
                                                        PurchaseResultStatus.Error
                                                    )
                                                }
                                            } catch (e: Exception) {
                                                android.util.Log.e("AlternativeBilling", "Legacy alternative billing error: ${e.message}", e)
                                                iapStore.postStatusMessage(
                                                    "Alternative billing failed: ${e.message}",
                                                    PurchaseResultStatus.Error
                                                )
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !status.isLoading && connectionStatus,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AppColors.primary
                                    )
                                ) {
                                    Icon(
                                        Icons.Default.ShoppingCart,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text("Buy (Legacy Alternative Billing)")
                                }
                            }

                            BillingModeOption.USER_CHOICE -> {
                                // User Choice Button (Legacy)
                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                iapStore.setActivity(activity)

                                                // User Choice: Just call requestPurchase
                                                // Google will show selection dialog automatically
                                                val props = RequestPurchaseProps(
                                                    request = RequestPurchaseProps.Request.Purchase(
                                                        RequestPurchasePropsByPlatforms(
                                                            android = RequestPurchaseAndroidProps(
                                                                skus = listOf(selectedProduct!!.id)
                                                            )
                                                        )
                                                    ),
                                                    type = ProductQueryType.InApp
                                                )

                                                iapStore.requestPurchase(props)

                                                // If user selects Google Play → onPurchaseUpdated callback
                                                // If user selects alternative → UserChoiceBillingListener callback
                                            } catch (e: Exception) {
                                                android.util.Log.e("AlternativeBilling", "User choice billing error: ${e.message}", e)
                                                iapStore.postStatusMessage(
                                                    "User choice billing failed: ${e.message}",
                                                    PurchaseResultStatus.Error
                                                )
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !status.isLoading && connectionStatus,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AppColors.secondary
                                    )
                                ) {
                                    Icon(
                                        Icons.Default.Person,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text("Buy (Legacy User Choice)")
                                }
                            }

                            BillingModeOption.EXTERNAL_PAYMENTS -> {
                                // External Payments Button (8.3.0+ Japan only)
                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                iapStore.setActivity(activity)

                                                // Step 1: Check if External Payments is available (Japan only)
                                                val availabilityResult = iapStore.isBillingProgramAvailable(
                                                    BillingProgramAndroid.ExternalPayments
                                                )
                                                if (!availabilityResult.isAvailable) {
                                                    iapStore.postStatusMessage(
                                                        "External Payments not available\n\n" +
                                                        "Possible causes:\n" +
                                                        "• Requires Billing Library 8.3.0+\n" +
                                                        "• Only available in Japan\n" +
                                                        "• Not configured in Play Console",
                                                        PurchaseResultStatus.Error
                                                    )
                                                    return@launch
                                                }

                                                // Step 2: Request purchase with developerBillingOption
                                                // User will see side-by-side choice dialog
                                                val props = RequestPurchaseProps(
                                                    request = RequestPurchaseProps.Request.Purchase(
                                                        RequestPurchasePropsByPlatforms(
                                                            google = RequestPurchaseAndroidProps(
                                                                skus = listOf(selectedProduct!!.id),
                                                                developerBillingOption = DeveloperBillingOptionParamsAndroid(
                                                                    billingProgram = BillingProgramAndroid.ExternalPayments,
                                                                    linkUri = "https://example.com/checkout?product=${selectedProduct!!.id}",
                                                                    launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp
                                                                )
                                                            )
                                                        )
                                                    ),
                                                    type = ProductQueryType.InApp
                                                )

                                                android.util.Log.d("ExternalPayments", "Launching purchase with External Payments option")
                                                iapStore.requestPurchase(props)

                                                // If user selects Google Play → onPurchaseSuccess callback
                                                // If user selects Developer billing → DeveloperProvidedBillingListener callback
                                                iapStore.postStatusMessage(
                                                    "Purchase dialog launched with External Payments option\n\n" +
                                                    "• If user selects Google Play → Normal purchase flow\n" +
                                                    "• If user selects Developer billing → DeveloperProvidedBillingListener fires",
                                                    PurchaseResultStatus.Info,
                                                    selectedProduct!!.id
                                                )
                                            } catch (e: Exception) {
                                                android.util.Log.e("ExternalPayments", "External Payments error: ${e.message}", e)
                                                iapStore.postStatusMessage(
                                                    "External Payments failed: ${e.message}",
                                                    PurchaseResultStatus.Error
                                                )
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !status.isLoading && connectionStatus,
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AppColors.primary
                                    )
                                ) {
                                    Icon(
                                        Icons.Default.Language,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text("Buy (External Payments 8.3.0+)")
                                }
                            }
                        }
                    }
                }
            }

            // Last Purchase Info
            if (lastPurchase != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "Last Purchase",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )

                            val purchase = lastPurchase as? PurchaseAndroid
                            if (purchase != null) {
                                Text(
                                    "Product: ${purchase.productId}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    "State: ${purchase.purchaseState}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    "Token: ${purchase.purchaseToken?.take(20)}...",
                                    style = MaterialTheme.typography.bodySmall
                                )

                                Text(
                                    "ℹ️ Transaction auto-finished for testing.\n" +
                                    "PRODUCTION: Validate on backend first!",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppColors.warning,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = AppColors.textSecondary
        )
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}
