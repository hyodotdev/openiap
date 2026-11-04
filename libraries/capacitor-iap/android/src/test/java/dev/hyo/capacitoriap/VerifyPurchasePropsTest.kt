package dev.hyo.capacitoriap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class VerifyPurchasePropsTest {
    @Test
    fun readsGoogleOptions() {
        val props =
            verifyPurchaseProps(
                mapOf(
                    "google" to
                        mapOf(
                            "sku" to "coins",
                            "accessToken" to "access",
                            "packageName" to "dev.hyo.martie",
                            "purchaseToken" to "token",
                            "isSub" to false,
                        ),
                ),
            )

        assertEquals("token", props.google?.purchaseToken)
        assertEquals(false, props.google?.isSub)
        assertNull(props.horizon)
    }

    @Test
    fun readsHorizonOptions() {
        val props = verifyPurchaseProps(mapOf("horizon" to mapOf("sku" to "coins", "userId" to "user", "accessToken" to "access")))

        assertEquals("user", props.horizon?.userId)
        assertNull(props.google)
    }

    @Test
    fun rejectsAMissingRequiredField() {
        val error =
            assertThrows(IllegalArgumentException::class.java) {
                verifyPurchaseProps(mapOf("google" to mapOf("sku" to "coins", "accessToken" to "", "packageName" to "p", "purchaseToken" to "t")))
            }

        assertEquals("Missing or empty required parameter: google.accessToken", error.message)
    }
}
