package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors
import dev.hyo.openiap.AppOwnershipVerificationResult
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PlayIntegrityParamsAndroid
import dev.hyo.openiap.VerifyAppOwnershipProps
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppOwnershipScreen(navController: NavController) {
    val uiScope = rememberCoroutineScope()
    val iapStore = currentOpenIapStore()
    var ownershipProjectNumber by remember { mutableStateOf("") }
    var ownershipRequestHash by remember { mutableStateOf("") }
    var ownershipResult by remember { mutableStateOf<AppOwnershipVerificationResult?>(null) }
    var ownershipError by remember { mutableStateOf<String?>(null) }
    var isCheckingOwnership by remember { mutableStateOf(false) }

    // Ownership checks need no billing connection.
    fun checkAppOwnership() {
        val projectNumber = ownershipProjectNumber.trim()
        val requestHash = ownershipRequestHash.trim()
        ownershipResult = null
        ownershipError = null
        if (projectNumber.isEmpty() != requestHash.isEmpty()) {
            ownershipError = "${ErrorCode.DeveloperError.rawValue}: Provide both Google inputs or leave both empty."
            return
        }
        val options = VerifyAppOwnershipProps(
            google = if (projectNumber.isNotEmpty()) {
                PlayIntegrityParamsAndroid(cloudProjectNumber = projectNumber, requestHash = requestHash)
            } else null
        )
        isCheckingOwnership = true
        uiScope.launch {
            try {
                ownershipResult = iapStore.verifyAppOwnership(options)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                val code = (error as? OpenIapError)?.code ?: ErrorCode.ServiceError.rawValue
                ownershipError = "$code: ${error.message ?: "App ownership verification failed"}"
            } finally {
                isCheckingOwnership = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Ownership") },
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
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 20.dp),
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
                            Icons.Default.Verified,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = AppColors.secondary
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                "App Ownership",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )

                            Text(
                                "Check the app came from its store",
                                style = MaterialTheme.typography.bodySmall,
                                color = AppColors.textSecondary
                            )
                        }
                    }

                    Text(
                        "Verify the app download itself, separately from in-app purchases.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppColors.textSecondary
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        "Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.",
                        style = MaterialTheme.typography.bodySmall,
                        color = AppColors.textSecondary
                    )
                    OutlinedTextField(
                        value = ownershipProjectNumber,
                        onValueChange = { ownershipProjectNumber = it },
                        label = { Text("Google Cloud project number") },
                        singleLine = true,
                        enabled = !isCheckingOwnership,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = ownershipRequestHash,
                        onValueChange = { ownershipRequestHash = it },
                        label = { Text("Request hash") },
                        singleLine = true,
                        enabled = !isCheckingOwnership,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = { checkAppOwnership() },
                        enabled = !isCheckingOwnership,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (isCheckingOwnership) "Checking…" else "Check app ownership")
                    }
                    ownershipError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    ownershipResult?.let { result ->
                        Text("Status: ${result.status.rawValue}")
                        Text("Store ID: ${result.storeId}")
                        Text("Reason: ${result.reason?.rawValue ?: "none"}")
                        Text("Signed AppTransaction length: ${result.signedAppTransactionIOS?.length ?: 0}")
                        Text("Integrity token length: ${result.integrityTokenAndroid?.length ?: 0}")
                    }
                }
            }
        }
    }
}
