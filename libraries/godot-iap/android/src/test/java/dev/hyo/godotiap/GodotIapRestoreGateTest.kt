package dev.hyo.godotiap

import kotlinx.coroutines.runBlocking
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
    fun `restore signals each owned purchase exactly once`() {
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
            // The restore loop stays the only emitter.
            signalled.addAll(listOf("a", "b"))
            assertEquals(listOf("a", "b"), signalled)
        }
    }

    @Test
    fun `unguarded listener emissions duplicate every restored purchase`() {
        val signalled = mutableListOf<String>()
        fakeHorizonRestore(signalled::add, listOf("a", "b"))
        signalled.addAll(listOf("a", "b"))
        assertEquals(listOf("a", "b", "a", "b"), signalled)
    }

    @Test
    fun `gate emits outside restore and resets after failure`() {
        runBlocking {
            val gate = GodotIapRestoreGate()
            assertTrue(gate.shouldEmit())
            val result = runCatching {
                gate.whileRestoring { throw IllegalStateException("store down") }
            }
            assertTrue(result.isFailure)
            assertTrue(gate.shouldEmit())
        }
    }
}
