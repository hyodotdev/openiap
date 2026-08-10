package dev.hyo.openiap.compatibility

import android.content.Context
import dev.hyo.openiap.store.OpenIapStore

class OpenIapConsumer(context: Context) {
    val store = OpenIapStore(context)
}
