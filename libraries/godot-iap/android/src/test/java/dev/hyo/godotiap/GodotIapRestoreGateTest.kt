package dev.hyo.godotiap

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GodotIapRestoreGateTest {
    /** Horizon notifies every purchase listener synchronously per owned purchase. */
    private fun fakeHorizonRestore(emit: (String) -> Unit, owned: List<String>) {
        owned.forEach(emit)
    }

    @Test
    fun `restore drops listener emissions and reopens the gate`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val signalled = mutableListOf<String>()
            val listenerEmit = { purchase: String ->
                if (gate.shouldEmit()) signalled.add(purchase)
            }
            gate.whileRestoring {
                assertFalse(gate.shouldEmit())
                fakeHorizonRestore(listenerEmit, listOf("a", "b"))
            }
            assertTrue(signalled.isEmpty())
            assertTrue(gate.shouldEmit())
            listenerEmit("c")
            assertEquals(listOf("c"), signalled)
        }
    }

    @Test
    fun `gate reopens after a throwing restore`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val result = runCatching {
                gate.whileRestoring { throw IllegalStateException("store down") }
            }
            assertTrue(result.isFailure)
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `silent restore returns count and emits nothing`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val signalled = mutableListOf<String>()
            val listenerEmit = { purchase: String ->
                if (gate.shouldEmit()) signalled.add(purchase)
            }
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
                    suppressListener = true,
                    restore = { fakeHorizonRestore(listenerEmit, listOf("a", "b")) },
                    countAvailable = { 2 },
                    onFailure = { throw AssertionError("success must not report failure") },
                ),
            )
            assertTrue(result.getBoolean("success"))
            assertEquals(2, result.getInt("count"))
            assertTrue(signalled.isEmpty())
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `unsuppressed restore passes listener emissions through`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val signalled = mutableListOf<String>()
            val listenerEmit = { purchase: String ->
                if (gate.shouldEmit()) signalled.add(purchase)
            }
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
                    suppressListener = false,
                    restore = { listenerEmit("a") },
                    countAvailable = { 1 },
                    onFailure = { throw AssertionError("success must not report failure") },
                ),
            )
            assertTrue(result.getBoolean("success"))
            assertEquals(1, result.getInt("count"))
            assertEquals(listOf("a"), signalled)
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `throwing provider restore reports the error code and reopens the gate`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val failures = mutableListOf<Exception>()
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
                    suppressListener = true,
                    restore = { throw OpenIapError.UserCancelled() },
                    countAvailable = { throw AssertionError("a failing restore skips the query") },
                    onFailure = failures::add,
                ),
            )
            assertFalse(result.getBoolean("success"))
            assertEquals("user-cancelled", result.getString("code"))
            assertEquals(1, failures.size)
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `unsuppressed failing restore keeps the error code and the emission`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val signalled = mutableListOf<String>()
            val failures = mutableListOf<Exception>()
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
                    suppressListener = false,
                    restore = {
                        if (gate.shouldEmit()) signalled.add("a")
                        throw OpenIapError.UserCancelled()
                    },
                    countAvailable = { throw AssertionError("a failing restore skips the query") },
                    onFailure = failures::add,
                ),
            )
            assertFalse(result.getBoolean("success"))
            assertEquals("user-cancelled", result.getString("code"))
            assertEquals(listOf("a"), signalled)
            assertEquals(1, failures.size)
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `failing purchase query reports service error and reopens the gate`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val failures = mutableListOf<Exception>()
            var restored = false
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
                    suppressListener = true,
                    restore = { restored = true },
                    countAvailable = { throw IllegalStateException("store down") },
                    onFailure = failures::add,
                ),
            )
            assertTrue(restored)
            assertFalse(result.getBoolean("success"))
            assertEquals("service-error", result.getString("code"))
            assertEquals(1, failures.size)
            assertTrue(gate.shouldEmit())
        }
    }

    @Test
    fun `restore before connecting keeps the not-prepared code`() {
        val result = JSONObject(restoreNotInitialized())
        assertFalse(result.getBoolean("success"))
        assertEquals("not-prepared", result.getString("code"))
        assertEquals("IAP connection is not initialized", result.getString("error"))
    }

    @Test
    fun `suppression follows the connected provider`() {
        assertTrue(shouldSuppressRestoreListeners("horizon"))
        listOf("play", "amazon", "community-fixture", "", "  ", null).forEach { storeId ->
            assertFalse("storeId=$storeId", shouldSuppressRestoreListeners(storeId))
        }
    }
}
