package io.github.hyochan.kmpiap

enum class Store {
    NONE,
    PLAY_STORE,
    AMAZON,
    APP_STORE,
    HORIZON,
    UNKNOWN
}

data class ConnectionResult(
    val connected: Boolean,
    val message: String? = null
)
