package dev.hyo.openiap.utils

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState

/** Active paid terms do not depend on a future renewal preference. */
internal fun List<Purchase>.activeSubscriptions(ids: Set<String>): List<ActiveSubscription> =
    filterIsInstance<PurchaseAndroid>()
        .filter { purchase ->
            purchase.currentPlanId != null &&
                purchase.purchaseState == PurchaseState.Purchased &&
                (ids.isEmpty() || purchase.productId in ids)
        }
        .map { it.toActiveSubscription() }

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
