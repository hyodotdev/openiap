package dev.hyo.openiap.utils

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState

/** Mirrors the Play and Horizon `toActiveSubscription()` seam. */
fun PurchaseAndroid.toActiveSubscription(): ActiveSubscription = ActiveSubscription(
    autoRenewingAndroid = autoRenewingAndroid,
    basePlanIdAndroid = currentPlanId,
    currentPlanId = currentPlanId,
    isActive = purchaseState == PurchaseState.Purchased,
    productId = productId,
    purchaseToken = purchaseToken,
    purchaseTokenAndroid = purchaseToken,
    transactionDate = transactionDate,
    // Restored receipts can arrive without a transactionId.
    transactionId = transactionId ?: id,
)
