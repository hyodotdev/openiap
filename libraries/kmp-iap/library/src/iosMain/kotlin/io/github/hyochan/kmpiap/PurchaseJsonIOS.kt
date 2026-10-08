package io.github.hyochan.kmpiap

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal fun Map<String, Any?>.toJsonStringIOS(): String =
    JsonObject(mapValues { it.value.toJsonElementIOS() }).toString()

private fun Any?.toJsonElementIOS(): JsonElement = when (val value = this) {
    null -> JsonNull
    is Boolean -> JsonPrimitive(value)
    is Number -> JsonPrimitive(value)
    is String -> JsonPrimitive(value)
    is List<*> -> JsonArray(value.map { it.toJsonElementIOS() })
    is Map<*, *> -> JsonObject(value.entries.associate { (key, nested) ->
        require(key is String) { "JSON object keys must be strings" }
        key to nested.toJsonElementIOS()
    })
    else -> throw IllegalArgumentException("Unsupported JSON value")
}
