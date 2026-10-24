// IAPKit confirmation for the purchase flow; ported from
// specs/client/src/purchase-flow-confirmers.ts. It uses only the flow's public
// contract, as any other verification service's confirmer would.
package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitAmazonProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitAppleProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitHorizonProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderProps
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult

/** How an app without its own backend confirms purchases with IAPKit. */
class IapkitConfirmationOptions(
    /**
     * A publishable key (`openiap-kit_pk_...`), which is safe to ship in an
     * app. Leave it out where the SDK has one configured.
     */
    val apiKey: String? = null,
    /** A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev. */
    val baseUrl: String? = null,
    val amazon: Amazon? = null,
    /** The IAPKit store that verifies a community store's evidence, such as an Amazon RVS adapter. */
    val verifyAs: ((Purchase) -> IapStore?)? = null,
    /**
     * Gives the user what they bought, before the flow finishes (and so
     * consumes) the purchase. Required for consumables. Must be idempotent per
     * `purchase.id`: after a crash the same purchase is confirmed again. Access
     * read from ownership, such as an active subscription, needs nothing here.
     */
    val grant: (suspend (purchase: Purchase, isConsumable: Boolean) -> Unit)? = null,
) {
    class Amazon(
        /** Verify App Tester receipts with the Amazon RVS Cloud Sandbox. */
        val sandbox: Boolean = false,
        /** RVS reports a subscription term under its parent SKU; maps one to the other. */
        val verifiedProductId: (productId: String) -> String = { it },
    )
}

private const val IAPKIT_UNKNOWN_RETRY_MS = 30_000L

/**
 * Confirmation through IAPKit, given a `verifyPurchaseWithProvider`: verifies
 * the purchase, then runs `grant` before the flow finishes it. Apps pass
 * [confirmWithIapkit], which binds this SDK's.
 */
internal fun iapkitConfirmation(
    verifyPurchaseWithProvider: suspend (VerifyPurchaseWithProviderProps) -> VerifyPurchaseWithProviderResult,
    options: IapkitConfirmationOptions,
): suspend (Purchase, Boolean) -> PurchaseConfirmation = { purchase, isConsumable ->
    requireGrant("confirmWithIapkit", purchase, isConsumable, options.grant)
    val confirmation = iapkitVerification(
        verifyPurchaseWithProvider(iapkitVerificationProps(purchase, options)),
        purchase,
        isConsumable,
        options,
    )
    if (confirmation is PurchaseConfirmation.Entitled && !confirmation.alreadyGranted) {
        options.grant?.invoke(purchase, isConsumable)
    }
    confirmation
}

/**
 * Confirms purchases with IAPKit from the app, for apps without their own
 * backend: pass it to [KmpIAP.createPurchaseFlow] as `confirmWithBackend`.
 */
fun KmpInAppPurchase.confirmWithIapkit(
    options: IapkitConfirmationOptions,
): suspend (Purchase, Boolean) -> PurchaseConfirmation =
    iapkitConfirmation(::verifyPurchaseWithProvider, options)

/** Builds the IAPKit request for a purchase; throws for a store IAPKit cannot verify. */
internal fun iapkitVerificationProps(purchase: Purchase, options: IapkitConfirmationOptions): VerifyPurchaseWithProviderProps {
    val apiKey = options.apiKey?.trim()
    // An unset environment variable, not a deliberate fallback to the SDK's key.
    require(apiKey != "") { "IAPKit apiKey is empty" }
    val baseUrl = options.baseUrl?.trim()?.ifEmpty { null }
    fun token(): String = purchase.purchaseToken?.ifEmpty { null }
        ?: throw IllegalArgumentException("Purchase ${purchase.productId} has no purchase token to verify")
    val iapkit = when (verifyingStore(purchase, options)) {
        IapStore.Apple -> RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            baseUrl = baseUrl,
            apple = RequestVerifyPurchaseWithIapkitAppleProps(jws = token()),
        )
        IapStore.Google -> RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            baseUrl = baseUrl,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = token()),
        )
        IapStore.Amazon -> RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            baseUrl = baseUrl,
            amazon = RequestVerifyPurchaseWithIapkitAmazonProps(
                receiptId = token(),
                sandbox = options.amazon?.sandbox ?: false,
                userId = (purchase as? PurchaseAndroid)?.userIdAmazon?.ifEmpty { null },
                expectedProductId = amazonProductId(purchase, options),
            ),
        )
        IapStore.Horizon -> RequestVerifyPurchaseWithIapkitProps(
            apiKey = apiKey,
            baseUrl = baseUrl,
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(sku = purchase.productId),
        )
        IapStore.Unknown -> throw IllegalArgumentException("IAPKit cannot verify store ${purchase.store.rawValue}")
    }
    return VerifyPurchaseWithProviderProps(iapkit = iapkit, provider = PurchaseVerificationProvider.Iapkit)
}

/**
 * Turns IAPKit's answer into the flow's confirmation. Anything that may be a
 * configuration error rather than a rejected payment throws, so the flow
 * reports `Failed` and leaves the purchase unfinished: evidence for another
 * store, product, or environment, `inauthentic` (IAPKit's answer to a product
 * or package mismatch, and to every Horizon rejection), and a valid state this
 * product type cannot be granted from.
 */
