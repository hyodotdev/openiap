package dev.hyo.openiap.listener

import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.UserChoiceBillingDetails

/**
 * Listener for purchase updates
 */
fun interface OpenIapPurchaseUpdateListener {
    /**
     * Called when a purchase is updated
     * @param purchase The updated purchase
     */
    fun onPurchaseUpdated(purchase: Purchase)
}

/**
 * Listener for purchase errors
 */
fun interface OpenIapPurchaseErrorListener {
    /**
     * Called when a purchase error occurs
     * @param error The error that occurred
     */
    fun onPurchaseError(error: OpenIapError)
}

/**
 * Listener for User Choice Billing selection (Android)
 * Fires when user selects alternative billing in the User Choice Billing dialog
 */
fun interface OpenIapUserChoiceBillingListener {
    /**
     * Called when user selects alternative billing
     * @param details The user choice billing details
     */
    fun onUserChoiceBilling(details: UserChoiceBillingDetails)
}

/**
 * Combined listener interface for convenience
 */
interface OpenIapListener : OpenIapPurchaseUpdateListener, OpenIapPurchaseErrorListener
