package dev.hyo.openiap

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class AppOwnershipHandlersTest {
    @Test fun `ownership options preserve legacy Google source and JVM calls`() {
        val type = VerifyAppOwnershipProps::class.java
        assertNotNull(type.getDeclaredConstructor(PlayIntegrityParamsAndroid::class.java))
        assertNotNull(type.getDeclaredConstructor())
        assertEquals(PlayIntegrityParamsAndroid::class.java, type.getDeclaredMethod("component1").returnType)
        assertNotNull(type.getDeclaredMethod("copy", PlayIntegrityParamsAndroid::class.java))
        assertTrue(type.declaredMethods.any { it.name == "copy\$default" && it.parameterCount == 4 })

        val google = PlayIntegrityParamsAndroid("123456789", "request-hash")
        val legacy = VerifyAppOwnershipProps(google)
        val (first) = legacy
        assertSame(google, first)
        assertNull(legacy.apple)
        assertEquals(legacy, VerifyAppOwnershipProps.fromJson(legacy.toJson()))
        assertEquals(legacy, legacy.copy())
    }

    @Test fun `ownership copy retains nested Apple refresh including explicit false`() {
        for (refresh in listOf(true, false)) {
            val original = VerifyAppOwnershipProps(apple = VerifyAppOwnershipOptionsIOS(refresh))
            val google = PlayIntegrityParamsAndroid("123456789", "request-hash")
            val copied = original.copy(google)
            assertSame(google, copied.google)
            assertEquals(refresh, copied.apple?.refresh)
            assertEquals(original, original.copy())
            assertEquals(original.hashCode(), original.copy().hashCode())
            assertEquals(original, VerifyAppOwnershipProps.fromJson(original.toJson()))
            assertNotEquals(original, VerifyAppOwnershipProps())
        }
    }

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
