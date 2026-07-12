package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PendingPurchaseOwnershipRaceTest {
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

    @Test
    fun `Android storefront IOS aliases fail with typed unsupported errors`() = runTest {
        val playError = assertFailsWith<PurchaseException> {
            InAppPurchaseAndroid().getStorefrontIOS()
        }
        val amazonError = assertFailsWith<PurchaseException> {
            AmazonInAppPurchaseAndroid().getStorefrontIOS()
        }

        assertEquals(ErrorCode.FeatureNotSupported, playError.error.code)
        assertEquals(ErrorCode.FeatureNotSupported, amazonError.error.code)
    }
}
