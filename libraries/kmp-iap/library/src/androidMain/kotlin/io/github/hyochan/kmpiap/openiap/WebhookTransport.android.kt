package io.github.hyochan.kmpiap.openiap

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * androidMain SSE transport. Built on `HttpURLConnection` rather than
 * OkHttp so the module ships without an extra runtime dep — every
 * Android API level since 21 has a robust HUC implementation, and
 * Convex / Apple / Google's SSE responses use chunked transfer with
 * plain UTF-8 text which HUC handles fine.
 *
 * Reconnect strategy: collectors get an indefinite stream that
 * reconnects with `Last-Event-ID` after a 2-second delay on transport
 * errors. The collector cancels the underlying read by closing the
 * scope.
 */
actual class WebhookTransport actual constructor(
    private val apiKey: String,
    private val baseUrl: String,
) {
    @Volatile private var closed: Boolean = false
    @Volatile private var activeConnection: HttpURLConnection? = null

    actual fun events(lastEventId: String?): Flow<WebhookEvent> = flow {
        var resumeId: String? = lastEventId
        while (!closed) {
            val url = URL(webhookStreamUrl(baseUrl, apiKey))
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "text/event-stream")
                setRequestProperty("Cache-Control", "no-cache")
                if (resumeId != null) {
                    setRequestProperty("Last-Event-ID", resumeId)
                }
                connectTimeout = 30_000
                readTimeout = 0 // SSE is long-lived; no read timeout
                doInput = true
            }
            activeConnection = connection
            try {
                connection.connect()
                if (connection.responseCode !in 200..299) {
                    throw IllegalStateException(
                        "SSE connect returned ${connection.responseCode}",
                    )
                }
                val reader = BufferedReader(
                    InputStreamReader(connection.inputStream, Charsets.UTF_8),
                )
                val frameLines = StringBuilder()
                while (!closed) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) {
                        val frame = frameLines.toString()
                        frameLines.clear()
                        val parsed = parseSseFrame(frame)
                        // Cursor advancement rules:
                        //   - Successful parse + emit → advance, so a
                        //     reconnect doesn't redeliver an event the
                        //     consumer already saw.
                        //   - Parse failed AND the frame carried an
                        //     eventId → still advance. Otherwise the
                        //     reconnect re-fetches the same poison-pill
                        //     forever and newer events are blocked
                        //     behind it. iOS already does this; the
                        //     Android branch was missing the cursor
                        //     bump on parse-null and could stall.
                        //   - Heartbeat / ready / parse-null without
                        //     an eventId → don't touch resumeId
                        //     (those frames never carry an id from the
                        //     server anyway).
                        val event = parsed.event
                        if (event != null) {
                            emit(event)
                            parsed.eventId?.let { resumeId = it }
                        } else if (parsed.shouldAdvanceCursorOnDrop) {
                            parsed.eventId?.let { resumeId = it }
                        }
                        continue
                    }
                    frameLines.append(line).append('\n')
                }
            } catch (error: Throwable) {
                if (closed) break
                // fall through to the back-off + reconnect.
            } finally {
                runCatching { connection.disconnect() }
                activeConnection = null
            }
            if (closed) break
            delay(2_000)
        }
    }.flowOn(Dispatchers.IO)

    actual fun close() {
        closed = true
        runCatching { activeConnection?.disconnect() }
        activeConnection = null
    }
}

private data class ParsedSseFrame(
    val eventId: String?,
    val eventType: String?,
    val event: WebhookEvent?,
    // True when the frame carried an eventId AND parsing failed,
    // signaling the caller to advance the reconnect cursor anyway so
    // the malformed payload doesn't block all future events behind a
    // poison-pill replay.
    val shouldAdvanceCursorOnDrop: Boolean = false,
)

private fun parseSseFrame(frame: String): ParsedSseFrame {
    if (frame.isEmpty()) return ParsedSseFrame(null, null, null)
    var eventId: String? = null
    var eventType: String? = null
    val data = StringBuilder()
    for (rawLine in frame.split('\n')) {
        val stripped = rawLine.trimEnd('\r')
        if (stripped.startsWith(":")) continue // comment
        val colon = stripped.indexOf(':')
        if (colon < 0) continue
        val field = stripped.substring(0, colon)
        var value = stripped.substring(colon + 1)
        if (value.startsWith(" ")) value = value.substring(1)
        when (field) {
            "id" -> eventId = value
            "event" -> eventType = value
            "data" -> {
                if (data.isNotEmpty()) data.append('\n')
                data.append(value)
            }
        }
    }
    if (eventType == "heartbeat" || eventType == "ready" || data.isEmpty()) {
        return ParsedSseFrame(eventId, eventType, null)
    }
    val event = WebhookEventParser.parse(data.toString())
    return ParsedSseFrame(
        eventId = eventId,
        eventType = eventType,
        event = event,
        shouldAdvanceCursorOnDrop = event == null && eventId != null,
    )
}
