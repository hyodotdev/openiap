package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitAmazonProps
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitProps
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class IapkitBaseUrlBridgeTest {
    // The delegate hands IAPKit options to openiap-google through this JSON boundary.
    @Test
    fun androidBridgeForwardsBaseUrlAndAmazonFields() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            amazon = RequestVerifyPurchaseWithIapkitAmazonProps(
                receiptId = "receipt",
                sandbox = true,
                userId = "user",
                expectedProductId = "premium",
            ),
            apiKey = "key",
            baseUrl = "https://kit.example.test",
        )

        val android = dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps.fromJson(options.toJson())

        assertEquals("https://kit.example.test", android.baseUrl)
        assertEquals("receipt", android.amazon?.receiptId)
        assertEquals(true, android.amazon?.sandbox)
        assertEquals("user", android.amazon?.userId)
        assertEquals("premium", android.amazon?.expectedProductId)
    }

    @Test
    fun platformBridgesPreserveIapkitEnvironment() {
        val iosSource = File(
            "src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt"
        ).readText()
        val helperSource = File(
            "src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt"
        ).readText()

        assertTrue(helperSource.contains("environment = environment"))
        // Unknown values degrade; openiap-google already decoded them safely.
        assertTrue(helperSource.contains("getOrDefault(IapkitPurchaseState.Unknown)"))
        assertTrue(iosSource.contains("\"environment\" to environment"))
        // Forwarded opaquely: `environment` is String in the spec.
        assertTrue(iosSource.contains("map[\"environment\"] as? String"))
    }
}
