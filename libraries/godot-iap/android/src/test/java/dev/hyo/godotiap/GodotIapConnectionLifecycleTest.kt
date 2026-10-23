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
    private val externalOffer = mapOf<String, Any?>("program" to "external-offer")

    private fun GodotIapConnectionLifecycle.connect(
        config: Map<String, Any?> = defaultConfig,
        connect: (Long) -> Boolean = { true },
    ) = init(config, connect, reconfigure = { true }, disconnect = { true }, cleanupListeners = {})

    @Test
    fun `a changed configuration reconfigures the live connection without connecting again`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val connects = AtomicInteger()
        val reconfigures = AtomicInteger()
        fun init(config: Map<String, Any?>?) = lifecycle.init(
            config,
            connect = { connects.incrementAndGet(); true },
            reconfigure = { reconfigures.incrementAndGet(); true },
            disconnect = { true },
            cleanupListeners = {},
        )

        assertTrue(init(defaultConfig).didConnect)
        val repeated = init(defaultConfig)
        val changed = init(externalOffer)
        val changedAgain = init(externalOffer)
        val kept = init(null)
        assertEquals(1, reconfigures.get())
        // An explicit empty config returns to Standard.
        val standard = init(emptyMap())

        assertTrue(repeated.success && changed.success && changedAgain.success && kept.success && standard.success)
        assertFalse(changed.didConnect)
        // Listeners attach only when connecting, so a reconfigure cannot add them twice.
        assertEquals(1, connects.get())
        assertEquals(2, reconfigures.get())
        assertTrue(lifecycle.isConnected)
    }

    @Test
    fun `a failed reconfiguration ends the connection`() {
        val signals = Collections.synchronizedList(mutableListOf<String>())
        val lifecycle = GodotIapConnectionLifecycle { connected ->
            signals += if (connected) "connected" else "disconnected"
        }
        val events = mutableListOf<String>()
        lifecycle.connect()

        val failed = lifecycle.init(
            externalOffer,
            connect = { error("already connected") },
            reconfigure = { false },
            disconnect = { events += "disconnect"; true },
            cleanupListeners = { events += "listeners-removed" },
        )

        assertFalse(failed.success)
        assertFalse(lifecycle.isConnected)
        assertEquals(listOf("disconnect", "listeners-removed"), events)
        assertEquals(listOf("connected", "disconnected"), signals)
        assertTrue(lifecycle.connect(externalOffer).didConnect)
    }

    @Test
    fun `a throwing reconfiguration ends the connection and rethrows`() {
        val lifecycle = GodotIapConnectionLifecycle()
        lifecycle.connect()

        val thrown = runCatching {
            lifecycle.init(
                externalOffer,
                connect = { true },
                reconfigure = { error("billing unavailable") },
                disconnect = { true },
                cleanupListeners = {},
            )
        }.exceptionOrNull()

        assertTrue(thrown is IllegalStateException)
        assertFalse(lifecycle.isConnected)
    }

    @Test
    fun `a late teardown for a dropped connection leaves a newer one alone`() {
        val lifecycle = GodotIapConnectionLifecycle()
        var dropped = 0L
        assertTrue(lifecycle.connect { dropped = it; true }.success)
        // The app reconnects before the dropped connection's teardown runs.
        assertTrue(lifecycle.end(disconnect = { true }, cleanupListeners = {}).didEnd)
        var current = 0L
        assertTrue(lifecycle.connect { current = it; true }.success)

        var disconnects = 0
        val late = lifecycle.end(disconnect = { disconnects++; true }, cleanupListeners = {}, onlyGeneration = dropped)
        assertFalse(late.didEnd)
        assertEquals(0, disconnects)
        assertTrue(lifecycle.isConnected)

        assertTrue(lifecycle.end(disconnect = { true }, cleanupListeners = {}, onlyGeneration = current).didEnd)
        assertFalse(lifecycle.isConnected)
    }

    @Test
    fun `a drop reported before connect returns still ends that connection`() {
        val lifecycle = GodotIapConnectionLifecycle()
        var dropped = 0L
        // Native setup finished, then the service dropped before connect returned.
        assertTrue(lifecycle.connect { dropped = it; true }.success)

        val queued = lifecycle.end(disconnect = { true }, cleanupListeners = {}, onlyGeneration = dropped)
        assertTrue(queued.didEnd)
        assertFalse(lifecycle.isConnected)
    }

    @Test
    fun `a drop queued during init signals connected before disconnected`() {
        val signals = Collections.synchronizedList(mutableListOf<String>())
        val dropEnded = CountDownLatch(1)
        val lifecycle = GodotIapConnectionLifecycle { connected ->
            // A slow `connected` gives a drop outside the lock time to overtake it.
            if (connected) dropEnded.await(200, TimeUnit.MILLISECONDS)
            signals += if (connected) "connected" else "disconnected"
        }

        lateinit var drop: Thread
        lifecycle.connect { generation ->
            drop = thread {
                lifecycle.end(disconnect = { true }, cleanupListeners = {}, onlyGeneration = generation)
                dropEnded.countDown()
            }
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            while (drop.state != Thread.State.BLOCKED && System.nanoTime() < deadline) Thread.yield()
            true
        }
        drop.join(5_000)

        assertEquals(listOf("connected", "disconnected"), signals)
        assertFalse(lifecycle.isConnected)
    }

    @Test
    fun `end waits for in-flight init and leaves lifecycle disconnected`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val initEntered = CountDownLatch(1)
        val allowInit = CountDownLatch(1)
        val endCompleted = CountDownLatch(1)

        val initThread = thread {
            lifecycle.connect {
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
        lifecycle.connect()

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
        lifecycle.connect()

        runCatching {
            lifecycle.end(
                disconnect = { true },
                cleanupListeners = { error("listener removal failed") },
            )
        }

        assertFalse(lifecycle.isConnected)
        assertTrue(lifecycle.connect().success)
    }
}
