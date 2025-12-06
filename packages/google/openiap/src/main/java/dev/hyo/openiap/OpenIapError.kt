package dev.hyo.openiap

/**
 * OpenIAP specific exceptions
 */
sealed class OpenIapError : Exception() {
    abstract val code: String
    abstract override val message: String

    fun toJSON(): Map<String, Any?> = mapOf(
        "code" to toCode(this),
        "message" to (this.message ?: ""),
        "platform" to "android",
    )

    class ProductNotFound(val productId: String) : OpenIapError() {
        val CODE = ErrorCode.SkuNotFound.rawValue
        override val code = CODE
        override val message = MESSAGE

        companion object {
            val CODE = ErrorCode.SkuNotFound.rawValue
            const val MESSAGE = "Product not found"
        }
    }

    object PurchaseFailed : OpenIapError() {
        val CODE = ErrorCode.PurchaseError.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Purchase failed"
    }

    object PurchaseCancelled : OpenIapError() {
        val CODE = ErrorCode.UserCancelled.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Purchase was cancelled by the user"
    }

    object PurchaseDeferred : OpenIapError() {
        val CODE = ErrorCode.DeferredPayment.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Purchase was deferred"
    }

    object PaymentNotAllowed : OpenIapError() {
        val CODE = ErrorCode.UserError.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Payment not allowed"
    }

    object BillingError : OpenIapError() {
        val CODE = ErrorCode.ServiceError.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Billing error"
    }

    /**
     * @deprecated Use [InvalidPurchaseVerification] instead
     */
    @Deprecated("Use InvalidPurchaseVerification instead", ReplaceWith("InvalidPurchaseVerification"))
    object InvalidReceipt : OpenIapError() {
        val CODE = ErrorCode.PurchaseVerificationFailed.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Purchase verification failed"
    }

    /**
     * Purchase verification failed (general error without specific provider message)
     */
    object InvalidPurchaseVerification : OpenIapError() {
        val CODE = ErrorCode.PurchaseVerificationFailed.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Purchase verification failed"
    }

    /**
     * Purchase verification failed with a specific error from the verification provider (e.g., IAPKit)
     */
    class PurchaseVerificationFailed(val providerError: String) : OpenIapError() {
        override val code = ErrorCode.PurchaseVerificationFailed.rawValue
        override val message = "Purchase verification failed: $providerError"

        companion object {
            val CODE = ErrorCode.PurchaseVerificationFailed.rawValue
        }
    }

    object NetworkError : OpenIapError() {
        val CODE = ErrorCode.NetworkError.rawValue
        const val MESSAGE = "Network connection error"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    object VerificationFailed : OpenIapError() {
        val CODE = ErrorCode.TransactionValidationFailed.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Verification failed"
    }

    object RestoreFailed : OpenIapError() {
        val CODE = ErrorCode.SyncError.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Restore failed"
    }

    object UnknownError : OpenIapError() {
        val CODE = ErrorCode.Unknown.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Unknown error"
    }

    object NotPrepared : OpenIapError() {
        const val CODE = "not-prepared"
        const val MESSAGE = "Billing client not ready"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    object InitConnection : OpenIapError() {
        val CODE = ErrorCode.InitConnection.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Failed to initialize billing connection"
    }

    object QueryProduct : OpenIapError() {
        val CODE = ErrorCode.QueryProduct.rawValue
        override val code = CODE
        override val message = MESSAGE

        const val MESSAGE = "Failed to query product"
    }

    object EmptySkuList : OpenIapError() {
        const val CODE = "empty-sku-list"
        const val MESSAGE = "SKU list cannot be empty"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    class SkuNotFound(val sku: String) : OpenIapError() {
        val CODE = ErrorCode.SkuNotFound.rawValue
        override val code = CODE
        override val message = MESSAGE

        companion object {
            val CODE = ErrorCode.SkuNotFound.rawValue
            const val MESSAGE = "SKU not found"
        }
    }

    object SkuOfferMismatch : OpenIapError() {
        const val CODE = "sku-offer-mismatch"
        const val MESSAGE = "SKU and offer token count mismatch"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    object MissingCurrentActivity : OpenIapError() {
        val CODE = ErrorCode.ActivityUnavailable.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Current activity is not available"
    }

