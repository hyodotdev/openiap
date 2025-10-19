package dev.hyo.openiap.store

import android.content.Context
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.horizon.OpenIapHorizonModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.listener.UserChoiceBillingListener

/**
 * Horizon-specific extensions for OpenIapStore
 * These constructors are only available in the Horizon flavor
 */

/**
 * Convenience constructor that creates OpenIapHorizonModule with alternative billing support
 *
 * @param context Android context
 * @param appId Oculus App ID
 * @param alternativeBillingMode Alternative billing mode (default: NONE)
 * @param userChoiceBillingListener Listener for user choice billing selection (optional)
 */
fun OpenIapStore(
    context: Context,
    appId: String,
    alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    userChoiceBillingListener: UserChoiceBillingListener? = null
): OpenIapStore = OpenIapStore(OpenIapHorizonModule(context, appId, alternativeBillingMode, userChoiceBillingListener) as OpenIapProtocol)
