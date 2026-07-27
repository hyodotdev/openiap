package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class PendingPurchaseOwnershipRaceTest {
    @Test
    fun `purchase preflight validation emits and throws`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val module = InAppPurchaseAndroid()
            val emitted = backgroundScope.async(UnconfinedTestDispatcher(testScheduler)) {
                module.purchaseErrorListener.first()
            }
            val request = RequestPurchaseProps(
                request = RequestPurchaseProps.Request.Purchase(
                    RequestPurchasePropsByPlatforms(
                        google = RequestPurchaseAndroidProps(skus = emptyList())
                    )
                ),
                type = ProductQueryType.InApp,
            )

            val failure = assertFailsWith<PurchaseException> {
                module.requestPurchase(request)
            }

            assertEquals(ErrorCode.EmptySkuList, failure.error.code)
            assertEquals(failure.error, emitted.await())
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `user cancellation is rethrown instead of becoming an empty purchase result`() {
        var publishedError: PurchaseError? = null
        var publicationCount = 0

        val failure = assertFailsWith<PurchaseException> {
            throwPurchaseRequestFailure(
                PurchaseException(
                    PurchaseError(
                        code = ErrorCode.UserCancelled,
                        message = "User cancelled the operation",
                    )
                ),
                productId = "product",
            ) { error ->
                publicationCount += 1
                publishedError = error
            }
        }

        assertEquals(1, publicationCount)
        assertEquals(ErrorCode.UserCancelled, publishedError?.code)
        assertEquals(ErrorCode.UserCancelled, failure.error.code)
        assertEquals("product", failure.error.productId)
    }

    @Test
    fun `end records terminal result before a late callback attachment`() = runTest {
        val module = InAppPurchaseAndroid()
        val lifecycleClass = Class.forName(
            "io.github.hyochan.kmpiap.InAppPurchaseAndroid\$PurchaseRequestLifecycle"
        )
        val lifecycle = lifecycleClass.getDeclaredConstructor()
            .apply { isAccessible = true }
            .newInstance()
        val ownerClass = Class.forName(
            "io.github.hyochan.kmpiap.InAppPurchaseAndroid\$PendingPurchaseOwner"
        )
        val owner = ownerClass.declaredConstructors
            .first { it.parameterCount == 5 }
            .apply { isAccessible = true }
            .newInstance(lifecycle, null, null, null, null)
        val pendingField = InAppPurchaseAndroid::class.java
            .getDeclaredField("pendingPurchase")
            .apply { isAccessible = true }
        pendingField.set(module, owner)

        module.endConnection()

        assertNull(pendingField.get(module))
        assertNotNull(
            lifecycleClass.getDeclaredField("terminalResult")
                .apply { isAccessible = true }
                .get(lifecycle)
        )
        assertTrue(
            (lifecycleClass.getDeclaredField("errorPublished")
                .apply { isAccessible = true }
                .get(lifecycle) as AtomicBoolean).get()
        )

        val attach = InAppPurchaseAndroid::class.java.declaredMethods
            .first { it.name.startsWith("attachPurchaseCallback") }
            .apply { isAccessible = true }
        val lateResult = attach.invoke(
            module,
            lifecycle,
            { _: Result<List<io.github.hyochan.kmpiap.openiap.Purchase>> -> Unit },
        )

        assertNotNull(lateResult)
        assertNull(pendingField.get(module))
    }

    @Test
    fun `request terminal claim wins once before a later end`() = runTest {
        val module = InAppPurchaseAndroid()
        val lifecycleClass = Class.forName(
            "io.github.hyochan.kmpiap.InAppPurchaseAndroid\$PurchaseRequestLifecycle"
        )
        val lifecycle = lifecycleClass.getDeclaredConstructor()
            .apply { isAccessible = true }
            .newInstance()
        val ownerClass = Class.forName(
            "io.github.hyochan.kmpiap.InAppPurchaseAndroid\$PendingPurchaseOwner"
        )
        val owner = ownerClass.declaredConstructors
            .first { it.parameterCount == 5 }
            .apply { isAccessible = true }
            .newInstance(lifecycle, null, null, null, null)
        val pendingField = InAppPurchaseAndroid::class.java
            .getDeclaredField("pendingPurchase")
            .apply { isAccessible = true }
        pendingField.set(module, owner)
        val claim = InAppPurchaseAndroid::class.java.declaredMethods
            .first { it.name.startsWith("claimPendingPurchaseResult") }
            .apply { isAccessible = true }

        assertNotNull(claim.invoke(module, lifecycle, null, Result.success(emptyList<Any>())))
        module.endConnection()

        assertNull(pendingField.get(module))
        assertFalse(
            (lifecycleClass.getDeclaredField("errorPublished")
                .apply { isAccessible = true }
                .get(lifecycle) as AtomicBoolean).get()
        )
    }

}
