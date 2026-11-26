package dev.hyo.openiap

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.test.core.app.ApplicationProvider
import com.google.gson.Gson
import java.net.InetAddress
import java.net.ServerSocket
import java.util.concurrent.CompletableFuture
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonVerifyPurchaseTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val module = OpenIapModule(context)

    // Verifies through IAPKit against a one-request loopback server and returns the posted `sandbox`.
    private suspend fun postedSandbox(isDebuggable: Boolean, sandbox: Boolean?): Any? {
        context.applicationInfo.flags = if (isDebuggable) ApplicationInfo.FLAG_DEBUGGABLE else 0
        ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { server ->
            val posted = CompletableFuture.supplyAsync {
                server.accept().use { socket ->
                    val request = socket.getInputStream().bufferedReader()
                    val headers = generateSequence { request.readLine() }.takeWhile { it.isNotEmpty() }.toList()
                    val length = headers.first { it.startsWith("Content-Length:", ignoreCase = true) }
                        .substringAfter(":").trim().toInt()
                    val body = CharArray(length)
                    var read = 0
                    while (read < length) {
                        read += request.read(body, read, length - read).also { check(it > 0) { "Request body ended early" } }
                    }
                    val response = """{"store":"horizon","isValid":true,"state":"ENTITLED"}"""
                    socket.getOutputStream().write(
                        "HTTP/1.1 200 OK\r\nContent-Length: ${response.length}\r\nConnection: close\r\n\r\n$response"
                            .toByteArray(),
                    )
                    String(body)
                }
            }
            module.verifyPurchaseWithProvider(
                VerifyPurchaseWithProviderProps(
                    provider = PurchaseVerificationProvider.Iapkit,
                    iapkit = RequestVerifyPurchaseWithIapkitProps(
                        baseUrl = "http://127.0.0.1:${server.localPort}",
                        horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                            sku = "coins",
                            userId = "meta-user",
                            sandbox = sandbox,
                        ),
                    ),
                ),
            )
            return (Gson().fromJson(posted.get(), Map::class.java) as Map<*, *>)["sandbox"]
        }
    }

    @Test
    fun `iapkit verification marks a debuggable build as sandbox unless the caller says otherwise`() = runTest {
        assertEquals(true, postedSandbox(isDebuggable = true, sandbox = null))
        assertEquals(false, postedSandbox(isDebuggable = false, sandbox = null))
        assertEquals(false, postedSandbox(isDebuggable = true, sandbox = false))
        assertEquals(true, postedSandbox(isDebuggable = false, sandbox = true))
    }

    @Test
    fun `google options alone are a developer error instead of a Play request`() = runTest {
        val props = VerifyPurchaseProps(
            google = VerifyPurchaseGoogleOptions(
                accessToken = "token",
                packageName = "dev.hyo.martie",
                purchaseToken = "purchase-token",
                sku = "coins",
            ),
        )

        val thrown = runCatching { module.verifyPurchase(props) }.exceptionOrNull()

        assertEquals(
            OpenIapError.DeveloperError(
                "Horizon verifyPurchase requires horizon options (sku, userId, accessToken)"
            ),
            thrown,
        )
    }

    @Test
    fun `a missing app id names the manifest meta-data`() = runTest {
        val props = VerifyPurchaseProps(
            horizon = VerifyPurchaseHorizonOptions(accessToken = "token", sku = "coins", userId = "meta-user"),
        )

        val thrown = runCatching { module.verifyPurchase(props) }.exceptionOrNull()

        assertEquals(
            OpenIapError.DeveloperError(
                "Horizon verifyPurchase requires the com.meta.horizon.platform.HORIZON_APP_ID manifest meta-data"
            ),
            thrown,
        )
    }
}
