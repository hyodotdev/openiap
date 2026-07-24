// Legacy 2.x factories delegate to the canonical store construction path.
// Consumer call sites retain warnings; remove these factories in 3.0.
@file:Suppress("DEPRECATION")

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
@Deprecated(
    "Use OpenIapStore(context), then pass InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.UserChoiceBilling or BillingProgramAndroid.ExternalOffer) to initConnection instead. Scheduled for removal in OpenIAP 3.0."
)
fun OpenIapStore(
    context: Context,
    alternativeBillingMode: AlternativeBillingMode,
    userChoiceBillingListener: UserChoiceBillingListener? = null
): OpenIapStore = OpenIapStore(OpenIapModule(context, alternativeBillingMode, userChoiceBillingListener) as OpenIapProtocol)

/**
 * Convenience constructor for backward compatibility
 *
 * @param context Android context
 * @param enableAlternativeBilling Enable alternative billing mode (uses ALTERNATIVE_ONLY mode)
 */
@Deprecated(
    "Use OpenIapStore(context), then pass InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer) to initConnection when enabled. Scheduled for removal in OpenIAP 3.0."
)
fun OpenIapStore(
    context: Context,
    enableAlternativeBilling: Boolean
): OpenIapStore = OpenIapStore(
    OpenIapModule(context, if (enableAlternativeBilling) AlternativeBillingMode.ALTERNATIVE_ONLY else AlternativeBillingMode.NONE) as OpenIapProtocol
)
