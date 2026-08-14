package dev.hyo.godotiap

import dev.hyo.openiap.InAppMessageCategoryAndroid
import dev.hyo.openiap.InAppMessageParamsAndroid
import org.json.JSONArray
import org.json.JSONObject

internal fun validateGodotInAppMessageParams(paramsJson: String): InAppMessageParamsAndroid {
    val json = JSONObject(paramsJson.ifBlank { "{}" })
    if (!json.has("categories") || json.isNull("categories")) return InAppMessageParamsAndroid()
    val categories = json.opt("categories") as? JSONArray
        ?: throw IllegalArgumentException("categories must be an array")
    return InAppMessageParamsAndroid(
        categories = List(categories.length()) { index ->
            parseGodotInAppMessageCategory(categories.opt(index))
        },
    )
}

private fun parseGodotInAppMessageCategory(value: Any?): InAppMessageCategoryAndroid =
    when (value) {
        "unknown-in-app-message-category-id",
        "UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID",
        "UnknownInAppMessageCategoryId",
        -> InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId
        "transactional", "TRANSACTIONAL", "Transactional" -> InAppMessageCategoryAndroid.Transactional
        else -> throw IllegalArgumentException("Unknown in-app message category input: $value")
    }
