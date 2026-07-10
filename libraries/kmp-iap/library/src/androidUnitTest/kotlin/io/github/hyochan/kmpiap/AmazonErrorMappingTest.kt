package io.github.hyochan.kmpiap

import dev.hyo.openiap.OpenIapError
import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlin.test.Test
import kotlin.test.assertEquals

class AmazonErrorMappingTest {
    @Test
    fun `Amazon cancellation maps to KMP user-cancelled error`() {
        val error = OpenIapError.UserCancelled("Amazon purchase was cancelled")

        val mapped = error.toKmpPurchaseError()

        assertEquals(ErrorCode.UserCancelled, mapped.code)
        assertEquals("Amazon purchase was cancelled", mapped.message)
    }
}
