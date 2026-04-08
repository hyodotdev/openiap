package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Tests for purchase verification types and related functionality.
 * Based on react-native-iap test patterns for verifyPurchaseWithProvider.
 */
class VerificationTest {

    // MARK: - VerifyPurchaseProps Tests

    @Test
    fun testVerifyPurchasePropsCreationWithApple() {
        val props = VerifyPurchaseProps(
            apple = VerifyPurchaseAppleOptions(sku = "test_product")
        )
        assertNotNull(props.apple)
        assertEquals("test_product", props.apple?.sku)
        assertNull(props.google)
        assertNull(props.horizon)
    }

    @Test
    fun testVerifyPurchasePropsCreationWithGoogle() {
        val props = VerifyPurchaseProps(
            google = VerifyPurchaseGoogleOptions(
                sku = "test_product",
                accessToken = "test_token",
                packageName = "com.test.app",
                purchaseToken = "purchase_token_123",
                isSub = false
            )
        )
        assertNotNull(props.google)
        assertEquals("test_product", props.google?.sku)
        assertEquals("test_token", props.google?.accessToken)
        assertEquals("com.test.app", props.google?.packageName)
        assertEquals("purchase_token_123", props.google?.purchaseToken)
        assertEquals(false, props.google?.isSub)
        assertNull(props.apple)
        assertNull(props.horizon)
    }

    @Test
    fun testVerifyPurchasePropsCreationWithHorizon() {
        val props = VerifyPurchaseProps(
            horizon = VerifyPurchaseHorizonOptions(
                sku = "test_product",
                userId = "user_123",
                accessToken = "horizon_token"
            )
        )
        assertNotNull(props.horizon)
        assertEquals("test_product", props.horizon?.sku)
        assertEquals("user_123", props.horizon?.userId)
        assertEquals("horizon_token", props.horizon?.accessToken)
        assertNull(props.apple)
        assertNull(props.google)
    }

    @Test
    fun testVerifyPurchasePropsToJsonWithApple() {
        val props = VerifyPurchaseProps(
            apple = VerifyPurchaseAppleOptions(sku = "test_product")
        )
        val json = props.toJson()
        assertNotNull(json["apple"])
        val appleJson = json["apple"] as? Map<*, *>
        assertEquals("test_product", appleJson?.get("sku"))
    }

    @Test
    fun testVerifyPurchasePropsToJsonWithGoogle() {
        val props = VerifyPurchaseProps(
            google = VerifyPurchaseGoogleOptions(
                sku = "test_product",
                accessToken = "token",
                packageName = "com.test",
                purchaseToken = "pt"
            )
        )
        val json = props.toJson()
        assertNotNull(json["google"])
        val googleJson = json["google"] as? Map<*, *>
        assertEquals("test_product", googleJson?.get("sku"))
        assertEquals("token", googleJson?.get("accessToken"))
    }

    @Test
    fun testVerifyPurchasePropsFromJsonWithApple() {
        val json = mapOf(
            "apple" to mapOf("sku" to "test_product")
        )
        val props = VerifyPurchaseProps.fromJson(json)
        assertNotNull(props.apple)
        assertEquals("test_product", props.apple?.sku)
    }

    @Test
    fun testVerifyPurchasePropsFromJsonWithGoogle() {
        val json = mapOf(
            "google" to mapOf(
                "sku" to "test_product",
                "accessToken" to "token",
                "packageName" to "com.test",
                "purchaseToken" to "pt",
                "isSub" to true
            )
        )
        val props = VerifyPurchaseProps.fromJson(json)
        assertNotNull(props.google)
        assertEquals("test_product", props.google?.sku)
        assertEquals("token", props.google?.accessToken)
        assertEquals(true, props.google?.isSub)
    }

    @Test
    fun testVerifyPurchaseAppleOptionsToJson() {
        val options = VerifyPurchaseAppleOptions(sku = "premium")
        val json = options.toJson()
        assertEquals("premium", json["sku"])
    }

