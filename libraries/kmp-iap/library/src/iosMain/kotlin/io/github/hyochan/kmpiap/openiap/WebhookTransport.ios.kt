package io.github.hyochan.kmpiap.openiap

import kotlin.concurrent.Volatile
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.get
import kotlinx.cinterop.reinterpret
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import platform.Foundation.NSData
import platform.Foundation.NSError
import platform.Foundation.NSHTTPURLResponse
import platform.Foundation.NSMakeRange
import platform.Foundation.NSMutableData
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSString
import platform.Foundation.NSURL
import platform.Foundation.appendData
import platform.Foundation.replaceBytesInRange
import platform.Foundation.subdataWithRange
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration
import platform.Foundation.NSURLSessionDataDelegateProtocol
import platform.Foundation.NSURLSessionDataTask
import platform.Foundation.NSURLSessionResponseAllow
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Foundation.setHTTPMethod
import platform.Foundation.setValue
import platform.darwin.NSObject
import platform.Foundation.NSUTF8StringEncoding

/**
 * iosMain SSE transport built on NSURLSession via cinterop. Mirrors
 * the androidMain shape — same `events(lastEventId)` flow surface,
 * same 2-second back-off reconnect.
 *
 * We deliberately do NOT use Ktor here so kmp-iap's runtime footprint
 * stays minimal. The cinterop API surface for NSURLSessionDataDelegate
 * is small (one bridging delegate, one per-task channel).
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
actual class WebhookTransport actual constructor(
    private val apiKey: String,
    private val baseUrl: String,
) {
    // Mark both shared-state fields volatile (multiplatform-aware
    // `kotlin.concurrent.Volatile`, not the JVM-only annotation) so
    // a write from `close()` on the host thread is visible to the
    // background `events()` reconnect loop on `Dispatchers.Default`.
    // Without this, Kotlin/Native's compiler + memory model allow
    // the loop to cache a stale `closed = false` and spin extra
    // iterations before noticing the close. Same concern for
    // `activeTask`, which `awaitClose` reads to cancel the in-
    // flight request.
    @Volatile private var closed: Boolean = false
    @Volatile private var activeTask: NSURLSessionDataTask? = null

    // Reconnect lifecycle is tied to the collector via callbackFlow:
    // when the collector cancels (or close() flips `closed`), awaitClose
    // cancels the in-flight NSURLSession task and the launch{} body
    // exits via the cancellation exception. The previous detached
    // CoroutineScope kept reconnecting in the background even after
    // every collector unsubscribed.
    actual fun events(lastEventId: String?): Flow<WebhookEvent> = callbackFlow {
        val job = launch {
            var resumeId = lastEventId
            var firstAttempt = true
            while (!closed) {
                // Always pause between attempts (after the first) — even
                // when `runOnce` returns true. NSURLSession completes the
                // task on EOF / server-side disconnect; without a pause
                // we'd reconnect in a tight loop the moment the kit pod
                // recycles. 2s matches the Flutter listener's cadence.
                if (!firstAttempt) {
                    delay(2_000)
                }
                firstAttempt = false
                runOnce(channel, resumeId) { id -> resumeId = id }
                if (closed) break
            }
            channel.close()
        }
        awaitClose {
            // Only cancel collector-scoped work here. The previous
            // `closed = true` flipped the instance-wide flag, so once
            // any collector cancelled, every subsequent events()
            // subscription on the same WebhookTransport returned
            // immediately (the launch{} body's `while (!closed)`
            // guard short-circuited). Explicit close() remains the
            // sole entry point for permanent shutdown.
            activeTask?.cancel()
            activeTask = null
            job.cancel()
        }
    }.flowOn(Dispatchers.Default)

    private suspend fun runOnce(
        channel: SendChannel<WebhookEvent>,
        lastEventId: String?,
        updateLastEventId: (String) -> Unit,
    ): Boolean = try {
        val url = NSURL(string = webhookStreamUrl(baseUrl, apiKey))
        // `NSURLRequest.requestWithURL` returns the immutable parent
        // type even when invoked on the mutable subclass companion, so
        // we cast to NSMutableURLRequest to expose the mutable setters.
        // Avoid `apply { }` so Kotlin resolves `setValue` to the ObjC
        // `setValue:forHTTPHeaderField:` selector rather than the
        // property-delegate operator.
        val request: NSMutableURLRequest =
            NSMutableURLRequest.requestWithURL(url) as NSMutableURLRequest
        request.setHTTPMethod("GET")
        request.setValue("text/event-stream", forHTTPHeaderField = "Accept")
        request.setValue("no-cache", forHTTPHeaderField = "Cache-Control")
        if (lastEventId != null) {
            request.setValue(lastEventId, forHTTPHeaderField = "Last-Event-ID")
        }
        val config = NSURLSessionConfiguration.defaultSessionConfiguration()
        // Buffer raw bytes — not a decoded String — so a multi-byte UTF-8
        // character split across two NSURLSession chunks doesn't get
        // dropped. `NSString.create(data:, encoding:)` returns null on
        // any incomplete UTF-8 sequence at the buffer tail, which would
        // silently lose the entire chunk including the head bytes.
        val byteBuffer = NSMutableData()
        val delegate = SseDelegate(channel, byteBuffer, updateLastEventId)
        val session = NSURLSession.sessionWithConfiguration(config, delegate, null)
        try {
            val task = session.dataTaskWithRequest(request)
            activeTask = task
            task.resume()
            delegate.awaitFinished()
            true
        } finally {
            // NSURLSession holds a strong reference to its delegate
            // (the SseDelegate above) until the session is invalidated.
            // Without this, every reconnect pass leaks the session +
            // delegate + buffered NSMutableData chain.
            session.finishTasksAndInvalidate()
        }
    } catch (error: Throwable) {
        false
    } finally {
        activeTask = null
    }

    actual fun close() {
        closed = true
        activeTask?.cancel()
        activeTask = null
    }
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private class SseDelegate(
    private val channel: SendChannel<WebhookEvent>,
    private val byteBuffer: NSMutableData,
    private val updateLastEventId: (String) -> Unit,
) : NSObject(), NSURLSessionDataDelegateProtocol {
    private val finishedSignal = Channel<Unit>(Channel.CONFLATED)

    // Validate the HTTP status before letting any body bytes flow.
    // Without this, a 4xx (bad apiKey, bundle mismatch) or 5xx
    // (kit pod restarting) just emits an empty body and the runOnce
    // loop silently retries — masking misconfiguration as a
    // transient transport blip. Mirrors the Android `responseCode
    // !in 200..299` guard. Allowing the response cancels the task
    // when status is non-2xx; the awaitFinished signal then
    // resolves and runOnce returns false → back-off + reconnect
    // applies the same way as a network drop.
    @Suppress("UNUSED_PARAMETER")
    override fun URLSession(
        session: NSURLSession,
        dataTask: NSURLSessionDataTask,
        didReceiveResponse: platform.Foundation.NSURLResponse,
        completionHandler: (platform.Foundation.NSURLSessionResponseDisposition) -> Unit,
    ) {
        val httpResponse = didReceiveResponse as? NSHTTPURLResponse
        val status = httpResponse?.statusCode?.toInt() ?: 0
        if (status in 200..299) {
            completionHandler(NSURLSessionResponseAllow)
        } else {
            // Cancel the task; awaitFinished will then unblock and
            // runOnce returns false, triggering the same back-off
            // reconnect path we use for network errors.
            dataTask.cancel()
            completionHandler(
                platform.Foundation.NSURLSessionResponseCancel,
            )
            finishedSignal.trySend(Unit)
        }
    }

    override fun URLSession(
        session: NSURLSession,
        dataTask: NSURLSessionDataTask,
        didReceiveData: NSData,
    ) {
        // Append the raw chunk to the running byte buffer. SSE frame
        // separators (`\n\n` / `\r\n\r\n`) are pure ASCII, so we can
        // safely scan for them at the byte level — even when the
        // surrounding data contains multi-byte UTF-8 characters.
        byteBuffer.appendData(didReceiveData)
        val totalLen = byteBuffer.length.toInt()
        if (totalLen < 2) return
        val bytesPtr = byteBuffer.bytes?.reinterpret<ByteVar>() ?: return
        val byteAt = { idx: Int -> bytesPtr[idx] }
        // Find the LAST complete frame boundary in the buffer. Anything
        // after it stays in the buffer for the next chunk — the tail
        // might end mid-multibyte-character, and we must not attempt
        // to decode it yet.
        val consumeUpTo = findLastFrameBoundary(byteAt, totalLen)
        if (consumeUpTo <= 0) return
        // Decode only the consumable prefix (bytes through the last
        // `\n\n` / `\r\n\r\n`) — guaranteed to be a complete UTF-8
        // sequence because the boundary is ASCII and the prior frame
        // body must have ended at a clean character boundary for the
        // server to have emitted the separator.
        val prefixRange = NSMakeRange(0u.toULong(), consumeUpTo.toULong())
        val prefixData = byteBuffer.subdataWithRange(prefixRange)
        val prefixNs =
            NSString.create(data = prefixData, encoding = NSUTF8StringEncoding)
        // Drop the consumed bytes from the head of the buffer regardless
        // of whether decode succeeded — if a server ever emits invalid
        // UTF-8, dropping the bad frame and keeping the trailing bytes
        // is preferable to looping on the same broken prefix forever.
        byteBuffer.replaceBytesInRange(
            range = prefixRange,
            withBytes = null,
            length = 0u.toULong(),
        )
        if (prefixNs == null) return
        var content = prefixNs.toString()
        while (true) {
            val sepIdx = content.indexOf("\n\n")
            val lfIdx = if (sepIdx >= 0) sepIdx else content.indexOf("\r\n\r\n")
            if (lfIdx < 0) break
            val sepLen = if (sepIdx >= 0) 2 else 4
            val frame = content.substring(0, lfIdx)
            content = content.substring(lfIdx + sepLen)
            processFrame(frame)
        }
    }

    // Scan for the last complete SSE frame separator (`\n\n` or
    // `\r\n\r\n`) and return the byte offset just past it (i.e. the
    // number of bytes safe to consume). Returns 0 when no complete
    // frame has arrived yet. Operates on raw bytes so a multi-byte
    // UTF-8 character in the tail can never produce a false match —
    // 0x0A and 0x0D never appear inside the body of a multi-byte
    // UTF-8 codepoint.
    private fun findLastFrameBoundary(byteAt: (Int) -> Byte, length: Int): Int {
        var lastEnd = 0
        var i = 0
        while (i < length - 1) {
            if (byteAt(i) == 0x0A.toByte() && byteAt(i + 1) == 0x0A.toByte()) {
                lastEnd = i + 2
                i += 2
                continue
            }
            if (
                i < length - 3 &&
                byteAt(i) == 0x0D.toByte() &&
                byteAt(i + 1) == 0x0A.toByte() &&
                byteAt(i + 2) == 0x0D.toByte() &&
                byteAt(i + 3) == 0x0A.toByte()
            ) {
                lastEnd = i + 4
                i += 4
                continue
            }
            i += 1
        }
        return lastEnd
    }

    override fun URLSession(
        session: NSURLSession,
        task: platform.Foundation.NSURLSessionTask,
        didCompleteWithError: NSError?,
    ) {
        finishedSignal.trySend(Unit)
    }

    suspend fun awaitFinished() {
        finishedSignal.receive()
    }

    private fun processFrame(frame: String) {
        if (frame.isEmpty()) return
        var eventId: String? = null
        var eventType: String? = null
        val data = StringBuilder()
        for (rawLine in frame.split('\n')) {
            val stripped = rawLine.trimEnd('\r')
            if (stripped.startsWith(":")) continue
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
            return
        }
        // Cursor advances ONLY after a successful enqueue. Advancing
        // before the parse / trySend (the prior implementation) would
        // move the reconnect cursor past events that never reached the
        // consumer — either because the parser returned null on a
        // malformed frame, or because the buffered channel rejected
        // the trySend. The reconnect would then skip those ids
        // forever. If parse fails entirely we still advance so we
        // don't loop on the same malformed id.
        val event = WebhookEventParser.parse(data.toString()) ?: run {
            eventId?.let(updateLastEventId)
            return
        }
        if (channel.trySend(event).isSuccess) {
            eventId?.let(updateLastEventId)
        }
    }
}
