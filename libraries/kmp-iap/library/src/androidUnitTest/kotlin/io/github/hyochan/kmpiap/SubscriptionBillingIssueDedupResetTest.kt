package io.github.hyochan.kmpiap

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards `InAppPurchaseAndroid` against a reconnect regression where the
 * session-scoped `emittedBillingIssueTokens` dedupe set leaks across
 * `endConnection()` calls.
 *
 * Without the reset, re-registering after a disconnect/reconnect cycle on
 * the same instance would permanently suppress re-emission of any token
 * that fired before the disconnect — users would stop seeing billing-issue
 * events for subscriptions that transition back into suspension.
 *
 * We go through reflection because the set is deliberately private: the
 * invariant under test is behavioral (reset-on-endConnection) and exposing
 * the internal state just for a test would widen the API surface.
 */
class SubscriptionBillingIssueDedupResetTest {

    @Test
    fun `endConnection clears emittedBillingIssueTokens so reconnect can re-emit`() = runTest {
        val module = InAppPurchaseAndroid()

        val dedupField = InAppPurchaseAndroid::class.java
            .getDeclaredField("emittedBillingIssueTokens")
            .apply { isAccessible = true }

        @Suppress("UNCHECKED_CAST")
        val dedup = dedupField.get(module) as MutableSet<String>
        dedup.add("token-before-disconnect")
        assertTrue(
            dedup.contains("token-before-disconnect"),
            "precondition: dedup set should hold the seeded token"
        )

        module.endConnection()

        @Suppress("UNCHECKED_CAST")
        val dedupAfter = dedupField.get(module) as Set<String>
        assertEquals(
            emptySet<String>(),
            dedupAfter,
            "endConnection() must clear the billing-issue dedupe set so " +
                "the next session can re-emit tokens that fired before disconnect."
        )
    }
}
