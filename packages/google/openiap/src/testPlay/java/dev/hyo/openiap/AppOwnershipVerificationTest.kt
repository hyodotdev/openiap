package dev.hyo.openiap

import com.google.android.play.core.integrity.model.StandardIntegrityErrorCode
import dev.hyo.openiap.utils.playIntegrityFailureReason
import dev.hyo.openiap.utils.verifyAppOwnershipPlay
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import org.junit.Assert.*
import org.junit.Test

class AppOwnershipVerificationTest {
    private fun options(project: String = "123456789", hash: String = "digest") =
        VerifyAppOwnershipProps(google = PlayIntegrityParamsAndroid(cloudProjectNumber = project, requestHash = hash))

    @Test fun `collecting a token never grants a license`() = runBlocking {
        val result = verifyAppOwnershipPlay(options()) { project, hash ->
            assertEquals(123456789L, project)
            assertEquals("digest", hash)
            "encrypted-token"
        }
        assertEquals(AppOwnershipStatus.Unknown, result.status)
        assertEquals(AppOwnershipVerificationReason.BackendVerificationRequired, result.reason)
        assertEquals("encrypted-token", result.integrityTokenAndroid)
        assertEquals(StoreIds.Play, result.storeId)
        assertNull(result.appTransactionIOS)
    }

    @Test fun `missing or invalid request data fails before contacting Play`() = runBlocking {
        for (invalid in listOf(null, options("0"), options("-1"), options("abc"), options("9223372036854775808"), options(hash = ""), options(hash = "é".repeat(251)))) {
            try {
                verifyAppOwnershipPlay(invalid) { _, _ -> fail("Must not collect a token"); "token" }
                fail("Expected developer error")
            } catch (expected: OpenIapError.DeveloperError) {
                assertNotNull(expected.message)
            }
        }
    }

    @Test fun `empty token is unknown and cancellation propagates`() = runBlocking {
        val empty = verifyAppOwnershipPlay(options()) { _, _ -> "" }
        assertEquals(AppOwnershipStatus.Unknown, empty.status)
        assertEquals(AppOwnershipVerificationReason.VerificationFailed, empty.reason)
        val cancellation = CancellationException("stopped")
        try {
            verifyAppOwnershipPlay(options()) { _, _ -> throw cancellation }
            fail("Expected cancellation")
        } catch (actual: CancellationException) {
            assertEquals(cancellation.message, actual.message)
        }
    }

    @Test fun `caller timeout propagates instead of returning a service verdict`() = runBlocking {
        try {
            withTimeout(10) { verifyAppOwnershipPlay(options()) { _, _ -> delay(1_000); "token" } }
            fail("Expected caller timeout")
        } catch (expected: TimeoutCancellationException) {
            assertNotNull(expected.message)
        }
    }

    @Test fun `unexpected token service failures stay inconclusive`() = runBlocking {
        val result = verifyAppOwnershipPlay(options()) { _, _ -> throw IllegalStateException("service failed") }
        assertEquals(AppOwnershipStatus.Unknown, result.status)
        assertEquals(AppOwnershipVerificationReason.ServiceError, result.reason)
        assertEquals(StoreIds.Play, result.storeId)
    }

    @Test fun `transport availability and attestation failures differ`() {
        assertEquals(AppOwnershipVerificationReason.NetworkError, playIntegrityFailureReason(StandardIntegrityErrorCode.NETWORK_ERROR))
        assertEquals(AppOwnershipVerificationReason.Unsupported, playIntegrityFailureReason(StandardIntegrityErrorCode.PLAY_STORE_NOT_FOUND))
        assertEquals(AppOwnershipVerificationReason.VerificationFailed, playIntegrityFailureReason(StandardIntegrityErrorCode.APP_UID_MISMATCH))
        assertEquals(AppOwnershipVerificationReason.ServiceError, playIntegrityFailureReason(StandardIntegrityErrorCode.TOO_MANY_REQUESTS))
    }
}
