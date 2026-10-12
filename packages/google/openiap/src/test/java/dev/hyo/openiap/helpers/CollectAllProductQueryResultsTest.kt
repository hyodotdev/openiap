package dev.hyo.openiap.helpers

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CollectAllProductQueryResultsTest {
    @Test
    fun `runs both product kinds concurrently and keeps partial success`() = runTest {
        val inAppStarted = CompletableDeferred<Unit>()
        val subscriptionsStarted = CompletableDeferred<Unit>()

        val results = withTimeout(1_000) {
            collectAllProductQueryResults(
                queryInApp = {
                    inAppStarted.complete(Unit)
                    subscriptionsStarted.await()
                    "in-app"
                },
                querySubscriptions = {
                    subscriptionsStarted.complete(Unit)
                    inAppStarted.await()
                    throw IllegalStateException("Subscriptions unavailable")
                },
            )
        }

        assertEquals("in-app", results.inApp)
        assertNull(results.subscriptions)
    }

    @Test
    fun `throws the in-app failure when both kinds fail`() = runTest {
        val inAppFailure = IllegalStateException("in-app unavailable")

        val thrown = runCatching {
            collectAllProductQueryResults<String>(
                queryInApp = { throw inAppFailure },
                querySubscriptions = { throw IllegalArgumentException("subscriptions unavailable") },
            )
        }.exceptionOrNull()

        assertSameFailure(inAppFailure, thrown)
    }

    @Test
    fun `propagates cancellation and cancels its sibling`() = runTest {
        val cancellation = CancellationException("Cancelled")
        val subscriptionQueryStarted = CompletableDeferred<Unit>()
        var subscriptionQueryCancelled = false

        val thrown = try {
            withTimeout(1_000) {
                collectAllProductQueryResults(
                    queryInApp = {
                        subscriptionQueryStarted.await()
                        throw cancellation
                    },
                    querySubscriptions = {
                        subscriptionQueryStarted.complete(Unit)
                        try {
                            awaitCancellation()
                        } finally {
                            subscriptionQueryCancelled = true
                        }
                    },
                )
            }
            throw AssertionError("Expected CancellationException")
        } catch (error: CancellationException) {
            error
        }

        assertEquals(cancellation.message, thrown.message)
        assertTrue(subscriptionQueryCancelled)
    }

    @Test
    fun `never recovers a fatal error or a dropped connection`() = runTest {
        for (expected in listOf<Throwable>(AssertionError("Fatal"), OpenIapError.ServiceDisconnected("dropped"))) {
            val thrown = runCatching {
                collectAllProductQueryResults(
                    queryInApp = { throw expected },
                    querySubscriptions = { "subscriptions" },
                )
            }.exceptionOrNull()

            assertSameFailure(expected, thrown)
        }
    }

    // Coroutine stack-trace recovery may rethrow a copy, so compare type and message.
    private fun assertSameFailure(expected: Throwable, actual: Throwable?) {
        assertEquals(expected.javaClass, actual?.javaClass)
        assertEquals(expected.message, actual?.message)
    }
}
