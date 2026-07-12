package dev.hyo.openiap.helpers

import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.InternalCoroutinesApi
import java.util.concurrent.atomic.AtomicBoolean

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

    @OptIn(InternalCoroutinesApi::class)
    fun resume(value: T) {
        val token = continuation.tryResume(value, null) ?: return
        didComplete.set(true)
        continuation.completeResume(token)
    }

    @OptIn(InternalCoroutinesApi::class)
    fun resumeWithException(error: Throwable) {
        resumeWithException(error) {}
    }

    @OptIn(InternalCoroutinesApi::class)
    fun resumeWithException(
        error: Throwable,
        beforeComplete: () -> Unit,
    ): Boolean {
        val token = continuation.tryResumeWithException(error) ?: return false
        didComplete.set(true)
        try {
            beforeComplete()
        } finally {
            continuation.completeResume(token)
        }
        return true
    }
}

internal fun <T> CancellableContinuation<T>.resumeGuard(
    onCancellation: (() -> Unit)? = null
): ContinuationResumeGuard<T> = ContinuationResumeGuard(this, onCancellation)
