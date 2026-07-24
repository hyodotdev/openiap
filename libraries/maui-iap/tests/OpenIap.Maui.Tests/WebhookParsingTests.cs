// OpenIapClient.ParseWebhookEventData / WebhookClient.WebhookEventTypes —
// the SSE payload classifier shared by every kit webhook consumer.

using Xunit;

namespace OpenIap.Maui.Tests;

public class WebhookParsingTests
{
    private const string ValidEventJson = """
        {
          "id": "evt-1",
          "type": "subscription-started",
          "platform": "android",
          "environment": "sandbox",
          "source": "google-play-real-time-developer-notifications",
          "projectId": "proj-1",
          "purchaseToken": "gp-token-1",
          "occurredAt": 1720000000000,
          "receivedAt": 1720000000500
        }
        """;

    [Fact]
    public void EmptyPayload_SkipsAsHeartbeat()
    {
        var result = OpenIapClient.ParseWebhookEventData(string.Empty);

        Assert.Equal(ParsedWebhookEventKind.Skip, result.Kind);
        Assert.Equal("heartbeat", result.Reason);
        Assert.Null(result.Event);
    }

    [Fact]
    public void PayloadWithoutTypeProperty_SkipsAsStreamControl()
    {
        var result = OpenIapClient.ParseWebhookEventData("""{"ping":1}""");

        Assert.Equal(ParsedWebhookEventKind.Skip, result.Kind);
        Assert.Equal("stream-control", result.Reason);
    }

    [Fact]
    public void PayloadWithNonStringType_SkipsAsStreamControl()
    {
        var result = OpenIapClient.ParseWebhookEventData("""{"type":123}""");

        Assert.Equal(ParsedWebhookEventKind.Skip, result.Kind);
        Assert.Equal("stream-control", result.Reason);
    }

    [Fact]
    public void ValidEvent_ParsesToTypedWebhookEvent()
    {
        var result = OpenIapClient.ParseWebhookEventData(ValidEventJson);

        Assert.Equal(ParsedWebhookEventKind.Ok, result.Kind);
        Assert.Null(result.Message);
        Assert.NotNull(result.Event);
        var evt = result.Event!;
        Assert.Equal("evt-1", evt.Id);
        Assert.Equal(WebhookEventType.SubscriptionStarted, evt.Type);
        Assert.Equal(IapPlatform.Android, evt.Platform);
        Assert.Equal(WebhookEventEnvironment.Sandbox, evt.Environment);
        Assert.Equal(WebhookEventSource.GooglePlayRealTimeDeveloperNotifications, evt.Source);
        Assert.Equal("gp-token-1", evt.PurchaseToken);
    }

    [Theory]
    [InlineData("id")]
    [InlineData("occurredAt")]
    [InlineData("receivedAt")]
    public void MissingRequiredEnvelopeField_IsError(string fieldToDrop)
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(ValidEventJson)!.AsObject();
        node.Remove(fieldToDrop);

        var result = OpenIapClient.ParseWebhookEventData(node.ToJsonString());

        Assert.Equal(ParsedWebhookEventKind.Error, result.Kind);
        Assert.NotNull(result.Message);
        Assert.Contains("id/occurredAt/receivedAt", result.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void NumericId_IsError()
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(ValidEventJson)!.AsObject();
        node["id"] = 42;

        var result = OpenIapClient.ParseWebhookEventData(node.ToJsonString());

        Assert.Equal(ParsedWebhookEventKind.Error, result.Kind);
    }

    [Fact]
    public void NonTestEventWithoutPurchaseToken_IsError()
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(ValidEventJson)!.AsObject();
        node.Remove("purchaseToken");

        var result = OpenIapClient.ParseWebhookEventData(node.ToJsonString());

        Assert.Equal(ParsedWebhookEventKind.Error, result.Kind);
        Assert.Contains("purchaseToken", result.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void TestNotificationWithoutPurchaseToken_IsOk()
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(ValidEventJson)!.AsObject();
        node["type"] = "test-notification";
        node.Remove("purchaseToken");

        var result = OpenIapClient.ParseWebhookEventData(node.ToJsonString());

        Assert.Equal(ParsedWebhookEventKind.Ok, result.Kind);
        Assert.NotNull(result.Event);
        Assert.Equal(WebhookEventType.TestNotification, result.Event!.Type);
        Assert.Null(result.Event.PurchaseToken);
    }

    [Fact]
    public void MalformedJson_IsParseError()
    {
        var result = OpenIapClient.ParseWebhookEventData("{not json");

        Assert.Equal(ParsedWebhookEventKind.Error, result.Kind);
        Assert.NotNull(result.Message);
        Assert.Contains("Failed to parse SSE payload", result.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void UnknownEventType_IsParseError()
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(ValidEventJson)!.AsObject();
        node["type"] = "subscription-teleported";

        var result = OpenIapClient.ParseWebhookEventData(node.ToJsonString());

        // Passes the envelope pre-checks but fails typed deserialization.
        Assert.Equal(ParsedWebhookEventKind.Error, result.Kind);
        Assert.Contains("Failed to parse SSE payload", result.Message!, StringComparison.Ordinal);
    }

    [Fact]
    public void WebhookEventTypes_CoverEveryEnumValueExactlyOnce()
    {
        var constants = OpenIapClient.WebhookEventTypes;

        Assert.Equal(Enum.GetValues<WebhookEventType>().Length, constants.Count);
        Assert.Equal(constants.Count, constants.Distinct().Count());
        foreach (var value in Enum.GetValues<WebhookEventType>())
        {
            Assert.Contains(value, constants);
        }
    }

    [Fact]
    public void WebhookEventTypes_AreExposedByAllFacades()
    {
        Assert.Same(WebhookClient.WebhookEventTypes, OpenIapClient.WebhookEventTypes);
#pragma warning disable CS0618 // Exercise the legacy facade until its 2.0.0 removal.
        Assert.Same(WebhookClient.WebhookEventTypes, Iap.WebhookEventTypes);
#pragma warning restore CS0618
    }

    [Fact]
    public void ConnectWebhookStream_RequiresApiKeyAndCallback()
    {
        var whitespaceKey = Assert.Throws<ArgumentException>(() =>
            OpenIapClient.ConnectWebhookStream(new WebhookListenerOptions
            {
                ApiKey = "   ",
                OnEvent = _ => { },
            }));
        Assert.Equal("options", whitespaceKey.ParamName);

        var nullCallback = Assert.Throws<ArgumentException>(() =>
            OpenIapClient.ConnectWebhookStream(new WebhookListenerOptions
            {
                ApiKey = "key",
                OnEvent = null!,
            }));
        Assert.Equal("options", nullCallback.ParamName);
    }
}