    @Test
    fun testVerifyPurchaseGoogleOptionsToJson() {
        val options = VerifyPurchaseGoogleOptions(
            sku = "premium",
            accessToken = "at",
            packageName = "pkg",
            purchaseToken = "pt",
            isSub = true
        )
        val json = options.toJson()
        assertEquals("premium", json["sku"])
        assertEquals("at", json["accessToken"])
        assertEquals("pkg", json["packageName"])
        assertEquals("pt", json["purchaseToken"])
        assertEquals(true, json["isSub"])
    }

    @Test
    fun testVerifyPurchaseHorizonOptionsToJson() {
        val options = VerifyPurchaseHorizonOptions(
            sku = "vr_product",
            userId = "uid",
            accessToken = "hat"
        )
        val json = options.toJson()
        assertEquals("vr_product", json["sku"])
        assertEquals("uid", json["userId"])
        assertEquals("hat", json["accessToken"])
    }

    @Test
    fun testVerifyPurchaseGoogleOptionsWithNullIsSub() {
        val options = VerifyPurchaseGoogleOptions(
            sku = "test",
            accessToken = "t",
            packageName = "p",
            purchaseToken = "pt"
        )
        assertNull(options.isSub)
    }

    // MARK: - VerifyPurchaseResultIOS Tests

    @Test
    fun testVerifyPurchaseResultIOSCreation() {
        val result = VerifyPurchaseResultIOS(
            isValid = true,
            jwsRepresentation = "test-jws",
            receiptData = "test-receipt-data"
        )
        assertTrue(result.isValid)
        assertEquals("test-jws", result.jwsRepresentation)
        assertEquals("test-receipt-data", result.receiptData)
        assertNull(result.latestTransaction)
    }

    @Test
    fun testVerifyPurchaseResultIOSWithLatestTransaction() {
        val purchase = PurchaseIOS(
            id = "trans123",
            productId = "test_product",
            platform = IapPlatform.Ios,
            quantity = 1,
            purchaseState = PurchaseState.Purchased,
            store = IapStore.Apple,
            isAutoRenewing = false,
            transactionDate = 1234567890.0,
            transactionId = "trans123"
        )
        val result = VerifyPurchaseResultIOS(
            isValid = true,
            jwsRepresentation = "test-jws",
            receiptData = "test-receipt-data",
            latestTransaction = purchase
        )
        assertNotNull(result.latestTransaction)
        assertEquals("trans123", result.latestTransaction?.id)
    }

    @Test
    fun testVerifyPurchaseResultIOSToJson() {
        val result = VerifyPurchaseResultIOS(
            isValid = true,
            jwsRepresentation = "test-jws",
            receiptData = "test-receipt"
        )
        val json = result.toJson()
        assertEquals(true, json["isValid"])
        assertEquals("test-jws", json["jwsRepresentation"])
        assertEquals("test-receipt", json["receiptData"])
        assertEquals("VerifyPurchaseResultIOS", json["__typename"])
    }

    @Test
    fun testVerifyPurchaseResultIOSFromJson() {
        val json = mapOf(
            "__typename" to "VerifyPurchaseResultIOS",
            "isValid" to true,
            "jwsRepresentation" to "jws-token",
            "receiptData" to "receipt-data",
            "latestTransaction" to null
        )
        val result = VerifyPurchaseResultIOS.fromJson(json)
        assertTrue(result.isValid)
        assertEquals("jws-token", result.jwsRepresentation)
        assertEquals("receipt-data", result.receiptData)
    }

    // MARK: - VerifyPurchaseResultAndroid Tests

    @Test
    fun testVerifyPurchaseResultAndroidCreation() {
        val result = VerifyPurchaseResultAndroid(
            autoRenewing = false,
            betaProduct = false,
            freeTrialEndDate = 0.0,
            gracePeriodEndDate = 0.0,
            parentProductId = "parent",
            productId = "test_product",
            productType = "inapp",
            purchaseDate = 1234567890.0,
            quantity = 1,
            receiptId = "receipt123",
            renewalDate = 0.0,
            term = "P1M",
            termSku = "test_product",
            testTransaction = true
        )
        assertEquals("test_product", result.productId)
        assertEquals("receipt123", result.receiptId)
        assertTrue(result.testTransaction)
        assertFalse(result.autoRenewing)
    }

