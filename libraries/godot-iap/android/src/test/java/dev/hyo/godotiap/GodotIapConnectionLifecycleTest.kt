package dev.hyo.godotiap

import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GodotIapConnectionLifecycleTest {
    private val defaultConfig = mapOf<String, Any?>("program" to null)

    @Test
    fun `same configuration is idempotent and different configuration is rejected`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val connects = AtomicInteger()
        val mismatches = AtomicInteger()

        assertTrue(lifecycle.init(defaultConfig, {}, { connects.incrementAndGet(); true }).success)
        val repeated = lifecycle.init(defaultConfig, {}, { connects.incrementAndGet(); true })
        val changed = lifecycle.init(
            mapOf("program" to "external-offer"),
            { mismatches.incrementAndGet() },
            { connects.incrementAndGet(); true },
        )

        assertTrue(repeated.success)
        assertFalse(repeated.didConnect)
        assertFalse(changed.success)
        assertEquals(1, connects.get())
        assertEquals(1, mismatches.get())
    }

    @Test
    fun `end waits for in-flight init and leaves lifecycle disconnected`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val initEntered = CountDownLatch(1)
        val allowInit = CountDownLatch(1)
        val endCompleted = CountDownLatch(1)

        val initThread = thread {
            lifecycle.init(defaultConfig, {}) {
                initEntered.countDown()
                assertTrue(allowInit.await(5, TimeUnit.SECONDS))
                true
            }
        }
        assertTrue(initEntered.await(5, TimeUnit.SECONDS))

        val endThread = thread {
            lifecycle.end(disconnect = { true }, cleanupListeners = {})
            endCompleted.countDown()
        }
        assertFalse(endCompleted.await(100, TimeUnit.MILLISECONDS))
        allowInit.countDown()

        initThread.join(5_000)
        endThread.join(5_000)
        assertTrue(endCompleted.await(1, TimeUnit.SECONDS))
        assertFalse(lifecycle.isConnected)
    }

    @Test
    fun `pending failure is delivered before listeners are removed`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val events = Collections.synchronizedList(mutableListOf<String>())
        lifecycle.init(defaultConfig, {}, { true })

        val result = lifecycle.end(
            disconnect = {
                events += "pending-error"
                true
            },
            cleanupListeners = { events += "listeners-removed" },
        )

        assertTrue(result.success)
        assertEquals(listOf("pending-error", "listeners-removed"), events)
    }

    @Test
    fun `listener cleanup failure cannot wedge the lifecycle`() {
        val lifecycle = GodotIapConnectionLifecycle()
        lifecycle.init(defaultConfig, {}, { true })

        runCatching {
            lifecycle.end(
                disconnect = { true },
                cleanupListeners = { error("listener removal failed") },
            )
        }

        assertFalse(lifecycle.isConnected)
        assertTrue(lifecycle.init(defaultConfig, {}, { true }).success)
    }
}
