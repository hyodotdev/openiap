package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.martie.util.findActivity
import dev.hyo.openiap.store.OpenIapStore
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfferCodeScreen(
    navController: NavController,
    storeParam: OpenIapStore? = null
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val iapStore = currentOpenIapStore(storeParam)

    var showResult by remember { mutableStateOf(false) }
    var resultMessage by remember { mutableStateOf("") }
    var isRedeeming by remember { mutableStateOf(false) }
    
    // Initialize and connect on first composition (spec-aligned names)
    val startupScope = rememberCoroutineScope()
    LaunchedEffect(iapStore) {
        runCatching { iapStore.initConnection() }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, iapStore) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                startupScope.launch {
                    runCatching { iapStore.getAvailablePurchases(null) }
                        .onSuccess { purchases ->
                            if (purchases.isNotEmpty()) {
                                resultMessage =
                                    "Reconciled ${purchases.size} available purchase(s) after resume. " +
                                        "Verify and grant each entitlement idempotently before finishing it."
                                showResult = true
                            }
                        }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Offer Code") },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(AppColors.background)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header Card
            Card(
                modifier = Modifier.fillMaxWidth(),
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
                            Icons.Default.LocalOffer,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = AppColors.warning
                        )
                        
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                "Redeem Offer Code",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            
                            Text(
                                "Open Google Play to enter a promo code",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                    }
                    
                    Text(
                        "Open the Google Play redemption page to enter a code. Reconcile purchases when you return to the app.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.textSecondary
                    )
                }
            }
            
            // Redemption action
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Button(
                        onClick = {
                            isRedeeming = true
                            startupScope.launch {
                                // openRedeemOfferCode opens the Google Play redeem page
                                // (https://play.google.com/redeem). It does not require the
                                // billing client; the user enters the code on the Play page.
                                val launched = runCatching {
                                    activity?.let { iapStore.openRedeemOfferCode(it) } ?: false
                                }.getOrDefault(false)
                                resultMessage = if (launched) {
                                    "Opened the Google Play redeem page. Enter your code there — " +
                                        "then return so the app can reconcile available purchases."
                                } else {
                                    "Could not open the Google Play redeem page on this device."
                                }
                                showResult = true
                                isRedeeming = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isRedeeming
                    ) {
                        if (isRedeeming) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(Icons.Default.Redeem, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Redeem Code")
                        }
                    }
                }
            }
            
            // Result Message
            if (showResult) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.info.copy(alpha = 0.1f)
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = null,
                            tint = AppColors.info
                        )
                        
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "How to Redeem",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                resultMessage,
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                    }
                }
            }
            
            // Instructions
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground)
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
                            Icons.AutoMirrored.Filled.HelpOutline,
                            contentDescription = null,
                            tint = AppColors.primary
                        )
                        Text(
                            "About Promo Codes",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    
                    Text(
                        "• Promo codes are provided by developers or Google\n" +
                        "• Codes can offer free trials, discounts, or in-app credits\n" +
                        "• Some codes are region or account-specific\n" +
                        "• Codes have expiration dates\n" +
                        "• Each code can typically be used only once per account",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                }
            }
            
            // Alternative Redemption Methods
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = AppColors.warning.copy(alpha = 0.1f)
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
                            Icons.Default.Store,
                            contentDescription = null,
                            tint = AppColors.warning
                        )
                        Text(
                            "Alternative Methods",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    
                    Text(
                        "You can also redeem codes:\n" +
                        "• Through Google Play Store app\n" +
                        "• Via play.google.com/redeem on web\n" +
                        "• Using Google Play gift cards",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                }
            }
        }
    }
}
