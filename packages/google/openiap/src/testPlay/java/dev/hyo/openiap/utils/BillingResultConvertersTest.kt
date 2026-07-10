package dev.hyo.openiap.utils

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import dev.hyo.openiap.SubResponseCodeAndroid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BillingResultConvertersTest {
    @Test
    fun `maps every Play Billing 9_1 sub-response code`() {
        val expected = mapOf(
            BillingClient.OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE to
                SubResponseCodeAndroid.NoApplicableSubResponseCode,
            BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS to
                SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
            BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE to
                SubResponseCodeAndroid.UserIneligible
        )

        expected.forEach { (nativeCode, openIapCode) ->
            val result = BillingResult.newBuilder()
                .setResponseCode(BillingClient.BillingResponseCode.ERROR)
                .setOnPurchasesUpdatedSubResponseCode(nativeCode)
                .build()

            assertEquals(openIapCode, result.toOpenIapBillingResult().subResponseCode)
        }
    }

    @Test
    fun `unknown sub-response code remains absent`() {
        assertNull(Int.MAX_VALUE.toOpenIapSubResponseCode())
    }
}
