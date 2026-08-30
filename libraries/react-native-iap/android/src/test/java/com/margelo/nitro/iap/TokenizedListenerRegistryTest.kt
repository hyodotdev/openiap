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
    fun `stale remover cannot remove a listener added after clear`() {
        val registry = TokenizedListenerRegistry<() -> Unit>()
        val staleToken = registry.add { }
        registry.add { }

        registry.clear()
        val activeToken = registry.add { }

        assertEquals(3.0, activeToken, 0.0)
        assertFalse(registry.remove(staleToken))
        assertTrue(registry.isNotEmpty())
    }
}
