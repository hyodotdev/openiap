package dev.hyo.openiap.helpers

import kotlinx.coroutines.CancellableContinuation
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Atomically completes a cancellable continuation at most once.
 *
 * BillingClient and listener callbacks can legally arrive late, more than once,
 * or from different threads. `isActive` followed by `resume` is not atomic, so
 * callback bridges should use this guard instead.
 */
internal class ContinuationResumeGuard<T>(
    private val continuation: CancellableContinuation<T>,
    onCancellation: (() -> Unit)? = null
) {
    private val didComplete = AtomicBoolean(false)

    init {
        continuation.invokeOnCancellation {
            if (didComplete.compareAndSet(false, true)) {
                onCancellation?.invoke()
            }
        }
    }

    fun resume(value: T) {
        if (didComplete.compareAndSet(false, true)) {
            continuation.resume(value)
        }
    }

    fun resumeWithException(error: Throwable) {
        if (didComplete.compareAndSet(false, true)) {
            continuation.resumeWithException(error)
        }
    }
}

internal fun <T> CancellableContinuation<T>.resumeGuard(
    onCancellation: (() -> Unit)? = null
): ContinuationResumeGuard<T> = ContinuationResumeGuard(this, onCancellation)
