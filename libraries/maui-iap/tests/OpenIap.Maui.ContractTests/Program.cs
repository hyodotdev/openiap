using System.Net;
using System.Text;
using System.Text.Json;
using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.ContractTests;

internal static class Program
{
    private const string ApiKey = "api key/?";
    private const string BaseUrl = "https://kit.example.test/root/";

    private static readonly (string Name, Func<Task> Run)[] Tests =
    [
        (nameof(ProductsRequirePlatformForClientPayload), ProductsRequirePlatformForClientPayload),
        (nameof(ProductsUseEscapedUriAndQuery), ProductsUseEscapedUriAndQuery),
        (nameof(ProductsDeserializeNestedClientPayload), ProductsDeserializeNestedClientPayload),
        (nameof(KitApiDropsUnreadableRows), KitApiDropsUnreadableRows),
        (nameof(ClientPayloadUsesEscapedUriAndDeserializes), ClientPayloadUsesEscapedUriAndDeserializes),
        (nameof(GeneratedVerificationResultDeserializesClientPayload), GeneratedVerificationResultDeserializesClientPayload),
        (nameof(GeneratedVerificationResultDegradesUnknownValues), GeneratedVerificationResultDegradesUnknownValues),
        (nameof(GeneratedAmazonVerificationContractRoundTrips), GeneratedAmazonVerificationContractRoundTrips),
        (nameof(ExampleRestoredAmazonTermsPreserveReceiptIdentity), ExampleRestoredAmazonTermsPreserveReceiptIdentity),
        (nameof(ExampleAppleVerificationBindsActiveReceipt), ExampleAppleVerificationBindsActiveReceipt),
    ];

    public static async Task<int> Main()
    {
        var failures = new List<string>();

        foreach (var (name, run) in Tests)
        {
            try
            {
                await run().ConfigureAwait(false);
                Console.WriteLine($"PASS {name}");
            }
            catch (Exception exception)
            {
                failures.Add($"{name}: {exception}");
                Console.Error.WriteLine($"FAIL {name}: {exception.Message}");
            }
        }

        if (failures.Count == 0)
        {
            Console.WriteLine($"All {Tests.Length} MAUI contract tests passed.");
            return 0;
        }

        Console.Error.WriteLine($"{failures.Count} of {Tests.Length} MAUI contract tests failed:");
        foreach (var failure in failures)
        {
            Console.Error.WriteLine(failure);
        }
        return 1;
    }

    private static Task ExampleAppleVerificationBindsActiveReceipt()
    {
        var receipt = new PurchaseIOS { Id = "old", TransactionId = "old", ProductId = OpenIap.Maui.Example.Constants.ConsumableProductIdSet.First(),
            PurchaseState = PurchaseState.Purchased, TransactionDate = 1, Quantity = 1,
            IsAutoRenewing = false, Store = IapStore.Apple, StoreId = "apple", EnvironmentIOS = "Sandbox" };
        AssertEqual(true, IapKitSettings.MatchesVerifiedPendingPurchase(receipt, [receipt]), "exact receipt");
        foreach (var other in new[] { receipt with { Id = "new" }, receipt with { ProductId = "foreign" },
            receipt with { Store = IapStore.Unknown, StoreId = "community" }, receipt with { EnvironmentIOS = "Production" },
            receipt with { EnvironmentIOS = null }, receipt with { RevocationDateIOS = 1 },
            receipt with { ExpirationDateIOS = 1 }, receipt with { IsUpgradedIOS = true } })
            AssertEqual(false, IapKitSettings.MatchesVerifiedPendingPurchase(receipt, [other]), "unusable receipt");
        var result = new RequestVerifyPurchaseWithIapkitResult { IsValid = true, ProductId = receipt.ProductId,
            Store = IapStore.Apple, StoreId = "apple", State = IapkitPurchaseState.ReadyToConsume, Environment = "Sandbox" };
        AssertEqual(true, IapKitSettings.AcceptsVerification(result, receipt), "matching environment");
        AssertEqual(false, IapKitSettings.AcceptsVerification(result with { Environment = "Production" }, receipt), "wrong environment");
        AssertEqual(false, IapKitSettings.AcceptsVerification(result with { Environment = null }, receipt), "missing environment");
        return Task.CompletedTask;
    }

