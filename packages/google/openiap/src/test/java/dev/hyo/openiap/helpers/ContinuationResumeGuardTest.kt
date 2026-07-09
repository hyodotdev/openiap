package dev.hyo.openiap.helpers

import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.test.runTest
import org.junit.Test

class ContinuationResumeGuardTest {
    @Test
    fun `resumeGuard ignores late completion after continuation already resumed`() = runTest {
        var captured: CancellableContinuation<Unit>? = null
        val deferred = async(start = CoroutineStart.UNDISPATCHED) {
            suspendCancellableCoroutine<Unit> { continuation ->
                captured = continuation
            }
        }
        val continuation = checkNotNull(captured)
        val guard = continuation.resumeGuard()

        continuation.resume(Unit)
        deferred.await()

        guard.resumeWithException(IllegalStateException("late product query failure"))
        guard.resume(Unit)
    }
}
