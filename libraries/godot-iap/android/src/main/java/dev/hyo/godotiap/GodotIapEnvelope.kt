package dev.hyo.godotiap

import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import org.json.JSONObject

// JSON envelopes the GDScript wrapper reads; a failure always carries `code` and `error`.

internal fun failureJson(
    code: String,
    message: String?,
    vararg fields: Pair<String, Any?>,
): String =
    JSONObject().apply {
        put("success", false)
        fields.forEach { (key, value) -> put(key, value) }
        put("code", code)
        put("error", message)
    }.toString()

internal fun failureJson(
    error: Throwable,
    fallback: ErrorCode = ErrorCode.ServiceError,
    vararg fields: Pair<String, Any?>,
): String = failureJson((error as? OpenIapError)?.code ?: fallback.toJson(), error.message, *fields)

/** Calls before initConnection report not-prepared, so purchase_error never says unknown. */
internal fun notInitializedJson(vararg fields: Pair<String, Any?>): String =
    failureJson(ErrorCode.NotPrepared.toJson(), "IAP connection is not initialized", *fields)