    private static Task ProductsRequirePlatformForClientPayload()
    {
        using var handler = new FakeHttpMessageHandler();
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        var exception = AssertThrows<ArgumentException>(() =>
        {
            _ = client.ProductsAsync(new KitProductsOptions
            {
                IncludeClientPayload = true,
            });
        });

        AssertEqual("options", exception.ParamName, "argument name");
        AssertEqual(0, handler.RequestUris.Count, "request count");
        return Task.CompletedTask;
    }

    private static async Task ProductsUseEscapedUriAndQuery()
    {
        using var handler = new FakeHttpMessageHandler("""
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
        }).ConfigureAwait(false);

        AssertEqual(0, response.Products.Count, "product count");
        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/products/api%20key%2F%3F" +
            "?platform=IOS&includeClientPayload=true&limit=25&cursor=after%20%2F%20%2B%3F");
    }

    private static async Task ProductsDeserializeNestedClientPayload()
    {
        using var handler = new FakeHttpMessageHandler("""
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
        }).ConfigureAwait(false);

        AssertEqual(1, response.Products.Count, "product count");
        var product = response.Products[0];
        AssertEqual("premium.monthly", product.ProductId, "product id");
        AssertEqual(KitProductPlatform.IOS, product.Platform, "product platform");
        AssertEqual("subscription", product.Type, "product type");
        AssertEqual(true, response.HasMore, "hasMore");
        AssertEqual("next-page", response.NextCursor, "next cursor");

