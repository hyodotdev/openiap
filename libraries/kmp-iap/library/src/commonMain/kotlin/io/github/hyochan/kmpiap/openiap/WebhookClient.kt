package io.github.hyochan.kmpiap.openiap

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Pure parser for the openiap kit SSE webhook stream
 * (`GET /v1/webhooks/stream/{apiKey}`).
 *
 * The `WebhookEvent` data class + every enum used here come from the
 * generated `Types.kt` (synced from `packages/gql/src/webhook.graphql`).
 * This file only adds the SSE-frame → `WebhookEvent` parser and the
 * URL builder. The transport (an actual HTTP+SSE client) lives in
 * the per-target source sets — `androidMain/WebhookTransport.android.kt`,
 * `iosMain/WebhookTransport.ios.kt` — because KMP doesn't ship a
 * stdlib HTTP client and we don't want to pull in Ktor.
 */

object WebhookEventParser {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /**
     * Parse one SSE `data:` frame (a single JSON object) into a
     * [WebhookEvent], or null if the frame is a heartbeat / control
     * envelope / malformed payload.
     */
    fun parse(rawJson: String): WebhookEvent? {
        if (rawJson.isEmpty()) return null
        val element: JsonElement = try {
            json.parseToJsonElement(rawJson)
        } catch (_: Throwable) {
            return null
        }
        if (element !is JsonObject) return null
        return fromJson(element)
    }

    fun fromJson(element: JsonObject): WebhookEvent? {
        return try {
            val id = element["id"]?.jsonPrimitive?.contentOrNull ?: return null
            val typeRaw = element["type"]?.jsonPrimitive?.contentOrNull
                ?: return null
            val purchaseToken =
                element["purchaseToken"]?.jsonPrimitive?.contentOrNull
            // purchaseToken is required for every event type *except*
            // TestNotification — Apple ASN v2 / Google RTDN test
            // payloads carry no transaction. Hard-rejecting here would
            // surface valid test webhooks as null events and the SSE
            // listener would never deliver them.
            if (purchaseToken == null && typeRaw != "TestNotification") {
                return null
            }
            val occurredAt =
                element["occurredAt"]?.jsonPrimitive?.numericOrNull()
                    ?: return null
            val receivedAt =
                element["receivedAt"]?.jsonPrimitive?.numericOrNull()
                    ?: return null
            val environmentRaw =
                element["environment"]?.jsonPrimitive?.contentOrNull
                    ?: return null
            val platformRaw =
                element["platform"]?.jsonPrimitive?.contentOrNull ?: return null
            val sourceRaw =
                element["source"]?.jsonPrimitive?.contentOrNull ?: return null

            // The generated `fromJson` companion factories throw on
            // unknown enum values. We catch the throw at the outer
            // level (PR #123 review: prefer fail-fast over silently
            // mapping unknown types to a synthetic `Unknown` value).
            WebhookEvent(
                cancellationReason =
                    element["cancellationReason"]?.jsonPrimitive?.contentOrNull?.let {
                        WebhookCancellationReason.fromJson(it)
                    },
                currency = element["currency"]?.jsonPrimitive?.contentOrNull,
                environment = WebhookEventEnvironment.fromJson(environmentRaw),
                expiresAt = element["expiresAt"]?.jsonPrimitive?.numericOrNull(),
                id = id,
                occurredAt = occurredAt,
                platform = IapPlatform.fromJson(platformRaw),
                priceAmountMicros =
                    element["priceAmountMicros"]?.jsonPrimitive?.numericOrNull(),
                productId = element["productId"]?.jsonPrimitive?.contentOrNull,
                projectId =
                    element["projectId"]?.jsonPrimitive?.contentOrNull
                        ?: return null,
                purchaseToken = purchaseToken,
                rawSignedPayload =
                    element["rawSignedPayload"]?.jsonPrimitive?.contentOrNull,
                receivedAt = receivedAt,
                renewsAt = element["renewsAt"]?.jsonPrimitive?.numericOrNull(),
                source = WebhookEventSource.fromJson(sourceRaw),
                subscriptionState =
                    element["subscriptionState"]?.jsonPrimitive?.contentOrNull?.let {
                        SubscriptionState.fromJson(it)
                    },
                type = WebhookEventType.fromJson(typeRaw),
            )
        } catch (_: Throwable) {
            // Fail-fast → null lets the SSE listener surface
            // MALFORMED_EVENT instead of emitting a half-decoded event.
            null
        }
    }
}

private fun JsonPrimitive.numericOrNull(): Double? =
    content.toDoubleOrNull() ?: longOrNull?.toDouble() ?: intOrNull?.toDouble()

/**
 * Endpoint URL for the kit SSE stream. Kept on the type so callers
 * don't reimplement the path layout in each transport.
 */
fun webhookStreamUrl(baseUrl: String = "https://kit.openiap.dev", apiKey: String): String {
    val trimmed = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
    // URL-encode the apiKey path segment. kit's apiKey format
    // (`openiap-kit_<hex>`) doesn't currently include reserved
    // characters, but a future format change or a misconfigured
    // operator-supplied key could break routing without this guard.
    // Matches the JS / Dart / GDScript clients which all
    // encodeURIComponent the same segment.
    return "$trimmed/v1/webhooks/stream/${encodePathSegment(apiKey)}"
}

private fun encodePathSegment(value: String): String {
    val sb = StringBuilder(value.length)
    for (ch in value) {
        if (ch.isLetterOrDigit() || ch == '-' || ch == '.' || ch == '_' || ch == '~') {
            sb.append(ch)
        } else {
            // RFC 3986 percent-encoding for the unreserved set —
            // matches Java's URLEncoder for path segments minus the
            // legacy `+` substitution for spaces (we want %20 for
            // path-segment use, not form-encoded space).
            for (b in ch.toString().encodeToByteArray()) {
                sb.append('%')
                sb.append(((b.toInt() shr 4) and 0xF).toString(16).uppercase())
                sb.append((b.toInt() and 0xF).toString(16).uppercase())
            }
        }
    }
    return sb.toString()
}
