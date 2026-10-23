package dev.hyo.godotiap

/**
 * Serializes the Godot bridge's synchronous init/end entry points and owns the
 * active connection configuration. The lock intentionally spans the native
 * connect/disconnect operation: endConnection cannot return and then have an
 * older initConnection publish a replacement BillingClient behind it.
 */
internal class GodotIapConnectionLifecycle(
    /** Runs under the lock, so a drop's `disconnected` cannot overtake its `connected`. */
    private val onConnectionChanged: (connected: Boolean) -> Unit = {},
) {
    internal data class InitResult(
        val success: Boolean,
        val didConnect: Boolean,
    )

    internal data class EndResult(
        val success: Boolean,
        val didEnd: Boolean,
    )

    /** Native refuses a rebuild while a purchase is in progress and keeps the live client. */
    internal enum class Reconfigure { Applied, Refused, Failed }

    private enum class State { Disconnected, Initializing, Connected, Ending }

    private val lock = Any()

    @Volatile
    private var state = State.Disconnected
    // Kept across a drop, so a reconnect without a config restores the billing program.
    private var activeConfig: Map<String, Any?> = emptyMap()

    /** Numbers connection attempts, so a late teardown can tell it targets an older one. */
    private var generation = 0L

    val isConnected: Boolean
        get() = state == State.Connected

    /** [connect] gets the attempt's generation and config; while connected, a changed [config] goes to [reconfigure], and null keeps it. */
    fun init(
        config: Map<String, Any?>?,
        connect: (generation: Long, config: Map<String, Any?>) -> Boolean,
        reconfigure: () -> Reconfigure,
        disconnect: () -> Boolean,
        cleanupListeners: () -> Unit,
    ): InitResult = synchronized(lock) {
        when (state) {
            State.Connected -> {
                if (config == null || activeConfig == config) {
                    return@synchronized InitResult(success = true, didConnect = false)
                }
                return@synchronized reconfigureLocked(config, reconfigure, disconnect, cleanupListeners)
            }
            State.Initializing, State.Ending -> {
                // Only reachable through a re-entrant call on the same thread;
                // other threads are serialized by the monitor.
                return@synchronized InitResult(success = false, didConnect = false)
            }
            State.Disconnected -> Unit
        }

        state = State.Initializing
        // Allocated before connecting, so a drop reported before connect returns targets this attempt.
        generation++
        val requested = config ?: activeConfig
        val result = try {
            val connected = connect(generation, requested)
            if (connected) {
                activeConfig = requested.toMap()
                state = State.Connected
            } else {
                activeConfig = emptyMap()
                state = State.Disconnected
            }
            InitResult(success = connected, didConnect = connected)
        } catch (error: Throwable) {
            activeConfig = emptyMap()
            state = State.Disconnected
            throw error
        }
        if (result.didConnect) onConnectionChanged(true)
        result
    }

    // The listeners stay attached: native keeps them across a rebuilt client.
    private fun reconfigureLocked(
        config: Map<String, Any?>,
        reconfigure: () -> Reconfigure,
        disconnect: () -> Boolean,
        cleanupListeners: () -> Unit,
    ): InitResult {
        val reconfigured = try {
            reconfigure()
        } catch (error: Throwable) {
            endLocked(disconnect, cleanupListeners, keepConfig = false)
            throw error
        }
        when (reconfigured) {
            Reconfigure.Applied -> activeConfig = config.toMap()
            Reconfigure.Refused -> return InitResult(success = false, didConnect = false)
            // A failed rebuild leaves native without a client, so end this connection too.
            Reconfigure.Failed -> {
                endLocked(disconnect, cleanupListeners, keepConfig = false)
                return InitResult(success = false, didConnect = false)
            }
        }
        return InitResult(success = true, didConnect = false)
    }

    /** With [onlyGeneration], ends only that dropped connection, keeping its config for the reconnect. */
    fun end(
        disconnect: () -> Boolean,
        cleanupListeners: () -> Unit,
        onlyGeneration: Long? = null,
    ): EndResult = synchronized(lock) {
        if (state == State.Disconnected || (onlyGeneration != null && onlyGeneration != generation)) {
            return@synchronized EndResult(success = true, didEnd = false)
        }
        if (state != State.Connected) {
            return@synchronized EndResult(success = false, didEnd = false)
        }
        endLocked(disconnect, cleanupListeners, keepConfig = onlyGeneration != null)
    }

    private fun endLocked(
        disconnect: () -> Boolean,
        cleanupListeners: () -> Unit,
        keepConfig: Boolean,
    ): EndResult {
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
                if (!keepConfig) activeConfig = emptyMap()
                state = State.Disconnected
            }
        }
        onConnectionChanged(false)
        return EndResult(success = success, didEnd = true)
    }
}
