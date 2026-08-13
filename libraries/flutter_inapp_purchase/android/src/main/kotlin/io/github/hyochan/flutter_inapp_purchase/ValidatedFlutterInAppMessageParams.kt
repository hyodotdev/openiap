package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.InAppMessageCategoryAndroid
import dev.hyo.openiap.InAppMessageParamsAndroid

internal fun validateFlutterInAppMessageParams(categories: Any?): InAppMessageParamsAndroid {
    if (categories == null) return InAppMessageParamsAndroid()
    require(categories is List<*>) { "categories must be a list" }
    return InAppMessageParamsAndroid(
        categories = categories.map(::parseFlutterInAppMessageCategory),
    )
}

private fun parseFlutterInAppMessageCategory(value: Any?): InAppMessageCategoryAndroid =
    when (value) {
        "unknown-in-app-message-category-id",
        "UNKNOWN_IN_APP_MESSAGE_CATEGORY_ID",
        "UnknownInAppMessageCategoryId",
        -> InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId
        "transactional", "TRANSACTIONAL", "Transactional" -> InAppMessageCategoryAndroid.Transactional
        else -> throw IllegalArgumentException("Unknown in-app message category input: $value")
    }
