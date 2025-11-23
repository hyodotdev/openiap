package dev.hyo.openiap.utils

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken
import dev.hyo.openiap.IapkitEnvironment
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

private const val VALIDATION_BASE_URL =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
private const val DEFAULT_IAPKIT_ENDPOINT = "https://api.iapkit.com/v1/purchase/verify"
private val gson = Gson()

private fun openConnection(url: String): HttpURLConnection {
    return URL(url).openConnection() as HttpURLConnection
}

suspend fun validateReceiptWithGooglePlay(
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
    val url =
        "$VALIDATION_BASE_URL/${options.packageName}/purchases/$typeSegment/${props.sku}/tokens/${options.productToken}"

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
            throw OpenIapError.InvalidReceipt
        }

        try {
            gson.fromJson(responseBody, VerifyPurchaseResultAndroid::class.java)
                ?: throw OpenIapError.InvalidReceipt
        } catch (jsonError: JsonSyntaxException) {
            OpenIapLog.warn("Failed to parse receipt validation response: ${jsonError.message}", tag)
            throw OpenIapError.InvalidReceipt
        }
    } catch (io: IOException) {
        OpenIapLog.warn("Network error during receipt validation: ${io.message}", tag)
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

    val requests: List<Pair<IapkitStore, Map<String, Any?>>> = run {
        val store = props.store ?: IapkitStore.Google
        if (store != IapkitStore.Google) {
            throw IllegalArgumentException("IAPKit verification on Android requires Google payload")
        }
        listOf(store to buildPayload(props, store))
    }

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
            connection.outputStream.use { stream ->
                stream.write(body.toByteArray())
            }

            val statusCode = connection.responseCode
            val responseBody = (if (statusCode in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()
                ?.use { it.readText() }
                .orElse("")

            if (statusCode !in 200..299) {
                OpenIapLog.warn("verifyPurchaseWithProvider failed (HTTP $statusCode) [$store]: $responseBody", tag)
                throw OpenIapError.InvalidReceipt
            }

            try {
                val mapType = object : TypeToken<Map<String, Any?>>() {}.type
                val parsed = gson.fromJson<Map<String, Any?>>(responseBody, mapType)
                RequestVerifyPurchaseWithIapkitResult.fromJson(parsed)
            } catch (jsonError: Exception) {
                OpenIapLog.warn("Failed to parse IAPKit verification response: ${jsonError.message}", tag)
                throw OpenIapError.InvalidReceipt
            }
        } catch (io: IOException) {
            OpenIapLog.warn("Network error during IAPKit verification: ${io.message}", tag)
            throw OpenIapError.NetworkError
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
            if (
                google.packageName.isBlank() ||
                google.purchaseId.isBlank() ||
                google.purchaseToken.isBlank()
            ) {
                throw IllegalArgumentException(
                    "IAPKit Google verification requires packageName, purchaseId, and purchaseToken"
                )
            }
            mutableMapOf<String, Any?>(
                "store" to store.toJson(),
                "packageName" to google.packageName,
                "purchaseId" to google.purchaseId,
                "purchaseToken" to google.purchaseToken
            )
        }
        else -> throw IllegalArgumentException("IAPKit verification on Android supports Google payloads only")
    }
}

private fun String?.orElse(fallback: String): String = this ?: fallback
