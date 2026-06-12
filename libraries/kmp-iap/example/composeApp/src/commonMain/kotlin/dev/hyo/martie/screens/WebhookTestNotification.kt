package dev.hyo.martie.screens

import kotlinx.datetime.Instant
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

internal expect fun currentTimeMillis(): Long

internal expect suspend fun triggerWebhookTestNotification(
    apiKey: String,
    baseUrl: String = "https://kit.openiap.dev",
): Result<Unit>

@OptIn(ExperimentalEncodingApi::class, kotlin.time.ExperimentalTime::class)
internal fun buildWebhookTestNotificationPayload(messagePrefix: String): String {
    val timestamp = currentTimeMillis()
    val now = Instant.fromEpochMilliseconds(timestamp)
    val dataJson =
        """{"version":"1.0","packageName":"com.example.app","eventTimeMillis":"$timestamp","testNotification":{"version":"1.0"}}"""
    val data = Base64.Default.encode(dataJson.encodeToByteArray())
    return """{"message":{"data":"$data","messageId":"$messagePrefix-test-$timestamp","publishTime":"$now"},"subscription":"projects/example/subscriptions/iapkit-rtdn"}"""
}

internal fun webhookTestNotificationUrl(baseUrl: String, apiKey: String): String {
    val trimmedBaseUrl = baseUrl.trimEnd('/')
    return "$trimmedBaseUrl/v1/webhooks/${apiKey.encodePathSegment()}"
}

private fun String.encodePathSegment(): String = buildString {
    encodeToByteArray().forEach { raw ->
        val byte = raw.toInt() and 0xff
        val char = byte.toChar()
        if (
            char in 'A'..'Z' ||
            char in 'a'..'z' ||
            char in '0'..'9' ||
            char == '-' ||
            char == '.' ||
            char == '_' ||
            char == '~'
        ) {
            append(char)
        } else {
            append('%')
            append(byte.toString(16).uppercase().padStart(2, '0'))
        }
    }
}
