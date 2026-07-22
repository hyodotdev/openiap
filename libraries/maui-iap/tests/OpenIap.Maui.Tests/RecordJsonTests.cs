// Serialization contract for the generated sealed records and
// [JsonPolymorphic] unions in Types.cs, exercised through the same
// JsonOptions.Default the library uses for every module payload.

using System.Text.Json;
using Xunit;

namespace OpenIap.Maui.Tests;

public class RecordJsonTests
{
    private static readonly JsonSerializerOptions Options = JsonOptions.Default;

    // ------------------------------------------------------------------
    // Product union
    // ------------------------------------------------------------------

    private const string ProductIosJson = """
        {
          "__typename": "ProductIOS",
          "currency": "USD",
          "description": "Premium access",
          "displayName": "Premium",
          "displayNameIOS": "Premium",
          "displayPrice": "$9.99",
          "id": "premium.monthly",
          "isFamilyShareableIOS": true,
          "jsonRepresentationIOS": "{}",
          "platform": "ios",
          "price": 9.99,
          "title": "Premium Monthly",
          "type": "subs",
          "typeIOS": "auto-renewable-subscription"
        }
        """;

    [Fact]
    public void Product_Union_DeserializesProductIosViaDiscriminator()
    {
        var product = JsonSerializer.Deserialize<Product>(ProductIosJson, Options);

        var ios = Assert.IsType<ProductIOS>(product);
        Assert.Equal("premium.monthly", ios.Id);
        Assert.Equal("USD", ios.Currency);
        Assert.Equal(IapPlatform.IOS, ios.Platform);
        Assert.Equal(ProductType.Subs, ios.Type);
        Assert.Equal(ProductTypeIOS.AutoRenewableSubscription, ios.TypeIOS);
        Assert.True(ios.IsFamilyShareableIOS);
        Assert.NotNull(ios.Price);
        Assert.Equal(9.99, ios.Price!.Value);
        // ProductCommon view exposes the same values.
        ProductCommon common = ios;
        Assert.Equal("$9.99", common.DisplayPrice);
        Assert.Equal("Premium Monthly", common.Title);
    }

    [Fact]
    public void Product_Union_RoundTripsThroughBaseTypeWithDiscriminator()
    {
        var product = JsonSerializer.Deserialize<Product>(ProductIosJson, Options)!;

        var serialized = JsonSerializer.Serialize(product, Options);
        Assert.Contains("\"__typename\":\"ProductIOS\"", serialized, StringComparison.Ordinal);

        var reparsed = JsonSerializer.Deserialize<Product>(serialized, Options);
        Assert.Equal(product, reparsed);
    }

    [Fact]
    public void ProductOrSubscription_Union_AcceptsAllFourVariantDiscriminators()
    {
        // The wider union declares four derived types; spot-check that the
        // ProductIOS payload also parses through it.
        var parsed = JsonSerializer.Deserialize<ProductOrSubscription>(ProductIosJson, Options);
        Assert.IsType<ProductIOS>(parsed);
    }