    @Test
    fun testVerifyPurchaseResultAndroidWithCancelInfo() {
        val result = VerifyPurchaseResultAndroid(
            autoRenewing = false,
            betaProduct = false,
            cancelDate = 1234600000.0,
            cancelReason = "user_cancelled",
            freeTrialEndDate = 0.0,
            gracePeriodEndDate = 0.0,
            parentProductId = "parent",
            productId = "test_sub",
            productType = "subs",
            purchaseDate = 1234567890.0,
            quantity = 1,
            receiptId = "receipt123",
            renewalDate = 0.0,
            term = "P1M",
            termSku = "test_sub",
            testTransaction = false
        )
        assertNotNull(result.cancelDate)
        assertEquals("user_cancelled", result.cancelReason)
    }

    @Test
    fun testVerifyPurchaseResultAndroidToJson() {
        val result = VerifyPurchaseResultAndroid(
            autoRenewing = true,
            betaProduct = false,
            freeTrialEndDate = 0.0,
            gracePeriodEndDate = 0.0,
            parentProductId = "parent",
            productId = "sub_monthly",
            productType = "subs",
            purchaseDate = 1234567890.0,
            quantity = 1,
            receiptId = "rid",
            renewalDate = 1234654890.0,
            term = "P1M",
            termSku = "sub_monthly",
            testTransaction = false
        )
        val json = result.toJson()
        assertEquals(true, json["autoRenewing"])
        assertEquals("sub_monthly", json["productId"])
        assertEquals("subs", json["productType"])
        assertEquals("VerifyPurchaseResultAndroid", json["__typename"])
    }

    // MARK: - PurchaseVerificationProvider Tests

    @Test
    fun testPurchaseVerificationProviderIapkit() {
        val provider = PurchaseVerificationProvider.Iapkit
        assertEquals("iapkit", provider.rawValue)
        assertEquals("iapkit", provider.toJson())
    }

    @Test
    fun testPurchaseVerificationProviderFromJson() {
        assertEquals(PurchaseVerificationProvider.Iapkit, PurchaseVerificationProvider.fromJson("iapkit"))
        assertEquals(PurchaseVerificationProvider.Iapkit, PurchaseVerificationProvider.fromJson("IAPKIT"))
        assertEquals(PurchaseVerificationProvider.Iapkit, PurchaseVerificationProvider.fromJson("Iapkit"))
    }

    // MARK: - IapkitPurchaseState Tests

