package dev.hyo.godotiap

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Logging utility for GodotIap plugin.
 * Logs are only visible when DEBUG is set to true (during library development).
 * Token values are automatically hidden for security.
 */
internal object GodotIapLog {
    private const val TAG = "GodotIap"

    /**
     * Set to true during library development to enable debug logging.
     * Should be false for production releases.
     */
    var DEBUG = false

    fun payload(
        name: String,
        payload: Any?,
    ) {
        if (DEBUG) {
            debug("$name payload: ${stringify(payload)}")
        }
    }

    fun result(
        name: String,
        value: Any?,
    ) {
        if (DEBUG) {
            debug("$name result: ${stringify(value)}")
        }
    }

    fun failure(
        name: String,
        error: Throwable,
    ) {
        Log.e(TAG, "$name failed: ${error.localizedMessage}", error)
    }

    fun warning(message: String) {
        if (DEBUG) {
            Log.w(TAG, message)
        }
    }

    fun debug(message: String) {
        if (DEBUG) {
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

        fun sanitizeJsonString(value: String): Any {
            val trimmed = value.trim()
            return try {
                when {
                    trimmed.startsWith("{") -> sanitizeJsonObject(JSONObject(trimmed))
                    trimmed.startsWith("[") -> sanitizeJsonArray(JSONArray(trimmed))
                    else -> value
                }
            } catch (_: Exception) {
                value
            }
        }

        return when (value) {
            is String -> sanitizeJsonString(value)
            is Map<*, *> -> sanitizeMap(value)
            is List<*> -> value.mapNotNull { sanitize(it) }
            is Array<*> -> value.mapNotNull { sanitize(it) }
            else -> value
        }
    }

    private fun sanitizeMap(source: Map<*, *>): Map<String, Any?> {
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

    private fun sanitizeJsonObject(source: JSONObject): Map<String, Any?> {
        val sanitized = linkedMapOf<String, Any?>()
        val keys = source.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            sanitized[key] =
                if (isSensitiveKey(key)) {
                    "hidden"
                } else {
                    sanitizeJsonValue(source.opt(key))
                }
        }
        return sanitized
    }

    private fun sanitizeJsonArray(source: JSONArray): List<Any?> {
        return (0 until source.length()).mapNotNull { index ->
            sanitizeJsonValue(source.opt(index))
        }
    }

    private fun sanitizeJsonValue(value: Any?): Any? {
        if (value == null || value == JSONObject.NULL) return null
        return when (value) {
            is JSONObject -> sanitizeJsonObject(value)
            is JSONArray -> sanitizeJsonArray(value)
            else -> sanitize(value)
        }
    }

    private fun isSensitiveKey(key: String): Boolean {
        val normalized = key.lowercase().filter { it.isLetterOrDigit() }
        return listOf("token", "apikey", "secret", "jws", "receiptid", "userid").any {
            normalized.contains(it)
        }
    }
}
