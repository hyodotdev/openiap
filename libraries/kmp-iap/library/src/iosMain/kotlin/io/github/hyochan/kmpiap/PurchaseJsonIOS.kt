package io.github.hyochan.kmpiap

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSJSONSerialization
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding

// ObjC dictionary parameters bridge as Map<Any?, *>. A Kotlin Boolean crosses as a number
// JSONSerialization writes as 1, which Swift cannot decode as Bool, so Foundation parses the JSON.
@OptIn(ExperimentalForeignApi::class)
internal fun Map<String, Any?>.toBridgeMapIOS(): Map<Any?, *> {
    val data = NSString.create(string = toJsonStringIOS()).dataUsingEncoding(NSUTF8StringEncoding)
    @Suppress("UNCHECKED_CAST")
    return NSJSONSerialization.JSONObjectWithData(requireNotNull(data), 0u, null) as Map<Any?, *>
}

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
