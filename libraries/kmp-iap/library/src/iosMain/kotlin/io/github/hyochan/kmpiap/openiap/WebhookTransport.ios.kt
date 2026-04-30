package io.github.hyochan.kmpiap.openiap

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import platform.Foundation.NSData
import platform.Foundation.NSError
import platform.Foundation.NSHTTPURLResponse
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSString
import platform.Foundation.NSURL
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration
import platform.Foundation.NSURLSessionDataDelegateProtocol
import platform.Foundation.NSURLSessionDataTask
import platform.Foundation.NSURLSessionResponseAllow
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
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
    private var closed: Boolean = false
    private var activeTask: NSURLSessionDataTask? = null

    actual fun events(lastEventId: String?): Flow<WebhookEvent> {
        val channel = Channel<WebhookEvent>(Channel.BUFFERED)
        val scope = CoroutineScope(Dispatchers.Default)
        scope.launch {
            var resumeId = lastEventId
            while (!closed) {
                val ok = runOnce(channel, resumeId) { id -> resumeId = id }
                if (closed) break
                if (!ok) delay(2_000)
            }
            channel.close()
        }
        return channel.consumeAsFlow().flowOn(Dispatchers.Default)
    }

    private suspend fun runOnce(
        channel: Channel<WebhookEvent>,
        lastEventId: String?,
        updateLastEventId: (String) -> Unit,
    ): Boolean = try {
        val url = NSURL(string = webhookStreamUrl(baseUrl, apiKey))
        val request = NSMutableURLRequest.requestWithURL(url).apply {
            setHTTPMethod("GET")
            setValue("text/event-stream", forHTTPHeaderField = "Accept")
            setValue("no-cache", forHTTPHeaderField = "Cache-Control")
            if (lastEventId != null) {
                setValue(lastEventId, forHTTPHeaderField = "Last-Event-ID")
            }
        }
        val config = NSURLSessionConfiguration.defaultSessionConfiguration()
        val frameBuffer = StringBuilder()
        val delegate = SseDelegate(channel, frameBuffer, updateLastEventId)
        val session = NSURLSession.sessionWithConfiguration(config, delegate, null)
        val task = session.dataTaskWithRequest(request)
        activeTask = task
        task.resume()
        delegate.awaitFinished()
        true
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
    private val channel: Channel<WebhookEvent>,
    private val frameBuffer: StringBuilder,
    private val updateLastEventId: (String) -> Unit,
) : NSObject(), NSURLSessionDataDelegateProtocol {
    private val finishedSignal = Channel<Unit>(Channel.CONFLATED)

    override fun URLSession(
        session: NSURLSession,
        dataTask: NSURLSessionDataTask,
        didReceiveData: NSData,
    ) {
        val str = NSString.create(data = didReceiveData, encoding = NSUTF8StringEncoding)
            ?.toString()
            ?: return
        frameBuffer.append(str)
        var content = frameBuffer.toString()
        while (true) {
            val sepIdx = content.indexOf("\n\n")
            val lfIdx = if (sepIdx >= 0) sepIdx else content.indexOf("\r\n\r\n")
            if (lfIdx < 0) break
            val sepLen = if (sepIdx >= 0) 2 else 4
            val frame = content.substring(0, lfIdx)
            content = content.substring(lfIdx + sepLen)
            processFrame(frame)
        }
        frameBuffer.clear()
        frameBuffer.append(content)
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
        eventId?.let(updateLastEventId)
        if (eventType == "heartbeat" || eventType == "ready" || data.isEmpty()) {
            return
        }
        WebhookEventParser.parse(data.toString())?.let { event ->
            channel.trySend(event)
        }
    }
}
