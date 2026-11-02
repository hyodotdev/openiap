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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import dev.hyo.martie.theme.AppColors
import dev.hyo.martie.utils.swipeToBack
import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.PlayIntegrityParamsAndroid
import io.github.hyochan.kmpiap.openiap.VerifyAppOwnershipProps
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppOwnershipScreen(navController: NavController) {
    val scope = rememberCoroutineScope()

    var ownershipCloudProjectNumber by remember { mutableStateOf("") }
    var ownershipRequestHash by remember { mutableStateOf("") }
    var ownershipResult by remember { mutableStateOf<String?>(null) }
    var isCheckingOwnership by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Ownership") },
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
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                    // Ownership checks need no store connection.
                    Button(
                        enabled = !isCheckingOwnership,
                        modifier = Modifier.fillMaxWidth(),
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
        }
    }
}
