package dev.hyo.openiap.conformance

import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Behavioral conformance expectations for every Android store, declared once
 * and compiled into the testPlay, testHorizon, and testAmazon source sets.
 *
 * Adding a store means adding a [StoreConformanceAdapter], not another copy of
 * these tests.
 */
abstract class StoreConformanceSuite {

    protected abstract val adapter: StoreConformanceAdapter

    // --- Spec binding ------------------------------------------------------

    /**
     * Behavior ids from packages/conformance this suite demonstrates. Asserted
     * against the generated [ConformanceBehaviors] so a renamed or retired id
     * fails here instead of silently losing coverage.
     */
    private val coveredBehaviors = listOf(
        ConformanceBehaviors.SUBSCRIPTIONS_ACTIVE_SUBSCRIPTION_IS_REPORTED_ACTIVE,
        ConformanceBehaviors.SUBSCRIPTIONS_PENDING_SUBSCRIPTION_IS_NOT_ACTIVE,
        ConformanceBehaviors.SUBSCRIPTIONS_UNKNOWN_STATE_SUBSCRIPTION_IS_NOT_ACTIVE,
        ConformanceBehaviors.SUBSCRIPTIONS_GROUPS_KEEP_INDEPENDENT_IDENTIFIERS,
        ConformanceBehaviors.ERRORS_STORE_CODES_NORMALIZE_TO_SPEC_ERROR_CODES,
        ConformanceBehaviors.ERRORS_UNRECOGNIZED_STORE_CODE_NORMALIZES_TO_UNKNOWN,
        ConformanceBehaviors.IDENTIFIERS_PURCHASE_CARRIES_A_CONCRETE_STORE,
        ConformanceBehaviors.CAPABILITIES_DECLARED_CAPABILITIES_MATCH_THE_MATRIX,
    )

    private val unsupportedStoreBehaviors = listOf(
        ConformanceBehaviors.CAPABILITIES_UNSUPPORTED_OPERATIONS_DEGRADE_PREDICTABLY,
    )

    @Test
    fun `suite declares the spec behaviors it covers`() {
        val declarations = coveredBehaviors + unsupportedStoreBehaviors
        assertEquals(9, declarations.size)
        assertEquals(declarations.size, declarations.toSet().size)
        for (id in declarations) {
            assertTrue("behavior id must be non-blank", id.isNotBlank())
            assertTrue("behavior id must be namespaced: $id", id.contains('.'))
        }
    }

    // --- Entitlement integrity (assertions with financial consequence) ----

    @Test
    fun `purchased subscription is an active entitlement`() {
        val active = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.premium.monthly", "token-premium", PurchaseState.Purchased),
        )

        assertTrue(
            "${adapter.store}: a Purchased subscription must be an active entitlement",
            active.isActive,
        )
    }

    // Unconditional: producing a Pending state is a capability, but what
    // Pending means is not negotiable.
    @Test
    fun `pending subscription is not an active entitlement`() {
        val pending = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.premium.monthly", "token-pending", PurchaseState.Pending),
        )

        assertFalse(
            "${adapter.store}: a Pending purchase is unpaid and must not be an active entitlement",
            pending.isActive,
        )
    }

    @Test
    fun `unknown-state subscription is not an active entitlement`() {
        val unknown = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.premium.monthly", "token-unknown", PurchaseState.Unknown),
        )

        assertFalse(
            "${adapter.store}: an Unknown-state purchase must not be an active entitlement",
            unknown.isActive,
        )
    }

    // --- Identifier normalization ----------------------------------------

    @Test
    fun `active subscriptions keep independent product ids for multiple groups`() {
        val premium = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.premium.monthly", "token-premium"),
        )
        val pro = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.pro.monthly", "token-pro"),
        )

        assertEquals("dev.hyo.martie.premium.monthly", premium.productId)
        assertEquals("dev.hyo.martie.premium.monthly", premium.currentPlanId)
        assertEquals("token-premium", premium.purchaseToken)
        assertEquals("dev.hyo.martie.pro.monthly", pro.productId)
        assertEquals("dev.hyo.martie.pro.monthly", pro.currentPlanId)
        assertEquals("token-pro", pro.purchaseToken)
    }

    @Test
    fun `active subscription carries the purchase token on both token fields`() {
        val active = adapter.toActiveSubscription(
            purchase("dev.hyo.martie.premium.monthly", "token-premium"),
        )

        assertEquals("token-premium", active.purchaseToken)
        assertEquals("token-premium", active.purchaseTokenAndroid)
    }

    // --- Normalized error codes -------------------------------------------
    // Adapters bind these assertions to their store-native production mapper.

    @Test
    fun `store response codes normalize to the specified error codes`() {
        for (errorCase in adapter.normativeErrorCases) {
            assertEquals(
                "${adapter.store}: ${errorCase.nativeCode} must normalize to ${errorCase.expected.rawValue}",
                errorCase.expected.rawValue,
                errorCase.actual.code,
            )
        }
    }

    @Test
    fun `unrecognized store response codes normalize to Unknown`() {
        assertEquals(
            "${adapter.store}: an unrecognized response code must normalize to Unknown",
            ErrorCode.Unknown.rawValue,
            adapter.unrecognizedError.code,
        )
    }

    @Test
    fun `unsupported offer code redemption returns its documented no-op`() {
        val result = adapter.unsupportedOperationResult()
        if (StoreCapability.OfferCodeRedemption in adapter.capabilities) {
            assertEquals(null, result)
        } else {
            assertEquals(false, result)
        }
    }

    // --- Capabilities ------------------------------------------------------

    /**
     * An adapter that declares capabilities its store does not have would let
     * capability-gated checks silently pass. The matrix is the authority.
     */
    @Test
    fun `declared capabilities match the specification matrix`() {
        val expectations = mapOf(
            StoreCapability.PendingPurchases to "pendingPurchases",
            StoreCapability.SubscriptionBillingIssue to "subscriptionBillingIssue",
            StoreCapability.OfferCodeRedemption to "offerCodeRedemption",
        )

        for ((capability, behavior) in expectations) {
            val level = ConformanceBehaviors.CAPABILITY_MATRIX[behavior]
                ?.get(adapter.store.name)
                ?: error("capability matrix has no $behavior entry for ${adapter.store}")

            val declared = capability in adapter.capabilities
            assertEquals(
                "${adapter.store}: $behavior is \"$level\" in the matrix but declared=$declared",
                level != "unsupported",
                declared,
            )
        }
    }

    // --- Store discriminator ---------------------------------------------

    @Test
    fun `adapter declares a concrete store discriminator`() {
        assertTrue(
            "a store implementation must not report IapStore.Unknown",
            adapter.store != IapStore.Unknown,
        )
    }

    // --- Fixtures ---------------------------------------------------------

    private fun purchase(
        productId: String,
        token: String,
        state: PurchaseState = PurchaseState.Purchased,
    ): PurchaseAndroid = PurchaseAndroid(
        autoRenewingAndroid = true,
        currentPlanId = productId,
        dataAndroid = "{}",
        id = token,
        ids = listOf(productId),
        isAcknowledgedAndroid = true,
        isAutoRenewing = true,
        packageNameAndroid = "dev.hyo.martie",
        productId = productId,
        purchaseState = state,
        purchaseToken = token,
        quantity = 1,
        signatureAndroid = null,
        store = adapter.store,
        transactionDate = 1_700_000_000_000.0,
        transactionId = token,
    )

}
