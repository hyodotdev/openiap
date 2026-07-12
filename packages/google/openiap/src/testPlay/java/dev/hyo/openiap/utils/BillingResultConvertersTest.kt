package dev.hyo.openiap.utils

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingResult
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.SubResponseCodeAndroid
import dev.hyo.openiap.fromBillingResponseCode
import dev.hyo.openiap.toOpenIapError
import dev.hyo.openiap.helpers.toPurchaseError
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

    @Test
    fun `billing response conversion preserves purchase sub-response code`() {
        val expected = SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds

        val error = OpenIapError.fromBillingResponseCode(
            responseCode = BillingClient.BillingResponseCode.ERROR,
            debugMessage = "Payment declined",
            subResponseCode = expected,
        )

        assertEquals(expected, error.subResponseCode)
        assertEquals(expected.rawValue, error.toJSON()["subResponseCodeAndroid"])
        assertEquals(expected, error.toPurchaseError().subResponseCodeAndroid)
    }

    @Test
    fun `network billing failures preserve isolated callback diagnostics`() {
        val first = OpenIapError.fromBillingResponseCode(
            responseCode = BillingClient.BillingResponseCode.NETWORK_ERROR,
            debugMessage = "Connection lost",
            subResponseCode = SubResponseCodeAndroid.UserIneligible,
        )
        val second = OpenIapError.fromBillingResponseCode(
            BillingClient.BillingResponseCode.NETWORK_ERROR,
        )

        assertEquals("Connection lost", first.debugMessage)
        assertEquals(
            SubResponseCodeAndroid.UserIneligible.rawValue,
            first.toJSON()["subResponseCodeAndroid"],
        )
        assertNull(second.toJSON()["subResponseCodeAndroid"])
        assertNull(OpenIapError.NetworkError.toJSON()["subResponseCodeAndroid"])
    }

    @Test
    fun `billing result maps modern API failures canonically`() {
        val result = BillingResult.newBuilder()
            .setResponseCode(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED)
            .setDebugMessage("Play connection dropped")
            .build()

        val error = result.toOpenIapError()

        assertEquals(OpenIapError.ServiceDisconnected.CODE, error.code)
        assertEquals("Play connection dropped", error.debugMessage)
    }
}
