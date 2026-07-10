package io.github.hyochan.kmpiap

internal fun normalizeBridgeMap(data: Any?): Map<String, Any?>? {
    val source = data as? Map<*, *> ?: return null
    return source.entries.associate { (key, value) ->
        key.toString() to normalizeBridgeValue(value)
    }
}

internal fun normalizeProductPayloadIOS(data: Any?): Map<String, Any?>? {
    val normalized = normalizeBridgeMap(data)?.toMutableMap() ?: return null

    fun applyAlias(canonical: String, legacy: String) {
        val canonicalValue = normalized[canonical]
        val isMissing = canonical !in normalized || canonicalValue == null ||
            (canonicalValue is Map<*, *> && canonicalValue.isEmpty()) ||
            (canonicalValue is List<*> && canonicalValue.isEmpty())
        if (isMissing && normalized[legacy] != null) {
            normalized[canonical] = normalized[legacy]
        }
    }

    applyAlias("subscriptionInfoIOS", "subscription")
    applyAlias("subscriptionOffers", "offers")
    applyAlias("discountsIOS", "discounts")
    return normalized
}

private fun normalizeBridgeValue(value: Any?): Any? = when (value) {
    is Map<*, *> -> value.entries.associate { (key, nested) ->
        key.toString() to normalizeBridgeValue(nested)
    }
    is List<*> -> value.map(::normalizeBridgeValue)
    else -> value
}
