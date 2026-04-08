package io.github.hyochan.kmpiap.utils

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.IapPlatform

/**
 * Utilities for working with OpenIAP error codes across platforms.
 */
object ErrorCodeUtils {
    private val iosErrorMapping: Map<ErrorCode, Int> = mapOf(
        ErrorCode.Unknown to 0,
        ErrorCode.UserCancelled to 1,
        ErrorCode.NetworkError to 2,
        ErrorCode.ItemUnavailable to 3,
        ErrorCode.ServiceError to 4,
        ErrorCode.ReceiptFailed to 5,
        ErrorCode.AlreadyOwned to 6,
        ErrorCode.NotEnded to 10,
        ErrorCode.DeveloperError to 11,
        ErrorCode.UserError to 12,
        ErrorCode.RemoteError to 13,
        ErrorCode.Pending to 14,
        ErrorCode.ReceiptFinishedFailed to 15,
        ErrorCode.NotPrepared to 16,
        ErrorCode.BillingResponseJsonParseError to 17,
        ErrorCode.DeferredPayment to 18,
        ErrorCode.Interrupted to 19,
        ErrorCode.IapNotAvailable to 20,
        ErrorCode.PurchaseError to 21,
        ErrorCode.SyncError to 22,
        ErrorCode.TransactionValidationFailed to 23,
        ErrorCode.ActivityUnavailable to 24,
        ErrorCode.AlreadyPrepared to 25,
        ErrorCode.ConnectionClosed to 26,
        ErrorCode.PurchaseVerificationFailed to 27,
        ErrorCode.PurchaseVerificationFinished to 28,
        ErrorCode.PurchaseVerificationFinishFailed to 29
    )

    private val legacyCodeMap: Map<String, ErrorCode> = buildMap {
        fun alias(vararg keys: String, target: ErrorCode) {
            keys.forEach { put(it, target) }
        }

        alias("E_UNKNOWN", "UNKNOWN", "ERROR", target = ErrorCode.Unknown)
        alias("E_USER_CANCELLED", "USER_CANCELLED", target = ErrorCode.UserCancelled)
        alias("E_USER_ERROR", "USER_ERROR", target = ErrorCode.UserError)
        alias("E_ITEM_UNAVAILABLE", "ITEM_UNAVAILABLE", target = ErrorCode.ItemUnavailable)
        alias("E_PRODUCT_NOT_AVAILABLE", target = ErrorCode.ItemUnavailable)
        alias("E_REMOTE_ERROR", "REMOTE_ERROR", target = ErrorCode.RemoteError)
        alias("E_NETWORK_ERROR", "NETWORK_ERROR", target = ErrorCode.NetworkError)
        alias("E_SERVICE_ERROR", "SERVICE_ERROR", target = ErrorCode.ServiceError)
        alias("E_RECEIPT_FAILED", "RECEIPT_FAILED", target = ErrorCode.ReceiptFailed)
        alias("E_RECEIPT_FINISHED", "RECEIPT_FINISHED", target = ErrorCode.ReceiptFinished)
        alias("E_RECEIPT_FINISHED_FAILED", "RECEIPT_FINISHED_FAILED", target = ErrorCode.ReceiptFinishedFailed)
        alias("E_NOT_PREPARED", "NOT_PREPARED", target = ErrorCode.NotPrepared)
        alias("E_NOT_ENDED", "NOT_ENDED", target = ErrorCode.NotEnded)
        alias("E_ALREADY_OWNED", "ALREADY_OWNED", target = ErrorCode.AlreadyOwned)
        alias("E_PRODUCT_ALREADY_OWNED", target = ErrorCode.AlreadyOwned)
        alias("E_DEVELOPER_ERROR", "DEVELOPER_ERROR", target = ErrorCode.DeveloperError)
        alias("E_BILLING_RESPONSE_JSON_PARSE_ERROR", "BILLING_RESPONSE_JSON_PARSE_ERROR", target = ErrorCode.BillingResponseJsonParseError)
        alias("E_DEFERRED_PAYMENT", "DEFERRED_PAYMENT", target = ErrorCode.DeferredPayment)
        alias("E_INTERRUPTED", "INTERRUPTED", target = ErrorCode.Interrupted)
        alias("E_IAP_NOT_AVAILABLE", "IAP_NOT_AVAILABLE", target = ErrorCode.IapNotAvailable)
        alias("E_PURCHASE_ERROR", "PURCHASE_ERROR", target = ErrorCode.PurchaseError)
        alias("E_SYNC_ERROR", "SYNC_ERROR", target = ErrorCode.SyncError)
        alias("E_TRANSACTION_VALIDATION_FAILED", "TRANSACTION_VALIDATION_FAILED", target = ErrorCode.TransactionValidationFailed)
        alias("E_ACTIVITY_UNAVAILABLE", "ACTIVITY_UNAVAILABLE", target = ErrorCode.ActivityUnavailable)
        alias("E_ALREADY_PREPARED", "ALREADY_PREPARED", target = ErrorCode.AlreadyPrepared)
        alias("E_PENDING", "PENDING", target = ErrorCode.Pending)
        alias("E_CONNECTION_CLOSED", "CONNECTION_CLOSED", target = ErrorCode.ConnectionClosed)
        alias("E_INIT_CONNECTION", "INIT_CONNECTION", target = ErrorCode.InitConnection)
        alias("E_SERVICE_DISCONNECTED", "SERVICE_DISCONNECTED", target = ErrorCode.ServiceDisconnected)
        alias("E_QUERY_PRODUCT", "QUERY_PRODUCT", target = ErrorCode.QueryProduct)
        alias("E_SKU_NOT_FOUND", "SKU_NOT_FOUND", target = ErrorCode.SkuNotFound)
        alias("E_SKU_OFFER_MISMATCH", "SKU_OFFER_MISMATCH", target = ErrorCode.SkuOfferMismatch)
        alias("E_ITEM_NOT_OWNED", "ITEM_NOT_OWNED", target = ErrorCode.ItemNotOwned)
        alias("E_BILLING_UNAVAILABLE", "BILLING_UNAVAILABLE", target = ErrorCode.BillingUnavailable)
        alias("E_FEATURE_NOT_SUPPORTED", "FEATURE_NOT_SUPPORTED", target = ErrorCode.FeatureNotSupported)
        alias("E_EMPTY_SKU_LIST", "EMPTY_SKU_LIST", target = ErrorCode.EmptySkuList)
        alias("E_PURCHASE_VERIFICATION_FAILED", "PURCHASE_VERIFICATION_FAILED", target = ErrorCode.PurchaseVerificationFailed)
        alias("E_PURCHASE_VERIFICATION_FINISHED", "PURCHASE_VERIFICATION_FINISHED", target = ErrorCode.PurchaseVerificationFinished)
        alias("E_PURCHASE_VERIFICATION_FINISH_FAILED", "PURCHASE_VERIFICATION_FINISH_FAILED", target = ErrorCode.PurchaseVerificationFinishFailed)
    }

