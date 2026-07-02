package dev.hyo.martie.screens

import kotlinx.cinterop.BetaInteropApi
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.CoreFoundation.CFAbsoluteTimeGetCurrent
import platform.Foundation.NSError
import platform.Foundation.NSHTTPURLResponse
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSString
import platform.Foundation.NSURL
import platform.Foundation.NSURLResponse
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration
import platform.Foundation.NSURLSessionDataDelegateProtocol
import platform.Foundation.NSURLSessionDataTask
import platform.Foundation.NSURLSessionResponseAllow
import platform.Foundation.NSURLSessionResponseCancel
import platform.Foundation.NSURLSessionResponseDisposition
import platform.Foundation.NSURLSessionTask
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Foundation.setHTTPBody
import platform.Foundation.setHTTPMethod
import platform.Foundation.setValue
import platform.darwin.NSObject
import kotlin.coroutines.resume

private const val CF_ABSOLUTE_TIME_UNIX_EPOCH_OFFSET_SECONDS = 978_307_200.0

internal actual fun currentTimeMillis(): Long =
    ((CFAbsoluteTimeGetCurrent() + CF_ABSOLUTE_TIME_UNIX_EPOCH_OFFSET_SECONDS) * 1000).toLong()

@OptIn(BetaInteropApi::class)
internal actual suspend fun triggerWebhookTestNotification(
    apiKey: String,
    baseUrl: String,
): Result<Unit> = suspendCancellableCoroutine { continuation ->
    if (apiKey.isEmpty()) {
        continuation.resume(Result.failure(IllegalStateException("IAPKIT_API_KEY is not configured.")))
        return@suspendCancellableCoroutine
    }

    val url = NSURL.URLWithString(webhookTestNotificationUrl(baseUrl, apiKey)) ?: run {
        continuation.resume(Result.failure(IllegalStateException("Invalid webhook URL.")))
        return@suspendCancellableCoroutine
    }
    val request = NSMutableURLRequest.requestWithURL(url)
    request.setHTTPMethod("POST")
    request.setValue("application/json", forHTTPHeaderField = "Content-Type")
    val body = NSString
        .create(string = buildWebhookTestNotificationPayload("kmp-ios"))
        .dataUsingEncoding(NSUTF8StringEncoding)
    request.setHTTPBody(body)

    val delegate = WebhookTestNotificationDelegate(continuation)
    val session = NSURLSession.sessionWithConfiguration(
        NSURLSessionConfiguration.defaultSessionConfiguration(),
        delegate,
        null,
    )
    val task = session.dataTaskWithRequest(request)
    continuation.invokeOnCancellation {
        task.cancel()
        session.invalidateAndCancel()
    }
    task.resume()
}

private class WebhookTestNotificationDelegate(
    private val continuation: CancellableContinuation<Result<Unit>>,
) : NSObject(), NSURLSessionDataDelegateProtocol {
    private var statusCode = 0
    private var didResume = false

    override fun URLSession(
        session: NSURLSession,
        dataTask: NSURLSessionDataTask,
        didReceiveResponse: NSURLResponse,
        completionHandler: (NSURLSessionResponseDisposition) -> Unit,
    ) {
        statusCode = (didReceiveResponse as? NSHTTPURLResponse)?.statusCode?.toInt() ?: 0
        if (statusCode in 200..299) {
            completionHandler(NSURLSessionResponseAllow)
        } else {
            completionHandler(NSURLSessionResponseCancel)
            dataTask.cancel()
            session.invalidateAndCancel()
            resumeOnce(Result.failure(IllegalStateException("Test POST returned $statusCode")))
        }
    }

    override fun URLSession(
        session: NSURLSession,
        task: NSURLSessionTask,
        didCompleteWithError: NSError?,
    ) {
        session.finishTasksAndInvalidate()
        if (didCompleteWithError != null) {
            resumeOnce(
                Result.failure(
                    IllegalStateException(didCompleteWithError.localizedDescription),
                ),
            )
        } else if (statusCode in 200..299) {
            resumeOnce(Result.success(Unit))
        } else {
            resumeOnce(Result.failure(IllegalStateException("Test POST returned $statusCode")))
        }
    }

    private fun resumeOnce(result: Result<Unit>) {
        if (didResume) return
        didResume = true
        continuation.resume(result)
    }
}