    object UserCancelled : OpenIapError() {
        val CODE = ErrorCode.UserCancelled.rawValue
        const val MESSAGE = "User cancelled the operation"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    object ItemAlreadyOwned : OpenIapError() {
        val CODE = ErrorCode.AlreadyOwned.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Item is already owned"
    }

    object ItemNotOwned : OpenIapError() {
        val CODE = ErrorCode.ItemNotOwned.rawValue
        const val MESSAGE = "Item is not owned"
        override val code: String = CODE
        override val message: String = MESSAGE
    }

    object ServiceUnavailable : OpenIapError() {
        val CODE = ErrorCode.ServiceError.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Billing service is unavailable"
    }

    object BillingUnavailable : OpenIapError() {
        val CODE = ErrorCode.BillingUnavailable.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Billing API version is not supported"
    }

    object ItemUnavailable : OpenIapError() {
        val CODE = ErrorCode.ItemUnavailable.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Requested product is not available for purchase"
    }

    object DeveloperError : OpenIapError() {
        val CODE = ErrorCode.DeveloperError.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Invalid arguments provided to the API"
    }

    object FeatureNotSupported : OpenIapError() {
        val CODE = ErrorCode.FeatureNotSupported.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Requested feature is not supported by Play Store"
    }

    object ServiceDisconnected : OpenIapError() {
        val CODE = ErrorCode.ServiceDisconnected.rawValue
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "Play Store service is not connected"
    }

    object ServiceTimeout : OpenIapError() {
        const val CODE = "service-timeout"
        override val code: String = CODE
        override val message: String = MESSAGE

        const val MESSAGE = "The request has reached the maximum timeout before billing service responds"
    }

    class AlternativeBillingUnavailable(val details: String) : OpenIapError() {
        val CODE = ErrorCode.BillingUnavailable.rawValue
        override val code = CODE
        override val message = details

        companion object {
            val CODE = ErrorCode.BillingUnavailable.rawValue
        }
    }

    companion object {
        private val defaultMessages: Map<String, String> by lazy {
            mapOf(
                ProductNotFound.CODE to ProductNotFound.MESSAGE,
                PurchaseFailed.CODE to PurchaseFailed.MESSAGE,
                PurchaseCancelled.CODE to PurchaseCancelled.MESSAGE,
                PurchaseDeferred.CODE to PurchaseDeferred.MESSAGE,
                NetworkError.CODE to NetworkError.MESSAGE,
                UnknownError.CODE to UnknownError.MESSAGE,
                NotPrepared.CODE to NotPrepared.MESSAGE,
                InitConnection.CODE to InitConnection.MESSAGE,
                QueryProduct.CODE to QueryProduct.MESSAGE,
                EmptySkuList.CODE to EmptySkuList.MESSAGE,
                SkuNotFound.CODE to SkuNotFound.MESSAGE,
                SkuOfferMismatch.CODE to SkuOfferMismatch.MESSAGE,
                UserCancelled.CODE to UserCancelled.MESSAGE,
                ItemAlreadyOwned.CODE to ItemAlreadyOwned.MESSAGE,
                ItemNotOwned.CODE to ItemNotOwned.MESSAGE,
                ServiceUnavailable.CODE to ServiceUnavailable.MESSAGE,
                BillingUnavailable.CODE to BillingUnavailable.MESSAGE,
                ItemUnavailable.CODE to ItemUnavailable.MESSAGE,
                DeveloperError.CODE to DeveloperError.MESSAGE,
                FeatureNotSupported.CODE to FeatureNotSupported.MESSAGE,
                ServiceDisconnected.CODE to ServiceDisconnected.MESSAGE,
                ServiceTimeout.CODE to ServiceTimeout.MESSAGE,
                PaymentNotAllowed.CODE to PaymentNotAllowed.MESSAGE,
                BillingError.CODE to BillingError.MESSAGE,
                InvalidPurchaseVerification.CODE to InvalidPurchaseVerification.MESSAGE,
                VerificationFailed.CODE to VerificationFailed.MESSAGE,
                RestoreFailed.CODE to RestoreFailed.MESSAGE,
                MissingCurrentActivity.CODE to MissingCurrentActivity.MESSAGE
            )
        }

        fun toCode(error: OpenIapError): String = error.code

        fun defaultMessage(code: String): String =
            defaultMessages[code] ?: "Unknown error occurred"

        fun getAllErrorCodes(): Map<String, String> = defaultMessages
    }

}
