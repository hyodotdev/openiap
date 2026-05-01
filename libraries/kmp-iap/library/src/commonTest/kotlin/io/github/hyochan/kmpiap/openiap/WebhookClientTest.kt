package io.github.hyochan.kmpiap.openiap

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class WebhookClientTest {
    @Test
    fun parsesACompleteEventPayload() {
        val raw = """
            {
              "id": "uuid-1",
              "type": "SubscriptionRenewed",
              "source": "AppleAppStoreServerNotificationsV2",
              "platform": "IOS",
              "environment": "Production",
              "projectId": "p-1",
              "occurredAt": 1711000000000,
              "receivedAt": 1711000001000,
              "purchaseToken": "token-1",
              "productId": "com.example.premium",
              "subscriptionState": "Active"
            }
        """.trimIndent()

        val event = WebhookEventParser.parse(raw)
        assertNotNull(event)
        assertEquals("uuid-1", event.id)
        assertEquals(WebhookEventType.SubscriptionRenewed, event.type)
        assertEquals("token-1", event.purchaseToken)
        assertEquals("com.example.premium", event.productId)
        assertEquals(1_711_000_000_000.0, event.occurredAt)
    }

    @Test
    fun returnsNullForEmptyOrMalformedInput() {
        assertNull(WebhookEventParser.parse(""))
        assertNull(WebhookEventParser.parse("not json"))
        // Required fields missing → fail-fast (PR #123 review fix:
        // we no longer silently default to empty strings).
        assertNull(
            WebhookEventParser.parse("""{"type":"SubscriptionRenewed"}"""),
        )
    }

    @Test
    fun returnsNullForUnseenEventTypes() {
        // Unknown event types are now rejected rather than mapped to a
        // synthetic `Unknown` enum value — PR #123 review correctly
        // flagged that lenient parsing hides spec drift between kit
        // and the SDK consumers.
        val raw = """
            {
              "id": "uuid-2",
              "type": "SomethingNew",
              "source": "AppleAppStoreServerNotificationsV2",
              "platform": "IOS",
              "environment": "Production",
              "projectId": "p-1",
              "occurredAt": 1,
              "receivedAt": 2,
              "purchaseToken": "t"
            }
        """.trimIndent()
        assertNull(WebhookEventParser.parse(raw))
    }

    @Test
    fun streamUrlBuilderTrimsTrailingSlashes() {
        assertEquals(
            "https://kit.openiap.dev/v1/webhooks/stream/key",
            webhookStreamUrl(baseUrl = "https://kit.openiap.dev/", apiKey = "key"),
        )
    }
}
