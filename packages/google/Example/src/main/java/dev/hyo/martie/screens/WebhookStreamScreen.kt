package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.models.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebhookStreamScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Webhook Stream") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.background)
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Trusted backend or MCP only",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            WebhookInfoCard(
                title = "Do not connect from a shipped app",
                body = "The project-wide IAPKit stream contains lifecycle records and purchase identifiers. " +
                    "It requires an openiap-kit_sk_ secret admin key, which must never be embedded in an app.",
                warning = true
            )
            WebhookInfoCard(
                title = "Mobile app",
                body = "Use an openiap-kit_pk_ publishable key for purchase verification, " +
                    "user-scoped entitlement helpers, and public product payloads."
            )
            WebhookInfoCard(
                title = "Trusted consumer",
                body = "MCP, CI, or your backend connects to GET /v1/webhooks/stream and sends " +
                    "Authorization: Bearer <IAPKIT_SECRET_KEY>. If your backend protects paid content, " +
                    "it should make the final entitlement decision."
            )
            Text(
                text = "Configure the separate lifecycle webhook URL from the IAPKit dashboard " +
                    "in App Store Connect and Google Cloud Pub/Sub.",
                color = AppColors.textSecondary
            )
        }
    }
}

@Composable
private fun WebhookInfoCard(
    title: String,
    body: String,
    warning: Boolean = false
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (warning) Color(0xFFFFF7ED) else AppColors.cardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(body, color = AppColors.textSecondary)
        }
    }
}
