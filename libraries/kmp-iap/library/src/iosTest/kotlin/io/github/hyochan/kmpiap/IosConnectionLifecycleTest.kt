package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

class IosConnectionLifecycleTest {
    @Test
    fun `init waits for an overlapping end operation`() = runTest {
        val lifecycle = IosConnectionLifecycle()
        val endStarted = CompletableDeferred<Unit>()
        val finishEnd = CompletableDeferred<Unit>()
        val order = mutableListOf<String>()

        val end = async {
            lifecycle.run {
                order += "end-start"
                endStarted.complete(Unit)
                finishEnd.await()
                order += "end-finish"
            }
        }
        endStarted.await()
        val init = async { lifecycle.run { order += "init" } }
        yield()

        assertFalse(init.isCompleted)
        assertEquals(listOf("end-start"), order)
        finishEnd.complete(Unit)
        end.await()
        init.await()
        assertEquals(listOf("end-start", "end-finish", "init"), order)
    }

    @Test
    fun `cancelling an operation releases the lifecycle`() = runTest {
        val lifecycle = IosConnectionLifecycle()
        val started = CompletableDeferred<Unit>()

        val operation = launch {
            lifecycle.run {
                started.complete(Unit)
                awaitCancellation()
            }
        }
        started.await()
        operation.cancel()

        withTimeout(100) { operation.join() }
        assertEquals("next", lifecycle.run { "next" })
    }

    @Test
    fun `stalled operation fails with a timeout error and releases the lifecycle`() = runTest {
        val lifecycle = IosConnectionLifecycle(timeoutMillis = 1)
        val stalled = async {
            runCatching { lifecycle.run { awaitCancellation() } }
        }
        val next = async { lifecycle.run { "next" } }

        val failure = assertIs<PurchaseException>(stalled.await().exceptionOrNull())
        assertEquals(ErrorCode.ServiceTimeout, failure.error.code)
        assertEquals("next", next.await())
    }

    @Test
    fun `the caller's own timeout stays a cancellation`() = runTest {
        val lifecycle = IosConnectionLifecycle()

        assertNull(withTimeoutOrNull(1) { lifecycle.run { awaitCancellation() } })
        assertEquals("next", lifecycle.run { "next" })
    }
}
