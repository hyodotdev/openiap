package dev.hyo.openiap.listener

/**
 * User choice billing details when user selects alternative billing
 */
@Deprecated(
    "Use UserChoiceBillingDetails instead. Scheduled for removal in OpenIAP 3.0."
)
data class UserChoiceDetails(
    /**
     * External transaction token to be sent to backend server
     */
    val externalTransactionToken: String,
    /**
     * Products being purchased
     */
    val products: List<String>
)

/**
 * Listener for user choice billing selection
 * Called when user selects alternative billing in the user choice flow
 */
@Deprecated(
    "Use OpenIapUserChoiceBillingListener instead. Scheduled for removal in OpenIAP 3.0."
)
fun interface UserChoiceBillingListener {
    /**
     * Called when user selects alternative billing
     *
     * @param details User choice details including external transaction token and products
     */
    fun onUserSelectedAlternativeBilling(details: UserChoiceDetails)
}
