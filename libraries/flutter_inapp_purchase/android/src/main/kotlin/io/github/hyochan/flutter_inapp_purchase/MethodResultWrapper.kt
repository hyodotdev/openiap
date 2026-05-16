package io.github.hyochan.flutter_inapp_purchase

import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.atomic.AtomicBoolean

// MethodChannel.Result wrapper that responds on the platform thread.
class MethodResultWrapper internal constructor(
    private val safeResult: MethodChannel.Result,
    private val safeChannel: MethodChannel
) : MethodChannel.Result {
    private val handler: Handler = Handler(Looper.getMainLooper())
    private val exhausted = AtomicBoolean(false)
    override fun success(result: Any?) {
        if (exhausted.compareAndSet(false, true)) {
            handler.post { safeResult.success(result) }
        }
    }

    override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {
        if (exhausted.compareAndSet(false, true)) {
            handler.post { safeResult.error(errorCode, errorMessage, errorDetails) }
        }
    }

    override fun notImplemented() {
        if (exhausted.compareAndSet(false, true)) {
            handler.post { safeResult.notImplemented() }
        }
    }

    fun invokeMethod(method: String, arguments: Any?) {
        handler.post { safeChannel.invokeMethod(method, arguments, null) }
    }
}
