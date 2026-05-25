package dev.hyo.openiap.utils

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult
import dev.hyo.openiap.VerifyPurchaseProps
import dev.hyo.openiap.VerifyPurchaseResultAndroid
import dev.hyo.openiap.VerifyPurchaseResultHorizon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private const val DEFAULT_IAPKIT_ENDPOINT = "https://kit.openiap.dev/v1/purchase/verify"
private val gson = Gson()

private fun openConnection(url: String): HttpURLConnection {
    return URL(url).openConnection() as HttpURLConnection
}

private fun encodePathSegment(value: String): String =
    URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

suspend fun verifyPurchaseWithGooglePlay(
    props: VerifyPurchaseProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): VerifyPurchaseResultAndroid = withContext(Dispatchers.IO) {
    val googleOptions = props.google
        ?: throw IllegalArgumentException(
            "Google Play validation requires google options (packageName, purchaseToken, accessToken)"
        )

    val packageName = googleOptions.packageName
    val purchaseToken = googleOptions.purchaseToken
    val accessToken = googleOptions.accessToken
    val isSub = googleOptions.isSub

    if (packageName.isBlank() || purchaseToken.isBlank() || accessToken.isBlank()) {
        throw IllegalArgumentException(
            "Google Play validation requires packageName, purchaseToken, and accessToken"
        )
    }

    val sku = googleOptions.sku
    val typeSegment = if (isSub == true) "subscriptions" else "products"
    val baseUrl = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
    val url = "$baseUrl/${encodePathSegment(packageName)}/purchases/$typeSegment/" +
        "${encodePathSegment(sku)}/tokens/${encodePathSegment(purchaseToken)}"

    val connection = connectionFactory(url).apply {
        requestMethod = "GET"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $accessToken")
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

/**
 * Verify purchase with Meta Horizon S2S API.
 * POST https://graph.oculus.com/$APP_ID/verify_entitlement
 */
suspend fun verifyPurchaseWithHorizon(
    props: VerifyPurchaseProps,
    appId: String,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): VerifyPurchaseResultHorizon = withContext(Dispatchers.IO) {
    val horizonOptions = props.horizon
        ?: throw IllegalArgumentException(
            "Horizon validation requires horizon options (sku, userId, accessToken)"
        )

    if (horizonOptions.sku.isBlank() || horizonOptions.userId.isBlank() || horizonOptions.accessToken.isBlank()) {
        throw IllegalArgumentException(
            "Horizon validation requires sku, userId, and accessToken"
        )
    }

    val url = "https://graph.oculus.com/$appId/verify_entitlement"

    val connection = connectionFactory(url).apply {
        requestMethod = "POST"
        doOutput = true
        setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
    }

    try {
        // Build form data
        val formData = buildString {
            append("access_token=${java.net.URLEncoder.encode(horizonOptions.accessToken, "UTF-8")}")
            append("&user_id=${java.net.URLEncoder.encode(horizonOptions.userId, "UTF-8")}")
            append("&sku=${java.net.URLEncoder.encode(horizonOptions.sku, "UTF-8")}")
        }

        connection.outputStream.use { stream ->
            stream.write(formData.toByteArray(Charsets.UTF_8))
        }

        val statusCode = connection.responseCode
        val responseBody = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()
            ?.use { it.readText() }
            .orElse("")

        if (statusCode !in 200..299) {
            OpenIapLog.warn("Horizon verifyPurchase failed (HTTP $statusCode)", tag)
            throw OpenIapError.InvalidPurchaseVerification
        }

        try {
            // Response: {"success":true,"grant_time":1744148687}
            val mapType = object : TypeToken<Map<String, Any?>>() {}.type
            val parsed = gson.fromJson<Map<String, Any?>>(responseBody, mapType)
            val success = parsed["success"] as? Boolean ?: false
            val grantTime = (parsed["grant_time"] as? Number)?.toDouble()

            VerifyPurchaseResultHorizon(
                grantTime = grantTime,
                success = success
            )
        } catch (jsonError: JsonSyntaxException) {
            OpenIapLog.warn("Failed to parse Horizon verification response: ${jsonError.message}", tag)
            throw OpenIapError.InvalidPurchaseVerification
        }
    } catch (io: IOException) {
        OpenIapLog.warn("Network error during Horizon verification: ${io.message}", tag)
        throw OpenIapError.NetworkError
    } finally {
        connection.disconnect()
    }
}

suspend fun verifyPurchaseWithIapkit(
    props: RequestVerifyPurchaseWithIapkitProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): RequestVerifyPurchaseWithIapkitResult = withContext(Dispatchers.IO) {
    fun malformedIapkitResponse(): OpenIapError.PurchaseVerificationFailed =
        OpenIapError.PurchaseVerificationFailed("IAPKit returned malformed response")

    val endpoint = DEFAULT_IAPKIT_ENDPOINT

    val hasApple = props.apple != null
    val hasGoogle = props.google != null
    val hasAmazon = props.amazon != null
    if (listOf(hasApple, hasGoogle, hasAmazon).count { it } != 1 || hasApple) {
        throw IllegalArgumentException(
            "IAPKit verification on Android requires exactly one google or amazon payload"
        )
    }

    fun buildGooglePayload(): Map<String, Any?> {
        val google = props.google
            ?: throw IllegalArgumentException("IAPKit Google verification requires google options")
        if (google.purchaseToken.isBlank()) {
            throw IllegalArgumentException("IAPKit Google verification requires purchaseToken")
        }
        return mutableMapOf<String, Any?>(
            "store" to IapStore.Google.rawValue,
            "purchaseToken" to google.purchaseToken
        )
    }

    fun buildAmazonPayload(): Map<String, Any?> {
        val amazon = props.amazon
            ?: throw IllegalArgumentException("IAPKit Amazon verification requires amazon options")
        val userId = amazon.userId?.trim().orEmpty()
        val receiptId = amazon.receiptId.trim()
        if (userId.isBlank() || receiptId.isBlank()) {
            throw IllegalArgumentException("IAPKit Amazon verification requires userId and receiptId")
        }
        return mutableMapOf<String, Any?>(
            "store" to IapStore.Amazon.rawValue,
            "userId" to userId,
            "receiptId" to receiptId
        ).apply {
            amazon.sandbox?.let { put("sandbox", it) }
        }
    }

    @Suppress("UNCHECKED_CAST")
    fun extractIapkitErrorMessage(json: Map<String, Any?>): String? {
        fun extractStringMessage(value: String): String {
            return try {
                val nested = gson.fromJson(value, Map::class.java) as? Map<String, Any?>
                if (nested != null) {
                    extractIapkitErrorMessage(nested) ?: value
                } else {
                    value
                }
            } catch (e: Exception) {
                value
            }
        }

        val errorsRaw = json["errors"]
        if (errorsRaw is List<*>) {
            val firstError = errorsRaw.firstOrNull()
            if (firstError is Map<*, *>) {
                return extractIapkitErrorMessage(firstError as Map<String, Any?>)
            }
        }

        val detailsRaw = json["details"]
        if (detailsRaw is Map<*, *>) {
            val details = detailsRaw as Map<String, Any?>
            val originalError = details["originalError"]
            if (originalError is String) {
                return extractStringMessage(originalError)
            }
        }

        val message = json["message"] as? String
        if (message != null) {
            return extractStringMessage(message)
        }

        val error = json["error"] as? String
        if (error != null) {
            return extractStringMessage(error)
        }

        return null
    }

    val store = if (hasAmazon) IapStore.Amazon else IapStore.Google
    val payload = when (store) {
        IapStore.Amazon -> buildAmazonPayload()
        IapStore.Google -> buildGooglePayload()
        else -> throw IllegalArgumentException("IAPKit verification on Android does not support ${store.rawValue}")
    }

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
        val mapType = object : TypeToken<Map<String, Any?>>() {}.type

        fun parseIapkitObject(responseBody: String): Map<String, Any?> {
            return try {
                gson.fromJson<Map<String, Any?>>(responseBody, mapType)
                    ?: throw malformedIapkitResponse()
            } catch (error: JsonSyntaxException) {
                OpenIapLog.warn("Failed to parse IAPKit verification response: ${error.message}", tag)
                throw OpenIapError.PurchaseVerificationFailed("Failed to parse response")
            }
        }

        fun readIapkitResult(parsed: Map<String, Any?>): RequestVerifyPurchaseWithIapkitResult {
            val errorsRaw = parsed["errors"]
            if (errorsRaw is List<*> && errorsRaw.isNotEmpty()) {
                val errorMessage = extractIapkitErrorMessage(parsed) ?: "IAPKit verification failed"
                throw OpenIapError.PurchaseVerificationFailed(errorMessage)
            }

            val isValid = parsed["isValid"] as? Boolean
                ?: throw malformedIapkitResponse()
            val state = parsed["state"] as? String
                ?: throw malformedIapkitResponse()
            val responseStore = (parsed["store"] as? String)
                ?.let { runCatching { IapStore.fromJson(it) }.getOrNull() }
                ?: throw malformedIapkitResponse()
            if (responseStore != store) {
                throw malformedIapkitResponse()
            }

            val normalizedState = state.lowercase().replace("_", "-")
            val parsedState = runCatching {
                IapkitPurchaseState.fromJson(normalizedState)
            }.getOrDefault(IapkitPurchaseState.Unknown)

            return RequestVerifyPurchaseWithIapkitResult(
                isValid = isValid,
                state = parsedState,
                store = responseStore
            )
        }

        connection.outputStream.use { stream ->
            stream.write(body.toByteArray(Charsets.UTF_8))
        }

        val statusCode = connection.responseCode
        val responseBody = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
            ?.bufferedReader()
            ?.use { it.readText() }
            .orElse("")

        if (statusCode !in 200..299) {
            OpenIapLog.warn("verifyPurchaseWithProvider failed (HTTP $statusCode) [$store]", tag)
            // Extract concise error message from IAPKit response
            // IAPKit returns nested error format - extract the deepest originalError
            val errorMessage = try {
                val errorJson = gson.fromJson<Map<String, Any?>>(responseBody, mapType)
                extractIapkitErrorMessage(errorJson) ?: "HTTP $statusCode"
            } catch (e: Exception) {
                "HTTP $statusCode"
            }
            throw OpenIapError.PurchaseVerificationFailed(errorMessage)
        }

        readIapkitResult(parseIapkitObject(responseBody))
    } catch (io: IOException) {
        OpenIapLog.warn("Network error during IAPKit verification: ${io.message}", tag)
        throw OpenIapError.NetworkError
    } finally {
        connection.disconnect()
    }
}

private fun String?.orElse(fallback: String): String = this ?: fallback