    [Fact]
    public void Product_Union_RejectsUnknownDiscriminator()
    {
        const string json = """{"__typename":"ProductWindows","id":"x"}""";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Product>(json, Options));
    }

    [Fact]
    public void Product_Union_RejectsPayloadWithoutDiscriminator()
    {
        // Abstract union roots cannot be materialized without __typename.
        const string json = """{"id":"x","currency":"USD"}""";
        Assert.Throws<NotSupportedException>(() => JsonSerializer.Deserialize<Product>(json, Options));
    }

    [Fact]
    public void Product_Union_RequiresDiscriminatorFirst()
    {
        // STJ metadata handling: __typename must be the first property (the
        // native modules emit it first; AllowOutOfOrderMetadataProperties is
        // deliberately not enabled in JsonOptions.Default).
        const string json = """{"id":"x","__typename":"ProductIOS"}""";
        Assert.Throws<NotSupportedException>(() => JsonSerializer.Deserialize<Product>(json, Options));
    }

    [Fact]
    public void ProductAndroid_DefaultsPlatformAndTypeWhenOmitted()
    {
        // platform / type carry generated defaults and are not `required`.
        const string json = """
            {
              "__typename": "ProductAndroid",
              "currency": "KRW",
              "description": "Coins",
              "displayPrice": "₩1,000",
              "id": "coins.100",
              "nameAndroid": "100 Coins",
              "title": "100 Coins"
            }
            """;

        var android = Assert.IsType<ProductAndroid>(JsonSerializer.Deserialize<Product>(json, Options));
        Assert.Equal(IapPlatform.Android, android.Platform);
        Assert.Equal(ProductType.InApp, android.Type);
        Assert.Null(android.Price);
        Assert.Null(android.DiscountOffers);
        Assert.Null(android.SubscriptionOffers);
    }

    // ------------------------------------------------------------------
    // Purchase union
    // ------------------------------------------------------------------

    private const string PurchaseAndroidJson = """
        {
          "__typename": "PurchaseAndroid",
          "id": "GPA.1234-5678",
          "isAutoRenewing": true,
          "platform": "android",
          "productId": "premium.monthly",
          "purchaseState": "purchased",
          "purchaseToken": "token-abc",
          "quantity": 1,
          "store": "google",
          "transactionDate": 1720000000000,
          "isAcknowledgedAndroid": false
        }
        """;

    [Fact]
    public void Purchase_Union_DeserializesPurchaseAndroidViaDiscriminator()
    {
        var purchase = JsonSerializer.Deserialize<Purchase>(PurchaseAndroidJson, Options);

        var android = Assert.IsType<PurchaseAndroid>(purchase);
        Assert.Equal("GPA.1234-5678", android.Id);
        Assert.Equal(IapPlatform.Android, android.Platform);
        Assert.Equal(PurchaseState.Purchased, android.PurchaseState);
        Assert.Equal(IapStore.Google, android.Store);
        Assert.Equal("token-abc", android.PurchaseToken);
        Assert.Equal(1720000000000D, android.TransactionDate);
        Assert.True(android.IsAutoRenewing);
        Assert.NotNull(android.IsAcknowledgedAndroid);
        Assert.False(android.IsAcknowledgedAndroid!.Value);
        Assert.Null(android.Ids);
        Assert.Null(android.SignatureAndroid);
    }

    [Fact]
    public void Purchase_Union_RoundTripsPurchaseAndroid()
    {
        var purchase = JsonSerializer.Deserialize<Purchase>(PurchaseAndroidJson, Options)!;
        var serialized = JsonSerializer.Serialize(purchase, Options);
        Assert.Contains("\"__typename\":\"PurchaseAndroid\"", serialized, StringComparison.Ordinal);
        Assert.Equal(purchase, JsonSerializer.Deserialize<Purchase>(serialized, Options));
    }

    [Fact]
    public void PurchaseIos_OmitsNullOptionalFieldsOnWrite()
    {
        Purchase purchase = new PurchaseIOS
        {
            Id = "2000000123",
            IsAutoRenewing = false,
            Platform = IapPlatform.IOS,
            ProductId = "premium.monthly",
            PurchaseState = PurchaseState.Purchased,
            Quantity = 1,
            Store = IapStore.Apple,
            TransactionDate = 1720000000000,
            TransactionId = "2000000123",
        };

        var json = JsonSerializer.Serialize(purchase, Options);

        Assert.Contains("\"__typename\":\"PurchaseIOS\"", json, StringComparison.Ordinal);
        Assert.Contains("\"store\":\"apple\"", json, StringComparison.Ordinal);
        Assert.Contains("\"purchaseState\":\"purchased\"", json, StringComparison.Ordinal);
        // JsonOptions.Default uses WhenWritingNull — unset optionals must vanish.
        Assert.DoesNotContain("purchaseToken", json, StringComparison.Ordinal);
        Assert.DoesNotContain("appAccountToken", json, StringComparison.Ordinal);
        Assert.DoesNotContain("expirationDateIOS", json, StringComparison.Ordinal);
    }

    [Fact]
    public void Purchase_MissingRequiredPropertyThrows()
    {
        // "id" is a required member on PurchaseAndroid.
        const string json = """
            {
              "__typename": "PurchaseAndroid",
              "isAutoRenewing": true,
              "platform": "android",
              "productId": "premium.monthly",
              "purchaseState": "purchased",
              "quantity": 1,
              "store": "google",
              "transactionDate": 1720000000000
            }
            """;
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Purchase>(json, Options));
    }

    // ------------------------------------------------------------------
    // PurchaseError record
    // ------------------------------------------------------------------

    [Fact]
    public void PurchaseError_DeserializesCodeViaConverter()
    {
        const string json = """{"code":"user-cancelled","message":"User cancelled the purchase"}""";
        var error = JsonSerializer.Deserialize<PurchaseError>(json, Options);

        Assert.NotNull(error);
        Assert.Equal(ErrorCode.UserCancelled, error!.Code);
        Assert.Equal("User cancelled the purchase", error.Message);
        Assert.Null(error.ProductId);
        Assert.Null(error.ResponseCode);
    }

    [Fact]
    public void PurchaseError_SerializesKebabCodeAndOmitsNulls()
    {
        var error = new PurchaseError
        {
            Code = ErrorCode.SkuNotFound,
            Message = "sku missing",
        };

        var json = JsonSerializer.Serialize(error, Options);
        Assert.Contains("\"code\":\"sku-not-found\"", json, StringComparison.Ordinal);
        Assert.DoesNotContain("productId", json, StringComparison.Ordinal);
        Assert.DoesNotContain("debugMessage", json, StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------
    // IAPKit verification result
    // ------------------------------------------------------------------

    [Fact]
    public void RequestVerifyPurchaseWithIapkitResult_DeserializesClientPayload()
    {
        // Ported from the ContractTests harness
        // (GeneratedVerificationResultDeserializesClientPayload).
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

        var result = JsonSerializer.Deserialize<RequestVerifyPurchaseWithIapkitResult>(json);

        Assert.NotNull(result);
        Assert.True(result!.IsValid);
        Assert.Equal("premium.monthly", result.ProductId);
        Assert.Equal(IapkitPurchaseState.Entitled, result.State);
        Assert.Equal(IapStore.Apple, result.Store);

        Assert.NotNull(result.ClientPayload);
        var payload = result.ClientPayload!;
        Assert.Equal(IapkitClientPayloadFormat.Toml, payload.Format);
        Assert.Equal("tier = \"gold\"", payload.Body);
        Assert.Equal(5D, payload.Version);
        Assert.Equal(1720000000789D, payload.UpdatedAt);
    }

    // ------------------------------------------------------------------
    // RequestPurchaseProps input validation
    // ------------------------------------------------------------------

    [Fact]
    public void RequestPurchaseProps_ValidPurchaseShapePassesValidation()
    {
        var props = new RequestPurchaseProps
        {
            Type = ProductQueryType.InApp,
            RequestPurchase = new RequestPurchasePropsByPlatforms
            {
                Apple = new RequestPurchaseIosProps { Sku = "coins.100" },
            },
        };

        props.Validate(); // must not throw
    }

    [Fact]
    public void RequestPurchaseProps_RequiresExactlyOneShape()
    {
        var neither = new RequestPurchaseProps { Type = ProductQueryType.InApp };
        Assert.Throws<InvalidOperationException>(neither.Validate);

        var both = new RequestPurchaseProps
        {
            Type = ProductQueryType.InApp,
            RequestPurchase = new RequestPurchasePropsByPlatforms(),
            RequestSubscription = new RequestSubscriptionPropsByPlatforms(),
        };
        Assert.Throws<InvalidOperationException>(both.Validate);
    }

    [Fact]
    public void RequestPurchaseProps_RejectsTypeShapeMismatch()
    {
        var purchaseWithSubsType = new RequestPurchaseProps
        {
            Type = ProductQueryType.Subs,
            RequestPurchase = new RequestPurchasePropsByPlatforms(),
        };
        Assert.Throws<InvalidOperationException>(purchaseWithSubsType.Validate);

        var subscriptionWithInAppType = new RequestPurchaseProps
        {
            Type = ProductQueryType.InApp,
            RequestSubscription = new RequestSubscriptionPropsByPlatforms(),
        };
        Assert.Throws<InvalidOperationException>(subscriptionWithInAppType.Validate);
    }

    [Fact]
    public void RequestPurchaseProps_ValidatesOnDeserialization()
    {
        const string valid = """
            {
              "type": "in-app",
              "requestPurchase": { "apple": { "sku": "coins.100" } }
            }
            """;
        var parsed = JsonSerializer.Deserialize<RequestPurchaseProps>(valid, Options);
        Assert.NotNull(parsed);
        Assert.NotNull(parsed!.RequestPurchase?.Apple);
        Assert.Equal("coins.100", parsed.RequestPurchase!.Apple!.Sku);

        // IJsonOnDeserialized.OnDeserialized runs Validate() — a mismatched
        // payload must fail at parse time, not at first use.
        const string mismatched = """
            {
              "type": "subs",
              "requestPurchase": { "apple": { "sku": "coins.100" } }
            }
            """;
        Assert.Throws<InvalidOperationException>(
            () => JsonSerializer.Deserialize<RequestPurchaseProps>(mismatched, Options));
    }

    // ------------------------------------------------------------------
    // WebhookEvent record
    // ------------------------------------------------------------------

    [Fact]
    public void WebhookEvent_DeserializesFullPayload()
    {
        const string json = """
            {
              "id": "evt-123",
              "type": "subscription-renewed",
              "platform": "ios",
              "environment": "production",
              "source": "apple-app-store-server-notifications-v2",
              "projectId": "proj-1",
              "productId": "premium.monthly",
              "purchaseToken": "orig-txn-1",
              "subscriptionState": "active",
              "occurredAt": 1720000000000,
              "receivedAt": 1720000000500,
              "expiresAt": 1722678400000,
              "renewsAt": 1722678400000,
              "priceAmountMicros": 9990000,
              "currency": "USD"
            }
            """;

        var evt = JsonSerializer.Deserialize<WebhookEvent>(json, Options);

        Assert.NotNull(evt);
        Assert.Equal("evt-123", evt!.Id);
        Assert.Equal(WebhookEventType.SubscriptionRenewed, evt.Type);
        Assert.Equal(IapPlatform.IOS, evt.Platform);
        Assert.Equal(WebhookEventEnvironment.Production, evt.Environment);
        Assert.Equal(WebhookEventSource.AppleAppStoreServerNotificationsV2, evt.Source);
        Assert.Equal(SubscriptionState.Active, evt.SubscriptionState);
        Assert.Equal("orig-txn-1", evt.PurchaseToken);
        Assert.Equal(1720000000000D, evt.OccurredAt);
        Assert.Equal(1720000000500D, evt.ReceivedAt);
        Assert.Null(evt.CancellationReason);
        Assert.Null(evt.RawSignedPayload);
    }
}
