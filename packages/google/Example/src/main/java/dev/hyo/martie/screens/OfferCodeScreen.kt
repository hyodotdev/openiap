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
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors
import dev.hyo.martie.screens.uis.*
import dev.hyo.openiap.IapContext
import dev.hyo.openiap.store.OpenIapStore
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfferCodeScreen(
    navController: NavController,
    storeParam: OpenIapStore? = null
) {
    val context = LocalContext.current
    val iapStore = storeParam ?: (IapContext.LocalOpenIapStore.current
        ?: IapContext.rememberOpenIapStore())
    val connectionStatus by iapStore.connectionStatus.collectAsState()
    
    var offerCode by remember { mutableStateOf("") }
    var showResult by remember { mutableStateOf(false) }
    var resultMessage by remember { mutableStateOf("") }
    var isRedeeming by remember { mutableStateOf(false) }
    
    // Initialize and connect on first composition (spec-aligned names)
    val startupScope = rememberCoroutineScope()
    DisposableEffect(Unit) {
        startupScope.launch { runCatching { iapStore.initConnection() } }
        onDispose { startupScope.launch { runCatching { iapStore.endConnection() } } }
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
                                "Enter promo code to redeem",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                    }
                    
                    Text(
                        "Enter your promo code to redeem special offers, discounts, or free subscriptions from Google Play Store.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.textSecondary
                    )
                }
            }
            
            // Input Field
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    OutlinedTextField(
                        value = offerCode,
                        onValueChange = { offerCode = it.uppercase() },
                        label = { Text("Promo Code") },
                        placeholder = { Text("Enter code") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = {
                            Icon(
                                Icons.Default.CardGiftcard,
                                contentDescription = null,
                                tint = AppColors.warning
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AppColors.warning,
                            unfocusedBorderColor = AppColors.textSecondary.copy(alpha = 0.3f)
                        )
                    )
                    
                    Button(
                        onClick = {
                            if (offerCode.isNotBlank()) {
                                isRedeeming = true
                                // Note: Google Play doesn't have a direct API for promo codes
                                // They are usually redeemed through the Play Store app
                                resultMessage = "Promo codes should be redeemed directly in the Google Play Store app. " +
                                              "Go to Play Store → Menu → Payments & subscriptions → Redeem code"
                                showResult = true
                                isRedeeming = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = offerCode.isNotBlank() && !isRedeeming && connectionStatus
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
