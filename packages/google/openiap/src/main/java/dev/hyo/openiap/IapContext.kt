package dev.hyo.openiap

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import dev.hyo.openiap.store.OpenIapStore

/**
 * Compose context helpers for providing OpenIapStore to UI tree
 * Mirrors the SwiftUI environment pattern used in openiap-apple.
 */
object IapContext {
    /** CompositionLocal for OpenIapStore */
    val LocalOpenIapStore: ProvidableCompositionLocal<OpenIapStore?> =
        compositionLocalOf { null }

    /** Remember an OpenIapStore bound to application context */
    @Composable
    fun rememberOpenIapStore(context: Context = LocalContext.current): OpenIapStore {
        val appContext = context.applicationContext
        return remember(appContext) { OpenIapStore(appContext) }
    }

    /** Provider to attach OpenIapStore to the composition */
    @Composable
    fun OpenIapProvider(
        store: OpenIapStore = rememberOpenIapStore(),
        content: @Composable () -> Unit
    ) {
        CompositionLocalProvider(LocalOpenIapStore provides store) {
            content()
        }
    }
}

