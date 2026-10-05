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
    fun `throwing provider restore reports the error code and reopens the gate`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val failures = mutableListOf<Exception>()
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
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
    fun `failing purchase query reports service error and reopens the gate`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            val failures = mutableListOf<Exception>()
            var restored = false
            val result = JSONObject(
                runSilentRestore(
                    gate = gate,
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
}
