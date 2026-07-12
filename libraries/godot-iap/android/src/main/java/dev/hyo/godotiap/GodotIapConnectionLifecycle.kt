package dev.hyo.godotiap

/**
 * Serializes the Godot bridge's synchronous init/end entry points and owns the
 * active connection configuration. The lock intentionally spans the native
 * connect/disconnect operation: endConnection cannot return and then have an
 * older initConnection publish a replacement BillingClient behind it.
 */
internal class GodotIapConnectionLifecycle {
    internal data class InitResult(
        val success: Boolean,
        val didConnect: Boolean,
    )

    internal data class EndResult(
        val success: Boolean,
        val didEnd: Boolean,
    )

    private enum class State { Disconnected, Initializing, Connected, Ending }

    private val lock = Any()

    @Volatile
    private var state = State.Disconnected
    private var activeConfig: Map<String, Any?>? = null

    val isConnected: Boolean
        get() = state == State.Connected

    fun init(
        config: Map<String, Any?>,
        onConfigMismatch: () -> Unit,
        connect: () -> Boolean,
    ): InitResult = synchronized(lock) {
        when (state) {
            State.Connected -> {
                if (activeConfig == config) {
                    return@synchronized InitResult(success = true, didConnect = false)
                }
                onConfigMismatch()
                return@synchronized InitResult(success = false, didConnect = false)
            }
            State.Initializing, State.Ending -> {
                // Only reachable through a re-entrant call on the same thread;
                // other threads are serialized by the monitor.
                return@synchronized InitResult(success = false, didConnect = false)
            }
            State.Disconnected -> Unit
        }

        state = State.Initializing
        try {
            val connected = connect()
            if (connected) {
                activeConfig = config.toMap()
                state = State.Connected
            } else {
                activeConfig = null
                state = State.Disconnected
            }
            InitResult(success = connected, didConnect = connected)
        } catch (error: Throwable) {
            activeConfig = null
            state = State.Disconnected
            throw error
        }
    }

    fun end(
        disconnect: () -> Boolean,
        cleanupListeners: () -> Unit,
    ): EndResult = synchronized(lock) {
        if (state == State.Disconnected) {
            return@synchronized EndResult(success = true, didEnd = false)
        }
        if (state != State.Connected) {
            return@synchronized EndResult(success = false, didEnd = false)
        }

        state = State.Ending
        var success = false
        try {
            // Keep listeners attached through this call so a pending purchase's
            // ServiceDisconnected error reaches Godot before cleanup.
            success = disconnect()
        } finally {
            try {
                cleanupListeners()
            } finally {
                // Listener cleanup is best-effort. A bridge implementation must
                // never remain wedged in Ending if a removal callback throws.
                activeConfig = null
                state = State.Disconnected
            }
        }
        EndResult(success = success, didEnd = true)
    }
}
