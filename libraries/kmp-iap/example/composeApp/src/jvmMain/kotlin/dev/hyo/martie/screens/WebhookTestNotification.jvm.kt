package dev.hyo.martie.screens

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

internal actual suspend fun triggerWebhookTestNotification(
    apiKey: String,
    baseUrl: String,
): Result<Unit> = withContext(Dispatchers.IO) {
    runCatching {
        if (apiKey.isEmpty()) error("IAPKIT_API_KEY is not configured.")
        val connection = (URL(webhookTestNotificationUrl(baseUrl, apiKey))
            .openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
        }
        try {
            connection.outputStream.use {
                it.write(buildWebhookTestNotificationPayload("kmp-jvm").toByteArray(Charsets.UTF_8))
            }
            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                error("Test POST returned $statusCode")
            }
        } finally {
            connection.disconnect()
        }
    }
}
