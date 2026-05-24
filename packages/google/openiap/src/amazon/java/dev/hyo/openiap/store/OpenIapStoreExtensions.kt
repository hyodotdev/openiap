package dev.hyo.openiap.store

import android.content.Context
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.listener.UserChoiceBillingListener

/**
 * Amazon-specific extensions for OpenIapStore.
 * These constructors are only available in the Amazon flavor.
 */

/**
 * Convenience constructor that creates OpenIapModule (Amazon flavor).
 *
 * @param context Android context
 * @param alternativeBillingMode Ignored by Amazon; kept for API compatibility
 * @param userChoiceBillingListener Ignored by Amazon; kept for API compatibility
 */
fun OpenIapStore(
    context: Context,
    alternativeBillingMode: AlternativeBillingMode = AlternativeBillingMode.NONE,
    userChoiceBillingListener: UserChoiceBillingListener? = null
): OpenIapStore = OpenIapStore(OpenIapModule(context, alternativeBillingMode, userChoiceBillingListener) as OpenIapProtocol)
