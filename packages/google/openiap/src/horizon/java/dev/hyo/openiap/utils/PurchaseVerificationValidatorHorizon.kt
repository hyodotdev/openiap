package dev.hyo.openiap.utils

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitHorizonProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Horizon-flavor IAPKit verification.
 *
 * Lives entirely under `src/horizon/` so the Play-flavor compiled
 * artifact never carries Meta/Quest-specific code. The main-source
 * `verifyPurchaseWithIapkit` keeps its historical Google-only
 * contract; the Horizon module imports this function instead when
 * the caller populated `props.horizon`.
 *
 * Authentication contract (matches the Google helper):
 *   - Client passes its IAPKit Bearer API key on `props.apiKey`.
 *   - No Meta credential ever lives on the device. IAPKit holds the
 *     Horizon App ID + App Secret server-side, composes
 *     `OC|APP_ID|APP_SECRET`, and calls
 *     `graph.oculus.com/{APP_ID}/verify_entitlement` on our behalf.
 *
 * The HTTP plumbing is intentionally duplicated from
 * `PurchaseVerificationValidator.kt` rather than shared via an
 * `internal` helper in main — keeping it here means the `main`
 * source tree has no Horizon knowledge at all and the Play flavor
 * build can't accidentally drift into Horizon code paths.
 */

private const val IAPKIT_ENDPOINT = "https://kit.openiap.dev/v1/purchase/verify"
private val horizonGson = Gson()

private fun horizonOpenConnection(url: String): HttpURLConnection =
    URL(url).openConnection() as HttpURLConnection

suspend fun verifyPurchaseWithIapkitHorizon(
    props: RequestVerifyPurchaseWithIapkitProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::horizonOpenConnection,
): RequestVerifyPurchaseWithIapkitResult = withContext(Dispatchers.IO) {
    val horizon = props.horizon
        ?: throw IllegalArgumentException(
            "IAPKit Horizon verification requires horizon options (userId, sku)",
        )
    if (horizon.userId.isBlank() || horizon.sku.isBlank()) {
        throw IllegalArgumentException(
            "IAPKit Horizon verification requires userId and sku",
        )
    }

    val payload = buildHorizonIapkitPayload(horizon)
    val store = IapStore.Horizon
    val connection = connectionFactory(IAPKIT_ENDPOINT).apply {
        requestMethod = "POST"
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        props.apiKey?.takeIf { it.isNotBlank() }?.let { apiKey ->
            setRequestProperty("Authorization", "Bearer $apiKey")
        }
    }

    try {
        val body = horizonGson.toJson(payload)
        connection.outputStream.use { stream ->
            stream.write(body.toByteArray(Charsets.UTF_8))
        }

        val statusCode = connection.responseCode
        val responseBody = (
            if (statusCode in 200..299) connection.inputStream else connection.errorStream
        )
            ?.bufferedReader()
            ?.use { it.readText() }
            ?: ""

        if (statusCode !in 200..299) {
            OpenIapLog.warn(
                "verifyPurchaseWithIapkitHorizon failed (HTTP $statusCode) [$store]",
                tag,
            )
            // Surface the deepest originalError if IAPKit returned a
            // structured error body; fall back to HTTP status text.
            val errorMessage = try {
                val mapType = object : TypeToken<Map<String, Any?>>() {}.type
                val errorJson = horizonGson.fromJson<Map<String, Any?>>(responseBody, mapType)
                extractHorizonIapkitErrorMessage(errorJson) ?: "HTTP $statusCode"
            } catch (e: Exception) {
                "HTTP $statusCode"
            }
            throw OpenIapError.PurchaseVerificationFailed(errorMessage)
        }

        try {
            val mapType = object : TypeToken<Map<String, Any?>>() {}.type
            val parsed = horizonGson.fromJson<Map<String, Any?>>(responseBody, mapType)
            // IAPKit returns UPPER_SNAKE_CASE states; Types.kt expects
            // lower-kebab-case. Mirror the normalization main's
            // Google helper already does.
            val normalizedParsed = parsed.toMutableMap().apply {
                val state = this["state"] as? String
                if (state != null) {
                    this["state"] = state.lowercase().replace("_", "-")
                }
                if (this["store"] == null) {
                    this["store"] = store.toJson()
                }
            }
            RequestVerifyPurchaseWithIapkitResult.fromJson(normalizedParsed)
        } catch (jsonError: Exception) {
            OpenIapLog.warn(
                "Failed to parse IAPKit Horizon verification response: ${jsonError.message}",
                tag,
            )
            throw OpenIapError.PurchaseVerificationFailed("Failed to parse response")
        }
    } catch (io: IOException) {
        OpenIapLog.warn(
            "Network error during IAPKit Horizon verification: ${io.message}",
            tag,
        )
        throw OpenIapError.PurchaseVerificationFailed("Network error: ${io.message}")
    } finally {
        connection.disconnect()
    }
}

/**
 * Build payload for Meta Horizon verification via IAPKit. The Meta
 * App Secret lives on the IAPKit server, so the client never carries
 * an Oculus access token — IAPKit composes `OC|APP_ID|APP_SECRET`
 * server-side and calls Meta's verify_entitlement on our behalf.
 */
private fun buildHorizonIapkitPayload(
    horizon: RequestVerifyPurchaseWithIapkitHorizonProps,
): Map<String, Any?> =
    mutableMapOf<String, Any?>(
        "store" to IapStore.Horizon.rawValue,
        "userId" to horizon.userId,
        "sku" to horizon.sku,
    )

/**
 * Extract the deepest originalError from IAPKit's nested error body.
 * Matches the shape `{ errors: [{ code, message, details: { originalError } }] }`.
 */
@Suppress("UNCHECKED_CAST")
private fun extractHorizonIapkitErrorMessage(json: Map<String, Any?>): String? {
    val errorsRaw = json["errors"]
    if (errorsRaw is List<*>) {
        val firstError = errorsRaw.firstOrNull()
        if (firstError is Map<*, *>) {
            return extractHorizonIapkitErrorMessage(firstError as Map<String, Any?>)
        }
    }

    val detailsRaw = json["details"]
    if (detailsRaw is Map<*, *>) {
        val details = detailsRaw as Map<String, Any?>
        val originalError = details["originalError"]
        if (originalError is String) {
            return try {
                val nested = horizonGson.fromJson(originalError, Map::class.java) as? Map<String, Any?>
                if (nested != null) {
                    extractHorizonIapkitErrorMessage(nested) ?: originalError
                } else {
                    originalError
                }
            } catch (e: Exception) {
                originalError
            }
        }
    }

    val message = json["message"] as? String
    if (message != null && !message.contains("{\"error\"")) {
        return message
    }
    return json["error"] as? String
}
