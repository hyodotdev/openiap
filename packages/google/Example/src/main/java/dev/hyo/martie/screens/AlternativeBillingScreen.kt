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
import dev.hyo.martie.util.findActivity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlternativeBillingScreen(navController: NavController) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val appContext = remember(context) { context.applicationContext }

    var selectedMode by remember { mutableStateOf<AlternativeBillingMode>(AlternativeBillingMode.ALTERNATIVE_ONLY) }
    var isModeDropdownExpanded by remember { mutableStateOf(false) }

    // Initialize store - recreate when mode changes
    val iapStore = remember(selectedMode) {
        android.util.Log.d("AlternativeBillingScreen", "Creating new OpenIapStore with mode: $selectedMode")
        dev.hyo.openiap.OpenIapLog.isEnabled = true

        val store = OpenIapStore(appContext, alternativeBillingMode = selectedMode)

        // Add event-based listener for User Choice Billing
        if (selectedMode == AlternativeBillingMode.USER_CHOICE) {
            store.addUserChoiceBillingListener { details ->
                android.util.Log.d("UserChoiceEvent", "=== User Choice Billing Event ===")
                android.util.Log.d("UserChoiceEvent", "External Token: ${details.externalTransactionToken}")
                android.util.Log.d("UserChoiceEvent", "Products: ${details.products}")
                android.util.Log.d("UserChoiceEvent", "==============================")

                // Show result in UI
                store.postStatusMessage(
                    message = "User selected alternative billing\nToken: ${details.externalTransactionToken.take(20)}...\nProducts: ${details.products.joinToString()}",
                    status = dev.hyo.openiap.store.PurchaseResultStatus.Info,
                    productId = details.products.firstOrNull()
                )

                // TODO: Process payment with your payment system
                // Then create token and report to backend
            }
        }

        store
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
    LaunchedEffect(selectedMode) {
        try {
            val config = when (selectedMode) {
                AlternativeBillingMode.USER_CHOICE -> InitConnectionConfig(
                    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.UserChoice
                )
                AlternativeBillingMode.ALTERNATIVE_ONLY -> InitConnectionConfig(
                    alternativeBillingModeAndroid = AlternativeBillingModeAndroid.AlternativeOnly
                )
                else -> null
            }

            val connected = iapStore.initConnection(config)
            if (connected) {
                iapStore.setActivity(activity)
                val request = ProductRequest(
                    skus = IapConstants.INAPP_SKUS,
                    type = ProductQueryType.InApp
                )
                iapStore.fetchProducts(request)
            }
        } catch (_: Exception) { }
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
                            onExpandedChange = { isModeDropdownExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = when (selectedMode) {
                                    AlternativeBillingMode.ALTERNATIVE_ONLY -> "Alternative Billing Only"
                                    AlternativeBillingMode.USER_CHOICE -> "User Choice Billing"
                                    else -> "None"
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
                                    text = { Text("Alternative Billing Only") },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = AlternativeBillingMode.ALTERNATIVE_ONLY
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.ShoppingCart, contentDescription = null)
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("User Choice Billing") },
                                    onClick = {
                                        selectedProduct = null
                                        selectedMode = AlternativeBillingMode.USER_CHOICE
                                        isModeDropdownExpanded = false
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Person, contentDescription = null)
                                    }
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
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = AppColors.warning
                            )
                            Text(
                                if (selectedMode == AlternativeBillingMode.ALTERNATIVE_ONLY)
                                    "Alternative Billing Only"
                                else
                                    "User Choice Billing",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Text(
                            if (selectedMode == AlternativeBillingMode.ALTERNATIVE_ONLY) {
                                "Alternative Billing Only Mode:\n\n" +
                                "• Users CANNOT use Google Play billing\n" +
                                "• Only your payment system is available\n" +
                                "• Requires manual 3-step flow:\n" +
                                "  1. Check availability\n" +
                                "  2. Show info dialog\n" +
                                "  3. Process payment → Create token\n\n" +
                                "• No onPurchaseUpdated callback\n" +
                                "• Must report to Google within 24h"
                            } else {
                                "User Choice Billing Mode:\n\n" +
                                "• Users CAN choose between:\n" +
                                "  - Google Play (30% fee)\n" +
                                "  - Your payment system (lower fee)\n" +
                                "• Google shows selection dialog automatically\n" +
                                "• If user selects Google Play:\n" +
                                "  → onPurchaseUpdated callback\n" +
                                "• If user selects alternative:\n" +
                                "  → UserChoiceBillingListener callback\n" +
                                "  → Process payment → Report to Google"
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
                                    "Connected (${if (selectedMode == AlternativeBillingMode.ALTERNATIVE_ONLY) "Alternative Only" else "User Choice"})"
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
                        if (selectedMode == AlternativeBillingMode.ALTERNATIVE_ONLY) {
                            // Alternative Billing Only Button
                            Button(
                                onClick = {
                                    scope.launch {
                                        try {
                                            iapStore.setActivity(activity)

                                            // Step 1: Check availability
                                            val isAvailable = iapStore.checkAlternativeBillingAvailability()
                                            if (!isAvailable) {
                                                iapStore.postStatusMessage(
                                                    "Alternative billing not available",
                                                    PurchaseResultStatus.Error
                                                )
                                                return@launch
                                            }

                                            // Step 2: Show information dialog
                                            val dialogAccepted = iapStore.showAlternativeBillingInformationDialog(activity!!)
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
                                            // Error handled by store
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
                                Text("Buy (Alternative Billing Only)")
                            }
                        } else {
                            // User Choice Button
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
                                            // Error handled by store
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
                                Text("Buy (User Choice)")
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
