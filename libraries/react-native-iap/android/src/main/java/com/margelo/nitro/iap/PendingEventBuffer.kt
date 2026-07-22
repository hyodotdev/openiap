package com.margelo.nitro.iap

/**
 * Bounded FIFO used while a bridge has no listener or is flushing a backlog.
 *
 * This class is intentionally not synchronized. Callers must invoke every
 * method while holding the same lock that protects their listener registry so
 * listener changes and queue state remain atomic.
 */
internal class PendingEventBuffer<T>(
    private val capacity: Int,
    private val onOverflow: () -> Unit,
) {
    private val events = ArrayDeque<T>()
    private var isFlushing = false

    init {
        require(capacity > 0) { "capacity must be greater than zero" }
    }

    /** Returns true when [event] was queued instead of delivered live. */
    fun enqueueIfNeeded(
        hasListeners: Boolean,
        event: T,
    ): Boolean {
        if (hasListeners && !isFlushing) return false

        if (events.size >= capacity) {
            events.removeFirst()
            onOverflow()
        }
        events.addLast(event)
        return true
    }

    /** Marks the buffer as flushing when a pending backlog exists. */
    fun beginFlushIfNeeded(): Boolean {
        if (isFlushing || events.isEmpty()) return false
        isFlushing = true
        return true
    }

    /**
     * Takes the current FIFO batch. A null result completes the flush and lets
     * subsequent events resume live delivery.
     */
    fun takeBatchOrFinish(): List<T>? {
        if (events.isEmpty()) {
            isFlushing = false
            return null
        }
        return events.toList().also { events.clear() }
    }

    fun clear() {
        events.clear()
        isFlushing = false
    }
}

internal data class PendingEventDelivery<T>(
    val events: List<T>,
    val listeners: List<(T) -> Unit>,
)

/**
 * Drains FIFO batches against a fresh listener snapshot for each batch.
 *
 * Events already present when a flush begins go only to listeners registered
 * for that batch. Listeners added while callbacks run are included in the next
 * batch, so they receive events that arrived after their registration without
 * receiving the earlier backlog.
 */
internal fun <T> drainPendingEvents(
    takeDelivery: () -> PendingEventDelivery<T>?,
    onDeliveryFailure: (Throwable) -> Unit,
) {
    while (true) {
        val delivery = takeDelivery() ?: return
        delivery.events.forEach { event ->
            delivery.listeners.forEach { listener ->
                runCatching { listener(event) }.onFailure(onDeliveryFailure)
            }
        }
    }
}