    @Test
    fun testIapkitPurchaseStateEntitled() {
        val state = IapkitPurchaseState.Entitled
        assertEquals("entitled", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStatePendingAcknowledgment() {
        val state = IapkitPurchaseState.PendingAcknowledgment
        assertEquals("pending-acknowledgment", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStatePending() {
        val state = IapkitPurchaseState.Pending
        assertEquals("pending", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateCanceled() {
        val state = IapkitPurchaseState.Canceled
        assertEquals("canceled", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateExpired() {
        val state = IapkitPurchaseState.Expired
        assertEquals("expired", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateReadyToConsume() {
        val state = IapkitPurchaseState.ReadyToConsume
        assertEquals("ready-to-consume", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateConsumed() {
        val state = IapkitPurchaseState.Consumed
        assertEquals("consumed", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateUnknown() {
        val state = IapkitPurchaseState.Unknown
        assertEquals("unknown", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateInauthentic() {
        val state = IapkitPurchaseState.Inauthentic
        assertEquals("inauthentic", state.rawValue)
    }

    @Test
    fun testIapkitPurchaseStateFromJson() {
        assertEquals(IapkitPurchaseState.Entitled, IapkitPurchaseState.fromJson("entitled"))
        assertEquals(IapkitPurchaseState.PendingAcknowledgment, IapkitPurchaseState.fromJson("pending-acknowledgment"))
        assertEquals(IapkitPurchaseState.Pending, IapkitPurchaseState.fromJson("pending"))
        assertEquals(IapkitPurchaseState.Canceled, IapkitPurchaseState.fromJson("canceled"))
        assertEquals(IapkitPurchaseState.Expired, IapkitPurchaseState.fromJson("expired"))
        assertEquals(IapkitPurchaseState.ReadyToConsume, IapkitPurchaseState.fromJson("ready-to-consume"))
        assertEquals(IapkitPurchaseState.Consumed, IapkitPurchaseState.fromJson("consumed"))
        assertEquals(IapkitPurchaseState.Unknown, IapkitPurchaseState.fromJson("unknown"))
        assertEquals(IapkitPurchaseState.Inauthentic, IapkitPurchaseState.fromJson("inauthentic"))
    }

    // MARK: - IapStore Tests

    @Test
    fun testIapStoreApple() {
        val store = IapStore.Apple
        assertEquals("apple", store.rawValue)
    }

    @Test
    fun testIapStoreGoogle() {
        val store = IapStore.Google
        assertEquals("google", store.rawValue)
    }

    @Test
    fun testIapStoreFromJson() {
        assertEquals(IapStore.Apple, IapStore.fromJson("apple"))
        assertEquals(IapStore.Google, IapStore.fromJson("google"))
    }

    // MARK: - RequestVerifyPurchaseWithIapkitProps Tests

    @Test
    fun testRequestVerifyPurchaseWithIapkitPropsApple() {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "test-api-key",
            apple = RequestVerifyPurchaseWithIapkitAppleProps(jws = "test-jws-token")
        )
        assertEquals("test-api-key", props.apiKey)
        assertNotNull(props.apple)
        assertEquals("test-jws-token", props.apple?.jws)
        assertNull(props.google)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitPropsGoogle() {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "test-api-key",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = "test-purchase-token")
        )
        assertEquals("test-api-key", props.apiKey)
        assertNull(props.apple)
        assertNotNull(props.google)
        assertEquals("test-purchase-token", props.google?.purchaseToken)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitPropsToJson() {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "key123",
            apple = RequestVerifyPurchaseWithIapkitAppleProps(jws = "jws-value")
        )
        val json = props.toJson()
        assertEquals("key123", json["apiKey"])
        assertNotNull(json["apple"])
    }

    // MARK: - RequestVerifyPurchaseWithIapkitResult Tests

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultValid() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = IapkitPurchaseState.Entitled,
            store = IapStore.Apple
        )
        assertTrue(result.isValid)
        assertEquals(IapkitPurchaseState.Entitled, result.state)
        assertEquals(IapStore.Apple, result.store)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultExpired() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = false,
            state = IapkitPurchaseState.Expired,
            store = IapStore.Google
        )
        assertFalse(result.isValid)
        assertEquals(IapkitPurchaseState.Expired, result.state)
        assertEquals(IapStore.Google, result.store)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultInauthentic() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = false,
            state = IapkitPurchaseState.Inauthentic,
            store = IapStore.Apple
        )
        assertFalse(result.isValid)
        assertEquals(IapkitPurchaseState.Inauthentic, result.state)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultReadyToConsume() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = IapkitPurchaseState.ReadyToConsume,
            store = IapStore.Google
        )
        assertTrue(result.isValid)
        assertEquals(IapkitPurchaseState.ReadyToConsume, result.state)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultPendingAcknowledgment() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = IapkitPurchaseState.PendingAcknowledgment,
            store = IapStore.Google
        )
        assertTrue(result.isValid)
        assertEquals(IapkitPurchaseState.PendingAcknowledgment, result.state)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultToJson() {
        val result = RequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = IapkitPurchaseState.Entitled,
            store = IapStore.Apple
        )
        val json = result.toJson()
        assertEquals(true, json["isValid"])
        assertEquals("entitled", json["state"])
        assertEquals("apple", json["store"])
        assertEquals("RequestVerifyPurchaseWithIapkitResult", json["__typename"])
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultFromJson() {
        val json = mapOf(
            "isValid" to true,
            "state" to "entitled",
            "store" to "google"
        )
        val result = RequestVerifyPurchaseWithIapkitResult.fromJson(json)
        assertTrue(result.isValid)
        assertEquals(IapkitPurchaseState.Entitled, result.state)
        assertEquals(IapStore.Google, result.store)
    }

    // MARK: - VerifyPurchaseWithProviderProps Tests

    @Test
    fun testVerifyPurchaseWithProviderPropsIapkit() {
        val props = VerifyPurchaseWithProviderProps(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = "test-key",
                apple = RequestVerifyPurchaseWithIapkitAppleProps(jws = "jws-token")
            )
        )
        assertEquals(PurchaseVerificationProvider.Iapkit, props.provider)
        assertNotNull(props.iapkit)
        assertEquals("test-key", props.iapkit?.apiKey)
    }

    @Test
    fun testVerifyPurchaseWithProviderPropsToJson() {
        val props = VerifyPurchaseWithProviderProps(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = "key",
                google = RequestVerifyPurchaseWithIapkitGoogleProps(purchaseToken = "token")
            )
        )
        val json = props.toJson()
        assertEquals("iapkit", json["provider"])
        assertNotNull(json["iapkit"])
    }

    // MARK: - VerifyPurchaseWithProviderResult Tests

    @Test
    fun testVerifyPurchaseWithProviderResultWithIapkit() {
        val result = VerifyPurchaseWithProviderResult(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitResult(
                isValid = true,
                state = IapkitPurchaseState.Entitled,
                store = IapStore.Apple
            )
        )
        assertEquals(PurchaseVerificationProvider.Iapkit, result.provider)
        assertNotNull(result.iapkit)
        assertTrue(result.iapkit!!.isValid)
        assertEquals(IapkitPurchaseState.Entitled, result.iapkit!!.state)
        assertEquals(IapStore.Apple, result.iapkit!!.store)
    }

    @Test
    fun testVerifyPurchaseWithProviderResultNullIapkit() {
        val result = VerifyPurchaseWithProviderResult(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = null
        )
        assertEquals(PurchaseVerificationProvider.Iapkit, result.provider)
        assertNull(result.iapkit)
    }

    @Test
    fun testVerifyPurchaseWithProviderResultToJson() {
        val result = VerifyPurchaseWithProviderResult(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitResult(
                isValid = true,
                state = IapkitPurchaseState.Entitled,
                store = IapStore.Apple
            )
        )
        val json = result.toJson()
        assertEquals("iapkit", json["provider"])
        assertEquals("VerifyPurchaseWithProviderResult", json["__typename"])
        assertNotNull(json["iapkit"])
    }

    @Test
    fun testVerifyPurchaseWithProviderResultFromJson() {
        val json = mapOf(
            "provider" to "iapkit",
            "iapkit" to mapOf(
                "isValid" to true,
                "state" to "entitled",
                "store" to "apple"
            )
        )
        val result = VerifyPurchaseWithProviderResult.fromJson(json)
        assertEquals(PurchaseVerificationProvider.Iapkit, result.provider)
        assertNotNull(result.iapkit)
        assertTrue(result.iapkit!!.isValid)
        assertEquals(IapkitPurchaseState.Entitled, result.iapkit!!.state)
    }

    // MARK: - Verification Error Code Tests

    @Test
    fun testPurchaseVerificationFailedErrorCode() {
        val error = PurchaseError(
            code = ErrorCode.PurchaseVerificationFailed,
            message = "Verification failed"
        )
        assertEquals(ErrorCode.PurchaseVerificationFailed, error.code)
        assertEquals("purchase-verification-failed", error.code.toJson())
    }

    @Test
    fun testPurchaseVerificationFinishedErrorCode() {
        val error = PurchaseError(
            code = ErrorCode.PurchaseVerificationFinished,
            message = "Verification finished"
        )
        assertEquals(ErrorCode.PurchaseVerificationFinished, error.code)
        assertEquals("purchase-verification-finished", error.code.toJson())
    }

    @Test
    fun testPurchaseVerificationFinishFailedErrorCode() {
        val error = PurchaseError(
            code = ErrorCode.PurchaseVerificationFinishFailed,
            message = "Verification finish failed"
        )
        assertEquals(ErrorCode.PurchaseVerificationFinishFailed, error.code)
        assertEquals("purchase-verification-finish-failed", error.code.toJson())
    }

    // MARK: - Integration Tests (Type Round-Trip)

    @Test
    fun testVerifyPurchaseResultIOSRoundTrip() {
        val original = VerifyPurchaseResultIOS(
            isValid = true,
            jwsRepresentation = "test-jws",
            receiptData = "test-receipt"
        )
        val json = original.toJson()
        val restored = VerifyPurchaseResultIOS.fromJson(json)

        assertEquals(original.isValid, restored.isValid)
        assertEquals(original.jwsRepresentation, restored.jwsRepresentation)
        assertEquals(original.receiptData, restored.receiptData)
    }

    @Test
    fun testVerifyPurchaseResultAndroidRoundTrip() {
        val original = VerifyPurchaseResultAndroid(
            autoRenewing = true,
            betaProduct = false,
            freeTrialEndDate = 0.0,
            gracePeriodEndDate = 0.0,
            parentProductId = "parent",
            productId = "product",
            productType = "subs",
            purchaseDate = 1234567890.0,
            quantity = 1,
            receiptId = "receipt",
            renewalDate = 1234600000.0,
            term = "P1M",
            termSku = "product",
            testTransaction = false
        )
        val json = original.toJson()
        val restored = VerifyPurchaseResultAndroid.fromJson(json)

        assertEquals(original.autoRenewing, restored.autoRenewing)
        assertEquals(original.productId, restored.productId)
        assertEquals(original.receiptId, restored.receiptId)
        assertEquals(original.purchaseDate, restored.purchaseDate)
    }

    @Test
    fun testRequestVerifyPurchaseWithIapkitResultRoundTrip() {
        val original = RequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = IapkitPurchaseState.Entitled,
            store = IapStore.Apple
        )
        val json = original.toJson()
        val restored = RequestVerifyPurchaseWithIapkitResult.fromJson(json)

        assertEquals(original.isValid, restored.isValid)
        assertEquals(original.state, restored.state)
        assertEquals(original.store, restored.store)
    }

    // MARK: - All IAPKit Purchase States Coverage

    @Test
    fun testAllIapkitPurchaseStatesFromJson() {
        val states = listOf(
            "entitled" to IapkitPurchaseState.Entitled,
            "pending-acknowledgment" to IapkitPurchaseState.PendingAcknowledgment,
            "pending" to IapkitPurchaseState.Pending,
            "canceled" to IapkitPurchaseState.Canceled,
            "expired" to IapkitPurchaseState.Expired,
            "ready-to-consume" to IapkitPurchaseState.ReadyToConsume,
            "consumed" to IapkitPurchaseState.Consumed,
            "unknown" to IapkitPurchaseState.Unknown,
            "inauthentic" to IapkitPurchaseState.Inauthentic
        )

        for ((jsonValue, expectedState) in states) {
            val result = IapkitPurchaseState.fromJson(jsonValue)
            assertEquals(expectedState, result, "Failed for state: $jsonValue")
        }
    }

    @Test
    fun testAllIapkitPurchaseStatesToJson() {
        val states = listOf(
            IapkitPurchaseState.Entitled to "entitled",
            IapkitPurchaseState.PendingAcknowledgment to "pending-acknowledgment",
            IapkitPurchaseState.Pending to "pending",
            IapkitPurchaseState.Canceled to "canceled",
            IapkitPurchaseState.Expired to "expired",
            IapkitPurchaseState.ReadyToConsume to "ready-to-consume",
            IapkitPurchaseState.Consumed to "consumed",
            IapkitPurchaseState.Unknown to "unknown",
            IapkitPurchaseState.Inauthentic to "inauthentic"
        )

        for ((state, expectedJson) in states) {
            assertEquals(expectedJson, state.toJson(), "Failed for state: $state")
        }
    }
}
