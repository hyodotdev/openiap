package dev.hyo.openiap.utils

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityException
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import com.google.android.play.core.integrity.model.StandardIntegrityErrorCode
import dev.hyo.openiap.AppOwnershipStatus
import dev.hyo.openiap.AppOwnershipVerificationReason
import dev.hyo.openiap.AppOwnershipVerificationResult
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.StoreIds
import dev.hyo.openiap.VerifyAppOwnershipProps
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal suspend fun verifyAppOwnershipPlay(
    options: VerifyAppOwnershipProps?,
    collectToken: suspend (Long, String) -> String,
): AppOwnershipVerificationResult {
    val params = options?.google
        ?: throw OpenIapError.DeveloperError("App ownership verification requires google.cloudProjectNumber and google.requestHash")
    val projectNumber = params.cloudProjectNumber.toLongOrNull()
    if (!params.cloudProjectNumber.matches(Regex("[1-9][0-9]*")) || projectNumber == null) {
        throw OpenIapError.DeveloperError("cloudProjectNumber must be a positive decimal Google Cloud project number")
    }
    if (params.requestHash.isBlank() || params.requestHash.toByteArray(Charsets.UTF_8).size > 500) {
        throw OpenIapError.DeveloperError("requestHash must contain a request digest of at most 500 UTF-8 bytes")
    }
    return try {
        val token = withTimeoutOrNull(60_000) { collectToken(projectNumber, params.requestHash) }
        if (token == null) {
            AppOwnershipVerificationResult(reason = AppOwnershipVerificationReason.ServiceError, status = AppOwnershipStatus.Unknown, storeId = StoreIds.Play)
        } else if (token.isBlank()) {
            AppOwnershipVerificationResult(reason = AppOwnershipVerificationReason.VerificationFailed, status = AppOwnershipStatus.Unknown, storeId = StoreIds.Play)
        } else {
            AppOwnershipVerificationResult(
                integrityTokenAndroid = token,
                reason = AppOwnershipVerificationReason.BackendVerificationRequired,
                status = AppOwnershipStatus.Unknown,
                storeId = StoreIds.Play,
            )
        }
    } catch (error: CancellationException) {
        throw error
    } catch (error: StandardIntegrityException) {
        if (error.errorCode == StandardIntegrityErrorCode.CLOUD_PROJECT_NUMBER_IS_INVALID) {
            throw OpenIapError.DeveloperError("Enable Play Integrity for the cloudProjectNumber linked to this app")
        }
        AppOwnershipVerificationResult(reason = playIntegrityFailureReason(error.errorCode), status = AppOwnershipStatus.Unknown, storeId = StoreIds.Play)
    } catch (error: Exception) {
        AppOwnershipVerificationResult(reason = AppOwnershipVerificationReason.ServiceError, status = AppOwnershipStatus.Unknown, storeId = StoreIds.Play)
    }
}

internal fun playIntegrityFailureReason(code: Int): AppOwnershipVerificationReason = when (code) {
    StandardIntegrityErrorCode.NETWORK_ERROR -> AppOwnershipVerificationReason.NetworkError
    StandardIntegrityErrorCode.API_NOT_AVAILABLE,
    StandardIntegrityErrorCode.PLAY_STORE_NOT_FOUND,
    StandardIntegrityErrorCode.PLAY_SERVICES_NOT_FOUND,
    StandardIntegrityErrorCode.PLAY_STORE_VERSION_OUTDATED,
    StandardIntegrityErrorCode.PLAY_SERVICES_VERSION_OUTDATED -> AppOwnershipVerificationReason.Unsupported
    StandardIntegrityErrorCode.APP_NOT_INSTALLED,
    StandardIntegrityErrorCode.APP_UID_MISMATCH -> AppOwnershipVerificationReason.VerificationFailed
    else -> AppOwnershipVerificationReason.ServiceError
}

internal suspend fun collectPlayIntegrityToken(context: Context, projectNumber: Long, requestHash: String): String {
    suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
        addOnSuccessListener { value -> continuation.resume(value) }
        addOnFailureListener { error -> continuation.resumeWithException(error) }
        addOnCanceledListener { continuation.cancel() }
    }
    val manager = IntegrityManagerFactory.createStandard(context.applicationContext)
    val provider = manager.prepareIntegrityToken(
        PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(projectNumber).build()
    ).awaitResult()
    return provider.request(StandardIntegrityTokenRequest.builder().setRequestHash(requestHash).build()).awaitResult().token()
}
