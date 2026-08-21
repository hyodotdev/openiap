package com.margelo.nitro.iap

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

internal object RnIapLog {
    private const val TAG = "RnIap"
    private val SENSITIVE_KEY_FRAGMENTS = setOf(
        "token",
        "apikey",
        "secret",
        "jws",
        "receiptid",
        "userid",
        "password",
        "bearer"
    )
    private val SENSITIVE_AUTH_KEYS = setOf(
        "auth",
        "authorization",
        "authheader"
    )

    fun payload(name: String, payload: Any?) {
        debug("$name payload: ${stringify(payload)}")
    }

    fun result(name: String, value: Any?) {
        debug("$name result: ${stringify(value)}")
    }

    fun failure(name: String, error: Throwable) {
        Log.e(TAG, "$name failed: ${error.localizedMessage}", error)
    }

    fun debug(message: String) {
        if (BuildConfig.DEBUG || Log.isLoggable(TAG, Log.DEBUG)) {
            Log.d(TAG, message)
        }
    }

    fun warn(message: String) {
        Log.w(TAG, message)
    }

    private fun stringify(value: Any?): String {
        val sanitized = sanitize(value) ?: return "null"
        return when (sanitized) {
            is String -> sanitized
            is Number, is Boolean -> sanitized.toString()
            is Map<*, *> -> JSONObject(sanitized).toString()
            is List<*> -> JSONArray(sanitized).toString()
            is Array<*> -> JSONArray(sanitized).toString()
            else -> sanitized.toString()
        }
    }

    private fun sanitize(value: Any?): Any? {
        if (value == null) return null
        return when (value) {
            is Map<*, *> -> sanitizeMap(value)
            is List<*> -> value.mapNotNull { sanitize(it) }
            is Array<*> -> value.mapNotNull { sanitize(it) }
            else -> value
        }
    }

    internal fun sanitizeMap(source: Map<*, *>): Map<String, Any?> {
        fun isSensitiveKey(key: String): Boolean {
            val normalized = key.lowercase(Locale.ROOT).filter { it.isLetterOrDigit() }
            return SENSITIVE_KEY_FRAGMENTS.any { normalized.contains(it) } ||
                normalized in SENSITIVE_AUTH_KEYS
        }

        val sanitized = linkedMapOf<String, Any?>()
        for ((rawKey, rawValue) in source) {
            val key = rawKey as? String ?: continue
            if (rawValue == null || rawValue === JSONObject.NULL) {
                sanitized[key] = JSONObject.NULL
                continue
            }
            if (isSensitiveKey(key)) {
                sanitized[key] = "hidden"
                continue
            }
            sanitized[key] = sanitize(rawValue)
        }
        return sanitized
    }
}
