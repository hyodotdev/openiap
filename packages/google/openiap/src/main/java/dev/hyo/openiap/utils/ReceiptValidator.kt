package dev.hyo.openiap.utils

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.ReceiptValidationProps
import dev.hyo.openiap.ReceiptValidationResultAndroid
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

private const val VALIDATION_BASE_URL =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
private val gson = Gson()

private fun openConnection(url: String): HttpURLConnection {
    return URL(url).openConnection() as HttpURLConnection
}

suspend fun validateReceiptWithGooglePlay(
    props: ReceiptValidationProps,
    tag: String,
    connectionFactory: (String) -> HttpURLConnection = ::openConnection
): ReceiptValidationResultAndroid = withContext(Dispatchers.IO) {
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
            gson.fromJson(responseBody, ReceiptValidationResultAndroid::class.java)
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

private fun String?.orElse(fallback: String): String = this ?: fallback
