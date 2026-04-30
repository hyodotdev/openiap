package io.github.hyochan.kmpiap.openiap

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Pure parser + value types for the openiap kit SSE webhook stream
 * (`GET /v1/webhooks/stream/{apiKey}`).
 *
 * Wire format mirrors the canonical TypeScript implementation in
 * `packages/gql/src/webhook-client.ts`. The `WebhookEvent` shape comes
 * from `packages/gql/src/webhook.graphql`.
 *
 * The transport (an actual HTTP+SSE client) is intentionally not in
 * commonMain — KMP doesn't ship a stdlib HTTP client. Consumers wire
 * a transport per target (e.g. OkHttp on Android, NSURLSession on
 * iOS) and feed each parsed JSON frame to [WebhookEventParser.parse].
 * That keeps this module's dependency surface flat (no Ktor) while
 * still giving every target the same parser + types.
 */

enum class WebhookEventTypeName {
    SubscriptionStarted,
    SubscriptionRenewed,
    SubscriptionExpired,
    SubscriptionInGracePeriod,
    SubscriptionInBillingRetry,
    SubscriptionRecovered,
    SubscriptionCanceled,
    SubscriptionUncanceled,
    SubscriptionRevoked,
    SubscriptionPriceChange,
    SubscriptionProductChanged,
    SubscriptionPaused,
    SubscriptionResumed,
    PurchaseRefunded,
    PurchaseConsumptionRequest,
    TestNotification,
    Unknown;

    companion object {
        fun fromRaw(raw: String?): WebhookEventTypeName = when (raw) {
            "SubscriptionStarted" -> SubscriptionStarted
            "SubscriptionRenewed" -> SubscriptionRenewed
            "SubscriptionExpired" -> SubscriptionExpired
            "SubscriptionInGracePeriod" -> SubscriptionInGracePeriod
            "SubscriptionInBillingRetry" -> SubscriptionInBillingRetry
            "SubscriptionRecovered" -> SubscriptionRecovered
            "SubscriptionCanceled" -> SubscriptionCanceled
            "SubscriptionUncanceled" -> SubscriptionUncanceled
            "SubscriptionRevoked" -> SubscriptionRevoked
            "SubscriptionPriceChange" -> SubscriptionPriceChange
            "SubscriptionProductChanged" -> SubscriptionProductChanged
            "SubscriptionPaused" -> SubscriptionPaused
            "SubscriptionResumed" -> SubscriptionResumed
            "PurchaseRefunded" -> PurchaseRefunded
            "PurchaseConsumptionRequest" -> PurchaseConsumptionRequest
            "TestNotification" -> TestNotification
            else -> Unknown
        }
    }
}

data class WebhookEvent(
    val id: String,
    val type: WebhookEventTypeName,
    val rawType: String,
    val source: String,
    val platform: String,
    val environment: String,
    val projectId: String,
    val occurredAt: Long,
    val receivedAt: Long,
    val purchaseToken: String,
    val productId: String? = null,
    val subscriptionState: String? = null,
    val expiresAt: Long? = null,
    val renewsAt: Long? = null,
    val cancellationReason: String? = null,
    val currency: String? = null,
    val priceAmountMicros: Long? = null,
    val rawSignedPayload: String? = null,
    val raw: JsonObject,
)

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
        val id = element["id"]?.jsonPrimitive?.contentOrNull ?: return null
        val type = element["type"]?.jsonPrimitive?.contentOrNull ?: return null
        val purchaseToken =
            element["purchaseToken"]?.jsonPrimitive?.contentOrNull ?: return null
        val occurredAt = element["occurredAt"]?.jsonPrimitive?.longOrNull
            ?: return null
        val receivedAt = element["receivedAt"]?.jsonPrimitive?.longOrNull
            ?: return null

        return WebhookEvent(
            id = id,
            type = WebhookEventTypeName.fromRaw(type),
            rawType = type,
            source = element["source"]?.jsonPrimitive?.contentOrNull ?: "",
            platform = element["platform"]?.jsonPrimitive?.contentOrNull ?: "",
            environment = element["environment"]?.jsonPrimitive?.contentOrNull ?: "",
            projectId = element["projectId"]?.jsonPrimitive?.contentOrNull ?: "",
            occurredAt = occurredAt,
            receivedAt = receivedAt,
            purchaseToken = purchaseToken,
            productId = element["productId"]?.jsonPrimitive?.contentOrNull,
            subscriptionState =
                element["subscriptionState"]?.jsonPrimitive?.contentOrNull,
            expiresAt = element["expiresAt"]?.jsonPrimitive?.longOrNull,
            renewsAt = element["renewsAt"]?.jsonPrimitive?.longOrNull,
            cancellationReason =
                element["cancellationReason"]?.jsonPrimitive?.contentOrNull,
            currency = element["currency"]?.jsonPrimitive?.contentOrNull,
            priceAmountMicros =
                element["priceAmountMicros"]?.jsonPrimitive?.longOrNull
                    ?: element["priceAmountMicros"]?.jsonPrimitive?.intOrNull?.toLong(),
            rawSignedPayload =
                element["rawSignedPayload"]?.jsonPrimitive?.contentOrNull,
            raw = element,
        )
    }
}

/**
 * Endpoint URL for the kit SSE stream. Kept on the type so callers
 * don't reimplement the path layout in each transport.
 */
fun webhookStreamUrl(baseUrl: String = "https://kit.openiap.dev", apiKey: String): String {
    val trimmed = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
    return "$trimmed/v1/webhooks/stream/$apiKey"
}