internal fun iapkitVerification(
    result: VerifyPurchaseWithProviderResult,
    purchase: Purchase,
    isConsumable: Boolean,
    options: IapkitConfirmationOptions = IapkitConfirmationOptions(),
): PurchaseConfirmation {
    val verified = result.iapkit ?: error(
        result.errors.orEmpty()
            .joinToString("\n") { failure -> failure.code?.let { "[$it] ${failure.message}" } ?: failure.message }
            .ifEmpty { "IAPKit returned no verification result" }
    )
    when (verified.state) {
        IapkitPurchaseState.Pending -> return PurchaseConfirmation.StorePending
        // The store gave no usable answer: retry instead of rejecting a payment.
        IapkitPurchaseState.Unknown -> return PurchaseConfirmation.VerificationDelayed(IAPKIT_UNKNOWN_RETRY_MS)
        else -> Unit
    }
    val store = verifyingStore(purchase, options)
    val expectedProductId = if (store == IapStore.Amazon) amazonProductId(purchase, options) else purchase.productId
    val expectedEnvironment = when (store) {
        IapStore.Amazon -> if (options.amazon?.sandbox == true) "Sandbox" else "Production"
        IapStore.Apple -> (purchase as? PurchaseIOS)?.environmentIOS
        else -> null
    }
    val mismatch = when {
        verified.store != purchase.store -> "store ${verified.store.rawValue}, expected ${purchase.store.rawValue}"
        purchase.storeId.isNotEmpty() && verified.storeId != purchase.storeId ->
            "store id ${verified.storeId}, expected ${purchase.storeId}"
        verified.productId != expectedProductId -> "product ${verified.productId ?: "(none)"}, expected $expectedProductId"
        !expectedEnvironment.isNullOrEmpty() && verified.environment != expectedEnvironment ->
            "environment ${verified.environment ?: "(none)"}, expected $expectedEnvironment"
        else -> null
    }
    check(mismatch == null) { "IAPKit verified $mismatch" }
    if (!verified.isValid) {
        return when (verified.state) {
            IapkitPurchaseState.Canceled, IapkitPurchaseState.Expired ->
                PurchaseConfirmation.Invalid(reason = verified.state.rawValue)
            // Only a granted purchase is consumed; the flow grants before finishing.
            IapkitPurchaseState.Consumed -> PurchaseConfirmation.Entitled(alreadyGranted = true)
            else -> error("IAPKit rejected the purchase: ${verified.state.rawValue}")
        }
    }
    // Apple and Amazon keep a consumable at ready-to-consume until it is finished;
    // Google reports a granted purchase as pending-acknowledgment until then.
    val grantsAccess = when (store) {
        IapStore.Apple, IapStore.Amazon ->
            verified.state == if (isConsumable) IapkitPurchaseState.ReadyToConsume else IapkitPurchaseState.Entitled
        IapStore.Google -> verified.state == IapkitPurchaseState.Entitled ||
            verified.state == IapkitPurchaseState.PendingAcknowledgment ||
            (isConsumable && verified.state == IapkitPurchaseState.ReadyToConsume)
        IapStore.Horizon -> verified.state == IapkitPurchaseState.Entitled
        IapStore.Unknown -> false
    }
    check(grantsAccess) {
        "IAPKit state ${verified.state.rawValue} cannot grant this " +
            "${if (isConsumable) "consumable" else "non-consumable"} ${purchase.store.rawValue} purchase"
    }
    return PurchaseConfirmation.Entitled(alreadyGranted = false)
}

private fun verifyingStore(purchase: Purchase, options: IapkitConfirmationOptions): IapStore =
    options.verifyAs?.invoke(purchase) ?: purchase.store

private fun amazonProductId(purchase: Purchase, options: IapkitConfirmationOptions): String =
    options.amazon?.verifiedProductId?.invoke(purchase.productId) ?: purchase.productId

// Checked before verifying: a consumable must never pass without a way to credit it.
internal fun requireGrant(
    name: String,
    purchase: Purchase,
    isConsumable: Boolean,
    grant: (suspend (Purchase, Boolean) -> Unit)?,
) {
    check(!isConsumable || grant != null) {
        "$name needs grant to credit consumable ${purchase.productId} before it is consumed"
    }
}


@Deprecated("Use confirmWithIapkit. Removed in the next major release.")
public fun createIapkitConfirmation(
    verifyPurchaseWithProvider: suspend (VerifyPurchaseWithProviderProps) -> VerifyPurchaseWithProviderResult,
    options: IapkitConfirmationOptions,
): suspend (Purchase, Boolean) -> PurchaseConfirmation = iapkitConfirmation(verifyPurchaseWithProvider, options)

@Deprecated("Use confirmWithIapkit. Removed in the next major release.")
public fun toIapkitVerificationProps(
    purchase: Purchase,
    options: IapkitConfirmationOptions,
): VerifyPurchaseWithProviderProps = iapkitVerificationProps(purchase, options)

@Deprecated("Use confirmWithIapkit. Removed in the next major release.")
public fun readIapkitVerification(
    result: VerifyPurchaseWithProviderResult,
    purchase: Purchase,
    isConsumable: Boolean,
    options: IapkitConfirmationOptions = IapkitConfirmationOptions(),
): PurchaseConfirmation = iapkitVerification(result, purchase, isConsumable, options)
