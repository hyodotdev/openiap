package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.amazonPurchaseError
import dev.hyo.openiap.unsupportedRedeemOfferCode
import dev.hyo.openiap.utils.toActiveSubscription
import kotlinx.coroutines.runBlocking

/**
 * Amazon Appstore's binding into the shared conformance suite.
 * The behavioral expectations live in [StoreConformanceSuite].
 */
class AmazonStoreConformanceTest : StoreConformanceSuite() {
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Amazon

        override val capabilities = setOf(StoreCapability.PendingPurchases)

        override fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription =
            purchase.toActiveSubscription()

        override val normativeErrorCases = listOf(
            errorCase("ALREADY_PURCHASED", ErrorCode.AlreadyOwned),
            errorCase("INVALID_SKU", ErrorCode.SkuNotFound),
            errorCase("NOT_SUPPORTED", ErrorCode.FeatureNotSupported),
            errorCase("INACTIVE_BASE_SUBSCRIPTION", ErrorCode.ItemUnavailable),
            errorCase("PENDING", ErrorCode.DeferredPayment),
            errorCase("FAILED", ErrorCode.PurchaseError),
        )

        override val unrecognizedError = checkNotNull(amazonPurchaseError(null, "sku"))

        override fun unsupportedOperationResult(): Boolean =
            runBlocking { unsupportedRedeemOfferCode() }

        private fun errorCase(
            status: String,
            expected: ErrorCode,
        ) = StoreErrorCase(status, expected, checkNotNull(amazonPurchaseError(status, "sku")))
    }
}
