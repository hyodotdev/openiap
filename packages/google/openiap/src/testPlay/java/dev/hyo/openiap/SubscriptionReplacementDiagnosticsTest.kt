package dev.hyo.openiap

import com.android.billingclient.api.ProductDetails
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionReplacementDiagnosticsTest {
    @Test
    fun `same subscription auto renewing switch lists two valid modes`() {
        val params = replacementParams(SubscriptionReplacementModeAndroid.ChargeProratedPrice)
        val message =
            subscriptionReplacementDeveloperErrorMessage(
                originalDebugMessage = "Invalid arguments provided to the API",
                replacementParams = params,
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.INFINITE_RECURRING),
                targetIsInstallment = false,
            )

        val error =
            OpenIapError
                .DeveloperError("Invalid arguments provided to the API")
                .withMessage(message)

        assertTrue(message.startsWith(OpenIapError.DeveloperError.MESSAGE))
        assertTrue(message.contains("requested replacement mode CHARGE_PRORATED_PRICE"))
        assertTrue(message.contains("same-subscription switch to an auto-renewing plan"))
        assertTrue(message.contains("CHARGE_FULL_PRICE, WITHOUT_PRORATION"))
        assertTrue(message.contains("Heuristic: Play does not disclose the exact cause"))
        assertEquals("Invalid arguments provided to the API", error.debugMessage)
        assertEquals(message, error.message)
    }

    @Test
    fun `prepaid target lists only charge full price`() {
        val switchType =
            classifySubscriptionReplacementSwitch(
                oldProductId = "basic",
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.NON_RECURRING),
                targetIsInstallment = false,
            )
        val message =
            subscriptionReplacementDeveloperErrorMessage(
                originalDebugMessage = "Invalid arguments",
                replacementParams = replacementParams(SubscriptionReplacementModeAndroid.Deferred),
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.NON_RECURRING),
                targetIsInstallment = false,
            )

        assertEquals(SubscriptionReplacementSwitchType.TargetPrepaid, switchType)
        assertTrue(message.contains("switch to a prepaid plan"))
        assertTrue(message.contains("Valid modes for this case: CHARGE_FULL_PRICE."))
    }

    @Test
    fun `cross subscription switch lists the documented mode set`() {
        val message =
            subscriptionReplacementDeveloperErrorMessage(
                originalDebugMessage = "Invalid arguments",
                replacementParams =
                    replacementParams(
                        SubscriptionReplacementModeAndroid.WithTimeProration,
                        oldProductId = "basic",
                    ),
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.INFINITE_RECURRING),
                targetIsInstallment = false,
            )

        assertTrue(message.contains("cross-subscription switch"))
        assertTrue(message.contains("CHARGE_PRORATED_PRICE (upgrades only)"))
        assertTrue(message.contains("WITHOUT_PRORATION, CHARGE_FULL_PRICE, DEFERRED"))
    }

    @Test
    fun `installment target lists the supported replacement modes`() {
        val switchType =
            classifySubscriptionReplacementSwitch(
                oldProductId = "premium",
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.INFINITE_RECURRING),
                targetIsInstallment = true,
            )
        val message =
            subscriptionReplacementDeveloperErrorMessage(
                originalDebugMessage = "Invalid arguments",
                replacementParams = replacementParams(SubscriptionReplacementModeAndroid.Deferred),
                targetProductId = "premium",
                targetRecurrenceModes = listOf(ProductDetails.RecurrenceMode.INFINITE_RECURRING),
                targetIsInstallment = true,
            )

        assertEquals(SubscriptionReplacementSwitchType.TargetInstallment, switchType)
        assertTrue(message.contains("switch to an installment plan"))
        assertTrue(message.contains("WITH_TIME_PRORATION, CHARGE_PRORATED_PRICE (upgrades only)"))
        assertTrue(message.contains("WITHOUT_PRORATION, CHARGE_FULL_PRICE, DEFERRED"))
        assertTrue(message.contains("KEEP_EXISTING also requires oldProductId == target productId"))
    }

    private fun replacementParams(
        mode: SubscriptionReplacementModeAndroid,
        oldProductId: String = "premium",
    ): SubscriptionProductReplacementParamsAndroid =
        SubscriptionProductReplacementParamsAndroid(
            oldProductId = oldProductId,
            replacementMode = mode,
        )
}
