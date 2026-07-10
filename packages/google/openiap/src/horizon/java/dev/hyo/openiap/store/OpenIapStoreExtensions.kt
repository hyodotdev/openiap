package dev.hyo.openiap.store

import android.content.Context
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.listener.UserChoiceBillingListener

/**
 * Horizon-specific extensions for OpenIapStore
 * These constructors are only available in the Horizon flavor
 *
 * The Horizon App ID is automatically read from AndroidManifest.xml meta-data
 * using "com.meta.horizon.platform.HORIZON_APP_ID". Expo apps can configure it
 * through the expo-iap config plugin.
 */

/**
 * Convenience constructor that creates OpenIapModule (Horizon flavor) with alternative billing support
 *
 * @param context Android context
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 */
fun OpenIapStore(
    context: Context,
    alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    userChoiceBillingListener: UserChoiceBillingListener? = null
): OpenIapStore = OpenIapStore(OpenIapModule(context, alternativeBillingMode, userChoiceBillingListener) as OpenIapProtocol)
