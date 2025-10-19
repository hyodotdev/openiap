package dev.hyo.openiap.store

import android.content.Context
import dev.hyo.openiap.AlternativeBillingMode
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.listener.UserChoiceBillingListener

/**
 * Play-specific extensions for OpenIapStore
 * These constructors are only available in the Play flavor
 */

/**
 * Convenience constructor that creates OpenIapModule with alternative billing support
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

/**
 * Convenience constructor for backward compatibility
 *
 * @param context Android context
 * @param enableAlternativeBilling Enable alternative billing mode (uses ALTERNATIVE_ONLY mode)
 */
@Deprecated("Use constructor with AlternativeBillingMode instead", ReplaceWith("OpenIapStore(context, if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE)"))
fun OpenIapStore(
    context: Context,
    enableAlternativeBilling: Boolean
): OpenIapStore = OpenIapStore(
    OpenIapModule(context, if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE) as OpenIapProtocol
)
