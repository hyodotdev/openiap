package dev.hyo.martie.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.hyo.martie.config.AppConfig
import io.github.hyochan.kmpiap.IapkitConfirmationOptions
import io.github.hyochan.kmpiap.PurchaseConfirmation
import io.github.hyochan.kmpiap.PurchaseFlowGuidanceKey
import io.github.hyochan.kmpiap.PurchaseFlowOutcome
import io.github.hyochan.kmpiap.PurchaseFlowStatus
import io.github.hyochan.kmpiap.confirmWithIapkit
import io.github.hyochan.kmpiap.createPurchaseFlow
import io.github.hyochan.kmpiap.describePurchaseFlowStatus
import io.github.hyochan.kmpiap.getCurrentPlatform
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.openiap.IapPlatform
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

enum class VerificationMethod(val label: String, val icon: String) {
    None("None (Leave unfinished)", "❌"),
    Local("Local (Device)", "📱"),
    IAPKitLocal("Local (IAPKit)", "🖥️"),
    IAPKit("IAPKit (Server)", "☁️");
}

/** Without a key purchases stay unfinished; a local IAPKit origin is preferred when set. */
fun defaultVerificationMethod(apiKey: String, localBaseUrl: String): VerificationMethod = when {
    apiKey.isBlank() -> VerificationMethod.None
    localBaseUrl.isNotBlank() -> VerificationMethod.IAPKitLocal
    else -> VerificationMethod.IAPKit
}

/** The app's one purchase flow: it confirms every delivery, whichever screen is open. */
internal object ExamplePurchaseFlow {
    private val scope = MainScope()

    var verificationMethod by mutableStateOf(
        defaultVerificationMethod(AppConfig.iapkitApiKey, AppConfig.iapkitBaseUrl)
    )
        private set

    private val hostedIapkit = iapkit(baseUrl = null)
    private val localIapkit = iapkit(baseUrl = AppConfig.iapkitBaseUrl)

    // Lives as long as the app. An app with sign-in disposes it and creates one per account.
    val flow = kmpIapInstance.createPurchaseFlow(
        scope = scope,
        confirmWithBackend = ::confirm,
        isConsumable = { it in ConsumableProductIds },
    )

    /** Connects, then finishes what an earlier session left unfinished. */
    suspend fun start() {
        if (kmpIapInstance.initConnection()) recover()
    }

    /** Purchases left unfinished are confirmed again with the new method. */
    fun select(method: VerificationMethod) {
        verificationMethod = method
        scope.launch { recover() }
    }

    private suspend fun recover() {
        try {
            flow.recoverPurchases()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            println("[KMP-IAP Example] Purchase recovery failed: ${error.message}")
        }
    }

    // Reads the selected method on each purchase, so switching needs no new flow.
    private suspend fun confirm(purchase: Purchase, isConsumable: Boolean): PurchaseConfirmation =
        when (verificationMethod) {
            VerificationMethod.None -> error("No verification method selected; the purchase stays unfinished.")
            VerificationMethod.Local -> confirmOnDevice(purchase, isConsumable)
            VerificationMethod.IAPKitLocal -> {
                check(AppConfig.iapkitBaseUrl.isNotBlank()) {
                    "Set IAPKIT_BASE_URL in .env (Android) or Secrets.xcconfig (iOS)."
                }
                localIapkit(purchase, isConsumable)
            }
            VerificationMethod.IAPKit -> hostedIapkit(purchase, isConsumable)
        }

    // StoreKit verified the unfinished transaction on the device.
    private suspend fun confirmOnDevice(purchase: Purchase, isConsumable: Boolean): PurchaseConfirmation {
        check(getCurrentPlatform() == IapPlatform.Ios) {
            "Local (Device) verification is iOS only. Choose an IAPKit method."
        }
        check(matchesVerifiedPendingPurchase(purchase, kmpIapInstance.getPendingTransactionsIOS())) {
            "StoreKit has no verified unfinished transaction ${purchase.id}"
        }
        grant(purchase, isConsumable)
        return PurchaseConfirmation.Entitled(alreadyGranted = false)
    }

    // Credit consumables here, once per purchase.id: a crash can confirm the same purchase again.
    private suspend fun grant(purchase: Purchase, isConsumable: Boolean) {
        if (isConsumable) println("[KMP-IAP Example] Credit ${purchase.productId} for purchase ${purchase.id}")
    }

    private fun iapkit(baseUrl: String?) = kmpIapInstance.confirmWithIapkit(
        IapkitConfirmationOptions(
            apiKey = AppConfig.iapkitApiKey,
            baseUrl = baseUrl,
            amazon = IapkitConfirmationOptions.Amazon(
                sandbox = AppConfig.amazonRvsSandbox,
                verifiedProductId = ::amazonVerifiedProductId,
            ),
            verifyAs = { if (it.storeId == AmazonExampleStoreId) IapStore.Amazon else null },
            grant = ::grant,
        )
    )
}

// Example copy for each guidance key; an app supplies its own.
internal fun PurchaseFlowOutcome.resultText(): String {
    val product = purchase.productId
    val guidance = describePurchaseFlowStatus(status)
    return when (guidance.key) {
        PurchaseFlowGuidanceKey.AccessGranted -> "✅ $product: access granted"
        PurchaseFlowGuidanceKey.ChangePending -> {
            val change = (purchase as? PurchaseAndroid)?.pendingPurchaseUpdateAndroid?.products.orEmpty()
            "Plan change to ${change.joinToString()} is pending. $product stays active until it applies."
        }
        PurchaseFlowGuidanceKey.PaymentPending -> "⏳ $product: payment is pending at the store"
        PurchaseFlowGuidanceKey.AccessPending -> "⏳ $product: confirmed; access is being prepared"
        PurchaseFlowGuidanceKey.VerificationDelayed -> "⏳ $product: the store has not confirmed it yet"
        PurchaseFlowGuidanceKey.OwnedByAnotherAccount -> "⚠️ $product belongs to another account"
        PurchaseFlowGuidanceKey.TestPurchaseNotAccepted -> "⚠️ $product: test purchases are not accepted"
        PurchaseFlowGuidanceKey.PurchaseNotValid ->
            "❌ $product: the store did not confirm this purchase" +
                if (guidance.offerPurchase) ". You can buy it again." else ""
        PurchaseFlowGuidanceKey.TryAgainLater ->
            "❌ $product: ${(status as? PurchaseFlowStatus.Failed)?.error?.message ?: "try again later"}"
    }
}
