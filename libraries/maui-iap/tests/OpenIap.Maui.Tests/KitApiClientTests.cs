// HTTP contract for OpenIapClient.KitApi(...). The five checks from the
// original tests/OpenIap.Maui.ContractTests harness are ported here 1:1
// (same fake-HttpMessageHandler technique), plus coverage for the remaining
// endpoints and the KitApiError paths.

using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using OpenIap.Maui.Tests.TestSupport;
using Xunit;

namespace OpenIap.Maui.Tests;

public class KitApiClientTests
{
    private const string ApiKey = "api key/?";
    private const string BaseUrl = "https://kit.example.test/root/";

    private static KitApiClient CreateClient(HttpClient httpClient)
        => OpenIapClient.KitApi(new KitApiOptions
        {
            ApiKey = ApiKey,
            BaseUrl = BaseUrl,
            HttpClient = httpClient,
        });

    private static void AssertSingleRequest(RecordingHttpMessageHandler handler, string expectedUri)
    {
        var uri = Assert.Single(handler.RequestUris);
        Assert.Equal(expectedUri, uri);
    }

    // ------------------------------------------------------------------
    // Ported harness checks
    // ------------------------------------------------------------------

    [Fact]
    public void Products_RequirePlatformForClientPayload()
    {
        using var handler = new RecordingHttpMessageHandler();
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var exception = Assert.Throws<ArgumentException>(void () =>
        {
            // The guard throws synchronously, before any request is issued.
            _ = client.ProductsAsync(new KitProductsOptions
            {
                IncludeClientPayload = true,
            });
        });

        Assert.Equal("options", exception.ParamName);
        Assert.Empty(handler.RequestUris);
    }

    [Fact]
    public async Task Products_UseEscapedUriAndQuery()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {"products":[],"hasMore":false,"nextCursor":null}
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.ProductsAsync(new KitProductsOptions
        {
            Platform = KitProductPlatform.IOS,
            IncludeClientPayload = true,
            Limit = 25,
            Cursor = "after / +?",
        });

