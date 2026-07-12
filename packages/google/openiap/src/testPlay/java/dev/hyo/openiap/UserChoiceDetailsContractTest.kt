package dev.hyo.openiap

import org.junit.Assert.assertTrue
import org.junit.Test

class UserChoiceDetailsContractTest {
    @Test
    fun `Play user choice details expose subscription replacement and product fields`() {
        val detailMethods = Class.forName("com.android.billingclient.api.UserChoiceDetails")
            .methods
            .map { it.name }
            .toSet()
        val productMethods = Class.forName("com.android.billingclient.api.UserChoiceDetails\$Product")
            .methods
            .map { it.name }
            .toSet()

        assertTrue("getExternalTransactionToken" in detailMethods)
        assertTrue("getOriginalExternalTransactionId" in detailMethods)
        assertTrue("getProducts" in detailMethods)
        assertTrue("getId" in productMethods)
        assertTrue("getOfferToken" in productMethods)
        assertTrue("getType" in productMethods)
    }
}
