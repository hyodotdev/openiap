package com.margelo.nitro.iap

import kotlinx.coroutines.CompletableDeferred

/**
 * Preserves invocation order for connection lifecycle calls before their
 * coroutine bodies are scheduled. Consecutive init calls share one flight;
 * an intervening end call invalidates that flight and closes the join window.
 */
internal class ConnectionLifecycleQueue {
    internal class Invocation<T> internal constructor(
        private val awaitResult: suspend () -> T,
    ) {
        suspend fun await(): T = awaitResult()
    }

    private data class InitFlight(
        val predecessor: CompletableDeferred<Unit>,
        val completion: CompletableDeferred<Unit>,
        val result: CompletableDeferred<Boolean>,
        var invalidation: Throwable? = null,
    )

    private val lock = Any()
    private var tail = CompletableDeferred(Unit)
    private var joinableInit: InitFlight? = null

    fun enqueueInit(
        operation: suspend () -> Boolean,
        onCommitted: (Boolean) -> Unit,
        onFailed: (Throwable) -> Unit,
    ): Invocation<Boolean> {
        synchronized(lock) {
            joinableInit?.let { flight ->
                return Invocation { flight.result.await() }
            }

            val completion = CompletableDeferred<Unit>()
            val flight =
                InitFlight(
                    predecessor = tail,
                    completion = completion,
                    result = CompletableDeferred(),
                )
            tail = completion
            joinableInit = flight

            return Invocation {
                try {
                    flight.predecessor.await()
                    synchronized(lock) { flight.invalidation }?.let { throw it }

                    val value = operation()
                    val committed =
                        synchronized(lock) {
                            if (flight.invalidation == null) {
                                onCommitted(value)
                                flight.result.complete(value)
                                true
                            } else {
                                false
                            }
                        }
                    if (!committed) {
                        throw synchronized(lock) {
                            checkNotNull(flight.invalidation)
                        }
                    }
                } catch (error: Throwable) {
                    val effectiveError =
                        synchronized(lock) {
                            flight.invalidation ?: error
                        }
                    runCatching { onFailed(effectiveError) }
                    flight.result.completeExceptionally(effectiveError)
                } finally {
                    synchronized(lock) {
                        if (joinableInit === flight) joinableInit = null
                    }
                    flight.completion.complete(Unit)
                }

                flight.result.await()
            }
        }
    }

    fun enqueueEnd(
        pendingInitError: Throwable,
        operation: suspend () -> Boolean,
    ): Invocation<Boolean> {
        val predecessor: CompletableDeferred<Unit>
        val completion = CompletableDeferred<Unit>()
        synchronized(lock) {
            joinableInit?.let { flight ->
                flight.invalidation = pendingInitError
                flight.result.completeExceptionally(pendingInitError)
            }
            joinableInit = null
            predecessor = tail
            tail = completion
        }

        return Invocation {
            try {
                predecessor.await()
                operation()
            } finally {
                completion.complete(Unit)
            }
        }
    }
}
