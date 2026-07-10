package io.github.hyochan.kmpiap

import com.android.billingclient.api.BillingClient
import io.github.hyochan.kmpiap.openiap.SubResponseCodeAndroid
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class BillingResultMappingTest {
    @Test
    fun `maps every Play Billing 9_1 sub-response code`() {
        assertEquals(
            SubResponseCodeAndroid.NoApplicableSubResponseCode,
            BillingClient.OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE
                .toOpenIapSubResponseCode()
        )
        assertEquals(
            SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
            BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS
                .toOpenIapSubResponseCode()
        )
        assertEquals(
            SubResponseCodeAndroid.UserIneligible,
            BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE
                .toOpenIapSubResponseCode()
        )
    }

    @Test
    fun `unknown sub-response code remains absent`() {
        assertNull(Int.MAX_VALUE.toOpenIapSubResponseCode())
    }
}
