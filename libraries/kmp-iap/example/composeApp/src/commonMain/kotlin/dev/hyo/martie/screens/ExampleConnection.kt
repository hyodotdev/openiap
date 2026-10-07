package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

private val exampleConnectionMutex = Mutex()
private var exampleConnectionConfig: InitConnectionConfig? = null
private var exampleHasConnection = false

// Connects the shared client with the config the caller needs. A connected
// client ignores a new config, so a different request ends it first. The full
// config is remembered because Alternative Billing can switch programs
// in-screen. Never call from onDispose: the incoming screen connects before
// the outgoing one leaves the composition.
internal suspend fun ensureExampleConnection(config: InitConnectionConfig? = null): Boolean =
    exampleConnectionMutex.withLock {
        if (exampleHasConnection && config != exampleConnectionConfig) {
            kmpIapInstance.endConnection()
            delay(500)
        }
        val connected = kmpIapInstance.initConnection(config)
        if (connected) {
            exampleConnectionConfig = config
            exampleHasConnection = true
        }
        connected
    }