        Assert.Empty(response.Products);
        Assert.NotNull(response.HasMore);
        Assert.False(response.HasMore!.Value);
        Assert.Null(response.NextCursor);
        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/products/api%20key%2F%3F" +
            "?platform=IOS&includeClientPayload=true&limit=25&cursor=after%20%2F%20%2B%3F");
    }

    [Fact]
    public async Task Products_DeserializeNestedClientPayload()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "products": [
                {
                  "productId": "premium.monthly",
                  "platform": "IOS",
                  "type": "subscription",
                  "title": "Premium Monthly",
                  "description": "Premium access",
                  "priceAmountMicros": 9990000,
                  "currency": "USD",
                  "state": "active",
                  "updatedAt": 1720000000000,
                  "clientPayload": {
                    "format": "toml",
                    "body": "tier = \"gold\"",
                    "version": 3,
                    "updatedAt": 1720000000123
                  }
                }
              ],
              "hasMore": true,
              "nextCursor": "next-page"
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.ProductsAsync(new KitProductsOptions
        {
            Platform = KitProductPlatform.IOS,
            IncludeClientPayload = true,
        });

        var product = Assert.Single(response.Products);
        Assert.Equal("premium.monthly", product.ProductId);
        Assert.Equal(KitProductPlatform.IOS, product.Platform);
        Assert.Equal("subscription", product.Type);
        Assert.NotNull(response.HasMore);
        Assert.True(response.HasMore!.Value);
        Assert.Equal("next-page", response.NextCursor);

        Assert.NotNull(product.ClientPayload);
        var payload = product.ClientPayload!;
        Assert.Equal("toml", payload.Format);
        Assert.Equal("tier = \"gold\"", payload.Body);
        Assert.Equal(3D, payload.Version);
        Assert.Equal(1720000000123D, payload.UpdatedAt);
    }

    [Fact]
    public async Task Products_DropUnreadableProductsAndOffersIndependently()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "products": [
                {
                  "productId": "future.product",
                  "platform": "Horizon",
                  "type": "in-app",
                  "title": "Future Product",
                  "state": "active",
                  "updatedAt": 1720000000000
                },
                {
                  "productId": "premium.monthly",
                  "platform": "IOS",
                  "type": "subscription",
                  "title": "Premium Monthly",
                  "state": "active",
                  "updatedAt": 1720000000001,
                  "offers": [
                    { "id": "broken-offer" },
                    { "id": "intro", "kind": "introductory", "duration": "P1M" }
                  ]
                }
              ]
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.ProductsAsync();

        var product = Assert.Single(response.Products);
        Assert.Equal("premium.monthly", product.ProductId);
        var offer = Assert.Single(Assert.IsAssignableFrom<IReadOnlyList<KitProductOffer>>(product.Offers));
        Assert.Equal("intro", offer.Id);
    }

    [Fact]
    public async Task ClientPayload_UsesEscapedUriAndDeserializes()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "clientPayload": {
                "format": "json",
                "body": "{\"tier\":\"platinum\"}",
                "version": 4,
                "updatedAt": 1720000000456
              }
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.ClientPayloadAsync(
            "premium / monthly?",
            KitProductPlatform.Android);

        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/products/api%20key%2F%3F/" +
            "premium%20%2F%20monthly%3F/client-payload?platform=Android");
        Assert.Equal("json", response.ClientPayload.Format);
        Assert.Equal("{\"tier\":\"platinum\"}", response.ClientPayload.Body);
        Assert.Equal(4D, response.ClientPayload.Version);
        Assert.Equal(1720000000456D, response.ClientPayload.UpdatedAt);
    }

    // The fifth harness check (generated RequestVerifyPurchaseWithIapkitResult
    // deserialization) lives in RecordJsonTests with the other generated-type
    // coverage.

    // ------------------------------------------------------------------
    // Client construction
    // ------------------------------------------------------------------

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void KitApi_RejectsEmptyApiKey(string apiKey)
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            OpenIapClient.KitApi(new KitApiOptions { ApiKey = apiKey }));
        Assert.Equal("options", exception.ParamName);
    }

    [Fact]
    public void KitApi_DefaultsBaseUrlAndTrimsTrailingSlash()
    {
        var defaulted = OpenIapClient.KitApi(new KitApiOptions { ApiKey = "k" });
        Assert.Equal("https://kit.openiap.dev", defaulted.BaseUrl);

        var trimmed = OpenIapClient.KitApi(new KitApiOptions
        {
            ApiKey = "k",
            BaseUrl = "https://kit.example.test/root/",
        });
        Assert.Equal("https://kit.example.test/root", trimmed.BaseUrl);
        Assert.Equal("k", trimmed.ApiKey);
    }

    // ------------------------------------------------------------------
    // Remaining endpoints
    // ------------------------------------------------------------------

    [Fact]
    public async Task Status_BuildsEscapedUriAndDeserializes()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "active": true,
              "subscription": {
                "id": "sub-1",
                "productId": "premium.monthly",
                "platform": "ios",
                "state": "active",
                "startedAt": 1719000000000,
                "updatedAt": 1720000000000,
                "purchaseToken": "orig-txn-1",
                "willRenew": true
              }
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.StatusAsync("user / 1?");

        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/subscriptions/status/api%20key%2F%3F?userId=user%20%2F%201%3F");
        var method = Assert.Single(handler.RequestMethods);
        Assert.Equal(HttpMethod.Get, method);
        Assert.True(response.Active);
        Assert.NotNull(response.Subscription);
        var subscription = response.Subscription!;
        Assert.Equal("sub-1", subscription.Id);
        // KitSubscription.Platform uses the generated IapPlatform converter
        // (lowercase wire values), unlike KitProduct's KitProductPlatform.
        Assert.Equal(IapPlatform.IOS, subscription.Platform);
        Assert.NotNull(subscription.WillRenew);
        Assert.True(subscription.WillRenew!.Value);
        Assert.Null(subscription.ExpiresAt);
    }

    [Fact]
    public async Task Status_DropsSubscriptionWithUnknownPlatform()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "active": true,
              "subscription": {
                "id": "sub-1",
                "productId": "premium.monthly",
                "platform": "horizon",
                "state": "active",
                "startedAt": 1719000000000,
                "updatedAt": 1720000000000,
                "purchaseToken": "token-1"
              }
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.StatusAsync("user-1");

        Assert.True(response.Active);
        Assert.Null(response.Subscription);
    }

    [Fact]
    public async Task Entitlements_BuildsUriAndDeserializes()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "userId": "user-1",
              "productIds": ["premium.monthly", "coins.100"],
              "subscriptions": []
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.EntitlementsAsync("user-1");

        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/subscriptions/entitlements/api%20key%2F%3F?userId=user-1");
        Assert.Equal("user-1", response.UserId);
        Assert.Equal(new[] { "premium.monthly", "coins.100" }, response.ProductIds);
        Assert.Empty(response.Subscriptions);
    }

    [Fact]
    public async Task Entitlements_DropOnlySubscriptionsWithUnknownPlatform()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {
              "userId": "user-1",
              "productIds": ["premium.monthly"],
              "subscriptions": [
                {
                  "id": "sub-future",
                  "productId": "future.plan",
                  "platform": "horizon",
                  "state": "active",
                  "startedAt": 1719000000000,
                  "updatedAt": 1720000000000,
                  "purchaseToken": "token-future"
                },
                {
                  "id": "sub-ios",
                  "productId": "premium.monthly",
                  "platform": "ios",
                  "state": "active",
                  "startedAt": 1719000000001,
                  "updatedAt": 1720000000001,
                  "purchaseToken": "token-ios"
                }
              ]
            }
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.EntitlementsAsync("user-1");

        var subscription = Assert.Single(response.Subscriptions);
        Assert.Equal("sub-ios", subscription.Id);
    }

    [Fact]
    public async Task BindUser_PostsJsonBodyAndDeserializes()
    {
        using var handler = new RecordingHttpMessageHandler("""
            {"ok":true,"bound":true}
            """);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var response = await client.BindUserAsync("token-1", "user-1");

        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/subscriptions/bind-user/api%20key%2F%3F");
        var method = Assert.Single(handler.RequestMethods);
        Assert.Equal(HttpMethod.Post, method);

        var body = Assert.Single(handler.RequestBodies);
        Assert.NotNull(body);
        var parsed = JsonNode.Parse(body!)!.AsObject();
        Assert.Equal("token-1", (string?)parsed["purchaseToken"]);
        Assert.Equal("user-1", (string?)parsed["userId"]);

        Assert.True(response.Ok);
        Assert.True(response.Bound);
    }

    // ------------------------------------------------------------------
    // Error paths
    // ------------------------------------------------------------------

    [Fact]
    public async Task NonSuccessStatus_ThrowsKitApiErrorWithParsedBody()
    {
        using var handler = new RecordingHttpMessageHandler();
        handler.EnqueueResponse(HttpStatusCode.NotFound, """{"error":"no such user"}""");
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var error = await Assert.ThrowsAsync<KitApiError>(() => client.StatusAsync("missing"));

        Assert.Equal(404, error.Status);
        Assert.Contains("returned 404", error.Message, StringComparison.Ordinal);
        var body = Assert.IsAssignableFrom<JsonNode>(error.Body);
        Assert.Equal("no such user", (string?)body.AsObject()["error"]);
    }

    [Fact]
    public async Task SuccessWithNonJsonBody_ThrowsKitApiError()
    {
        using var handler = new RecordingHttpMessageHandler();
        handler.EnqueueResponse(HttpStatusCode.OK, "<html>proxy page</html>", "text/html");
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var error = await Assert.ThrowsAsync<KitApiError>(() => client.StatusAsync("user-1"));

        Assert.Equal(200, error.Status);
        Assert.Contains("non-JSON", error.Message, StringComparison.Ordinal);
        Assert.Equal("<html>proxy page</html>", error.Body);
    }

    [Fact]
    public async Task SuccessWithEmptyBody_ThrowsKitApiError()
    {
        using var handler = new RecordingHttpMessageHandler(string.Empty);
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var error = await Assert.ThrowsAsync<KitApiError>(() => client.StatusAsync("user-1"));

        Assert.Equal(200, error.Status);
        Assert.Contains("empty", error.Message, StringComparison.Ordinal);
        Assert.Null(error.Body);
    }

}
