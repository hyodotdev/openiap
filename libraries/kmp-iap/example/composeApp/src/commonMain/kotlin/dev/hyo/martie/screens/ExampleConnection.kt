package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

private val exampleConnectionMutex = Mutex()
private var exampleConnectionConfig: InitConnectionConfig? = null
private var exampleHasConnection = false

// A connected client ignores a new config, so a different request ends it first.
// Never end the connection from onDispose: the incoming screen connects before the outgoing one leaves.
internal suspend fun ensureExampleConnection(config: InitConnectionConfig? = null): Boolean =
    exampleConnectionMutex.withLock {
        if (exampleHasConnection && config != exampleConnectionConfig) {
            kmpIapInstance.endConnection()
            exampleHasConnection = false
            delay(500)
        }
        exampleConnectionConfig = config
        exampleHasConnection = true
        val connected = kmpIapInstance.initConnection(config)
        if (!connected) {
            exampleHasConnection = false
        }
        connected
    }
