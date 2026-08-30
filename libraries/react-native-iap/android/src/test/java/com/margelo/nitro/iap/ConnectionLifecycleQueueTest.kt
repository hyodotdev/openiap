package com.margelo.nitro.iap

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class ConnectionLifecycleQueueTest {
    @Test(timeout = 5_000)
    fun `end preserves false and still cleans up`() = runBlocking {
        val cleanedUp = AtomicBoolean(false)

        val result = endRnConnectionWithCleanup(
            endConnection = { false },
            cleanup = { cleanedUp.set(true) },
        )

        assertFalse(result)
        assertTrue(cleanedUp.get())
    }

    @Test(timeout = 5_000)
    fun `later end invalidates a pending init even when end awaits first`() =
        runBlocking {
            val queue = ConnectionLifecycleQueue()
            val invalidation = IllegalStateException("connection ended")
            val initCalls = AtomicInteger()
            val endCalls = AtomicInteger()
            val init =
                queue.enqueueInit(
                    operation = {
                        initCalls.incrementAndGet()
                        true
                    },
                    onCommitted = {},
                    onFailed = {},
                )
            val end =
                queue.enqueueEnd(invalidation) {
                    endCalls.incrementAndGet()
                    true
                }

            val endResult = async { end.await() }
            val initResult = async { runCatching { init.await() } }

            assertEquivalentFailure(invalidation, initResult.await().exceptionOrNull())
            assertTrue(endResult.await())
            assertEquals(0, initCalls.get())
            assertEquals(1, endCalls.get())
        }

    @Test(timeout = 5_000)
    fun `init invoked after end waits for end regardless of coroutine start order`() =
        runBlocking {
            val queue = ConnectionLifecycleQueue()
            val endMayFinish = CompletableDeferred<Unit>()
            val events = mutableListOf<String>()
            val end =
                queue.enqueueEnd(IllegalStateException("unused")) {
                    events += "end-start"
                    endMayFinish.await()
                    events += "end-finish"
                    true
                }
            val init =
                queue.enqueueInit(
                    operation = {
                        events += "init"
                        true
                    },
                    onCommitted = {},
                    onFailed = {},
                )

            val initResult = async { init.await() }
            val endResult = async { end.await() }
            while (events.isEmpty()) kotlinx.coroutines.yield()
            assertEquals(listOf("end-start"), events)

            endMayFinish.complete(Unit)
            assertTrue(endResult.await())
            assertTrue(initResult.await())
            assertEquals(listOf("end-start", "end-finish", "init"), events)
        }

    @Test(timeout = 5_000)
    fun `consecutive init callers share one failure`() =
        runBlocking {
            val queue = ConnectionLifecycleQueue()
            val failure = IllegalArgumentException("setup failed")
            val calls = AtomicInteger()
            val first =
                queue.enqueueInit(
                    operation = {
                        calls.incrementAndGet()
                        throw failure
                    },
                    onCommitted = {},
                    onFailed = {},
                )
            val second =
                queue.enqueueInit(
                    operation = {
                        calls.incrementAndGet()
                        true
                    },
                    onCommitted = {},
                    onFailed = {},
                )

            val secondResult = async { runCatching { second.await() } }
            val firstResult = async { runCatching { first.await() } }

            assertEquivalentFailure(failure, firstResult.await().exceptionOrNull())
            assertEquivalentFailure(failure, secondResult.await().exceptionOrNull())
            assertEquals(1, calls.get())
        }

    @Test(timeout = 5_000)
    fun `a later reconnect runs a fresh init operation`() =
        runBlocking {
            val queue = ConnectionLifecycleQueue()
            val calls = AtomicInteger()
            val operation: suspend () -> Boolean = {
                calls.incrementAndGet()
                true
            }

            val first =
                queue.enqueueInit(
                    operation = operation,
                    onCommitted = {},
                    onFailed = {},
                )
            assertTrue(first.await())

            val reconnect =
                queue.enqueueInit(
                    operation = operation,
                    onCommitted = {},
                    onFailed = {},
                )
            assertTrue(reconnect.await())
            assertEquals(2, calls.get())
        }

    @Test(timeout = 5_000)
    fun `end during native init prevents commit and runs after native returns`() =
        runBlocking {
            val queue = ConnectionLifecycleQueue()
            val nativeStarted = CompletableDeferred<Unit>()
            val nativeMayFinish = CompletableDeferred<Unit>()
            val invalidation = IllegalStateException("connection ended")
            val committed = AtomicBoolean(false)
            val failed = AtomicBoolean(false)
            val events = mutableListOf<String>()
            val init =
                queue.enqueueInit(
                    operation = {
                        events += "init-start"
                        nativeStarted.complete(Unit)
                        nativeMayFinish.await()
                        events += "init-finish"
                        true
                    },
                    onCommitted = { committed.set(true) },
                    onFailed = { failed.set(true) },
                )
            val initResult = async { runCatching { init.await() } }
            nativeStarted.await()

            val end =
                queue.enqueueEnd(invalidation) {
                    events += "end"
                    true
                }
            val endResult = async { end.await() }
            nativeMayFinish.complete(Unit)

            assertEquivalentFailure(invalidation, initResult.await().exceptionOrNull())
            assertTrue(endResult.await())
            assertFalse(committed.get())
            assertTrue(failed.get())
            assertEquals(listOf("init-start", "init-finish", "end"), events)
        }

    private fun assertEquivalentFailure(
        expected: Throwable,
        actual: Throwable?,
    ) {
        requireNotNull(actual)
        assertEquals(expected::class, actual::class)
        assertEquals(expected.message, actual.message)
    }
}
