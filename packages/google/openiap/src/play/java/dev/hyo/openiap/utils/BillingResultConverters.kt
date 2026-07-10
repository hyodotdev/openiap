package dev.hyo.openiap.utils

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import dev.hyo.openiap.BillingResultAndroid
import dev.hyo.openiap.SubResponseCodeAndroid

internal fun Int.toOpenIapSubResponseCode(): SubResponseCodeAndroid? = when (this) {
    BillingClient.OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE ->
        SubResponseCodeAndroid.NoApplicableSubResponseCode
    BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS ->
        SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds
    BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE ->
        SubResponseCodeAndroid.UserIneligible
    else -> null
}

internal fun BillingResult.toOpenIapBillingResult(): BillingResultAndroid =
    BillingResultAndroid(
        responseCode = responseCode,
        debugMessage = debugMessage,
        subResponseCode = onPurchasesUpdatedSubResponseCode.toOpenIapSubResponseCode()
    )
