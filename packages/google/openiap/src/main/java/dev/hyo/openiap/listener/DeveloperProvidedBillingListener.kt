package dev.hyo.openiap.listener

import dev.hyo.openiap.DeveloperProvidedBillingProductAndroid

/**
 * Developer-provided billing details when the user selects developer billing.
 * Available for External Payments (8.3.0+) and Billing Choice (9.1.0+).
 */
@Deprecated(
    "Use DeveloperProvidedBillingDetailsAndroid instead. Scheduled for removal in OpenIAP 3.0."
)
data class DeveloperProvidedBillingDetails(
    /**
     * External transaction token, when supplied by Google Play.
     */
    val externalTransactionToken: String?,
    /** URI for an external-link flow, when supplied by Google Play. */
    val linkUri: String? = null,
    /** Original external transaction ID for a subscription replacement. */
    val originalExternalTransactionId: String? = null,
    /** Products selected for developer-provided billing. */
    val products: List<DeveloperProvidedBillingProductAndroid> = emptyList()
)

/**
 * Listener for developer-provided billing selection in an enabled billing program.
 * Called when user selects the developer's billing option (instead of Google Play)
 * in the applicable purchase flow.
 */
@Deprecated(
    "Use OpenIapDeveloperProvidedBillingListener instead. Scheduled for removal in OpenIAP 3.0."
)
fun interface DeveloperProvidedBillingListener {
    /**
     * Called when user selects developer-provided billing
     *
     * @param details Developer-provided billing details for the selected flow
     */
    fun onUserSelectedDeveloperBilling(details: DeveloperProvidedBillingDetails)
}
