package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.AdvancedCommerceInfoIOS
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseOfferIOS
import io.github.hyochan.kmpiap.openiap.RenewalInfoIOS
import io.github.hyochan.kmpiap.openiap.TransactionCommitmentInfoIOS
import platform.Foundation.NSNull

internal fun normalizeBridgeMap(data: Any?): Map<String, Any?>? {
    val source = data as? Map<*, *> ?: return null
    return source.entries.associate { (key, value) ->
        key.toString() to normalizeBridgeValue(value)
    }
}

internal fun normalizeProductPayloadIOS(data: Any?): Map<String, Any?>? {
    val normalized = normalizeBridgeMap(data)?.toMutableMap() ?: return null

    // This is internal StoreKit bridge-response recovery, not a user-authored
    // deprecated input. Older native bridges can emit empty canonical
    // placeholders beside populated historical response labels, so the
    // non-empty legacy value intentionally fills the placeholder. It is not
    // part of the KMP 3.0 public API removal schedule.
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

internal fun normalizePurchasePayloadIOS(data: Any?): Map<String, Any?>? {
    val normalized = normalizeBridgeMap(data)?.toMutableMap() ?: return null

    // Preserve every canonical PurchaseIOS field from the native dictionary.
    // These defaults only cover legacy bridge payloads that predate the
    // generated platform/store/quantity fields.
    if (normalized["platform"] == null) normalized["platform"] = "ios"
    if (normalized["store"] == null) normalized["store"] = "apple"
    if (normalized["quantity"] == null) {
        normalized["quantity"] = normalized["quantityIOS"] as? Number ?: 1
    }
    if ((normalized["platform"] as? String)?.equals("ios", ignoreCase = true) == true) {
        normalized["platform"] = "ios"
    }
    if ((normalized["store"] as? String)?.equals("apple", ignoreCase = true) == true) {
        normalized["store"] = "apple"
    }
    val id = (normalized["id"] as? String)?.takeIf { it.isNotBlank() }
    val transactionId = (normalized["transactionId"] as? String)?.takeIf { it.isNotBlank() }
    if (id == null && transactionId != null) normalized["id"] = transactionId
    if (transactionId == null && id != null) normalized["transactionId"] = id
    return normalized
}

internal fun decodePurchasePayloadIOS(data: Any?): PurchaseIOS? {
    val normalized = normalizePurchasePayloadIOS(data) ?: return null
    if (normalized["platform"] != "ios") return null
    if ((normalized["productId"] as? String).isNullOrBlank()) return null
    if (
        (normalized["id"] as? String).isNullOrBlank() ||
        (normalized["transactionId"] as? String).isNullOrBlank()
    ) {
        return null
    }

    runCatching { PurchaseIOS.fromJson(normalized) }.getOrNull()?.let { return it }

    // A malformed optional native object must not suppress an otherwise-valid
    // purchase update. Validate each structured field independently, discard
    // only the field that cannot be decoded, and retry the generated decoder.
    val fallback = normalized.toMutableMap()
    fallback.removeMalformedPurchaseObjectIOS(
        "advancedCommerceInfoIOS",
        AdvancedCommerceInfoIOS::fromJson,
    )
    fallback.removeMalformedPurchaseObjectIOS(
        "commitmentInfoIOS",
        TransactionCommitmentInfoIOS::fromJson,
    )
    fallback.removeMalformedPurchaseObjectIOS(
        "offerIOS",
        PurchaseOfferIOS::fromJson,
    )
    fallback.removeMalformedPurchaseObjectIOS(
        "renewalInfoIOS",
        RenewalInfoIOS::fromJson,
    )
    return runCatching { PurchaseIOS.fromJson(fallback) }.getOrNull()
}

private fun MutableMap<String, Any?>.removeMalformedPurchaseObjectIOS(
    key: String,
    decode: (Map<String, Any?>) -> Any,
) {
    val value = this[key] ?: return
    val normalizedObject = normalizeBridgeMap(value)
    if (normalizedObject == null || runCatching { decode(normalizedObject) }.isFailure) {
        remove(key)
    }
}

private fun normalizeBridgeValue(value: Any?): Any? = when (value) {
    is NSNull -> null
    is Map<*, *> -> value.entries.associate { (key, nested) ->
        key.toString() to normalizeBridgeValue(nested)
    }
    is List<*> -> value.map(::normalizeBridgeValue)
    else -> value
}
