package io.github.hyochan.kmpiap.openiap

import kotlinx.coroutines.flow.Flow

/**
 * Bearer-authenticated SSE transport for the openiap kit webhook stream.
 * Hosted IAPKit requires a secret admin key for this project-wide stream, so
 * never instantiate this transport in a shipped app. It calls
 * `GET /v1/webhooks/stream` with Bearer authentication.
 *
 * The common surface is a Flow<WebhookEvent> driven by an internal SSE reader;
 * concrete transports live in androidMain / iosMain / jvmMain to plug in the
 * platform's HTTP client (HttpURLConnection on Android and JVM, NSURLSession
 * via cinterop for iOS).
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
 *
 * Hosted IAPKit now restricts the project-wide stream to secret admin keys.
 * Never call this helper from a shipped app or pass it a publishable key. It
 * calls `GET /v1/webhooks/stream` with the secret in the Authorization header.
 */
fun connectWebhookStream(
    apiKey: String,
    baseUrl: String = "https://kit.openiap.dev",
): WebhookTransport = WebhookTransport(apiKey, baseUrl)
