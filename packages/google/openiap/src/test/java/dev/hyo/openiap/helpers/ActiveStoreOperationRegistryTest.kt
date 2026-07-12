package dev.hyo.openiap.helpers

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ActiveStoreOperationRegistryTest {
    @Test
    fun `end fails an operation even when the native callback never arrives`() = runTest {
        val lock = Any()
        val client = Any()
        var connection = ActiveStoreConnection(client, 0L)
        val registry = ActiveStoreOperationRegistry(lock) { connection }
        val issued = CompletableDeferred<Unit>()
        val pending = async {
            runCatching {
                registry.await<Unit>(client) { issued.complete(Unit) }
            }
        }
        issued.await()

        val failures = synchronized(lock) {
            connection = ActiveStoreConnection(null, 1L)
            registry.invalidate(client) {
                OpenIapError.ServiceDisconnected("connection ended")
            }
        }
        failures.forEach { it() }

        assertTrue(pending.await().exceptionOrNull() is OpenIapError.ServiceDisconnected)
        assertEquals(0, registry.size())
    }

    @Test
    fun `stale client callback cannot resume or repopulate cache after reconnect`() = runTest {
        val lock = Any()
        val oldClient = Any()
        val newClient = Any()
        var connection = ActiveStoreConnection(oldClient, 0L)
        val registry = ActiveStoreOperationRegistry(lock) { connection }
        val oldCallback = CompletableDeferred<ActiveStoreOperationCompletion<String>>()
        var cache: String? = null
        val oldResult = async {
            runCatching {
                registry.await(oldClient) { oldCallback.complete(it) }
            }
        }
        val callback = oldCallback.await()

        val failures = synchronized(lock) {
            connection = ActiveStoreConnection(newClient, 1L)
            registry.invalidate(oldClient) {
                OpenIapError.ServiceDisconnected("client replaced")
            }
        }
        failures.forEach { it() }
        assertTrue(oldResult.await().exceptionOrNull() is OpenIapError.ServiceDisconnected)

        callback.succeed("stale") { cache = "stale" }
        assertNull(cache)

        val fresh = registry.await(newClient) { operation ->
            operation.succeed("fresh") { cache = "fresh" }
        }
        assertEquals("fresh", fresh)
        assertEquals("fresh", cache)
    }

    @Test
    fun `late listener callback from a replaced connection is ignored`() {
        val lock = Any()
        val oldClient = Any()
        val newClient = Any()
        var connection = ActiveStoreConnection(oldClient, 0L)
        val oldOwner = ActiveStoreListenerOwner(lock, { connection }, { oldClient }, 0L)
        val events = mutableListOf<String>()
        val oldCallback = { oldOwner.deliver { events += "old" } }

        synchronized(lock) {
            connection = ActiveStoreConnection(newClient, 1L)
        }
        oldCallback()
        ActiveStoreListenerOwner(lock, { connection }, { newClient }, 1L)
            .deliver { events += "new" }

        assertEquals(listOf("new"), events)
    }

    @Test
    fun `resumed old query cannot reclaim derived state after replacement reset`() {
        val lock = Any()
        val oldClient = Any()
        val newClient = Any()
        var connection = ActiveStoreConnection(oldClient, 0L)
        val oldOwner = ActiveStoreListenerOwner(lock, { connection }, { oldClient }, 0L)
        val claimedTokens = mutableSetOf("old-token")
        val queryResumed = CountDownLatch(1)
        val continueNotification = CountDownLatch(1)
        var notified = false
        val oldResult = thread {
            queryResumed.countDown()
            check(continueNotification.await(5, TimeUnit.SECONDS))
            notified = oldOwner.claim { claimedTokens.add("stale-token") } == true
        }

        assertTrue(queryResumed.await(5, TimeUnit.SECONDS))
        synchronized(lock) {
            connection = ActiveStoreConnection(newClient, 1L)
            claimedTokens.clear()
        }
        continueNotification.countDown()
        oldResult.join()

        assertEquals(false, notified)
        assertTrue(claimedTokens.isEmpty())
    }

    @Test
    fun `listener callback does not hold the lifecycle lock`() {
        val lock = Any()
        val oldClient = Any()
        val newClient = Any()
        var connection = ActiveStoreConnection(oldClient, 0L)
        val owner = ActiveStoreListenerOwner(lock, { connection }, { oldClient }, 0L)
        val callbackEntered = CountDownLatch(1)
        val releaseCallback = CountDownLatch(1)
        val replacementStarted = CountDownLatch(1)
        val replacementFinished = CountDownLatch(1)

        val callback = thread {
            owner.deliver {
                callbackEntered.countDown()
                check(releaseCallback.await(5, TimeUnit.SECONDS))
            }
        }
        assertTrue(callbackEntered.await(5, TimeUnit.SECONDS))
        val replacement = thread {
            replacementStarted.countDown()
            synchronized(lock) {
                connection = ActiveStoreConnection(newClient, 1L)
            }
            replacementFinished.countDown()
        }

        assertTrue(replacementStarted.await(5, TimeUnit.SECONDS))
        try {
            assertTrue(replacementFinished.await(1, TimeUnit.SECONDS))
        } finally {
            releaseCallback.countDown()
        }
        callback.join()
        replacement.join()
    }

    @Test
    fun `client replacement and setup failure reset derived state`() {
        val oldClient = Any()
        val newClient = Any()
        var resets = 0

        assertSame(newClient, transitionStoreConnection(oldClient, newClient) { resets += 1 })
        assertSame(newClient, transitionStoreConnection(newClient, newClient) { resets += 1 })
        assertNull(transitionStoreConnection(newClient, null) { resets += 1 })

        assertEquals(2, resets)
    }
}
