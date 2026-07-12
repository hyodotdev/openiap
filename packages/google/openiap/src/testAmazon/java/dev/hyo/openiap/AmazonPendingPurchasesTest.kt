package dev.hyo.openiap

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AmazonPendingPurchasesTest {
    @Test
    @OptIn(ExperimentalCoroutinesApi::class)
    fun `purchase update pagination sessions are serialized`() = runTest {
        val session = AmazonPurchaseUpdatesSession()
        val firstEntered = CompletableDeferred<Unit>()
        val releaseFirst = CompletableDeferred<Unit>()
        val order = mutableListOf<String>()

        val first = async {
            session.run {
                order += "first-start"
                firstEntered.complete(Unit)
                releaseFirst.await()
                order += "first-end"
            }
        }
        firstEntered.await()
        val second = async { session.run { order += "second" } }

        runCurrent()
        assertEquals(listOf("first-start"), order)

        releaseFirst.complete(Unit)
        first.await()
        second.await()
        assertEquals(listOf("first-start", "first-end", "second"), order)
    }

    @Test
    fun `Amazon storefront uses marketplace instead of residence country`() {
        val marketplace = "US"
        val residenceCountry = "KR"
        val storefront = resolveAmazonStorefront(marketplace)

        assertEquals(marketplace, storefront)
        assertNotEquals(residenceCountry, storefront)
    }

    @Test
    fun `Amazon storefront rejects blank marketplace instead of using country`() {
        var thrown: Throwable? = null

        try {
            resolveAmazonStorefront(" ")
        } catch (error: Throwable) {
            thrown = error
        }

        assertTrue(thrown is OpenIapError.UnknownError)
    }

    @Test
    fun `Amazon registration enables pending purchases before use`() {
        val calls = mutableListOf<String>()

        configureAmazonPurchasingService(
            registerListener = { calls += "register-listener" },
            enablePendingPurchases = { calls += "enable-pending-purchases" },
        )

        assertEquals(
            listOf("register-listener", "enable-pending-purchases"),
            calls,
        )
    }

    @Test
    fun `end invalidates a request issued before pending wait installation`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("request-1", generation))

        assertEquals(setOf("request-1"), lifecycle.endGeneration())
        assertFalse(lifecycle.isCurrent(issued))
        assertFalse(lifecycle.installIfCurrent(issued) { error("must not install") })
    }

    @Test
    fun `request returned after end cannot join the new generation`() {
        val lifecycle = AmazonRequestLifecycle()
        val staleGeneration = lifecycle.beginIssue()

        lifecycle.endGeneration()

        assertNull(lifecycle.registerIssued("late-request", staleGeneration))
    }

    @Test
    fun `end before UI dispatch prevents the native issue`() {
        val lifecycle = AmazonRequestLifecycle()
        val capturedGeneration = lifecycle.currentGeneration()
        var nativeCalled = false

        lifecycle.endGeneration()

        assertNull(
            lifecycle.issueIfCurrent(capturedGeneration) {
                nativeCalled = true
                "late-request"
            }
        )
        assertFalse(nativeCalled)
    }

    @Test
    fun `pagination cannot issue a new page after generation end`() {
        val lifecycle = AmazonRequestLifecycle()
        val operationGeneration = lifecycle.currentGeneration()
        val first = checkNotNull(
            lifecycle.issueIfCurrent(operationGeneration) { "page-1" }
        )
        val issued = checkNotNull(
            lifecycle.registerIssued(first.request.toString(), first.generation)
        )
        assertTrue(lifecycle.completeIfCurrent(issued.requestId))

        lifecycle.endGeneration()

        assertNull(lifecycle.issueIfCurrent(operationGeneration) { "page-2" })
    }

    @Test
    fun `current issued request installs exactly once before end`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("request-2", generation))
        var installed = false

        assertTrue(lifecycle.installIfCurrent(issued) { installed = true })
        assertTrue(installed)
        assertTrue(lifecycle.isCurrent(issued))
    }

    @Test
    fun `end wins against a late pending response claim`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("pending-response", generation))
        var completed = false

        lifecycle.endGeneration()

        assertFalse(
            lifecycle.completeIfCurrent(issued.requestId) { completed = true }
        )
        assertFalse(completed)
    }

    @Test
    fun `end wins against a cached early response claim`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("early-response", generation))
        val earlyResponses = mutableMapOf<String, String>()

        lifecycle.endGeneration { earlyResponses.clear() }

        assertFalse(
            lifecycle.cacheIfCurrent(issued.requestId) {
                earlyResponses[issued.requestId] = "late"
            }
        )
        assertTrue(earlyResponses.isEmpty())
    }

    @Test
    fun `end clears an early response that won the cache race`() {
        val lifecycle = AmazonRequestLifecycle()
        val requestId = "early-response-first"
        lifecycle.beginIssue()
        val earlyResponses = mutableMapOf<String, String>()

        assertTrue(
            lifecycle.cacheIfCurrent(requestId) {
                earlyResponses[requestId] = "response"
            }
        )

        lifecycle.endGeneration { earlyResponses.clear() }

        assertTrue(earlyResponses.isEmpty())
    }

    @Test
    fun `response completion immediately after wait installation stays accepted`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("installed-response", generation))
        var installed = false
        var completed = false

        assertTrue(lifecycle.installIfCurrent(issued) { installed = true })
        assertTrue(
            lifecycle.completeIfCurrent(issued.requestId) { completed = true }
        )

        assertTrue(installed)
        assertTrue(completed)
        assertFalse(lifecycle.isCurrent(issued))
    }

    @Test
    fun `response claim removes ownership before a later end`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val issued = checkNotNull(lifecycle.registerIssued("response-wins", generation))
        var completed = false

        assertTrue(
            lifecycle.completeIfCurrent(issued.requestId) { completed = true }
        )

        assertTrue(completed)
        assertEquals(emptySet<String>(), lifecycle.endGeneration())
    }

    @Test
    fun `issued request metadata is installed before end can invalidate it`() {
        val lifecycle = AmazonRequestLifecycle()
        val generation = lifecycle.beginIssue()
        val metadata = mutableMapOf<String, String>()

        lifecycle.registerIssued("purchase-1", generation) { requestId ->
            metadata[requestId] = "premium"
        }
        val aborted = lifecycle.endGeneration()

        assertEquals(setOf("purchase-1"), aborted)
        assertEquals("premium", metadata["purchase-1"])
    }

    @Test
    fun `end reports only request ids from the ended generation`() {
        val lifecycle = AmazonRequestLifecycle()
        val oldGeneration = lifecycle.beginIssue()
        checkNotNull(lifecycle.registerIssued("old-request", oldGeneration))

        val aborted = lifecycle.endGeneration()
        val newGeneration = lifecycle.beginIssue()
        val current = checkNotNull(lifecycle.registerIssued("new-request", newGeneration))

        assertEquals(setOf("old-request"), aborted)
        assertFalse("new-request" in aborted)
        assertTrue(lifecycle.isCurrent(current))
    }

    @Test
    fun `aborted request tombstones stay bounded`() {
        val ids = BoundedAmazonRequestIds(maximumSize = 2)

        ids.addAll(listOf("request-1", "request-2", "request-3"))

        assertEquals(2, ids.size())
        assertFalse(ids.remove("request-1"))
        assertTrue(ids.remove("request-2"))
        assertTrue(ids.remove("request-3"))
    }
}
