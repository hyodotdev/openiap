package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
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

    /** The flavor's `OpenIapError.fromBillingResponseCode` binding. */
    fun errorForResponseCode(responseCode: Int): OpenIapError
}
