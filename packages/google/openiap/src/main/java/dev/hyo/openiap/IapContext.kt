package dev.hyo.openiap

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.utils.activityBindingState
import dev.hyo.openiap.utils.findActivity

/**
 * Compose context helpers for providing OpenIapStore to UI tree
 * Mirrors the SwiftUI environment pattern used in openiap-apple.
 */
object IapContext {
    /** CompositionLocal for OpenIapStore */
    val LocalOpenIapStore: ProvidableCompositionLocal<OpenIapStore?> =
        compositionLocalOf { null }

    /** Remember an OpenIapStore and bind the current foreground Activity. */
    @Composable
    fun rememberOpenIapStore(context: Context = LocalContext.current): OpenIapStore {
        val store = rememberUnboundOpenIapStore(context)
        BindActivity(store, context)
        return store
    }

    @Composable
    private fun rememberUnboundOpenIapStore(context: Context = LocalContext.current): OpenIapStore {
        val appContext = context.applicationContext
        return remember(appContext) { OpenIapStore(appContext) }
    }

    /** Provider to attach OpenIapStore to the composition */
    @Composable
    fun OpenIapProvider(
        store: OpenIapStore = rememberUnboundOpenIapStore(),
        content: @Composable () -> Unit
    ) {
        BindActivity(store, LocalContext.current)
        CompositionLocalProvider(LocalOpenIapStore provides store) {
            content()
        }
    }

    @Composable
    private fun BindActivity(store: OpenIapStore, context: Context) {
        val activity = remember(context) { context.findActivity() }
        val lifecycleOwner = activity as? LifecycleOwner
        val bindingOwner = remember(store) { Any() }
        DisposableEffect(store, activity, lifecycleOwner, bindingOwner) {
            if (activity == null) {
                onDispose { }
            } else if (lifecycleOwner == null) {
                store.bindActivity(bindingOwner, activity)
                onDispose { store.unbindActivity(bindingOwner) }
            } else {
                val observer = LifecycleEventObserver { _, event ->
                    when (event.activityBindingState()) {
                        true -> store.bindActivity(bindingOwner, activity)
                        false -> store.unbindActivity(bindingOwner)
                        null -> Unit
                    }
                }
                lifecycleOwner.lifecycle.addObserver(observer)
                // setContent commonly runs from onCreate before ON_START. Bind
                // the live Activity now so first-frame initialization can use
                // Horizon, then let pause/stop/destroy remove the binding.
                if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.CREATED)) {
                    store.bindActivity(bindingOwner, activity)
                }
                onDispose {
                    lifecycleOwner.lifecycle.removeObserver(observer)
                    store.unbindActivity(bindingOwner)
                }
            }
        }
    }
}
