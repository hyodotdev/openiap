package dev.hyo.martie.screens

import android.util.Base64
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import dev.hyo.martie.BuildConfig
import dev.hyo.martie.models.AppColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

private const val IAPKIT_BASE_URL = "https://kit.openiap.dev"

private data class WebhookEventRow(
    val id: String,
    val type: String,
    val source: String?,
    val platform: String?,
    val productId: String?
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebhookStreamScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    var events by remember { mutableStateOf<List<WebhookEventRow>>(emptyList()) }
    var status by remember { mutableStateOf("idle") }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var streamJob by remember { mutableStateOf<Job?>(null) }
    var testing by remember { mutableStateOf(false) }

    fun disconnect() {
        streamJob?.cancel()
        streamJob = null
        if (status == "connected") {
            status = "idle"
            statusMessage = null
        }
    }

    fun connect() {
        val apiKey = BuildConfig.IAPKIT_API_KEY
        if (apiKey.isEmpty()) {
            status = "error"
            statusMessage = "IAPKIT_API_KEY is not configured."
            return
        }

        disconnect()
        status = "connected"
        statusMessage = null
        streamJob = scope.launch {
            runCatching {
                collectWebhookEvents(apiKey) { event ->
                    events = (listOf(event) + events).take(50)
                    status = "connected"
                    statusMessage = null
                }
            }.onFailure { error ->
                if (isActive) {
                    status = "error"
                    statusMessage = error.message ?: error.javaClass.simpleName
                }
            }
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
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.background)
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("SSE /v1/webhooks/stream/{apiKey}", style = MaterialTheme.typography.titleMedium)
            Text(
                "api key: ${BuildConfig.IAPKIT_API_KEY.take(8).ifEmpty { "MISSING" }}",
                color = AppColors.textSecondary
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { if (status == "connected") disconnect() else connect() },
                    modifier = Modifier.weight(1f)
                ) {
                    Text(if (status == "connected") "Disconnect" else "Connect")
                }
                Button(
                    onClick = {
                        scope.launch {
                            testing = true
                            statusMessage = runCatching {
                                triggerTestNotification(BuildConfig.IAPKIT_API_KEY)
                                "Test notification accepted."
                            }.getOrElse { "Test POST failed: ${it.message}" }
                            testing = false
                        }
                    },
                    enabled = !testing,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(if (testing) "Sending..." else "Trigger Test")
                }
            }

            StatusCard(status, statusMessage)

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (events.isEmpty()) {
                    item {
                        Text(
                            text = "No webhook events yet.",
                            color = AppColors.textSecondary,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
                items(events, key = { it.id }) { event ->
                    EventCard(event)
                }
            }
        }
    }
}

@Composable
private fun StatusCard(status: String, message: String?) {
    val background = when (status) {
        "connected" -> AppColors.success.copy(alpha = 0.12f)
        "error" -> AppColors.danger.copy(alpha = 0.12f)
        else -> AppColors.cardBackground
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = background),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = if (message == null) "Status: $status" else "Status: $status\n$message",
            modifier = Modifier.padding(16.dp)
        )
    }
}

@Composable
private fun EventCard(event: WebhookEventRow) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.cardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(event.type, fontWeight = FontWeight.Bold)
            Text("source: ${event.source ?: "-"}", color = AppColors.textSecondary)
            Text("platform: ${event.platform ?: "-"}", color = AppColors.textSecondary)
            Text("productId: ${event.productId ?: "-"}", color = AppColors.textSecondary)
        }
    }
}

private suspend fun collectWebhookEvents(
    apiKey: String,
    onEvent: (WebhookEventRow) -> Unit
) = withContext(Dispatchers.IO) {
    val url = URL("$IAPKIT_BASE_URL/v1/webhooks/stream/${apiKey.urlEncodePath()}")
    val connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        setRequestProperty("Accept", "text/event-stream")
        connectTimeout = 30_000
        readTimeout = 60_000
    }
    try {
        BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
            var line = reader.readLine()
            while (line != null && isActive) {
                if (line.startsWith("data:")) {
                    val event = parseWebhookEvent(line.removePrefix("data:").trim())
                    if (event != null) {
                        withContext(Dispatchers.Main) {
                            onEvent(event)
                        }
                    }
                }
                line = reader.readLine()
            }
        }
    } finally {
        connection.disconnect()
    }
}

private suspend fun triggerTestNotification(apiKey: String) = withContext(Dispatchers.IO) {
    if (apiKey.isEmpty()) error("IAPKIT_API_KEY is not configured.")
    val dataJson = JSONObject()
        .put("version", "1.0")
        .put("packageName", "com.example.app")
        .put("eventTimeMillis", System.currentTimeMillis().toString())
        .put("testNotification", JSONObject().put("version", "1.0"))
        .toString()
    val payload = JSONObject()
        .put(
            "message",
            JSONObject()
                .put("data", Base64.encodeToString(dataJson.toByteArray(), Base64.NO_WRAP))
                .put("messageId", "google-test-${System.currentTimeMillis()}")
                .put("publishTime", Instant.now().toString())
        )
        .put("subscription", "projects/example/subscriptions/iapkit-rtdn")

    val url = URL("$IAPKIT_BASE_URL/v1/webhooks/${apiKey.urlEncodePath()}")
    val connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        doOutput = true
    }
    try {
        connection.outputStream.use { it.write(payload.toString().toByteArray()) }
        val statusCode = connection.responseCode
        if (statusCode !in 200..299) {
            error("Test POST returned $statusCode")
        }
    } finally {
        connection.disconnect()
    }
}

private fun parseWebhookEvent(raw: String): WebhookEventRow? {
    return runCatching {
        val json = JSONObject(raw)
        WebhookEventRow(
            id = json.getString("id"),
            type = json.getString("type"),
            source = json.optString("source").ifEmpty { null },
            platform = json.optString("platform").ifEmpty { null },
            productId = json.optString("productId").ifEmpty { null }
        )
    }.getOrNull()
}

private fun String.urlEncodePath(): String = java.net.URLEncoder
    .encode(this, Charsets.UTF_8.name())
    .replace("+", "%20")
