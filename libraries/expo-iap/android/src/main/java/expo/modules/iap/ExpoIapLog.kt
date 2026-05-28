package expo.modules.iap

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

internal object ExpoIapLog {
    private const val TAG = "ExpoIap"
    private val SENSITIVE_KEYS = setOf(
        "token",
        "purchasetoken",
        "receipttoken",
        "accesstoken",
        "apikey",
        "secret",
        "sharedsecret",
        "jws",
        "receiptid",
        "userid",
        "password",
        "auth",
        "authorization",
        "authheader",
        "bearer"
    )

    fun payload(
        name: String,
        payload: Any?,
    ) {
        debug("$name payload: ${stringify(payload)}")
    }

    fun result(
        name: String,
        value: Any?,
    ) {
        debug("$name result: ${stringify(value)}")
    }

    fun failure(
        name: String,
        error: Throwable,
    ) {
        Log.e(TAG, "$name failed: ${error.localizedMessage}", error)
    }

    fun warning(message: String) {
        Log.w(TAG, message)
    }

    fun debug(message: String) {
        if (BuildConfig.DEBUG || Log.isLoggable(TAG, Log.DEBUG)) {
            Log.d(TAG, message)
        }
    }

    private fun stringify(value: Any?): String {
        val sanitized = sanitize(value) ?: return "null"
        return when (sanitized) {
            is String -> sanitized
            is Number, is Boolean -> sanitized.toString()
            is Map<*, *> -> JSONObject(sanitized).toString()
            is List<*> -> JSONArray(sanitized).toString()
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

    private fun sanitizeMap(source: Map<*, *>): Map<String, Any?> {
        fun isSensitiveKey(key: String): Boolean {
            val normalized = key.lowercase().filter { it.isLetterOrDigit() }
            return normalized in SENSITIVE_KEYS
        }

        val sanitized = linkedMapOf<String, Any?>()
        for ((rawKey, rawValue) in source) {
            val key = rawKey as? String ?: continue
            if (isSensitiveKey(key)) {
                sanitized[key] = "hidden"
                continue
            }
            sanitized[key] = sanitize(rawValue)
        }
        return sanitized
    }
}
