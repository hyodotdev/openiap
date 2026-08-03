package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.AdvancedCommerceInfoIOS
import io.github.hyochan.kmpiap.openiap.ActiveSubscription
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseOfferIOS
import io.github.hyochan.kmpiap.openiap.PurchaseState
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

    applyAlias("subscriptionOffers", "offers")
    return normalized
}

internal fun normalizePurchasePayloadIOS(data: Any?): Map<String, Any?>? {
    val normalized = normalizeBridgeMap(data)?.toMutableMap() ?: return null

    // Preserve every canonical PurchaseIOS field from the native dictionary.
    // The native bridge still supplies StoreKit-specific response labels that
    // are normalized internally before decoding.
    if (normalized["store"] == null) normalized["store"] = "apple"
    if (normalized["quantity"] == null) {
        normalized["quantity"] = normalized["quantityIOS"] as? Number ?: 1
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
    if (normalized["store"] != "apple") return null
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

/** Decode an authoritative native purchase list without partial success. */
internal fun decodePurchaseListPayloadIOS(data: Any?): List<PurchaseIOS> {
    val list = data as? List<*> ?: throw malformedPurchaseListIOS(
        "Native bridge returned a non-list purchase payload"
    )
    return list.mapIndexed { index, item ->
        val bridgeMap = normalizeBridgeMap(item) ?: throw malformedPurchaseListIOS(
            "Native bridge returned a malformed purchase at index $index"
        )
        if (!bridgeMap.hasNativePurchaseQuantityIOS()) {
            throw malformedPurchaseListIOS(
                "Native bridge returned a purchase without quantity at index $index"
            )
        }
        if (!bridgeMap.hasNativePurchaseIdentityIOS()) {
            throw malformedPurchaseListIOS(
                "Native bridge returned a purchase without required identity at index $index"
            )
        }
        val normalized = normalizePurchasePayloadIOS(bridgeMap)!!
        if (
            normalized["store"] != "apple" ||
            (normalized["productId"] as? String).isNullOrBlank() ||
            (normalized["id"] as? String).isNullOrBlank() ||
            (normalized["transactionId"] as? String).isNullOrBlank() ||
            normalized["isAutoRenewing"] !is Boolean ||
            !normalized.hasValidPurchaseStateIOS() ||
            !normalized.hasValidPurchaseQuantityIOS() ||
            !normalized.hasValidTransactionDateIOS() ||
            !normalized.hasValidPurchaseIdsIOS() ||
            !normalized.hasValidOptionalPurchaseObjectsIOS()
        ) {
            throw malformedPurchaseListIOS(
                "Native bridge returned a purchase with malformed required fields at index $index"
            )
        }
        runCatching { PurchaseIOS.fromJson(normalized) }.getOrElse {
            throw malformedPurchaseListIOS(
                "Failed to decode native purchase at index $index"
            )
        }
    }
}

/** Decode an authoritative native active-subscription list without partial success. */
internal fun decodeActiveSubscriptionListPayloadIOS(
    data: Any?,
    subscriptionIds: List<String>? = null,
): List<ActiveSubscription> {
    val list = data as? List<*> ?: throw malformedPurchaseListIOS(
        "Native bridge returned a non-list active-subscription payload"
    )
    val subscriptions = list.mapIndexed { index, item ->
        val normalized = normalizeBridgeMap(item) ?: throw malformedPurchaseListIOS(
            "Native bridge returned a malformed active subscription at index $index"
        )
        val transactionDate = normalized["transactionDate"] as? Number
        val renewalInfo = normalized["renewalInfoIOS"]
        if (
            (normalized["productId"] as? String).isNullOrBlank() ||
            (normalized["transactionId"] as? String).isNullOrBlank() ||
            normalized["isActive"] !is Boolean ||
            transactionDate == null ||
            !transactionDate.toDouble().isFinite() ||
            renewalInfo != null && renewalInfo !is Map<*, *>
        ) {
            throw malformedPurchaseListIOS(
                "Native bridge returned an active subscription with malformed required fields at index $index"
            )
        }
        runCatching { ActiveSubscription.fromJson(normalized) }.getOrElse {
            throw malformedPurchaseListIOS(
                "Failed to decode native active subscription at index $index"
            )
        }
    }

    if (subscriptionIds.isNullOrEmpty()) return subscriptions
    val filter = subscriptionIds.toSet()
    return subscriptions.filter { it.productId in filter }
}

private fun Map<String, Any?>.hasNativePurchaseQuantityIOS(): Boolean =
    this["quantity"] is Number || this["quantityIOS"] is Number

private fun Map<String, Any?>.hasNativePurchaseIdentityIOS(): Boolean =
    (this["store"] as? String)?.equals("apple", ignoreCase = true) == true &&
        !(this["productId"] as? String).isNullOrBlank() &&
        !(this["id"] as? String).isNullOrBlank() &&
        !(this["transactionId"] as? String).isNullOrBlank()

private fun Map<String, Any?>.hasValidPurchaseStateIOS(): Boolean {
    val raw = this["purchaseState"] as? String ?: return false
    return runCatching { PurchaseState.fromJson(raw) }.isSuccess
}

private fun Map<String, Any?>.hasValidPurchaseQuantityIOS(): Boolean {
    val value = this["quantity"] as? Number ?: return false
    val doubleValue = value.toDouble()
    return doubleValue.isFinite() && doubleValue == value.toInt().toDouble()
}

private fun Map<String, Any?>.hasValidTransactionDateIOS(): Boolean {
    val value = this["transactionDate"] as? Number ?: return false
    return value.toDouble().isFinite()
}

private fun Map<String, Any?>.hasValidPurchaseIdsIOS(): Boolean {
    val value = this["ids"] ?: return true
    return value is List<*> && value.all { it is String }
}

private fun Map<String, Any?>.hasValidOptionalPurchaseObjectsIOS(): Boolean = listOf(
    "advancedCommerceInfoIOS",
    "commitmentInfoIOS",
    "offerIOS",
    "renewalInfoIOS",
).all { key ->
    val value = this[key]
    value == null || value is Map<*, *>
}

private fun malformedPurchaseListIOS(message: String): PurchaseException =
    PurchaseException(
        PurchaseError(
            code = ErrorCode.BillingResponseJsonParseError,
            message = message,
        )
    )

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
