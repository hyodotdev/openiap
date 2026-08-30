package com.margelo.nitro.iap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingEventBufferTest {
    @Test
    fun `zero-listener backlog flushes FIFO and preserves arrivals during flush`() {
        val buffer = PendingEventBuffer<Int>(capacity = 4, onOverflow = {})

        assertTrue(buffer.enqueueIfNeeded(hasListeners = false, event = 1))
        assertTrue(buffer.enqueueIfNeeded(hasListeners = false, event = 2))
        assertTrue(buffer.beginFlushIfNeeded())
        assertEquals(listOf(1, 2), buffer.takeBatchOrFinish())

        // A live listener now exists, but events arriving while the backlog is
        // flushing must queue behind it instead of overtaking it.
        assertTrue(buffer.enqueueIfNeeded(hasListeners = true, event = 3))
        assertEquals(listOf(3), buffer.takeBatchOrFinish())
        assertNull(buffer.takeBatchOrFinish())

        assertFalse(buffer.enqueueIfNeeded(hasListeners = true, event = 4))
    }

    @Test
    fun `listeners added during flush receive only subsequent arrivals`() {
        val buffer = PendingEventBuffer<Int>(capacity = 4, onOverflow = {})
        val firstReceived = mutableListOf<Int>()
        val secondReceived = mutableListOf<Int>()
        val listeners = mutableListOf<(Int) -> Unit>()
        val secondListener: (Int) -> Unit = { secondReceived.add(it) }
        val firstListener: (Int) -> Unit = { event ->
            firstReceived.add(event)
            if (event == 1) {
                listeners.add(secondListener)
                assertTrue(buffer.enqueueIfNeeded(hasListeners = true, event = 3))
            }
        }
        listeners.add(firstListener)

        assertTrue(buffer.enqueueIfNeeded(hasListeners = false, event = 1))
        assertTrue(buffer.enqueueIfNeeded(hasListeners = false, event = 2))
        assertTrue(buffer.beginFlushIfNeeded())

        drainPendingEvents(
            takeDelivery = {
                buffer.takeBatchOrFinish()?.let { events ->
                    PendingEventDelivery(events, listeners.toList())
                }
            },
            onDeliveryFailure = { throw it },
        )

        assertEquals(listOf(1, 2, 3), firstReceived)
        assertEquals(listOf(3), secondReceived)
    }

    @Test
    fun `singleton bridge listener removal ignores regenerated wrapper identity`() {
        val buffer = PendingEventBuffer<String>(capacity = 4, onOverflow = {})
        val registeredListeners = mutableListOf<(String) -> Unit>()
        val firstReceived = mutableListOf<String>()
        val firstBridgeWrapper: (String) -> Unit = { firstReceived.add(it) }
        registeredListeners.add(firstBridgeWrapper)

        // Nitro creates a new Kotlin callback wrapper for remove even though JS
        // passes the same function. Removal must therefore not use identity.
        val removalBridgeWrapper: (String) -> Unit = { firstBridgeWrapper(it) }
        assertFalse(firstBridgeWrapper === removalBridgeWrapper)
        removeSingletonBridgeListener(registeredListeners, removalBridgeWrapper)

        assertTrue(buffer.enqueueIfNeeded(registeredListeners.isNotEmpty(), "gap"))

        val remountedReceived = mutableListOf<String>()
        registeredListeners.add { remountedReceived.add(it) }
        assertTrue(buffer.beginFlushIfNeeded())
        drainPendingEvents(
            takeDelivery = {
                buffer.takeBatchOrFinish()?.let { events ->
                    PendingEventDelivery(events, registeredListeners.toList())
                }
            },
            onDeliveryFailure = { throw it },
        )

        val liveEvent = "live"
        assertFalse(buffer.enqueueIfNeeded(registeredListeners.isNotEmpty(), liveEvent))
        registeredListeners.toList().forEach { it(liveEvent) }

        assertTrue(firstReceived.isEmpty())
        assertEquals(listOf("gap", "live"), remountedReceived)
    }

    @Test
    fun `overflow drops the oldest event and reports each drop`() {
        var overflowCount = 0
        val buffer = PendingEventBuffer<Int>(capacity = 2) { overflowCount += 1 }

        buffer.enqueueIfNeeded(hasListeners = false, event = 1)
        buffer.enqueueIfNeeded(hasListeners = false, event = 2)
        buffer.enqueueIfNeeded(hasListeners = false, event = 3)

        assertTrue(buffer.beginFlushIfNeeded())
        assertEquals(listOf(2, 3), buffer.takeBatchOrFinish())
        assertEquals(1, overflowCount)
    }

    @Test
    fun `clear resets pending and flushing state`() {
        val buffer = PendingEventBuffer<Int>(capacity = 2, onOverflow = {})
        buffer.enqueueIfNeeded(hasListeners = false, event = 1)
        assertTrue(buffer.beginFlushIfNeeded())

        buffer.clear()

        assertFalse(buffer.beginFlushIfNeeded())
        assertFalse(buffer.enqueueIfNeeded(hasListeners = true, event = 2))
    }
}
