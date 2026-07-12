package io.github.hyochan.kmpiap

import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class CancellableContinuationTest {
    @Test
    fun lateCallbacksAreIgnoredAfterCancellation() = runTest {
        lateinit var continuation: CancellableContinuation<Int>
        val job = launch {
            suspendCancellableCoroutine { captured: CancellableContinuation<Int> ->
                continuation = captured
            }
        }

        runCurrent()
        job.cancelAndJoin()
        continuation.resumeIfActive(1)
        continuation.resumeWithExceptionIfActive(IllegalStateException("late callback"))

        assertTrue(job.isCancelled)
    }
}
