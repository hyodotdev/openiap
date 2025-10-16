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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.martie.IapConstants
import dev.hyo.martie.util.findActivity
import dev.hyo.openiap.IapContext
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.ProductSubscription
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.store.PurchaseResultStatus
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllProductsScreen(
    navController: NavController,
    storeParam: OpenIapStore? = null
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val appContext = remember(context) { context.applicationContext }
    val iapStore = storeParam ?: remember(appContext) { OpenIapStore(appContext) }
    val products by iapStore.products.collectAsState()
    val subscriptions by iapStore.subscriptions.collectAsState()
    val status by iapStore.status.collectAsState()
    val connectionStatus by iapStore.connectionStatus.collectAsState()

    // Combine all products from both lists
    val allProducts = remember(products, subscriptions) {
        (products + subscriptions).filterIsInstance<ProductAndroid>()
    }

    val scope = rememberCoroutineScope()

    // Initialize and connect on first composition
    val startupScope = rememberCoroutineScope()
    DisposableEffect(Unit) {
        startupScope.launch {
            try {
                val connected = iapStore.initConnection()
                if (connected) {
                    iapStore.setActivity(activity)
                    // Fetch all products at once using ProductQueryType.All
                    // This fetches both in-app and subscription products in a single call
                    val request = ProductRequest(
                        skus = IapConstants.INAPP_SKUS + IapConstants.SUBS_SKUS,
                        type = ProductQueryType.All
                    )
                    iapStore.fetchProducts(request)
                }
            } catch (_: Exception) { }
        }
        onDispose {
            // End connection when screen leaves
            startupScope.launch {
                runCatching { iapStore.endConnection() }
                runCatching { iapStore.clear() }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("All Products") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.cardBackground,
                    titleContentColor = AppColors.textPrimary
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(AppColors.background)
        ) {
            if (!connectionStatus) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = AppColors.warning.copy(alpha = 0.1f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = AppColors.warning
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                "Not Connected",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = AppColors.textPrimary
                            )
                            Text(
                                "Billing service is not connected. Tap to retry.",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        TextButton(onClick = {
                            scope.launch {
                                try {
                                    val connected = iapStore.initConnection()
                                    if (connected) {
                                        iapStore.setActivity(activity)
                                        // Fetch all products after reconnecting using ProductQueryType.All
                                        val request = ProductRequest(
                                            skus = IapConstants.INAPP_SKUS + IapConstants.SUBS_SKUS,
                                            type = ProductQueryType.All
                                        )
                                        iapStore.fetchProducts(request)
                                    }
                                } catch (_: Exception) { }
                            }
                        }) {
                            Text("Retry", color = AppColors.primary)
                        }
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Display all products in one list
                if (allProducts.isNotEmpty()) {
                    items(allProducts) { product ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(
                                            product.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = AppColors.textPrimary
                                        )
                                        product.description?.let { desc ->
                                            Text(
                                                desc,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = AppColors.textSecondary
                                            )
                                        }
                                    }
                                    // Product type badge
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = when (product.type) {
                                            ProductType.Subs -> AppColors.primary.copy(alpha = 0.1f)
                                            else -> AppColors.success.copy(alpha = 0.1f)
                                        },
                                        modifier = Modifier.padding(start = 8.dp)
                                    ) {
                                        Text(
                                            text = when (product.type) {
                                                ProductType.Subs -> "subs"
                                                else -> "in-app"
                                            },
                                            style = MaterialTheme.typography.labelSmall,
                                            color = when (product.type) {
                                                ProductType.Subs -> AppColors.primary
                                                else -> AppColors.success
                                            },
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        product.price?.toString() ?: "--",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = AppColors.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "SKU: ${product.id}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = AppColors.textSecondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Empty state when no products and not loading
                if (!status.isLoading && allProducts.isEmpty() && connectionStatus) {
                    item {
                        EmptyStateCard(
                            message = "No products available",
                            icon = Icons.Default.ShoppingBag
                        )
                    }
                }

                // Loading indicator
                if (status.isLoading) {
                    item {
                        LoadingCard()
                    }
                }

                // Status message
                status.lastPurchaseResult?.let { message ->
                    item {
                        PurchaseResultCard(
                            message = message.toString(),
                            status = PurchaseResultStatus.Success,
                            onDismiss = { /* TODO */ }
                        )
                    }
                }

                // Error message
                status.lastError?.let { err ->
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = AppColors.danger.copy(alpha = 0.1f))
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = AppColors.danger
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    err.message,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = AppColors.danger
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}