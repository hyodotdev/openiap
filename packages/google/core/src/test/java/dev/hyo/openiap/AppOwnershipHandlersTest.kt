package dev.hyo.openiap

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Test

class AppOwnershipHandlersTest {
    @Test fun `copy preserves ownership callback and value identity`() = runBlocking {
        val evidence = AppOwnershipVerificationResult(status = AppOwnershipStatus.Unknown, storeId = "play")
        val handler: QueryVerifyAppOwnershipHandler = { evidence }
        val original = QueryHandlers(verifyAppOwnership = handler)
        val copied = original.copy()
        assertSame(handler, copied.verifyAppOwnership)
        assertSame(evidence, copied.verifyAppOwnership?.invoke(null))
        assertEquals(original, copied)
        assertEquals(original.hashCode(), copied.hashCode())
        assertNotEquals(original, QueryHandlers())
    }
}
