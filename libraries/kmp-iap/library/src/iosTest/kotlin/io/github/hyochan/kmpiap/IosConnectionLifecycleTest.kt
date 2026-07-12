package io.github.hyochan.kmpiap

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class IosConnectionLifecycleTest {
    @Test
    fun `init waits for an overlapping end operation`() = runTest {
        val lifecycle = IosConnectionLifecycle()
        val endStarted = CompletableDeferred<Unit>()
        val finishEnd = CompletableDeferred<Unit>()
        val order = mutableListOf<String>()

        val end = async {
            lifecycle.run {
                order += "end"
                endStarted.complete(Unit)
                finishEnd.await()
            }
        }
        endStarted.await()
        val init = async { lifecycle.run { order += "init" } }

        assertEquals(listOf("end"), order)
        finishEnd.complete(Unit)
        end.await()
        init.await()
        assertEquals(listOf("end", "init"), order)
    }

    @Test
    fun `cancelling a submitted end does not let init overtake it`() = runTest {
        val lifecycle = IosConnectionLifecycle()
        val endStarted = CompletableDeferred<Unit>()
        val finishEnd = CompletableDeferred<Unit>()
        val order = mutableListOf<String>()

        val end = launch {
            lifecycle.run {
                order += "end-start"
                endStarted.complete(Unit)
                finishEnd.await()
                order += "end-finish"
            }
        }
        endStarted.await()
        end.cancel()
        val init = async { lifecycle.run { order += "init" } }
        yield()

        assertEquals(listOf("end-start"), order)
        finishEnd.complete(Unit)
        end.join()
        init.await()
        assertEquals(listOf("end-start", "end-finish", "init"), order)
    }

    @Test
    fun `stalled operation times out and releases the lifecycle`() = runTest {
        val lifecycle = IosConnectionLifecycle(timeoutMillis = 1)
        val stalled = async {
            runCatching { lifecycle.run { awaitCancellation() } }
        }
        val next = async { lifecycle.run { "next" } }

        assertTrue(stalled.await().exceptionOrNull() is TimeoutCancellationException)
        assertEquals("next", next.await())
    }
}
