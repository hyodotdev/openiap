package com.margelo.nitro.iap

/** Callers may also lock this registry to coordinate listener and queue state. */
internal class TokenizedListenerRegistry<T> {
    private data class Registration<T>(
        val token: Double,
        val listener: T,
    )

    private val registrations = mutableListOf<Registration<T>>()
    private var nextToken = 1.0

    @Synchronized
    fun add(listener: T): Double {
        val token = nextToken
        nextToken += 1.0
        registrations.add(Registration(token, listener))
        return token
    }

    @Synchronized
    fun remove(token: Double): Boolean {
        val index = registrations.indexOfFirst { it.token == token }
        if (index < 0) return false
        registrations.removeAt(index)
        return true
    }

    @Synchronized
    fun isNotEmpty(): Boolean = registrations.isNotEmpty()

    @Synchronized
    fun snapshot(): List<T> = registrations.map { it.listener }

    @Synchronized
    fun clear() {
        registrations.clear()
        nextToken = 1.0
    }
}
