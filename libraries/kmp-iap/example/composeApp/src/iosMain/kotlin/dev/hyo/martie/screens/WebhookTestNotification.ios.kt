package dev.hyo.martie.screens

import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSHTTPURLResponse
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSString
import platform.Foundation.NSURL
import platform.Foundation.NSURLSession
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.dataUsingEncoding
import platform.Foundation.setHTTPMethod
import platform.Foundation.setValue
import kotlin.coroutines.resume

internal actual suspend fun triggerWebhookTestNotification(
    apiKey: String,
    baseUrl: String,
): Result<Unit> = suspendCancellableCoroutine { continuation ->
    if (apiKey.isEmpty()) {
        continuation.resume(Result.failure(IllegalStateException("IAPKIT_API_KEY is not configured.")))
        return@suspendCancellableCoroutine
    }

    val url = NSURL(string = webhookTestNotificationUrl(baseUrl, apiKey))
    if (url == null) {
        continuation.resume(Result.failure(IllegalArgumentException("Invalid webhook URL.")))
        return@suspendCancellableCoroutine
    }

    val request = NSMutableURLRequest.requestWithURL(url) as NSMutableURLRequest
    request.setHTTPMethod("POST")
    request.setValue("application/json", forHTTPHeaderField = "Content-Type")
    request.HTTPBody = NSString
        .create(string = buildWebhookTestNotificationPayload("kmp-ios"))
        .dataUsingEncoding(NSUTF8StringEncoding)

    val task = NSURLSession.sharedSession.dataTaskWithRequest(request) { _, response, error ->
        if (error != null) {
            continuation.resume(
                Result.failure(
                    IllegalStateException(error.localizedDescription ?: "Network error"),
                ),
            )
            return@dataTaskWithRequest
        }
        val statusCode = (response as? NSHTTPURLResponse)?.statusCode?.toInt() ?: 0
        if (statusCode in 200..299) {
            continuation.resume(Result.success(Unit))
        } else {
            continuation.resume(Result.failure(IllegalStateException("Test POST returned $statusCode")))
        }
    }
    continuation.invokeOnCancellation { task.cancel() }
    task.resume()
}
