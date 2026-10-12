package io.github.hyochan.kmpiap

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow

private const val EVENT_BUFFER_CAPACITY = 64

/** Store events for collectors; the buffer absorbs bursts such as a restore redelivering every purchase. */
internal fun <T> eventFlow(): MutableSharedFlow<T> =
    MutableSharedFlow(extraBufferCapacity = EVENT_BUFFER_CAPACITY, onBufferOverflow = BufferOverflow.DROP_OLDEST)
