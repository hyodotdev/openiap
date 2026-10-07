package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseAndroid

/**
 * Capabilities a store may or may not provide, so "this store cannot do X" is
 * data rather than a missing test file.
 */
enum class StoreCapability(val id: String) {
    /** Store reports a distinct PENDING purchase state (deferred payment). */
    PendingPurchases("pendingPurchases"),

    /** Store reports subscription billing-issue / suspension signals. */
    SubscriptionBillingIssue("subscriptionBillingIssue"),

    /** Store exposes an offer-code redemption entry point. */
    OfferCodeRedemption("offerCodeRedemption"),
}

data class StoreErrorCase(
    val nativeCode: String,
    val expected: ErrorCode,
    val actual: OpenIapError,
)

/**
 * The seam [StoreConformanceSuite] drives. Each store supplies one
 * implementation from its own test source set; this is the only place stores
 * are allowed to differ.
 */
interface StoreConformanceAdapter {
    /** The store discriminator this implementation must stamp on purchases. */
    val store: IapStore
    val storeId: String
        get() = when (store) {
            IapStore.Google -> "play"
            IapStore.Unknown -> error("storeId must be the provider's own id: override it when store is Unknown")
            else -> store.rawValue
        }

    /** Behaviors this store supports. See [StoreCapability]. */
    val capabilities: Set<StoreCapability>

    /** The store's `toActiveSubscription()` binding. */
    fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription

    /** Store-native failure values passed through the production mapper. */
    val normativeErrorCases: List<StoreErrorCase>

    /** The production mapper's fail-closed result for an unknown native value. */
    val unrecognizedError: OpenIapError
}

/** Play Billing response codes with their spec mappings, for Play-compatible stores. */
fun playBillingErrorCases(mapper: (Int) -> OpenIapError): List<StoreErrorCase> = listOf(
    StoreErrorCase("1", ErrorCode.UserCancelled, mapper(1)),
    StoreErrorCase("2", ErrorCode.ServiceError, mapper(2)),
    StoreErrorCase("3", ErrorCode.BillingUnavailable, mapper(3)),
    StoreErrorCase("4", ErrorCode.ItemUnavailable, mapper(4)),
    StoreErrorCase("5", ErrorCode.DeveloperError, mapper(5)),
    StoreErrorCase("6", ErrorCode.ServiceError, mapper(6)),
    StoreErrorCase("7", ErrorCode.AlreadyOwned, mapper(7)),
    StoreErrorCase("8", ErrorCode.ItemNotOwned, mapper(8)),
    StoreErrorCase("-1", ErrorCode.ServiceDisconnected, mapper(-1)),
    StoreErrorCase("-2", ErrorCode.FeatureNotSupported, mapper(-2)),
    StoreErrorCase("-3", ErrorCode.ServiceTimeout, mapper(-3)),
    StoreErrorCase("12", ErrorCode.NetworkError, mapper(12)),
)
