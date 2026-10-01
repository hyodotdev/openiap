package community.fixture

import android.app.Activity
import android.content.Context
import dev.hyo.openiap.*
import dev.hyo.openiap.listener.*

class FixtureFactory : OpenIapProviderFactory {
    override val storeId = STORE_ID
    override val coreVersion = BuildConfig.CORE_VERSION
    override val clientProtocolVersion = "0.2.0"
    override val capabilities = setOf("pendingPurchases", "subscriptionBillingIssue", "offerCodeRedemption")
    override fun create(context: Context): OpenIapProtocol = FixtureProvider()
    companion object { const val STORE_ID = "community-fixture" }
}

/** In-memory compatibility fixture, never a real store or receipt validator. */
class FixtureProvider : OpenIapProtocol {
    private val updates = mutableSetOf<OpenIapPurchaseUpdateListener>()
    private val issues = mutableSetOf<OpenIapSubscriptionBillingIssueListener>()
    private val owned = linkedMapOf<String, PurchaseAndroid>()
    private var connected = false
    private var nextTransaction = 0
    private fun unsupported(): Nothing = throw OpenIapError.FeatureNotSupported("Fixture does not implement this operation")
    override val initConnection: MutationInitConnectionHandler = { connected = true; true }
    override val endConnection: MutationEndConnectionHandler = { connected = false; true }
    override val fetchProducts: QueryFetchProductsHandler = { params ->
        check(connected)
        FetchProductsResultProducts(params.skus.map { id -> ProductAndroid(
            currency = "USD", description = "In-memory fixture product", displayPrice = "$1.00", id = id,
            nameAndroid = id, title = id,
        ) })
    }
    override val getAvailablePurchases: QueryGetAvailablePurchasesHandler = { owned.values.toList() }
    override val getActiveSubscriptions: QueryGetActiveSubscriptionsHandler = { ids ->
        owned.values.filter { ids == null || it.productId in ids }.map(::toActiveSubscription)
    }
    override val hasActiveSubscriptions: QueryHasActiveSubscriptionsHandler = { ids -> getActiveSubscriptions(ids).any { it.isActive } }
    override val requestPurchase: MutationRequestPurchaseHandler = { params ->
        check(connected)
        val skus = when (val request = params.request) {
            is RequestPurchaseProps.Request.Purchase -> request.value.google?.skus
            is RequestPurchaseProps.Request.Subscription -> request.value.google?.skus
        }
        val sku = skus?.firstOrNull() ?: throw OpenIapError.ItemUnavailable()
        val transaction = ++nextTransaction
        val purchase = purchase(sku).copy(id = "fixture:$sku:$transaction", purchaseToken = "fixture-token:$sku:$transaction")
        owned[sku] = purchase
        updates.toList().forEach { it.onPurchaseUpdated(purchase) }
        RequestPurchaseResultPurchase(purchase)
    }
    override val finishTransaction: MutationFinishTransactionHandler = { purchase, consumable ->
        if (consumable == true) owned.remove(purchase.productId)
    }
    override val acknowledgePurchaseAndroid: MutationAcknowledgePurchaseAndroidHandler = { true }
    override val consumePurchaseAndroid: MutationConsumePurchaseAndroidHandler = { token -> owned.entries.removeAll { it.value.purchaseToken == token }; true }
    override val restorePurchases: MutationRestorePurchasesHandler = {}
    override val deepLinkToSubscriptions: MutationDeepLinkToSubscriptionsHandler = {}
    override val verifyPurchase: MutationVerifyPurchaseHandler = { unsupported() }
    override val verifyPurchaseWithProvider: MutationVerifyPurchaseWithProviderHandler = { unsupported() }
    override val queryHandlers get() = QueryHandlers(fetchProducts = fetchProducts, getAvailablePurchases = getAvailablePurchases,
        getActiveSubscriptions = getActiveSubscriptions, hasActiveSubscriptions = hasActiveSubscriptions, getStorefront = { "US" })
    override val mutationHandlers get() = MutationHandlers(initConnection = initConnection, endConnection = endConnection,
        requestPurchase = requestPurchase, finishTransaction = finishTransaction, restorePurchases = restorePurchases,
        openRedeemOfferCodeAndroid = { true })
    override val subscriptionHandlers = SubscriptionHandlers()
    override fun setActivity(activity: Activity?) {}
    override fun addPurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) { updates.add(listener) }
    override fun removePurchaseUpdateListener(listener: OpenIapPurchaseUpdateListener) { updates.remove(listener) }
    override fun addSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener) { issues.add(listener) }
    override fun removeSubscriptionBillingIssueListener(listener: OpenIapSubscriptionBillingIssueListener) { issues.remove(listener) }
    override fun addPurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {}
    override fun removePurchaseErrorListener(listener: OpenIapPurchaseErrorListener) {}
    override fun addUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {}
    override fun removeUserChoiceBillingListener(listener: OpenIapUserChoiceBillingListener) {}
    override fun addDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {}
    override fun removeDeveloperProvidedBillingListener(listener: OpenIapDeveloperProvidedBillingListener) {}
    override fun addConnectionStateListener(listener: OpenIapConnectionStateListener) {}
    override fun removeConnectionStateListener(listener: OpenIapConnectionStateListener) {}
    override suspend fun isBillingProgramAvailable(program: BillingProgramAndroid): BillingProgramAvailabilityResultAndroid = unsupported()
    override suspend fun createBillingProgramReportingDetails(program: BillingProgramAndroid, developerBillingType: DeveloperBillingTypeAndroid?): BillingProgramReportingDetailsAndroid = unsupported()
    override suspend fun launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid): Boolean = unsupported()
    override suspend fun getBillingChoiceInfo(params: GetBillingChoiceInfoParamsAndroid): BillingChoiceInfoAndroid = unsupported()
    override suspend fun showBillingProgramInformationDialog(activity: Activity, params: BillingProgramInformationDialogParamsAndroid): BillingResultAndroid = unsupported()
    override suspend fun showInAppMessages(activity: Activity, params: InAppMessageParamsAndroid?): InAppMessageResultAndroid = unsupported()
    override suspend fun openRedeemOfferCode(activity: Activity) = true

    fun emitPending() { updates.toList().forEach { it.onPurchaseUpdated(purchase("conformance.product", PurchaseState.Pending)) } }
    fun emitBillingIssue() { issues.toList().forEach { it.onSubscriptionBillingIssue(purchase("conformance.product").copy(isSuspendedAndroid = true)) } }
    fun emitRedemption() { updates.toList().forEach { it.onPurchaseUpdated(purchase("conformance.product")) } }

    fun purchase(sku: String, state: PurchaseState = PurchaseState.Purchased) = PurchaseAndroid(
        id = "fixture:$sku", productId = sku, purchaseToken = "fixture-token:$sku", quantity = 1,
        isAutoRenewing = false, purchaseState = state, store = IapStore.Unknown, storeId = FixtureFactory.STORE_ID,
        transactionDate = 1_700_000_000_000.0,
    )
    fun toActiveSubscription(purchase: PurchaseAndroid) = ActiveSubscription(
        isActive = purchase.purchaseState == PurchaseState.Purchased && purchase.isSuspendedAndroid != true,
        productId = purchase.productId, currentPlanId = purchase.productId, purchaseToken = purchase.purchaseToken,
        purchaseTokenAndroid = purchase.purchaseToken, transactionDate = purchase.transactionDate,
        transactionId = purchase.id,
    )
    fun mapError(code: String): OpenIapError = when(code) {
        "cancelled" -> OpenIapError.UserCancelled()
        "missing" -> OpenIapError.ItemUnavailable()
        else -> OpenIapError.UnknownError()
    }
}
