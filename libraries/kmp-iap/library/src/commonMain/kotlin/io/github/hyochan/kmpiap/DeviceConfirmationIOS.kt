// On-device confirmation for the purchase flow; ported from
// specs/client/src/purchase-flow-confirmers.ts.
package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import kotlin.time.Clock

/**
 * Confirmation from StoreKit alone, given a `getPendingTransactionsIOS`, for an
 * app with neither a backend nor IAPKit. StoreKit verified the transaction if
 * it is still unfinished, unrevoked, not upgraded, unexpired, and from the
 * purchase's environment; [grant] then runs before the flow finishes it.
 * Apps pass [confirmOnDeviceIOS], which binds this SDK's; tests set the time in
 * ms with [clock].
 */
internal fun createDeviceConfirmationIOS(
    getPendingTransactionsIOS: suspend () -> List<PurchaseIOS>,
    grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
    clock: () -> Long = { Clock.System.now().toEpochMilliseconds() },
): PurchaseConfirmer = { purchase, isConsumable ->
    requireGrant("confirmOnDeviceIOS", purchase, isConsumable, grant)
    // A community provider may report store Apple under its own storeId.
    require(purchase.store == IapStore.Apple && purchase.storeId.ifEmpty { "apple" } == "apple") {
        "Device confirmation covers App Store purchases, not ${purchase.storeId.ifEmpty { purchase.store.rawValue }}"
    }
    val pending = getPendingTransactionsIOS()
    // After the query: a transaction can expire while StoreKit answers.
    val now = clock()
    val environment = (purchase as? PurchaseIOS)?.environmentIOS
    val verified = pending.any { candidate ->
        candidate.store == IapStore.Apple &&
            purchase.id.isNotEmpty() &&
            candidate.id == purchase.id &&
            candidate.productId == purchase.productId &&
            candidate.revocationDateIOS == null &&
            candidate.isUpgradedIOS != true &&
            (candidate.expirationDateIOS?.let { it > now } ?: true) &&
            (environment == null || candidate.environmentIOS == environment)
    }
    check(verified) { "StoreKit lists no valid unfinished transaction for ${purchase.productId}" }
    grant?.invoke(purchase, isConsumable)
    PurchaseConfirmation.Entitled(alreadyGranted = false)
}

/**
 * Confirms App Store purchases on the device through this SDK's
 * [getPendingTransactionsIOS], for apps with neither a backend nor IAPKit:
 * pass it to [KmpIAP.createPurchaseFlow] as `confirmWithBackend`. [grant]
 * credits consumables before they are consumed.
 */
fun KmpInAppPurchase.confirmOnDeviceIOS(
    grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
): PurchaseConfirmer =
    createDeviceConfirmationIOS({ getPendingTransactionsIOS() }, grant)
