package io.github.hyochan.kmpiap

import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ApplicationInfo
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.OpenIapError
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import kotlinx.coroutines.test.runTest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FirstPurchaseNoticeTest {
    private val appContext: Context = ContextWrapper(null)
    private var claims = 0
    private val logs = mutableListOf<String>()

    private fun notice(
        isTestRunner: Boolean = false,
        isHostDebuggable: Boolean = true,
        claimed: Boolean = true,
    ) = FirstPurchaseNotice(
        isTestRunner = { isTestRunner },
        isHostDebuggable = { isHostDebuggable },
        claim = {
            claims += 1
            claimed
        },
        log = { logs += it },
        runInBackground = { work -> work() },
    )

    @Test
    fun `logs the four lines in one call after the first purchased finish in a debug host`() {
        notice().onTransactionFinished(purchase(), appContext)

        assertEquals(listOf(FIRST_PURCHASE_NOTICE), logs)
        assertEquals(4, logs.single().lines().size)
    }

    @Test
    fun `stays silent in a release host`() {
        notice(isHostDebuggable = false).onTransactionFinished(purchase(), appContext)

        assertEquals(0, claims)
        assertTrue(logs.isEmpty())
    }

    @Test
    fun `stays silent under a test runner`() {
        notice(isTestRunner = true).onTransactionFinished(purchase(), appContext)

        assertEquals(0, claims)
        assertTrue(logs.isEmpty())
    }

    @Test
    fun `stays silent for a pending purchase and keeps the claim for a later one`() {
        val notice = notice()

        notice.onTransactionFinished(purchase(PurchaseState.Pending), appContext)
        assertEquals(0, claims)

        notice.onTransactionFinished(purchase(), appContext)
        assertEquals(listOf(FIRST_PURCHASE_NOTICE), logs)
    }

    @Test
    fun `stays silent when this install already showed the notice`() {
        notice(claimed = false).onTransactionFinished(purchase(), appContext)

        assertEquals(1, claims)
        assertTrue(logs.isEmpty())
    }

    @Test
    fun `later finishes in the process skip the native claim`() {
        val notice = notice(claimed = false)

        notice.onTransactionFinished(purchase(), appContext)
        notice.onTransactionFinished(purchase(), appContext)

        assertEquals(1, claims)
    }

    @Test
    fun `detects the JUnit runner by default`() {
        assertTrue(isJUnitOnClasspath())

        FirstPurchaseNotice(
            isHostDebuggable = { true },
            claim = {
                claims += 1
                true
            },
            log = { logs += it },
            runInBackground = { work -> work() },
        ).onTransactionFinished(purchase(), appContext)

        assertEquals(0, claims)
    }

    @Test
    fun `claims off the caller's thread`() {
        val release = CountDownLatch(1)
        val logged = CountDownLatch(1)
        val notice = FirstPurchaseNotice(
            isTestRunner = { false },
            isHostDebuggable = { true },
            claim = {
                release.await(2, TimeUnit.SECONDS)
                true
            },
            log = { logged.countDown() },
        )

        notice.onTransactionFinished(purchase(), appContext)

        assertEquals(1L, logged.count)
        release.countDown()
        assertTrue(logged.await(2, TimeUnit.SECONDS))
    }

    @Test
    fun `the default debug check reads the host app's debuggable flag`() {
        fun host(flags: Int) = object : ContextWrapper(null) {
            override fun getApplicationInfo() = ApplicationInfo().also { it.flags = flags }
        }
        fun defaultCheck() = FirstPurchaseNotice(
            isTestRunner = { false },
            claim = { true },
            log = { logs += it },
            runInBackground = { work -> work() },
        )

        defaultCheck().onTransactionFinished(purchase(), host(0))
        assertTrue(logs.isEmpty())

        defaultCheck().onTransactionFinished(purchase(), host(ApplicationInfo.FLAG_DEBUGGABLE))
        assertEquals(listOf(FIRST_PURCHASE_NOTICE), logs)
    }

    @Test
    fun `a failing debug check never reaches the caller`() {
        // ContextWrapper(null) has no ApplicationInfo, so the default check throws.
        FirstPurchaseNotice(
            isTestRunner = { false },
            claim = { true },
            log = { logs += it },
            runInBackground = { work -> work() },
        ).onTransactionFinished(purchase(), appContext)

        assertTrue(logs.isEmpty())
    }

    @Test
    fun `a failing claim never escapes the background work`() {
        val failures = listOf(
            IllegalStateException("disk full"),
            // An openiap-google older than the helper.
            NoClassDefFoundError("dev/hyo/openiap/helpers/OpenIapFirstPurchaseNotice"),
        )
        for (failure in failures) {
            var escaped: Throwable? = null
            FirstPurchaseNotice(
                isTestRunner = { false },
                isHostDebuggable = { true },
                claim = { throw failure },
                log = { logs += it },
                runInBackground = { work -> escaped = runCatching(work).exceptionOrNull() },
            ).onTransactionFinished(purchase(), appContext)

            assertNull(escaped, failure.toString())
        }
        assertTrue(logs.isEmpty())
    }

    @Test
    fun `delegated stores log after a successful finish`() = runTest {
        for (store in listOf(Store.PLAY_STORE, Store.HORIZON)) {
            logs.clear()
            val iap = delegateModule(store) { _, _ -> }

            iap.finishTransaction(purchase(), isConsumable = false)

            assertEquals(listOf(FIRST_PURCHASE_NOTICE), logs, "$store")
        }
    }

    @Test
    fun `delegated stores stay silent and keep the finish error when the finish fails`() = runTest {
        for (store in listOf(Store.PLAY_STORE, Store.HORIZON)) {
            val iap = delegateModule(store) { _, _ -> throw OpenIapError.PurchaseFailed("store rejected the finish") }

            val failure = assertFailsWith<PurchaseException> { iap.finishTransaction(purchase(), isConsumable = false) }
            assertEquals(ErrorCode.PurchaseError, failure.error.code)
            assertEquals(0, claims, "$store")
        }
    }

    private fun purchase(state: PurchaseState = PurchaseState.Purchased) =
        PurchaseAndroid(
            id = "order-1",
            isAutoRenewing = false,
            productId = "dev.hyo.martie.10bulbs",
            purchaseState = state,
            purchaseToken = "purchase-token",
            quantity = 1,
            store = IapStore.Google,
            storeId = "play",
            transactionDate = 0.0,
        )

    private fun delegateModule(store: Store, finish: MutationFinishTransactionHandler) =
        delegateFor(
            store,
            fakeModule { method, _ ->
                check(method == "getFinishTransaction") { "Unexpected call: $method" }
                finish
            },
            context = appContext,
            firstPurchaseNotice = notice(),
        )
}
