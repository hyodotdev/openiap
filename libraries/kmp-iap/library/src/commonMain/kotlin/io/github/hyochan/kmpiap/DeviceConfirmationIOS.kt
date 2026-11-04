// On-device confirmation for the purchase flow; ported from
// specs/client/src/purchase-flow-confirmers.ts.
package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseOptions
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import kotlin.time.Clock

/**
 * Confirmation from StoreKit alone, given a `getPendingTransactionsIOS`, for an
 * app with neither a backend nor IAPKit. StoreKit verified the transaction if
 * it lists it as unfinished, or, for a purchase the flow already finished, in
 * [getTransactionHistoryIOS], from the purchase's environment. A revoked or
 * upgraded one is invalid, and an expired one delayed, since billing grace can
 * still cover it; [grant] runs before an unfinished one is finished, and again
 * for a finished non-consumable a restore reads.
 * Apps pass [confirmOnDeviceIOS], which binds this SDK's; tests set the time in
 * ms with [clock].
 */
internal fun deviceConfirmationIOS(
    getPendingTransactionsIOS: suspend () -> List<PurchaseIOS>,
    grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
    getTransactionHistoryIOS: (suspend () -> List<Purchase>)? = null,
    clock: () -> Long = { Clock.System.now().toEpochMilliseconds() },
): suspend (Purchase, Boolean) -> PurchaseConfirmation = { purchase, isConsumable ->
    requireGrant("confirmOnDeviceIOS", purchase, isConsumable, grant)
    // A community provider may report store Apple under its own storeId.
    require(purchase.store == IapStore.Apple && purchase.storeId.ifEmpty { "apple" } == "apple") {
        "Device confirmation covers App Store purchases, not ${purchase.storeId.ifEmpty { purchase.store.rawValue }}"
    }
    val environment = (purchase as? PurchaseIOS)?.environmentIOS
    val isSame = { candidate: PurchaseIOS ->
        candidate.store == IapStore.Apple &&
            purchase.id.isNotEmpty() &&
            candidate.id == purchase.id &&
            candidate.productId == purchase.productId &&
            (environment == null || candidate.environmentIOS == environment)
    }
    val pending = getPendingTransactionsIOS().firstOrNull(isSame)
    val transaction = pending
        ?: getTransactionHistoryIOS?.invoke()?.filterIsInstance<PurchaseIOS>()?.firstOrNull(isSame)
    checkNotNull(transaction) { "StoreKit lists no transaction for ${purchase.productId}" }
    when {
        transaction.revocationDateIOS != null -> PurchaseConfirmation.Invalid("revoked")
        transaction.isUpgradedIOS == true -> PurchaseConfirmation.Invalid("upgraded")
        // After the reads: a transaction can expire while StoreKit answers.
        transaction.expirationDateIOS?.let { it <= clock() } == true ->
            PurchaseConfirmation.VerificationDelayed(DEVICE_EXPIRED_RETRY_MS)
        else -> {
            // A finished consumable was credited before it was consumed.
            if (pending != null || !isConsumable) grant?.invoke(purchase, isConsumable)
            PurchaseConfirmation.Entitled(alreadyGranted = pending == null)
        }
    }
}

// An expired App Store receipt may still be in billing grace; check it again.
private const val DEVICE_EXPIRED_RETRY_MS = 30_000L

/**
 * Confirms App Store purchases on the device through this SDK's
 * [getPendingTransactionsIOS], or for a restore its verified history, for apps
 * with neither a backend nor IAPKit: pass it to [KmpIAP.createPurchaseFlow] as
 * `confirmWithBackend`. [grant] credits consumables before they are consumed.
 */
fun KmpInAppPurchase.confirmOnDeviceIOS(
    grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
): suspend (Purchase, Boolean) -> PurchaseConfirmation = deviceConfirmationIOS(
    { getPendingTransactionsIOS() },
    grant,
    { getAvailablePurchases(PurchaseOptions(onlyIncludeActiveItemsIOS = false)) },
)


@Deprecated("Use confirmOnDeviceIOS. Removed in the next major release.")
public fun createDeviceConfirmationIOS(
    getPendingTransactionsIOS: suspend () -> List<PurchaseIOS>,
    grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
): suspend (Purchase, Boolean) -> PurchaseConfirmation = deviceConfirmationIOS(getPendingTransactionsIOS, grant)
