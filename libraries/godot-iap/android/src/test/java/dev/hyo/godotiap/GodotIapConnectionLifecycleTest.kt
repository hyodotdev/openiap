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
import dev.hyo.godotiap.GodotIapConnectionLifecycle.Reconfigure

class GodotIapConnectionLifecycleTest {
    private val defaultConfig = mapOf<String, Any?>("program" to null)
    private val externalOffer = mapOf<String, Any?>("program" to "external-offer")

    private fun GodotIapConnectionLifecycle.connect(
        config: Map<String, Any?> = defaultConfig,
        connect: (Long) -> Boolean = { true },
    ) = init(
        config,
        connect = { generation, _ -> connect(generation) },
        reconfigure = { Reconfigure.Applied },
        disconnect = { true },
        cleanupListeners = {},
    )

    /** Connects without a config, recording the config each connect receives. */
    private fun GodotIapConnectionLifecycle.reconnect(
        requested: MutableList<Map<String, Any?>>,
        succeeds: Boolean = true,
    ) = init(
        null,
        connect = { _, config -> requested += config; succeeds },
        reconfigure = { Reconfigure.Applied },
        disconnect = { true },
        cleanupListeners = {},
    )

    @Test
    fun `a changed configuration reconfigures the live connection without connecting again`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val connects = AtomicInteger()
        val reconfigures = AtomicInteger()
        fun init(config: Map<String, Any?>?) = lifecycle.init(
            config,
            connect = { _, _ -> connects.incrementAndGet(); true },
            reconfigure = { reconfigures.incrementAndGet(); Reconfigure.Applied },
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
            connect = { _, _ -> error("already connected") },
            reconfigure = { Reconfigure.Failed },
            disconnect = { events += "disconnect"; true },
            cleanupListeners = { events += "listeners-removed" },
        )

        assertFalse(failed.success)
        assertFalse(lifecycle.isConnected)
        assertEquals(listOf("disconnect", "listeners-removed"), events)
        assertEquals(listOf("connected", "disconnected"), signals)
        // The program the app chose last stays for the reconnect, as native records it.
        val requested = mutableListOf<Map<String, Any?>>()
        assertTrue(lifecycle.reconnect(requested).didConnect)
        assertEquals(listOf(externalOffer), requested)
    }

    @Test
    fun `a throwing reconfiguration ends the connection and rethrows`() {
        val lifecycle = GodotIapConnectionLifecycle()
        lifecycle.connect()

        val thrown = runCatching {
            lifecycle.init(
                externalOffer,
                connect = { _, _ -> true },
                reconfigure = { error("billing unavailable") },
                disconnect = { true },
                cleanupListeners = {},
            )
        }.exceptionOrNull()

        assertTrue(thrown is IllegalStateException)
        assertFalse(lifecycle.isConnected)
        val requested = mutableListOf<Map<String, Any?>>()
        assertTrue(lifecycle.reconnect(requested).success)
        assertEquals(listOf(externalOffer), requested)
    }

    @Test
    fun `a refused rebuild keeps the connection, its config, and its listeners`() {
        val signals = Collections.synchronizedList(mutableListOf<String>())
        val lifecycle = GodotIapConnectionLifecycle { connected ->
            signals += if (connected) "connected" else "disconnected"
        }
        val teardowns = AtomicInteger()
        lifecycle.connect()

        val refused = lifecycle.init(
            externalOffer,
            connect = { _, _ -> error("already connected") },
            reconfigure = { Reconfigure.Refused },
            disconnect = { teardowns.incrementAndGet(); true },
            cleanupListeners = { teardowns.incrementAndGet() },
        )

        assertFalse(refused.success)
        assertTrue(lifecycle.isConnected)
        assertEquals(0, teardowns.get())
        assertEquals(listOf("connected"), signals)
        // The active config is unchanged, so the same request is tried again.
        val reconfigures = AtomicInteger()
        lifecycle.init(
            externalOffer,
            connect = { _, _ -> error("already connected") },
            reconfigure = { reconfigures.incrementAndGet(); Reconfigure.Applied },
            disconnect = { true },
            cleanupListeners = {},
        )
        assertEquals(1, reconfigures.get())
    }

    @Test
    fun `a reconnect after a drop keeps the billing program until end`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val requested = mutableListOf<Map<String, Any?>>()
        var dropped = 0L
        lifecycle.connect(externalOffer) { dropped = it; true }

        lifecycle.end(disconnect = { true }, cleanupListeners = {}, onlyGeneration = dropped)
        assertTrue(lifecycle.reconnect(requested).success)
        lifecycle.end(disconnect = { true }, cleanupListeners = {})
        assertTrue(lifecycle.reconnect(requested).success)
        // The drop kept the program; an explicit end did not.
        assertEquals(listOf(externalOffer, emptyMap<String, Any?>()), requested)
    }

    @Test
    fun `a failed connect keeps the billing program it asked for`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val requested = mutableListOf<Map<String, Any?>>()

        assertFalse(lifecycle.connect(externalOffer) { false }.success)
        assertFalse(lifecycle.reconnect(requested, succeeds = false).success)
        assertTrue(runCatching { lifecycle.connect(externalOffer) { error("no provider") } }.isFailure)
        assertTrue(lifecycle.reconnect(requested).success)
        assertEquals(listOf(externalOffer, externalOffer), requested)
    }

    @Test
    fun `end forgets the billing program even after a drop disconnected`() {
        val lifecycle = GodotIapConnectionLifecycle()
        val requested = mutableListOf<Map<String, Any?>>()
        var dropped = 0L
        lifecycle.connect(externalOffer) { dropped = it; true }
        lifecycle.end(disconnect = { true }, cleanupListeners = {}, onlyGeneration = dropped)

        val ended = lifecycle.end(disconnect = { true }, cleanupListeners = {})
        assertTrue(ended.success)
        assertFalse(ended.didEnd)
        assertTrue(lifecycle.reconnect(requested).success)
        assertEquals(listOf(emptyMap<String, Any?>()), requested)
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
