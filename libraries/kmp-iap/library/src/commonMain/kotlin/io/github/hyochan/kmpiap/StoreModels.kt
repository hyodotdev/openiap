package io.github.hyochan.kmpiap

enum class Store {
    NONE,
    PLAY_STORE,
    AMAZON,
    APP_STORE
}

data class ConnectionResult(
    val connected: Boolean,
    val message: String? = null
)
