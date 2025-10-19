package dev.hyo.openiap

import com.android.billingclient.api.BillingClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenIapErrorTest {

    @Test
    fun `ProductNotFound has correct code and message`() {
        val error = OpenIapError.ProductNotFound("test_product")
        assertEquals(ErrorCode.SkuNotFound.rawValue, error.code)
        assertEquals("Product not found", error.message)
    }

    @Test
    fun `PurchaseFailed has correct code and message`() {
        val error = OpenIapError.PurchaseFailed
        assertEquals(ErrorCode.PurchaseError.rawValue, error.code)
        assertEquals("Purchase failed", error.message)
    }

    @Test
    fun `PurchaseCancelled has correct code and message`() {
        val error = OpenIapError.PurchaseCancelled
        assertEquals(ErrorCode.UserCancelled.rawValue, error.code)
        assertEquals("Purchase was cancelled by the user", error.message)
    }

    @Test
    fun `PurchaseDeferred has correct code and message`() {
        val error = OpenIapError.PurchaseDeferred
        assertEquals(ErrorCode.DeferredPayment.rawValue, error.code)
        assertEquals("Purchase was deferred", error.message)
    }

    @Test
    fun `PaymentNotAllowed has correct code and message`() {
        val error = OpenIapError.PaymentNotAllowed
        assertEquals(ErrorCode.UserError.rawValue, error.code)
        assertEquals("Payment not allowed", error.message)
    }

    @Test
    fun `BillingError has correct code and message`() {
        val error = OpenIapError.BillingError
        assertEquals(ErrorCode.ServiceError.rawValue, error.code)
        assertEquals("Billing error", error.message)
    }

    @Test
    fun `InvalidReceipt has correct code and message`() {
        val error = OpenIapError.InvalidReceipt
        assertEquals(ErrorCode.ReceiptFailed.rawValue, error.code)
        assertEquals("Invalid receipt", error.message)
    }

    @Test
    fun `NetworkError has correct code and message`() {
        val error = OpenIapError.NetworkError
        assertEquals(ErrorCode.NetworkError.rawValue, error.code)
        assertEquals("Network connection error", error.message)
    }

    @Test
    fun `VerificationFailed has correct code and message`() {
        val error = OpenIapError.VerificationFailed
        assertEquals(ErrorCode.TransactionValidationFailed.rawValue, error.code)
        assertEquals("Verification failed", error.message)
    }

    @Test
    fun `RestoreFailed has correct code and message`() {
        val error = OpenIapError.RestoreFailed
        assertEquals(ErrorCode.SyncError.rawValue, error.code)
        assertEquals("Restore failed", error.message)
    }

    @Test
    fun `UnknownError has correct code and message`() {
        val error = OpenIapError.UnknownError
        assertEquals(ErrorCode.Unknown.rawValue, error.code)
        assertEquals("Unknown error", error.message)
    }


    @Test
    fun `NotPrepared has correct code and message`() {
        val error = OpenIapError.NotPrepared
        assertEquals(ErrorCode.NotPrepared.rawValue, error.code)
        assertEquals("Billing client not ready", error.message)
    }

    @Test
    fun `InitConnection has correct code and message`() {
        val error = OpenIapError.InitConnection
        assertEquals(ErrorCode.InitConnection.rawValue, error.code)
        assertEquals("Failed to initialize billing connection", error.message)
    }

    @Test
    fun `QueryProduct has correct code and message`() {
        val error = OpenIapError.QueryProduct
        assertEquals(ErrorCode.QueryProduct.rawValue, error.code)
        assertEquals("Failed to query product", error.message)
    }

    @Test
    fun `EmptySkuList has correct code and message`() {
        val error = OpenIapError.EmptySkuList
        assertEquals(ErrorCode.EmptySkuList.rawValue, error.code)
        assertEquals("SKU list cannot be empty", error.message)
    }

    @Test
    fun `SkuNotFound has correct code and message`() {
        val error = OpenIapError.SkuNotFound("test_sku")
        assertEquals(ErrorCode.SkuNotFound.rawValue, error.code)
        assertEquals("SKU not found", error.message)
    }

    @Test
    fun `SkuOfferMismatch has correct code and message`() {
        val error = OpenIapError.SkuOfferMismatch
        assertEquals(ErrorCode.SkuOfferMismatch.rawValue, error.code)
        assertEquals("SKU and offer token count mismatch", error.message)
    }

    @Test
    fun `MissingCurrentActivity has correct code and message`() {
        val error = OpenIapError.MissingCurrentActivity
        assertEquals(ErrorCode.ActivityUnavailable.rawValue, error.code)
        assertEquals("Current activity is not available", error.message)
    }

    @Test
    fun `UserCancelled has correct code and message`() {
        val error = OpenIapError.UserCancelled
        assertEquals(ErrorCode.UserCancelled.rawValue, error.code)
        assertEquals("User cancelled the operation", error.message)
    }

    @Test
    fun `ItemAlreadyOwned has correct code and message`() {
        val error = OpenIapError.ItemAlreadyOwned
        assertEquals(ErrorCode.AlreadyOwned.rawValue, error.code)
        assertEquals("Item is already owned", error.message)
    }

    @Test
    fun `ItemNotOwned has correct code and message`() {
        val error = OpenIapError.ItemNotOwned
        assertEquals(ErrorCode.ItemNotOwned.rawValue, error.code)
        assertEquals("Item is not owned", error.message)
    }

    @Test
    fun `ServiceUnavailable has correct code and message`() {
        val error = OpenIapError.ServiceUnavailable
        assertEquals(ErrorCode.ServiceError.rawValue, error.code)
        assertEquals("Google Play service is unavailable", error.message)
    }

    @Test
    fun `BillingUnavailable has correct code and message`() {
        val error = OpenIapError.BillingUnavailable
        assertEquals(ErrorCode.BillingUnavailable.rawValue, error.code)
        assertEquals("Billing API version is not supported", error.message)
    }

    @Test
    fun `ItemUnavailable has correct code and message`() {
        val error = OpenIapError.ItemUnavailable
        assertEquals(ErrorCode.ItemUnavailable.rawValue, error.code)
        assertEquals("Requested product is not available for purchase", error.message)
    }

    @Test
    fun `DeveloperError has correct code and message`() {
        val error = OpenIapError.DeveloperError
        assertEquals(ErrorCode.DeveloperError.rawValue, error.code)
        assertEquals("Invalid arguments provided to the API", error.message)
    }

    @Test
    fun `FeatureNotSupported has correct code and message`() {
        val error = OpenIapError.FeatureNotSupported
        assertEquals(ErrorCode.FeatureNotSupported.rawValue, error.code)
        assertEquals("Requested feature is not supported by Play Store", error.message)
    }

    @Test
    fun `ServiceDisconnected has correct code and message`() {
        val error = OpenIapError.ServiceDisconnected
        assertEquals("service-disconnected", error.code)
        assertEquals("Play Store service is not connected", error.message)
    }

    @Test
    fun `ServiceTimeout has correct code and message`() {
        val error = OpenIapError.ServiceTimeout
        assertEquals("service-timeout", error.code)
        assertEquals("The request has reached the maximum timeout before billing service responds", error.message)
    }

    @Test
    fun `toJSON returns correct map for all error types`() {
        val errors = listOf(
            OpenIapError.ProductNotFound("test"),
            OpenIapError.PurchaseFailed,
            OpenIapError.PurchaseCancelled,
            OpenIapError.PurchaseDeferred,
            OpenIapError.PaymentNotAllowed,
            OpenIapError.BillingError,
            OpenIapError.InvalidReceipt,
            OpenIapError.NetworkError,
            OpenIapError.VerificationFailed,
            OpenIapError.RestoreFailed,
            OpenIapError.UnknownError,
            OpenIapError.NotPrepared,
            OpenIapError.InitConnection,
            OpenIapError.QueryProduct,
            OpenIapError.EmptySkuList,
            OpenIapError.SkuNotFound("test"),
            OpenIapError.SkuOfferMismatch,
            OpenIapError.MissingCurrentActivity,
            OpenIapError.UserCancelled,
            OpenIapError.ItemAlreadyOwned,
            OpenIapError.ItemNotOwned,
            OpenIapError.ServiceUnavailable,
            OpenIapError.BillingUnavailable,
            OpenIapError.ItemUnavailable,
            OpenIapError.DeveloperError,
            OpenIapError.FeatureNotSupported,
            OpenIapError.ServiceDisconnected,
            OpenIapError.ServiceTimeout
        )

        errors.forEach { error ->
            val json = error.toJSON()
            assertEquals(error.code, json["code"])
            assertEquals(error.message, json["message"])
            assertEquals("android", json["platform"])
        }
    }

    @Test
    fun `fromBillingResponseCode returns correct error for known response codes`() {
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.USER_CANCELED) is OpenIapError.UserCancelled)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE) is OpenIapError.ServiceUnavailable)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.BILLING_UNAVAILABLE) is OpenIapError.BillingUnavailable)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.ITEM_UNAVAILABLE) is OpenIapError.ItemUnavailable)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.DEVELOPER_ERROR) is OpenIapError.DeveloperError)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.ERROR) is OpenIapError.BillingError)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) is OpenIapError.ItemAlreadyOwned)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.ITEM_NOT_OWNED) is OpenIapError.ItemNotOwned)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED) is OpenIapError.ServiceDisconnected)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED) is OpenIapError.FeatureNotSupported)
        assertTrue(OpenIapError.fromBillingResponseCode(BillingClient.BillingResponseCode.SERVICE_TIMEOUT) is OpenIapError.ServiceTimeout)
    }

    @Test
    fun `fromBillingResponseCode returns UnknownError for unknown response codes`() {
        val unknownError = OpenIapError.fromBillingResponseCode(999)
        assertTrue(unknownError is OpenIapError.UnknownError)
    }

    @Test
    fun `getAllErrorCodes returns all error codes and messages`() {
        val allCodes = OpenIapError.getAllErrorCodes()

        // Check that all expected codes are present
        val expectedCodes = setOf(
            ErrorCode.SkuNotFound.rawValue,
            ErrorCode.PurchaseError.rawValue,
            ErrorCode.UserCancelled.rawValue,
            ErrorCode.DeferredPayment.rawValue,
            ErrorCode.NetworkError.rawValue,
            ErrorCode.Unknown.rawValue,
            ErrorCode.NotPrepared.rawValue,
            ErrorCode.InitConnection.rawValue,
            ErrorCode.QueryProduct.rawValue,
            ErrorCode.EmptySkuList.rawValue,
            ErrorCode.SkuNotFound.rawValue,
            ErrorCode.SkuOfferMismatch.rawValue,
            ErrorCode.UserCancelled.rawValue,
            ErrorCode.AlreadyOwned.rawValue,
            ErrorCode.ItemNotOwned.rawValue,
            ErrorCode.BillingUnavailable.rawValue,
            ErrorCode.ItemUnavailable.rawValue,
            ErrorCode.DeveloperError.rawValue,
            ErrorCode.FeatureNotSupported.rawValue,
            ErrorCode.ServiceDisconnected.rawValue,
            ErrorCode.UserError.rawValue,
            ErrorCode.ServiceError.rawValue,
            ErrorCode.ReceiptFailed.rawValue,
            ErrorCode.TransactionValidationFailed.rawValue,
            ErrorCode.SyncError.rawValue,
            ErrorCode.ActivityUnavailable.rawValue
        )

        assertEquals(expectedCodes.size, allCodes.size)
        expectedCodes.forEach { code ->
            assertTrue("Code $code should be present", allCodes.containsKey(code))
            assertTrue("Message for $code should not be empty", allCodes[code]?.isNotEmpty() == true)
        }
    }

    @Test
    fun `toCode returns correct code for all error types`() {
        val errors = listOf(
            OpenIapError.ProductNotFound("test") to ErrorCode.SkuNotFound.rawValue,
            OpenIapError.PurchaseFailed to ErrorCode.PurchaseError.rawValue,
            OpenIapError.PurchaseCancelled to ErrorCode.UserCancelled.rawValue,
            OpenIapError.PurchaseDeferred to ErrorCode.DeferredPayment.rawValue,
            OpenIapError.PaymentNotAllowed to ErrorCode.UserError.rawValue,
            OpenIapError.BillingError to ErrorCode.ServiceError.rawValue,
            OpenIapError.InvalidReceipt to ErrorCode.ReceiptFailed.rawValue,
            OpenIapError.NetworkError to ErrorCode.NetworkError.rawValue,
            OpenIapError.VerificationFailed to ErrorCode.TransactionValidationFailed.rawValue,
            OpenIapError.RestoreFailed to ErrorCode.SyncError.rawValue,
            OpenIapError.UnknownError to ErrorCode.Unknown.rawValue,
            OpenIapError.NotPrepared to ErrorCode.NotPrepared.rawValue,
            OpenIapError.InitConnection to ErrorCode.InitConnection.rawValue,
            OpenIapError.QueryProduct to ErrorCode.QueryProduct.rawValue,
            OpenIapError.EmptySkuList to ErrorCode.EmptySkuList.rawValue,
            OpenIapError.SkuNotFound("test") to ErrorCode.SkuNotFound.rawValue,
            OpenIapError.SkuOfferMismatch to ErrorCode.SkuOfferMismatch.rawValue,
            OpenIapError.MissingCurrentActivity to ErrorCode.ActivityUnavailable.rawValue,
            OpenIapError.UserCancelled to ErrorCode.UserCancelled.rawValue,
            OpenIapError.ItemAlreadyOwned to ErrorCode.AlreadyOwned.rawValue,
            OpenIapError.ItemNotOwned to ErrorCode.ItemNotOwned.rawValue,
            OpenIapError.ServiceUnavailable to ErrorCode.ServiceError.rawValue,
            OpenIapError.BillingUnavailable to ErrorCode.BillingUnavailable.rawValue,
            OpenIapError.ItemUnavailable to ErrorCode.ItemUnavailable.rawValue,
            OpenIapError.DeveloperError to ErrorCode.DeveloperError.rawValue,
            OpenIapError.FeatureNotSupported to ErrorCode.FeatureNotSupported.rawValue,
            OpenIapError.ServiceDisconnected to ErrorCode.ServiceDisconnected.rawValue,
            OpenIapError.ServiceTimeout to "service-timeout"
        )

        errors.forEach { (error, expectedCode) ->
            assertEquals(expectedCode, OpenIapError.toCode(error))
        }
    }

    @Test
    fun `defaultMessage returns correct message for known codes`() {
        assertEquals("SKU not found", OpenIapError.defaultMessage(ErrorCode.SkuNotFound.rawValue))
        assertEquals("Purchase failed", OpenIapError.defaultMessage(ErrorCode.PurchaseError.rawValue))
        assertEquals("Unknown error occurred", OpenIapError.defaultMessage("non-existent-code"))
    }
}