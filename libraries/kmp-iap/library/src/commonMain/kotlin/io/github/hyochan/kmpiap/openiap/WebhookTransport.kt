package io.github.hyochan.kmpiap.openiap

import kotlinx.coroutines.flow.Flow

/**
 * Per-target SSE transport for the openiap kit webhook stream. The
 * common surface is a Flow<WebhookEvent> driven by an internal SSE
 * reader; concrete transports live in androidMain / iosMain / jvmMain
 * to plug in the platform's HTTP client (HttpURLConnection on Android
 * and JVM, NSURLSession via cinterop for iOS).
 *
 * Reconnect: implementations should resubscribe on transport errors
 * with a 2-second back-off, honoring the optional `lastEventId` the
 * caller saved on the previous emission. The Flow surface itself is
 * cold — collecting starts the connection, cancelling the collector
 * tears it down.
 */
expect class WebhookTransport(
    apiKey: String,
    baseUrl: String = "https://kit.openiap.dev",
) {
    /**
     * Cold flow that emits one [WebhookEvent] per SSE `data:` frame.
     * Subscribers may pass the `id` of the last received event into
     * [lastEventId] on a subsequent invocation to resume from there.
     */
    fun events(lastEventId: String? = null): Flow<WebhookEvent>

    /**
     * Releases any underlying connection resources owned by this
     * transport instance. Calling [events] after [close] returns an
     * empty flow.
     */
    fun close()
}

/**
 * Convenience factory so call sites read like the JS / Dart APIs:
 *
 *   val flow = connectWebhookStream(apiKey = "...").events()
 */
fun connectWebhookStream(
    apiKey: String,
    baseUrl: String = "https://kit.openiap.dev",
): WebhookTransport = WebhookTransport(apiKey, baseUrl)
