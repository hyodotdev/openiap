package io.github.hyochan.kmpiap

import com.android.billingclient.api.BillingClient
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.SubResponseCodeAndroid
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull

class BillingResultMappingTest {
    @Test
    fun `missing billing program API fails closed`() {
        val failure = billingProgramConfigurationException(
            BillingProgramAndroid.ExternalOffer,
            NoSuchMethodException("enableBillingProgram"),
        )

        assertEquals(ErrorCode.FeatureNotSupported, failure.error.code)
        assertContains(failure.error.message, "not supported")
    }

    @Test
    fun `billing program invocation failure preserves its cause`() {
        val failure = billingProgramConfigurationException(
            BillingProgramAndroid.BillingChoice,
            java.lang.reflect.InvocationTargetException(
                IllegalStateException("builder rejected configuration")
            ),
        )

        assertEquals(ErrorCode.ServiceError, failure.error.code)
        assertEquals("builder rejected configuration", failure.error.debugMessage)
        assertContains(failure.error.message, "builder rejected configuration")
    }

    @Test
    @Suppress("DEPRECATION")
    fun `maps Play network and timeout failures`() {
        assertEquals(
            ErrorCode.NetworkError,
            mapBillingResponseCode(BillingClient.BillingResponseCode.NETWORK_ERROR),
        )
        assertEquals(
            ErrorCode.ServiceTimeout,
            mapBillingResponseCode(BillingClient.BillingResponseCode.SERVICE_TIMEOUT),
        )
    }

    @Test
    fun `maps generic Play billing failures to service error`() {
        assertEquals(
            ErrorCode.ServiceError,
            mapBillingResponseCode(BillingClient.BillingResponseCode.ERROR),
        )
    }

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

    @Test
    fun `purchase update error preserves Play Billing diagnostics`() {
        val billingResult = com.android.billingclient.api.BillingResult.newBuilder()
            .setResponseCode(BillingClient.BillingResponseCode.ERROR)
            .setDebugMessage("Payment declined")
            .setOnPurchasesUpdatedSubResponseCode(
                BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS
            )
            .build()

        val error = billingResult.toPurchaseUpdateError()

        assertEquals("Payment declined", error.debugMessage)
        assertEquals(
            SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds,
            error.subResponseCodeAndroid,
        )
    }

    @Test
    fun `query product error preserves Play Billing diagnostics`() {
        val billingResult = com.android.billingclient.api.BillingResult.newBuilder()
            .setResponseCode(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE)
            .setDebugMessage("Billing service unavailable")
            .build()

        val error = billingResult.toQueryProductError(
            productIds = listOf("premium"),
            productType = BillingClient.ProductType.INAPP,
            isEmptyProductList = true,
        )

        assertEquals(ErrorCode.QueryProduct, error.code)
        assertEquals("Billing service unavailable", error.debugMessage)
        assertEquals(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE, error.responseCode)
        assertEquals(listOf("premium"), error.productIds)
        assertEquals(BillingClient.ProductType.INAPP, error.productType)
        assertEquals(true, error.isEmptyProductList)
    }

    @Test
    fun `billing operation error preserves canonical response diagnostics`() {
        val billingResult = com.android.billingclient.api.BillingResult.newBuilder()
            .setResponseCode(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED)
            .setDebugMessage("Play connection dropped")
            .build()

        val error = billingResult.toBillingOperationError("Billing operation failed")

        assertEquals(ErrorCode.ServiceDisconnected, error.code)
        assertEquals("Play connection dropped", error.message)
        assertEquals("Play connection dropped", error.debugMessage)
        assertEquals(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED, error.responseCode)
    }

    @Test
    fun `storefront country accepts only authoritative nonblank store value`() {
        assertEquals("KR", authoritativeStorefrontCountryOrNull(" KR "))
        assertNull(authoritativeStorefrontCountryOrNull("  "))
        assertNull(authoritativeStorefrontCountryOrNull(null))
    }
}
