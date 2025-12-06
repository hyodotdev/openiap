package dev.hyo.openiap.utils

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken
import dev.hyo.openiap.IapkitStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseResultAndroid
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val DEFAULT_IAPKIT_ENDPOINT = "https://api.iapkit.com/v1/purchase/verify"
private val gson = Gson()

private fun openConnection(url: String): HttpURLConnection {
    return URL(url).openConnection() as HttpURLConnection
}

suspend fun verifyPurchaseWithGooglePlay(
    props: VerifyPurchaseProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): VerifyPurchaseResultAndroid = withContext(Dispatchers.IO) {
    val options = props.androidOptions
        ?: throw IllegalArgumentException(
            "Android validation requires packageName, productToken, and accessToken"
        )

    if (
        options.packageName.isBlank() ||
        options.productToken.isBlank() ||
        options.accessToken.isBlank()
    ) {
        throw IllegalArgumentException(
            "Android validation requires packageName, productToken, and accessToken"
        )
    }

    val typeSegment = if (options.isSub == true) "subscriptions" else "products"
    val baseUrl = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
    val url = "$baseUrl/${options.packageName}/purchases/$typeSegment/${props.sku}/tokens/${options.productToken}"

    val connection = connectionFactory(url).apply {
        requestMethod = "GET"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer ${options.accessToken}")
    }

    try {
        val statusCode = connection.responseCode
        val responseBody = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()
            ?.use { it.readText() }
            .orElse("")

        if (statusCode !in 200..299) {
            OpenIapLog.warn("verifyPurchase failed (HTTP $statusCode): $responseBody", tag)
            throw OpenIapError.InvalidPurchaseVerification
        }

        try {
            gson.fromJson(responseBody, VerifyPurchaseResultAndroid::class.java)
                ?: throw OpenIapError.InvalidPurchaseVerification
        } catch (jsonError: JsonSyntaxException) {
            OpenIapLog.warn("Failed to parse purchase verification response: ${jsonError.message}", tag)
            throw OpenIapError.InvalidPurchaseVerification
        }
    } catch (io: IOException) {
        OpenIapLog.warn("Network error during purchase verification: ${io.message}", tag)
        throw OpenIapError.NetworkError
    } finally {
        connection.disconnect()
    }
}

suspend fun verifyPurchaseWithIapkit(
    props: RequestVerifyPurchaseWithIapkitProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): List<RequestVerifyPurchaseWithIapkitResult> = withContext(Dispatchers.IO) {
    val endpoint = DEFAULT_IAPKIT_ENDPOINT

    // On Android, only Google verification is supported
    if (props.google == null) {
        throw IllegalArgumentException("IAPKit verification on Android requires google payload")
    }

    val requests: List<Pair<IapkitStore, Map<String, Any?>>> = listOf(
        IapkitStore.Google to buildPayload(props, IapkitStore.Google)
    )

    requests.map { (store, payload) ->
        val connection = connectionFactory(endpoint).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            props.apiKey?.takeIf { it.isNotBlank() }?.let { apiKey ->
                setRequestProperty("Authorization", "Bearer $apiKey")
            }
        }

        try {
            val body = gson.toJson(payload)

            // Log request details for debugging
            OpenIapLog.debug("IAPKit request URL: $endpoint", tag)
            OpenIapLog.debug("IAPKit request body: $body", tag)

            connection.outputStream.use { stream ->
                stream.write(body.toByteArray())
            }

            val statusCode = connection.responseCode
            val responseBody = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orElse("")

            OpenIapLog.debug("IAPKit response (HTTP $statusCode): $responseBody", tag)

            if (statusCode !in 200..299) {
                OpenIapLog.warn("verifyPurchaseWithProvider failed (HTTP $statusCode) [$store]: $responseBody", tag)
                // Extract concise error message from IAPKit response
                // IAPKit returns nested error format - extract the deepest originalError
                val errorMessage = try {
                    val mapType = object : TypeToken<Map<String, Any?>>() {}.type
                    val errorJson = gson.fromJson<Map<String, Any?>>(responseBody, mapType)
                    extractIapkitErrorMessage(errorJson) ?: "HTTP $statusCode"
                } catch (e: Exception) {
                    "HTTP $statusCode"
                }
                throw OpenIapError.PurchaseVerificationFailed(errorMessage)
            }

            try {
                val mapType = object : TypeToken<Map<String, Any?>>() {}.type
                val parsed = gson.fromJson<Map<String, Any?>>(responseBody, mapType)
                // IAPKit API returns UPPER_SNAKE_CASE (e.g., "PURCHASED", "PENDING_ACKNOWLEDGMENT")
                // Types.kt expects lower-kebab-case (e.g., "purchased", "pending-acknowledgment")
                val normalizedParsed = parsed.toMutableMap().apply {
                    val state = this["state"] as? String
                    if (state != null) {
                        this["state"] = state.lowercase().replace("_", "-")
                    }
                    // IAPKit response doesn't include store, add it from request
                    if (this["store"] == null) {
                        this["store"] = store.toJson()
                    }
                }
                OpenIapLog.debug("IAPKit normalized response: $normalizedParsed", tag)
                RequestVerifyPurchaseWithIapkitResult.fromJson(normalizedParsed)
            } catch (jsonError: Exception) {
                OpenIapLog.warn("Failed to parse IAPKit verification response: ${jsonError.message}", tag)
                throw OpenIapError.PurchaseVerificationFailed("Failed to parse response")
            }
        } catch (io: IOException) {
            OpenIapLog.warn("Network error during IAPKit verification: ${io.message}", tag)
            throw OpenIapError.PurchaseVerificationFailed("Network error: ${io.message}")
        } finally {
            connection.disconnect()
        }
    }
}

