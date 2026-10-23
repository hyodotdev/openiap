package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the init-failure contract HybridRnIap relies on: a failed
 * initConnection on a non-Play build names the linked store, and a refused
 * rebuild keeps the connection.
 */
class InitConnectionStoreHintTest {
    @Test
    fun `non-Play stores are named in the init-failure message`() {
        for (store in listOf("horizon", "amazon")) {
            val error = OpenIapError.InitConnection.forStore(store)

            assertEquals(OpenIapError.InitConnection.CODE, error.code)
            assertTrue(error.message.contains(store))
        }
    }

    @Test
    fun `Play and unknown stores keep the plain message`() {
        for (store in listOf("play", null)) {
            val error = OpenIapError.InitConnection.forStore(store)

            assertEquals(OpenIapError.InitConnection.MESSAGE, error.message)
        }
    }

    @Test
    fun `a refused rebuild keeps the connection and a failed connect does not`() = runBlocking {
        val queue = ConnectionLifecycleQueue()
        val readiness = ConnectionReadiness()
        suspend fun init(operation: suspend () -> Boolean) {
            runCatching {
                queue.enqueueInit(operation, readiness::committed, readiness::failed).await()
            }
        }

        init { true }
        assertTrue(readiness.isInitialized)
        init {
            throw nativeInitFailure(
                OpenIapError.DeveloperError("initConnection cannot change the billing program while a purchase is in progress"),
                null,
            )
        }
        assertTrue("a refused rebuild keeps the live client", readiness.isInitialized)
        init { throw nativeInitFailure(IllegalStateException("setup failed"), null) }
        assertFalse("a failed connect leaves the store disconnected", readiness.isInitialized)
    }
}
