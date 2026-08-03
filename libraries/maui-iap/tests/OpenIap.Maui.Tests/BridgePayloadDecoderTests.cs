using System.Text.Json.Nodes;
using OpenIap;
using Xunit;

namespace OpenIap.Maui.Tests;

public class BridgePayloadDecoderTests
{
    private const string PurchaseJson = """
        {
          "__typename": "PurchaseAndroid",
          "id": "token-1",
          "isAutoRenewing": false,
          "productId": "premium",
          "purchaseState": "purchased",
          "purchaseToken": "token-1",
          "quantity": 1,
          "store": "google",
          "transactionDate": 1720000000000
        }
        """;

    private const string PurchaseIosJson = """
        {
          "__typename": "PurchaseIOS",
          "id": "transaction-1",
          "isAutoRenewing": false,
          "productId": "premium",
          "purchaseState": "purchased",
          "quantity": 1,
          "store": "apple",
          "transactionDate": 1720000000000,
          "transactionId": "transaction-1"
        }
        """;

    private const string ActiveSubscriptionJson = """
        {
          "isActive": true,
          "productId": "premium.monthly",
          "transactionDate": 1720000000000,
          "transactionId": "transaction-1"
        }
        """;

    [Fact]
    public void ExplicitEmptyItemsIsAuthoritativeSuccess()
    {
        var result = BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
            """{"items":[]}""",
            "getAvailablePurchases");

        Assert.Empty(result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("{\"items\":null}")]
    [InlineData("not-json")]
    public void MissingOrMalformedEnvelopeFails(string payload)
    {
        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                payload,
                "getAvailablePurchases"));

        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }

    [Fact]
    public void MixedValidAndMalformedItemsFailAtomically()
    {
        var payload = $$"""{"items":[{{PurchaseJson}},{}]}""";

        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                payload,
                "getAvailablePurchases"));

        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }

    [Theory]
    [InlineData("id")]
    [InlineData("productId")]
    public void EmptyPurchaseIdentityFails(string field)
    {
        var malformed = PurchaseJson.Replace($"\"{field}\": \"{(field == "id" ? "token-1" : "premium")}\"", $"\"{field}\": \"\"");
        var payload = $$"""{"items":[{{malformed}}]}""";

        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                payload,
                "getAvailablePurchases"));

        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }

    [Theory]
    [InlineData("\"id\": \"token-1\",")]
    [InlineData("\"isAutoRenewing\": false,")]
    [InlineData("\"productId\": \"premium\",")]
    [InlineData("\"purchaseState\": \"purchased\",")]
    [InlineData("\"quantity\": 1,")]
    [InlineData("\"store\": \"google\",")]
    [InlineData("\"transactionDate\": 1720000000000")]
    public void MissingRequiredPurchaseFieldFails(string propertyLine)
    {
        var malformed = PurchaseJson.Replace(propertyLine, "");
        var payload = $$"""{"items":[{{malformed}}]}""";

        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                payload,
                "getAvailablePurchases"));

        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }

    [Fact]
    public void ValidPurchaseListDecodes()
    {
        var payload = $$"""{"items":[{{PurchaseJson}}]}""";

        var result = BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
            payload,
            "getAvailablePurchases");

        Assert.Single(result);
        var purchase = Assert.IsType<PurchaseAndroid>(result[0]);
        Assert.Equal("premium", purchase.ProductId);
    }

    [Fact]
    public void PurchaseRuntimeTypeRejectsForeignStore()
    {
        var validIos = $$"""{"items":[{{PurchaseIosJson}}]}""";
        var decoded = BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
            validIos,
            "getAvailablePurchases");
        Assert.IsType<PurchaseIOS>(Assert.Single(decoded));

        var foreignIos = validIos.Replace("\"store\": \"apple\"", "\"store\": \"google\"");
        var iosError = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                foreignIos,
                "getAvailablePurchases"));
        Assert.Equal(ErrorCode.BillingResponseJsonParseError, iosError.Error.Code);

        var foreignAndroid = $$"""{"items":[{{PurchaseJson.Replace("\"store\": \"google\"", "\"store\": \"apple\"")}}]}""";
        var androidError = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredItems<Purchase>(
                foreignAndroid,
                "getAvailablePurchases"));
        Assert.Equal(ErrorCode.BillingResponseJsonParseError, androidError.Error.Code);
    }

    [Fact]
    public void ActiveSubscriptionListFailsAtomically()
    {
        var valid = new JsonArray(JsonNode.Parse(ActiveSubscriptionJson));
        var decoded = BridgePayloadDecoder.DecodeRequiredArray<ActiveSubscription>(
            valid,
            "getActiveSubscriptions");
        Assert.Equal("premium.monthly", Assert.Single(decoded).ProductId);

        var mixed = new JsonArray(
            JsonNode.Parse(ActiveSubscriptionJson),
            JsonNode.Parse("""{"productId":"broken"}"""));
        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredArray<ActiveSubscription>(
                mixed,
                "getActiveSubscriptions"));
        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }

    [Theory]
    [InlineData("productId")]
    [InlineData("transactionId")]
    public void ActiveSubscriptionRejectsEmptyIdentity(string field)
    {
        var value = field == "productId" ? "premium.monthly" : "transaction-1";
        var malformed = ActiveSubscriptionJson.Replace(
            $"\"{field}\": \"{value}\"",
            $"\"{field}\": \"\"");
        var payload = new JsonArray(JsonNode.Parse(malformed));

        var error = Assert.Throws<OpenIapException>(() =>
            BridgePayloadDecoder.DecodeRequiredArray<ActiveSubscription>(
                payload,
                "getActiveSubscriptions"));
        Assert.Equal(ErrorCode.BillingResponseJsonParseError, error.Error.Code);
    }
}
