package dev.hyo.openiap

import com.android.billingclient.api.ProductDetails
import java.util.Locale

private const val REPLACEMENT_MODES_URL =
    "https://developer.android.com/google/play/billing/subscriptions#replacement-modes"

internal enum class SubscriptionReplacementSwitchType {
    SameSubscriptionAutoRenewing,
    TargetPrepaid,
    CrossSubscription,
    TargetInstallment,
    Unknown,
}

internal fun classifySubscriptionReplacementSwitch(
    oldProductId: String,
    targetProductId: String,
    targetRecurrenceModes: List<Int>,
    targetIsInstallment: Boolean,
): SubscriptionReplacementSwitchType {
    val targetIsAutoRenewing =
        targetRecurrenceModes.contains(ProductDetails.RecurrenceMode.INFINITE_RECURRING)
    val targetIsPrepaid = targetRecurrenceModes.isNotEmpty() && !targetIsAutoRenewing

    return when {
        targetIsInstallment -> SubscriptionReplacementSwitchType.TargetInstallment
        targetIsPrepaid -> SubscriptionReplacementSwitchType.TargetPrepaid
        oldProductId != targetProductId -> SubscriptionReplacementSwitchType.CrossSubscription
        targetIsAutoRenewing -> SubscriptionReplacementSwitchType.SameSubscriptionAutoRenewing
        else -> SubscriptionReplacementSwitchType.Unknown
    }
}

internal fun subscriptionReplacementDeveloperErrorMessage(
    originalDebugMessage: String,
    replacementParams: SubscriptionProductReplacementParamsAndroid,
    targetProductId: String,
    targetRecurrenceModes: List<Int>,
    targetIsInstallment: Boolean,
): String {
    val requestedMode =
        replacementParams.replacementMode.rawValue
            .replace('-', '_')
            .uppercase(Locale.ROOT)
    val switchType =
        classifySubscriptionReplacementSwitch(
            oldProductId = replacementParams.oldProductId,
            targetProductId = targetProductId,
            targetRecurrenceModes = targetRecurrenceModes,
            targetIsInstallment = targetIsInstallment,
        )
    val restriction =
        when (switchType) {
            SubscriptionReplacementSwitchType.SameSubscriptionAutoRenewing ->
                "a same-subscription switch to an auto-renewing plan " +
                    "(oldProductId == target productId). Valid modes for this case: " +
                    "CHARGE_FULL_PRICE, WITHOUT_PRORATION."
            SubscriptionReplacementSwitchType.TargetPrepaid ->
                "a switch to a prepaid plan. Valid modes for this case: CHARGE_FULL_PRICE."
            SubscriptionReplacementSwitchType.CrossSubscription ->
                "a cross-subscription switch. Valid modes for this case: " +
                    "WITH_TIME_PRORATION, CHARGE_PRORATED_PRICE (upgrades only), " +
                    "WITHOUT_PRORATION, CHARGE_FULL_PRICE, DEFERRED."
            SubscriptionReplacementSwitchType.TargetInstallment ->
                "a switch to an installment plan. Valid modes for installment subscriptions: " +
                    "WITH_TIME_PRORATION, CHARGE_PRORATED_PRICE (upgrades only), " +
                    "WITHOUT_PRORATION, CHARGE_FULL_PRICE, DEFERRED. KEEP_EXISTING also " +
                    "requires oldProductId == target productId."
            SubscriptionReplacementSwitchType.Unknown ->
                "this subscription switch. Verify that the mode is supported for the target plan."
        }

    return "${OpenIapError.DeveloperError.MESSAGE}. Heuristic: Play does not disclose the " +
        "exact cause, but " +
        "requested replacement mode $requestedMode may be invalid for $restriction " +
        "Original Play message: $originalDebugMessage See $REPLACEMENT_MODES_URL"
}
