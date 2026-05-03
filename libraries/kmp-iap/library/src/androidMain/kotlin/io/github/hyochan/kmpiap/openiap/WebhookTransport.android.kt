package io.github.hyochan.kmpiap.openiap

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.job
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

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
    // Track every in-flight connection so close() can disconnect ALL
    // of them — the prior single-slot `activeConnection` was overwritten
    // when a second collector subscribed, and close() then leaked the
    // first collector's socket. Synchronized via the connections set's
    // own monitor.
    private val activeConnections = mutableSetOf<HttpURLConnection>()
    // Single-collector enforcement guard. The transport contract
    // (commonMain WebhookTransport.kt) is one-collector-per-instance,
    // and concurrent collectors would step on each other's
    // Last-Event-ID cursor + double-process the same backlog.
    // AtomicBoolean so the check + set is race-free under concurrent
    // events() calls.
    private val collecting = AtomicBoolean(false)

    actual fun events(lastEventId: String?): Flow<WebhookEvent> = flow {
        if (!collecting.compareAndSet(false, true)) {
            throw IllegalStateException(
                "WebhookTransport.events() is single-collector — close the existing collection first.",
            )
        }
        // Per-collector connection-cleanup hook. When the collector's
        // coroutine cancels (job.cancel()), invoke disconnect() on
        // whatever connection is currently active so the blocking
        // input.read() unblocks via SocketException instead of waiting
        // out the 60s read timeout.
        var localConnection: HttpURLConnection? = null
        val cancelHandle = currentCoroutineContext().job.invokeOnCompletion {
            runCatching { localConnection?.disconnect() }
        }
        var resumeId: String? = lastEventId
        try {
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
                // 60s read timeout — long enough for the kit's 25s
                // heartbeat to keep the connection alive under
                // healthy conditions, but tight enough that a half-
                // open TCP state (NAT timeout, dropped Wi-Fi) trips a
                // SocketTimeoutException quickly so the reconnect
                // back-off can kick in. The previous value of 0
                // disabled the timeout entirely, which left dead
                // connections wedged until the OS cleared them.
                readTimeout = 60_000
                doInput = true
            }
            localConnection = connection
            synchronized(activeConnections) { activeConnections.add(connection) }
            try {
                connection.connect()
                if (connection.responseCode !in 200..299) {
                    val code = connection.responseCode
                    // 4xx (401 INVALID_API_KEY / 412 *_NOT_CONFIGURED)
                    // will never succeed on retry — flip closed so
                    // the outer reconnect loop exits cleanly. 5xx
                    // falls through to the normal back-off.
                    if (code in 400..499) {
                        closed = true
                    }
                    throw IllegalStateException(
                        "SSE connect returned $code",
                    )
                }
                // Byte-level frame buffer. WHATWG SSE accepts CR, LF,
                // or CRLF as a line terminator, and a frame separator
                // is any two consecutive terminators (including mixed
                // forms like \r\n\r, \r\r, \n\r\n). The previous
                // BufferedReader.readLine() approach was platform-line-
                // ending dependent and silently dropped frames from
                // CR-only servers. Operating on raw bytes here matches
                // the iOS / Flutter / Godot transports.
                val input: InputStream = connection.inputStream
                val buf = ByteArray(8 * 1024)
                val pending = ByteArrayBuilder()
                while (!closed) {
                    // Coop-cancellation check before each blocking
                    // read. Without this the loop only notices
                    // cancellation at emit() / delay() — a heartbeat-
                    // only stream could sit inside input.read() for
                    // up to readTimeout (60s) after the collector
                    // cancelled. The invokeOnCompletion above also
                    // disconnects the underlying socket, which forces
                    // the read to throw, but ensureActive() makes the
                    // coroutine cooperate as soon as it has a
                    // suspension opportunity.
                    currentCoroutineContext().ensureActive()
                    val n = input.read(buf)
                    if (n == -1) break
                    if (n == 0) continue
                    pending.append(buf, 0, n)
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val boundary =
                            findFirstFrameBoundary(pending.bytes, pending.size)
                        if (boundary == null) break
                        // boundary.end = byte offset just past the
                        // trailing terminator pair; bodyLen = bytes
                        // before that pair (the parseable body).
                        val bodyLen = boundary.end - boundary.pairLength
                        val body = String(
                            pending.bytes,
                            0,
                            bodyLen,
                            Charsets.UTF_8,
                        )
                        pending.dropFirst(boundary.end)
                        val parsed = parseSseFrame(body)
                        // Cursor advancement rules:
                        //   - Successful parse + emit → advance, so a
                        //     reconnect doesn't redeliver an event the
                        //     consumer already saw.
                        //   - Parse failed AND the frame carried an
                        //     eventId → still advance (poison-pill
                        //     prevention).
                        //   - Heartbeat / ready / parse-null without
                        //     an eventId → don't touch resumeId.
                        val event = parsed.event
                        if (event != null) {
                            // Wrap emit so a downstream collector
                            // exception isn't accidentally caught by
                            // the outer transport-error handler — a
                            // consumer that throws should propagate
                            // upstream as-is, not silently trigger a
                            // reconnect that risks redelivering the
                            // same event to a now-broken collector.
                            try {
                                emit(event)
                            } catch (cancellation: CancellationException) {
                                throw cancellation
                            } catch (consumerError: Throwable) {
                                throw EmitError(consumerError)
                            }
                            parsed.eventId?.let { resumeId = it }
                        } else if (parsed.shouldAdvanceCursorOnDrop) {
                            parsed.eventId?.let { resumeId = it }
                        }
                    }
                }
            } catch (cancellation: CancellationException) {
                // Coroutine cancellation must propagate so the
                // collector can tear down — wrapping it in the
                // generic Throwable catch below would treat the
                // cancellation as a transient transport error and
                // re-enter the retry loop. Re-throw before any
                // back-off / reconnect logic runs.
                throw cancellation
            } catch (emitError: EmitError) {
                // Downstream collector failed — surface the original
                // exception to the caller instead of treating it as a
                // transient transport error and reconnecting.
                throw emitError.cause ?: emitError
            } catch (error: Throwable) {
                if (closed) break
                // fall through to the back-off + reconnect.
            } finally {
                runCatching { connection.disconnect() }
                synchronized(activeConnections) {
                    activeConnections.remove(connection)
                }
                if (localConnection === connection) {
                    localConnection = null
                }
            }
            if (closed) break
            delay(2_000)
        }
        } finally {
            // Always release the cancel handle + collector slot, even
            // if the loop exits via an unexpected throw. Without
            // releasing collecting, a follow-up events() call on the
            // same transport would never get past the AtomicBoolean
            // guard.
            cancelHandle.dispose()
            collecting.set(false)
        }
    }.flowOn(Dispatchers.IO)

    actual fun close() {
        closed = true
        // Disconnect every in-flight connection. Multiple collectors
        // can share the same transport instance during transient
        // teardown windows (old collector still draining, new one
        // booting), and the prior single-slot field overwrote the
        // first connection on the second collector's create — leaking
        // the first socket until OS GC. Snapshot under the monitor so
        // a concurrent insert in events() can't race with the iterate.
        val snapshot: List<HttpURLConnection> =
            synchronized(activeConnections) { activeConnections.toList() }
        for (conn in snapshot) {
            runCatching { conn.disconnect() }
        }
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

private val SSE_LINE_SEPARATOR = Regex("\\r\\n|\\r|\\n")

// Sentinel wrapper for exceptions thrown by the downstream collector
// (`emit(event)`). The transport-error catch clause treats network
// I/O failures as transient and reconnects, but a consumer-side
// exception should propagate to the caller as-is.
private class EmitError(cause: Throwable) : Throwable(cause)

private fun parseSseFrame(frame: String): ParsedSseFrame {
    if (frame.isEmpty()) return ParsedSseFrame(null, null, null)
    var eventId: String? = null
    var eventType: String? = null
    val data = StringBuilder()
    // Per WHATWG SSE spec, a line within a frame can be terminated
    // by CR, LF, or CRLF. Splitting only on '\n' would mis-parse
    // CR-only servers (rare but spec-allowed) — fields like `id` and
    // `event` would silently merge into one giant `id` value.
    for (rawLine in frame.split(SSE_LINE_SEPARATOR)) {
        val stripped = rawLine
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

// Minimal growable byte buffer. Avoids the per-byte boxing of
// ArrayDeque<Byte> for SSE traffic that can run hundreds of KB/s
// during backlog drains.
private class ByteArrayBuilder(initialCapacity: Int = 16 * 1024) {
    var bytes: ByteArray = ByteArray(initialCapacity)
        private set
    var size: Int = 0
        private set

    fun append(src: ByteArray, offset: Int, len: Int) {
        ensureCapacity(size + len)
        System.arraycopy(src, offset, bytes, size, len)
        size += len
    }

    /**
     * Drops the first [count] bytes; the remaining tail shifts down
     * to offset 0. No allocation.
     */
    fun dropFirst(count: Int) {
        if (count >= size) {
            size = 0
            return
        }
        System.arraycopy(bytes, count, bytes, 0, size - count)
        size -= count
    }

    private fun ensureCapacity(min: Int) {
        if (bytes.size >= min) return
        var next = bytes.size * 2
        while (next < min) next *= 2
        bytes = bytes.copyOf(next)
    }
}

// Length (1 or 2) of the line terminator starting at [idx], or 0 if
// the byte at [idx] isn't a terminator. CRLF takes precedence so
// `\r\n` is reported as 2, not 1+1. Per WHATWG SSE spec.
private fun terminatorLength(buf: ByteArray, idx: Int, end: Int): Int {
    if (idx >= end) return 0
    val b = buf[idx]
    if (b == 0x0D.toByte() && idx + 1 < end && buf[idx + 1] == 0x0A.toByte()) {
        return 2
    }
    if (b == 0x0A.toByte() || b == 0x0D.toByte()) return 1
    return 0
}

// Result of a successful frame-boundary scan. `end` is the byte
// offset just past the trailing terminator pair; `pairLength` is the
// total length of that pair (sum of both terminator lengths) so the
// caller can subtract it to get the parseable body length.
private data class FrameBoundary(val end: Int, val pairLength: Int)

// Returns the FIRST complete frame separator (two consecutive line
// terminators) within [0, length), or null when no complete frame
// has arrived yet. Operates on raw bytes so a multi-byte UTF-8
// character in the tail can never produce a false match — 0x0A and
// 0x0D never appear inside the body of a multi-byte UTF-8 codepoint.
private fun findFirstFrameBoundary(buf: ByteArray, length: Int): FrameBoundary? {
    var i = 0
    while (i < length) {
        val firstLen = terminatorLength(buf, i, length)
        if (firstLen == 0) {
            i += 1
            continue
        }
        val secondLen = terminatorLength(buf, i + firstLen, length)
        if (secondLen == 0) {
            i += firstLen
            continue
        }
        return FrameBoundary(end = i + firstLen + secondLen, pairLength = firstLen + secondLen)
    }
    return null
}
