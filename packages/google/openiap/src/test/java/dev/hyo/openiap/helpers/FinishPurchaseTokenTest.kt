package dev.hyo.openiap.helpers

import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.store.FakeOpenIapProtocol
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FinishPurchaseTokenTest {
    @Test
    fun `a Boolean-only protocol refusal throws service-error`() = runBlocking {
        val module = FakeOpenIapProtocol().apply { storeAcceptsFinish = false }

        for (isConsumable in listOf(true, false)) {
            val thrown = runCatching {
                module.protocol.finishPurchaseToken("token", isConsumable)
            }.exceptionOrNull()

            assertTrue("isConsumable=$isConsumable: $thrown", thrown is OpenIapError.BillingError)
            assertEquals("service-error", (thrown as OpenIapError).code)
        }
    }

    @Test
    fun `an accepted finish returns after the matching store call`() = runBlocking {
        val module = FakeOpenIapProtocol()

        module.protocol.finishPurchaseToken("coins-token", isConsumable = true)
        module.protocol.finishPurchaseToken("premium-token", isConsumable = false)

        assertEquals(listOf("consume:coins-token", "acknowledge:premium-token"), module.finishedTokens)
    }
}
