package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.InAppMessageParamsAndroid

internal fun validateFlutterInAppMessageParams(categories: Any?): InAppMessageParamsAndroid =
    InAppMessageParamsAndroid.fromJson(mapOf("categories" to categories))