private fun buildPayload(
    props: RequestVerifyPurchaseWithIapkitProps,
    store: IapkitStore
): Map<String, Any?> {
    return when (store) {
        IapkitStore.Google -> {
            val google = props.google
                ?: throw IllegalArgumentException("IAPKit Google verification requires google options")
            if (google.purchaseToken.isBlank()) {
                throw IllegalArgumentException(
                    "IAPKit Google verification requires purchaseToken"
                )
            }
            mutableMapOf<String, Any?>(
                "store" to store.toJson(),
                "purchaseToken" to google.purchaseToken
            )
        }
        else -> throw IllegalArgumentException("IAPKit verification on Android supports Google payloads only")
    }
}

private fun String?.orElse(fallback: String): String = this ?: fallback

/**
 * Extract concise error message from IAPKit error response.
 * IAPKit returns nested error structures - we extract the deepest originalError for clarity.
 *
 * Example input:
 * {"error":"PLAY_STORE_VERIFICATION_ERROR","message":"Failed to verify Google Play purchase: {...}",
 *  "details":{"originalError":"..."}}
 *
 * Returns: "The purchase token is no longer valid." (the deepest originalError)
 */
@Suppress("UNCHECKED_CAST")
private fun extractIapkitErrorMessage(json: Map<String, Any?>): String? {
    // Try errors array format first: { "errors": [{ "code": "...", "message": "..." }] }
    val errorsRaw = json["errors"]
    if (errorsRaw is List<*>) {
        val firstError = errorsRaw.firstOrNull()
        if (firstError is Map<*, *>) {
            val errorMap = firstError as Map<String, Any?>
            // Recursively extract from first error
            return extractIapkitErrorMessage(errorMap)
        }
    }

    // Try to get details.originalError (deepest level)
    val detailsRaw = json["details"]
    if (detailsRaw is Map<*, *>) {
        val details = detailsRaw as Map<String, Any?>
        val originalError = details["originalError"]
        if (originalError is String) {
            // originalError might be a JSON string, try to parse it
            return try {
                val nested = gson.fromJson(originalError, Map::class.java) as? Map<String, Any?>
                if (nested != null) {
                    extractIapkitErrorMessage(nested) ?: originalError
                } else {
                    originalError
                }
            } catch (e: Exception) {
                // Not JSON, use as-is
                originalError
            }
        }
    }

    // Try message field, but avoid the verbose nested JSON string
    val message = json["message"] as? String
    if (message != null && !message.contains("{\"error\"")) {
        return message
    }

    // Fallback to error code
    return json["error"] as? String
}
