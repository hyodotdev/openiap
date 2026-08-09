package dev.hyo.martie.screens

import androidx.compose.runtime.Composable
import dev.hyo.openiap.IapContext
import dev.hyo.openiap.store.OpenIapStore

/** Uses an injected store or the Activity-owned store provided by AppNavigation. */
@Composable
internal fun currentOpenIapStore(storeParam: OpenIapStore?): OpenIapStore =
    storeParam ?: requireNotNull(IapContext.LocalOpenIapStore.current) {
        "OpenIapStore must be provided by IapContext.OpenIapProvider"
    }