        var payload = AssertNotNull(product.ClientPayload, "nested client payload");
        AssertEqual("toml", payload.Format, "payload format");
        AssertEqual("tier = \"gold\"", payload.Body, "payload body");
        AssertEqual(3D, payload.Version, "payload version");
        AssertEqual(1720000000123D, payload.UpdatedAt, "payload updatedAt");
    }

    private static async Task ClientPayloadUsesEscapedUriAndDeserializes()
    {
        using var handler = new FakeHttpMessageHandler("""
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
            KitProductPlatform.Android).ConfigureAwait(false);

        AssertSingleRequest(
            handler,
            "https://kit.example.test/root/v1/products/api%20key%2F%3F/" +
            "premium%20%2F%20monthly%3F/client-payload?platform=Android");
        AssertEqual("json", response.ClientPayload.Format, "payload format");
        AssertEqual("{\"tier\":\"platinum\"}", response.ClientPayload.Body, "payload body");
        AssertEqual(4D, response.ClientPayload.Version, "payload version");
        AssertEqual(1720000000456D, response.ClientPayload.UpdatedAt, "payload updatedAt");
    }

    private static async Task KitApiDropsUnreadableRows()
    {
        using var entitlementsHandler = new FakeHttpMessageHandler("""
            {
              "userId": "user-1",
              "productIds": ["premium.monthly"],
              "subscriptions": [
                {
                  "id": "sub-future", "productId": "future.plan", "platform": "horizon",
                  "state": "active", "startedAt": 1, "updatedAt": 2, "purchaseToken": "future"
                },
                {
                  "id": "sub-ios", "productId": "premium.monthly", "platform": "ios",
                  "state": "active", "startedAt": 1, "updatedAt": 2, "purchaseToken": "ios"
                }
              ]
            }
            """);
        using var entitlementsHttpClient = new HttpClient(entitlementsHandler);
        var entitlements = await CreateClient(entitlementsHttpClient)
            .EntitlementsAsync("user-1")
            .ConfigureAwait(false);
        AssertEqual(1, entitlements.Subscriptions.Count, "readable subscription count");
        AssertEqual("sub-ios", entitlements.Subscriptions[0].Id, "readable subscription");

        using var productsHandler = new FakeHttpMessageHandler("""
            {
              "products": [
                {
                  "productId": "future.product", "platform": "Horizon", "type": "in-app",
                  "title": "Future", "state": "active", "updatedAt": 1
                },
                {
                  "productId": "premium.monthly", "platform": "IOS", "type": "subscription",
                  "title": "Premium", "state": "active", "updatedAt": 2,
                  "offers": [
                    { "id": "broken" },
                    { "id": "intro", "kind": "introductory" }
                  ]
                }
              ]
            }
            """);
        using var productsHttpClient = new HttpClient(productsHandler);
        var products = await CreateClient(productsHttpClient).ProductsAsync().ConfigureAwait(false);
        AssertEqual(1, products.Products.Count, "readable product count");
        var offers = AssertNotNull(products.Products[0].Offers, "readable offers");
        AssertEqual(1, offers.Count, "readable offer count");
        AssertEqual("intro", offers[0].Id, "readable offer");
    }

    private static Task GeneratedVerificationResultDeserializesClientPayload()
    {
        const string json = """
            {
              "isValid": true,
              "productId": "premium.monthly",
              "state": "entitled",
              "store": "apple",
              "clientPayload": {
                "format": "toml",
                "body": "tier = \"gold\"",
                "version": 5,
                "updatedAt": 1720000000789
              }
            }
            """;

        var result = AssertNotNull(
            JsonSerializer.Deserialize<RequestVerifyPurchaseWithIapkitResult>(json),
            "generated verification result");
        AssertEqual(true, result.IsValid, "verification validity");
        AssertEqual("premium.monthly", result.ProductId, "verified product id");
        AssertEqual(IapkitPurchaseState.Entitled, result.State, "purchase state");
        AssertEqual(IapStore.Apple, result.Store, "purchase store");

        var payload = AssertNotNull(result.ClientPayload, "generated client payload");
        AssertEqual(IapkitClientPayloadFormat.Toml, payload.Format, "generated payload format");
        AssertEqual("tier = \"gold\"", payload.Body, "generated payload body");
        AssertEqual(5D, payload.Version, "generated payload version");
        AssertEqual(1720000000789D, payload.UpdatedAt, "generated payload updatedAt");
        return Task.CompletedTask;
    }

    private static Task GeneratedVerificationResultDegradesUnknownValues()
    {
        const string json = """
            {
              "isValid": true,
              "state": "future-state",
              "store": "future_store",
              "storeId": "future_store",
              "clientPayload": {
                "format": "future-format",
                "body": "opaque",
                "version": 1,
                "updatedAt": 2
              }
            }
            """;

        var result = AssertNotNull(
            JsonSerializer.Deserialize<RequestVerifyPurchaseWithIapkitResult>(json),
            "tolerant generated verification result");
        AssertEqual(IapkitPurchaseState.Unknown, result.State, "unknown purchase state");
        AssertEqual(IapStore.Unknown, result.Store, "unknown store");
        AssertEqual("future_store", result.StoreId, "community store identity");
        AssertEqual<IapkitProductClientPayload?>(null, result.ClientPayload, "unknown client payload");
        return Task.CompletedTask;
    }

    private static Task GeneratedAmazonVerificationContractRoundTrips()
    {
        var props = new RequestVerifyPurchaseWithIapkitAmazonProps
        {
            ExpectedProductId = "dev.hyo.martie.10bulbs",
            ReceiptId = "amzn1.receipt.test",
            Sandbox = true,
            UserId = "amzn1.account.test",
        };
        var result = new RequestVerifyPurchaseWithIapkitResult
        {
            Environment = "Sandbox",
            IsValid = true,
            ProductId = "dev.hyo.martie.10bulbs",
            State = IapkitPurchaseState.ReadyToConsume,
            Store = IapStore.Amazon,
        };

        var restoredProps = AssertNotNull(
            JsonSerializer.Deserialize<RequestVerifyPurchaseWithIapkitAmazonProps>(
                JsonSerializer.Serialize(props)),
            "generated Amazon verification props");
        var restoredResult = AssertNotNull(
            JsonSerializer.Deserialize<RequestVerifyPurchaseWithIapkitResult>(
                JsonSerializer.Serialize(result)),
            "generated Amazon verification result");

        AssertEqual(props.ExpectedProductId, restoredProps.ExpectedProductId, "expected product id");
        AssertEqual(props.ReceiptId, restoredProps.ReceiptId, "Amazon receipt id");
        AssertEqual("Sandbox", restoredResult.Environment, "Amazon environment");
        AssertEqual(IapStore.Amazon, restoredResult.Store, "Amazon store");
        return Task.CompletedTask;
    }

    private static Task ExampleRestoredAmazonTermsPreserveReceiptIdentity()
    {
        var restored = new PurchaseAndroid
        {
            Id = "receipt",
            ProductId = "dev.hyo.martie.premium.base",
            PurchaseToken = "receipt",
            PurchaseState = PurchaseState.Purchased,
            TransactionDate = 1,
            Quantity = 1,
            IsAutoRenewing = true,
            Store = IapStore.Unknown,
            StoreId = "amazon_example",
        };
        foreach (var term in OpenIap.Maui.Example.Constants.SubscriptionProductIds)
        {
            foreach (var (store, storeId) in new[] { (IapStore.Amazon, "amazon"), (IapStore.Unknown, "amazon_example") })
            {
                var purchase = restored with { CurrentPlanId = term, Store = store, StoreId = storeId };
                AssertEqual(term, IapKitSettings.SubscriptionProductId(purchase), "restored plan");
                AssertEqual(restored.ProductId, purchase.ProductId, "raw receipt SKU");
                AssertEqual(restored.PurchaseToken, purchase.PurchaseToken, "raw receipt token");
                AssertEqual(restored.ProductId, IapKitSettings.CreateVerifyProps(purchase).Amazon?.ExpectedProductId, "RVS base SKU");
            }
        }
        AssertEqual<string?>(null, IapKitSettings.SubscriptionProductId(restored), "missing term");
        AssertEqual<string?>(null, IapKitSettings.SubscriptionProductId(restored with { CurrentPlanId = "foreign.term" }), "foreign term");
        AssertEqual<string?>(null, IapKitSettings.SubscriptionProductId(restored with { CurrentPlanId = "dev.hyo.martie.premium", StoreId = "foreign" }), "foreign provider");
        AssertEqual<string?>(null, IapKitSettings.SubscriptionProductId(restored with { CurrentPlanId = "dev.hyo.martie.premium", ProductId = "foreign.base" }), "foreign base");
        AssertEqual("dev.hyo.martie.premium", IapKitSettings.SubscriptionProductId(restored with
        {
            ProductId = "dev.hyo.martie.premium", CurrentPlanId = "premium-monthly", Store = IapStore.Google, StoreId = "play",
        }), "unchanged Play plan");
        AssertEqual(true, IapKitSettings.SubscriptionQueryIds.Contains(restored.ProductId), "ownership query includes base");
        return Task.CompletedTask;
    }

    private static KitApiClient CreateClient(HttpClient httpClient)
        => OpenIapClient.KitApi(new KitApiOptions
        {
            ApiKey = ApiKey,
            BaseUrl = BaseUrl,
            HttpClient = httpClient,
        });

    private static void AssertSingleRequest(FakeHttpMessageHandler handler, string expectedUri)
    {
        AssertEqual(1, handler.RequestUris.Count, "request count");
        AssertEqual(expectedUri, handler.RequestUris[0], "request URI");
    }

    private static T AssertNotNull<T>(T? value, string label)
        where T : class
        => value ?? throw new InvalidOperationException($"Expected {label} to be non-null.");

    private static void AssertEqual<T>(T expected, T actual, string label)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException(
                $"Expected {label} to be '{expected}', but received '{actual}'.");
        }
    }

    private static TException AssertThrows<TException>(Action action)
        where TException : Exception
    {
        try
        {
            action();
        }
        catch (TException exception)
        {
            return exception;
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                $"Expected {typeof(TException).Name}, but received {exception.GetType().Name}.",
                exception);
        }

        throw new InvalidOperationException($"Expected {typeof(TException).Name}, but no exception was thrown.");
    }

    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<string> _responseBodies;

        public FakeHttpMessageHandler(params string[] responseBodies)
        {
            _responseBodies = new Queue<string>(responseBodies);
        }

        public List<string> RequestUris { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            RequestUris.Add(
                request.RequestUri?.AbsoluteUri
                ?? throw new InvalidOperationException("Request URI was null."));

            if (_responseBodies.Count == 0)
            {
                throw new InvalidOperationException("No fake HTTP response was configured.");
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    _responseBodies.Dequeue(),
                    Encoding.UTF8,
                    "application/json"),
            });
        }
    }
}