    fun fromPlatformCode(platformCode: Any, platform: IapPlatform): ErrorCode {
        return when (platform) {
            IapPlatform.Ios -> {
                val code = platformCode as? Int ?: return ErrorCode.Unknown
                iosErrorMapping.entries.firstOrNull { it.value == code }?.key ?: ErrorCode.Unknown
            }
            IapPlatform.Android -> {
                val raw = (platformCode as? String) ?: return ErrorCode.Unknown
                val normalized = raw.uppercase().replace('-', '_')
                legacyCodeMap[normalized]
                    ?: legacyCodeMap[
                        if (normalized.startsWith("E_")) normalized else "E_${normalized}"
                    ]
                    ?: ErrorCode.Unknown
            }
        }
    }

    fun toPlatformCode(errorCode: ErrorCode, platform: IapPlatform): Any {
        return when (platform) {
            IapPlatform.Ios -> iosErrorMapping[errorCode] ?: 0
            IapPlatform.Android -> errorCode.rawValue.replace('-', '_').uppercase()
        }
    }

    fun isValidForPlatform(errorCode: ErrorCode, platform: IapPlatform): Boolean {
        return when (platform) {
            IapPlatform.Ios -> iosErrorMapping.containsKey(errorCode)
            IapPlatform.Android -> true
        }
    }

    fun getErrorMessage(errorCode: ErrorCode): String = when (errorCode) {
        ErrorCode.Unknown -> "Unknown error occurred"
        ErrorCode.UserCancelled -> "Purchase cancelled by user"
        ErrorCode.UserError -> "User-related error during purchase"
        ErrorCode.ItemUnavailable -> "Product not available in store"
        ErrorCode.AlreadyOwned -> "Item already owned"
        ErrorCode.RemoteError -> "Remote service error"
        ErrorCode.NetworkError -> "Network connection error"
        ErrorCode.ServiceError -> "Store service error"
        ErrorCode.ReceiptFailed -> "Receipt validation failed"
        ErrorCode.ReceiptFinished -> "Receipt already processed"
        ErrorCode.ReceiptFinishedFailed -> "Failed to finish receipt"
        ErrorCode.NotPrepared -> "Billing client not initialized"
        ErrorCode.NotEnded -> "Transaction not finished"
        ErrorCode.DeveloperError -> "Developer configuration error"
        ErrorCode.BillingResponseJsonParseError -> "Failed to parse billing response"
        ErrorCode.DeferredPayment -> "Payment deferred"
        ErrorCode.Interrupted -> "Purchase flow interrupted"
        ErrorCode.IapNotAvailable -> "In-app purchases not available"
        ErrorCode.PurchaseError -> "General purchase error"
        ErrorCode.SyncError -> "Sync error with store"
        ErrorCode.TransactionValidationFailed -> "Transaction validation failed"
        ErrorCode.ActivityUnavailable -> "Activity context not available"
        ErrorCode.AlreadyPrepared -> "Billing client already initialized"
        ErrorCode.Pending -> "Purchase pending"
        ErrorCode.ConnectionClosed -> "Billing service connection closed"
        ErrorCode.InitConnection -> "Failed to initialize connection"
        ErrorCode.ServiceDisconnected -> "Service disconnected"
        ErrorCode.QueryProduct -> "Failed to query product"
        ErrorCode.SkuNotFound -> "SKU not found"
        ErrorCode.SkuOfferMismatch -> "SKU offer mismatch"
        ErrorCode.ItemNotOwned -> "Item not owned"
        ErrorCode.BillingUnavailable -> "Billing unavailable"
        ErrorCode.FeatureNotSupported -> "Feature not supported"
        ErrorCode.EmptySkuList -> "SKU list is empty"
        ErrorCode.PurchaseVerificationFailed -> "Purchase verification failed"
        ErrorCode.PurchaseVerificationFinished -> "Purchase verification completed"
        ErrorCode.PurchaseVerificationFinishFailed -> "Failed to complete purchase verification"
    }
}
