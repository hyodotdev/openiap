package dev.hyo.martie.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import io.github.hyochan.kmpiap.KmpIAP
import dev.hyo.martie.utils.swipeToBack
import dev.hyo.martie.theme.AppColors
import io.github.hyochan.kmpiap.getCurrentPlatform
import io.github.hyochan.kmpiap.openiap.IapPlatform
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfferCodeScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    val platform = getCurrentPlatform()
    
    // Create IAP instance
    val kmpIAP = remember { KmpIAP() }
    
    var isConnected by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            kmpIAP.initConnection()
            isConnected = true
        } catch (e: Exception) {
            result = "Connection failed: ${e.message}"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Offer Code Redemption") },
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
            // Status Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (isConnected) AppColors.Success else AppColors.Secondary
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isConnected) "Connected" else "Disconnected",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Platform-specific content
            when (platform) {
                IapPlatform.Ios -> {
                    Text(
                        text = "iOS Offer Code Redemption",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.OnSurface
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Text(
                                text = "Present the native iOS redemption sheet to allow users to enter promo codes.",
                                fontSize = 14.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    Button(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                try {
                                    kmpIAP.presentCodeRedemptionSheetIOS()
                                    result = "Redemption sheet presented"
                                } catch (e: Exception) {
                                    result = "Failed to present sheet: ${e.message}"
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        enabled = isConnected && !isLoading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Present Code Redemption Sheet")
                        }
                    }
                }
                
                IapPlatform.Android -> {
                    Text(
                        text = "Android Promo Code Redemption",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.OnSurface
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp)
                        ) {
                            Text(
                                text = "Redirect users to the Play Store to redeem promo codes.",
                                fontSize = 14.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    OutlinedTextField(
                        value = "",
                        onValueChange = { },
                        label = { Text("Promo Code (Optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Leave empty to open general redemption") }
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Button(
                        onClick = {
                            // TODO: Implement when openRedeemOfferCodeAndroid is available
                            result = "Play Store redemption not yet implemented"
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AppColors.Primary)
                    ) {
                        Text("Open Play Store Redemption")
                    }
                }
            }
            
            // Result display
            result?.let {
                Spacer(modifier = Modifier.height(20.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (it.contains("failed", ignoreCase = true)) 
                            AppColors.Error else AppColors.Surface
                    )
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(16.dp),
                        color = if (it.contains("failed", ignoreCase = true)) 
                            Color.White else AppColors.OnSurface
                    )
                }
            }
            
            // Testing Instructions
            Spacer(modifier = Modifier.height(20.dp))
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = AppColors.Surface)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "📝 Testing Promo Codes",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = AppColors.OnSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    when (platform) {
                        IapPlatform.Ios -> {
                            Text(
                                text = "1. Create promo codes in App Store Connect\n" +
                                      "2. Go to My Apps → Your App → Features → Promo Codes\n" +
                                      "3. Generate codes for testing\n" +
                                      "4. Codes work in TestFlight and production",
                                fontSize = 14.sp,
                                color = AppColors.Secondary
                            )
                        }
                        IapPlatform.Android -> {
                            Text(
                                text = "1. Create promo codes in Play Console\n" +
                                      "2. Go to Your App → Monetize → Promotions\n" +
                                      "3. Create a new promotion campaign\n" +
                                      "4. Generate and distribute codes",
                                fontSize = 14.sp,
                                color = AppColors.Secondary
                            )
                        }
                    }
                }
            }
        }
    }
}
