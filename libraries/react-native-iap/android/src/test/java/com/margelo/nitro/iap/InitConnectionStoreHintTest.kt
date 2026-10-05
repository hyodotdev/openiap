package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the init-failure contract HybridRnIap relies on: a failed
 * initConnection on a non-Play build names the linked store.
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
}
