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
