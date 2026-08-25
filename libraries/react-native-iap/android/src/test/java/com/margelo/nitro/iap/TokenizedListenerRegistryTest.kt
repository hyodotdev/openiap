package com.margelo.nitro.iap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenizedListenerRegistryTest {
    @Test
    fun `removing one token preserves the other listener`() {
        val registry = TokenizedListenerRegistry<(String) -> Unit>()
        val events = mutableListOf<String>()
        val firstToken = registry.add { events.add("first:$it") }
        val secondToken = registry.add { events.add("second:$it") }

        assertEquals(2.0, secondToken, 0.0)
        assertTrue(registry.remove(firstToken))
        registry.snapshot().forEach { it("purchase") }

        assertEquals(listOf("second:purchase"), events)
    }

    @Test
    fun `removing an unknown token preserves all listeners`() {
        val registry = TokenizedListenerRegistry<(String) -> Unit>()
        registry.add { }
        registry.add { }

        assertFalse(registry.remove(999.0))

        assertEquals(2, registry.snapshot().size)
    }

    @Test
    fun `clear removes all listeners and resets token allocation`() {
        val registry = TokenizedListenerRegistry<() -> Unit>()
        registry.add { }
        registry.add { }

        registry.clear()

        assertFalse(registry.isNotEmpty())
        assertEquals(1.0, registry.add { }, 0.0)
    }
}
