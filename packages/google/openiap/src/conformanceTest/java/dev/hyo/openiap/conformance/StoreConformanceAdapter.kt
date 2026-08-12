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
enum class StoreCapability {
    /** Store reports a distinct PENDING purchase state (deferred payment). */
    PendingPurchases,

    /** Store reports subscription billing-issue / suspension signals. */
    SubscriptionBillingIssue,

    /** Store exposes an offer-code redemption entry point. */
    OfferCodeRedemption,
}

data class StoreErrorCase(
    val nativeCode: String,
    val expected: ErrorCode,
    val actual: OpenIapError,
)

/**
 * The seam [StoreConformanceSuite] drives. Each Gradle flavor supplies one
 * implementation from its own test source set; this is the only place flavors
 * are allowed to differ.
 */
interface StoreConformanceAdapter {
    /** The store discriminator this implementation must stamp on purchases. */
    val store: IapStore

    /** Behaviors this store supports. See [StoreCapability]. */
    val capabilities: Set<StoreCapability>

    /** The flavor's `toActiveSubscription()` binding. */
    fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription

    /** Store-native failure values passed through the production mapper. */
    val normativeErrorCases: List<StoreErrorCase>

    /** The production mapper's fail-closed result for an unknown native value. */
    val unrecognizedError: OpenIapError

    /** A documented unsupported operation result, or null when none is selected. */
    fun unsupportedOperationResult(): Boolean?
}

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
