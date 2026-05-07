package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.config.AppConfig
import dev.hyo.martie.theme.AppColors
import dev.hyo.martie.utils.swipeToBack
import io.github.hyochan.kmpiap.openiap.WebhookEvent
import io.github.hyochan.kmpiap.openiap.WebhookTransport
import io.github.hyochan.kmpiap.openiap.connectWebhookStream
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebhookStreamScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    var transport by remember { mutableStateOf<WebhookTransport?>(null) }
    var job by remember { mutableStateOf<Job?>(null) }
    var events by remember { mutableStateOf<List<WebhookEvent>>(emptyList()) }
    var status by remember { mutableStateOf("idle") }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var testing by remember { mutableStateOf(false) }

    fun disconnect() {
        job?.cancel()
        transport?.close()
        job = null
        transport = null
        status = "idle"
        statusMessage = null
    }

    fun connect() {
        val apiKey = AppConfig.iapkitApiKey
        if (apiKey.isEmpty()) {
            status = "error"
            statusMessage = "IAPKIT_API_KEY is not configured."
            return
        }
        disconnect()
        val stream = connectWebhookStream(apiKey = apiKey)
        transport = stream
        status = "connected"
        job = scope.launch {
            try {
                stream.events().collect { event ->
                    events = (listOf(event) + events).take(50)
                    status = "connected"
                    statusMessage = null
                }
            } catch (e: Exception) {
                status = "error"
                statusMessage = e.message ?: e::class.simpleName ?: "Webhook stream failed"
            }
        }
    }

    fun triggerTest() {
        val apiKey = AppConfig.iapkitApiKey
        if (apiKey.isEmpty()) {
            status = "error"
            statusMessage = "Cannot trigger test: IAPKIT_API_KEY is missing."
            return
        }
        scope.launch {
            testing = true
            val result = triggerWebhookTestNotification(apiKey)
            result
                .onSuccess {
                    statusMessage = "Test notification accepted."
                }
                .onFailure { error ->
                    status = "error"
                    statusMessage = "Test POST failed: ${error.message ?: error::class.simpleName}"
                }
            testing = false
        }
    }

    DisposableEffect(Unit) {
        onDispose { disconnect() }
    }

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
        },
        modifier = Modifier.swipeToBack(navController)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.Background)
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "SSE /v1/webhooks/stream/{apiKey}",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "api key: ${AppConfig.iapkitApiKey.take(8).ifEmpty { "MISSING" }}",
                color = AppColors.Secondary
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        if (status == "connected") disconnect() else connect()
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text(if (status == "connected") "Disconnect" else "Connect")
                }
                Button(
                    onClick = { triggerTest() },
                    enabled = !testing,
                    modifier = Modifier.weight(1f)
                ) {
                    if (testing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Trigger test notification")
                    }
                }
            }
            StatusCard(status = status, message = statusMessage)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (events.isEmpty()) {
                    item {
                        Text(
                            text = "No webhook events yet. Connect, then trigger a test notification.",
                            color = AppColors.Secondary,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
                items(events, key = { it.id }) { event ->
                    WebhookEventCard(event)
                }
            }
        }
    }
}

@Composable
private fun StatusCard(status: String, message: String?) {
    val color = when (status) {
        "connected" -> AppColors.Success.copy(alpha = 0.1f)
        "error" -> AppColors.Error.copy(alpha = 0.1f)
        else -> Color.White
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = color),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = if (message == null) "Status: $status" else "Status: $status\n$message",
            modifier = Modifier.padding(16.dp),
            color = AppColors.OnSurface
        )
    }
}

@Composable
private fun WebhookEventCard(event: WebhookEvent) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(event.type.rawValue, fontWeight = FontWeight.Bold)
            Text("source: ${event.source.rawValue}", color = AppColors.Secondary)
            Text("platform: ${event.platform.rawValue}", color = AppColors.Secondary)
            Text("productId: ${event.productId ?: "-"}", color = AppColors.Secondary)
        }
    }
}
