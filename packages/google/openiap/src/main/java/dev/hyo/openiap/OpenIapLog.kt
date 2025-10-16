package dev.hyo.openiap

import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * OpenIAP logging utility (Android parity with Apple side).
 * - Toggleable via isEnabled
 * - Optional external handler integration
 * - Level-based routing (Debug/Info/Warn/Error)
 */
object OpenIapLog {
    enum class Level { Debug, Info, Warn, Error }

    private val enabled = AtomicBoolean(false)
    private val defaultTagRef = AtomicReference("OpenIAP")
    @Volatile private var handler: ((Level, String, Throwable?) -> Unit)? = null

    var isEnabled: Boolean
        get() = enabled.get()
        set(value) { enabled.set(value) }

    fun enable(value: Boolean) { isEnabled = value }

    fun setHandler(custom: ((Level, String, Throwable?) -> Unit)?) {
        handler = custom
    }

    fun setDefaultTag(tag: String) { defaultTagRef.set(tag) }
    fun defaultTag(): String = defaultTagRef.get()

    // Shorthand APIs (match Apple naming)
    fun debug(message: String, tag: String = defaultTag()) = log(Level.Debug, message, null, tag)
    fun info(message: String, tag: String = defaultTag()) = log(Level.Info, message, null, tag)
    fun warn(message: String, tag: String = defaultTag()) = log(Level.Warn, message, null, tag)
    fun error(message: String, tr: Throwable? = null, tag: String = defaultTag()) = log(Level.Error, message, tr, tag)

    // Backwards-compat alias with Android Log-style letters
    fun d(message: String, tag: String = defaultTag()) = debug(message, tag)
    fun i(message: String, tag: String = defaultTag()) = info(message, tag)
    fun w(message: String, tag: String = defaultTag()) = warn(message, tag)
    fun e(message: String, tr: Throwable? = null, tag: String = defaultTag()) = error(message, tr, tag)

    private fun log(level: Level, message: String, tr: Throwable? = null, tag: String = defaultTag()) {
        if (!isEnabled) return
        val h = handler
        if (h != null) {
            h(level, message, tr)
            return
        }
        when (level) {
            Level.Debug -> Log.d(tag, message)
            Level.Info -> Log.i(tag, message)
            Level.Warn -> Log.w(tag, message)
            Level.Error -> Log.e(tag, message, tr)
        }
    }
}
