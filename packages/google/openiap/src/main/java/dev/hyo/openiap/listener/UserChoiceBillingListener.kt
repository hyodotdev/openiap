package dev.hyo.openiap.listener

/**
 * User choice billing details when user selects alternative billing
 */
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
fun interface UserChoiceBillingListener {
    /**
     * Called when user selects alternative billing
     *
     * @param details User choice details including external transaction token and products
     */
    fun onUserSelectedAlternativeBilling(details: UserChoiceDetails)
}
