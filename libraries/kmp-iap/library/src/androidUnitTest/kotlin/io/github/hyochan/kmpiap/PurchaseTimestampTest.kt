package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals

class PurchaseTimestampTest {
    @Test
    fun `Play purchase timestamp remains epoch milliseconds`() {
        val purchaseTimeMillis = 1_700_000_000_123L

        assertEquals(
            purchaseTimeMillis.toDouble(),
            purchaseTimeMillis.toOpenIapTransactionDate()
        )
    }
}
