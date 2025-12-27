package dev.hyo.openiap.listener

/**
 * Developer-provided billing details when user selects developer billing in External Payments flow.
 * Available in Google Play Billing Library 8.3.0+ (Japan only).
 */
data class DeveloperProvidedBillingDetails(
    /**
     * External transaction token to be reported to Google within 24 hours
     */
    val externalTransactionToken: String
)

/**
 * Listener for developer-provided billing selection in External Payments flow.
 * Called when user selects the developer's billing option (instead of Google Play)
 * in the side-by-side choice dialog during purchase.
 *
 * This is only available in Japan and requires Google Play Billing Library 8.3.0+.
 */
fun interface DeveloperProvidedBillingListener {
    /**
     * Called when user selects developer-provided billing
     *
     * @param details Developer-provided billing details including external transaction token
     */
    fun onUserSelectedDeveloperBilling(details: DeveloperProvidedBillingDetails)
}
