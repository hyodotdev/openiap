package dev.hyo.capacitoriap

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

/** Converts between Capacitor's JSON objects and the maps the generated OpenIAP types read and write. */
internal object JsonBridge {
    fun toMap(json: JSONObject): Map<String, Any?> = json.keys().asSequence().associateWith { fromJson(json.opt(it)) }

    fun fromJson(value: Any?): Any? =
        when (value) {
            null, JSONObject.NULL -> null
            is JSONObject -> toMap(value)
            is JSONArray -> List(value.length()) { fromJson(value.opt(it)) }
            else -> value
        }

    fun toJSObject(map: Map<String, Any?>): JSObject =
        JSObject().apply {
            for ((key, value) in map) put(key, toJson(value))
        }

    /** Null becomes JSON null, so canonical fields stay present in the payload. */
    fun toJson(value: Any?): Any =
        when (value) {
            null -> JSONObject.NULL
            is Map<*, *> -> JSObject().apply { for ((key, item) in value) put(key.toString(), toJson(item)) }
            is Iterable<*> -> JSArray().apply { for (item in value) put(toJson(item)) }
            is Array<*> -> JSArray().apply { for (item in value) put(toJson(item)) }
            else -> value
        }
}
