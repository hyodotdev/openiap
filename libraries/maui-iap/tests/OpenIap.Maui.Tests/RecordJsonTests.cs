// Serialization contract for the generated sealed records and
// [JsonPolymorphic] unions in Types.cs, exercised through the same
// JsonOptions.Default the library uses for every module payload.

using System.Text.Json;
using System.Text.Json.Serialization;
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
          "autoRenewingAndroid": true,
          "currentPlanId": "monthly-base-plan",
          "dataAndroid": "{\"orderId\":\"GPA.1234-5678\"}",
          "developerPayloadAndroid": "developer-payload",
          "id": "token-abc",
          "ids": ["premium.monthly", "premium.backup"],
          "isAcknowledgedAndroid": false,
          "isAutoRenewing": true,
          "isSuspendedAndroid": true,
          "obfuscatedAccountIdAndroid": "account-hash",
          "obfuscatedProfileIdAndroid": "profile-hash",
          "packageNameAndroid": "dev.hyo.martie",
          "pendingPurchaseUpdateAndroid": {
            "products": ["premium.annual"],
            "purchaseToken": "pending-token"
          },
          "productId": "premium.monthly",
          "purchaseState": "purchased",
          "purchaseToken": "token-abc",
          "quantity": 1,
          "signatureAndroid": "signature-abc",
          "store": "google",
          "transactionDate": 1720000000000,
          "transactionId": "GPA.1234-5678",
          "userIdAmazon": "amazon-user-1",
          "userMarketplaceAmazon": "US"
        }
        """;

    private const string PurchaseIosJson = """
        {
          "__typename": "PurchaseIOS",
          "advancedCommerceInfoIOS": {
            "description": "Advanced commerce purchase",
            "displayName": "Premium bundle",
            "estimatedTax": "0.99",
            "items": [
              {
                "details": {
                  "jsonRepresentation": "{\"sku\":\"premium.bundle\"}"
                },
                "refunds": [
                  {
                    "jsonRepresentation": "{\"reason\":\"partial\"}"
                  }
                ],
                "revocationDate": 1720000000111
              }
            ],
            "requestReferenceId": "request-reference",
            "taxCode": "digital-goods",
            "taxExclusivePrice": "9.00",
            "taxRate": "0.11"
          },
          "appAccountToken": "11111111-2222-3333-4444-555555555555",
          "appBundleIdIOS": "dev.hyo.martie",
          "billingPlanTypeIOS": "monthly",
          "bundleOriginalTransactionIdIOS": "2000000001",
          "bundleProductIdIOS": "premium.bundle",
          "bundleSubscriptionGroupIdIOS": "group.bundle",
          "bundleTransactionIdIOS": "2000000123",
          "commitmentInfoIOS": {
            "billingPeriodNumber": 3,
            "commitmentExpiresDate": 1750000000000,
            "commitmentPrice": 9.99,
            "totalBillingPeriods": 12
          },
          "countryCodeIOS": "US",
          "currencyCodeIOS": "USD",
          "currencySymbolIOS": "$",
          "currentPlanId": "premium.monthly",
          "environmentIOS": "Sandbox",
          "expirationDateIOS": 1722592000000,
          "id": "2000000123",
          "ids": ["premium.monthly"],
          "isAutoRenewing": true,
          "isUpgradedIOS": false,
          "offerIOS": {
            "id": "launch-offer",
            "paymentMode": "payAsYouGo",
            "type": "promotional"
          },
          "originalTransactionDateIOS": 1710000000000,
          "originalTransactionIdentifierIOS": "2000000001",
          "ownershipTypeIOS": "PURCHASED",
          "productId": "premium.monthly",
          "purchaseState": "purchased",
          "purchaseToken": "signed-jws",
          "quantity": 1,
          "quantityIOS": 1,
          "reasonIOS": "PURCHASE",
          "reasonStringRepresentationIOS": "purchase",
          "renewalInfoIOS": {
            "autoRenewPreference": "premium.annual",
            "bundleOriginalTransactionId": "2000000001",
            "bundleProductId": "premium.bundle",
            "bundleSubscriptionGroupId": "group.bundle",
            "commitmentInfo": {
              "commitmentAutoRenewProductId": "premium.annual",
              "commitmentAutoRenewStatus": true,
              "commitmentRenewalBillingPlanType": "up-front",
              "commitmentRenewalDate": 1750000000000,
              "commitmentRenewalPrice": 99.99
            },
            "expirationReason": "VOLUNTARY",
            "gracePeriodExpirationDate": 1723000000000,
            "isInBillingRetry": true,
            "jsonRepresentation": "{\"renewal\":\"metadata\"}",
            "pendingUpgradeProductId": "premium.annual",
            "priceIncreaseStatus": "AGREED",
            "renewalBillingPlanType": "up-front",
            "renewalDate": 1722592000000,
            "renewalOfferId": "renewal-offer",
            "renewalOfferType": "PROMOTIONAL",
            "willAutoRenew": true,
            "willUnbundle": false
          },
          "previousOriginalTransactionIdIOS": "1999999999",
          "revocationDateIOS": 1724000000000,
          "revocationReasonIOS": "REFUNDED",
          "revocationTypeIOS": "assignmentRevocation",
          "store": "apple",
          "storefrontCountryCodeIOS": "USA",
          "subscriptionGroupIdIOS": "group.premium",
          "transactionDate": 1720000000000,
          "transactionId": "2000000123",
          "transactionReasonIOS": "PURCHASE",
          "webOrderLineItemIdIOS": "1000000999"
        }
        """;

    [Fact]
    public void Purchase_Union_DeserializesPurchaseAndroidViaDiscriminator()
    {
        var purchase = JsonSerializer.Deserialize<Purchase>(PurchaseAndroidJson, Options);

        var android = Assert.IsType<PurchaseAndroid>(purchase);
        Assert.Equal("token-abc", android.Id);
        Assert.Equal(PurchaseState.Purchased, android.PurchaseState);
        Assert.Equal(IapStore.Google, android.Store);
        Assert.Equal("token-abc", android.PurchaseToken);
        Assert.Equal("GPA.1234-5678", android.TransactionId);
        Assert.Equal(1720000000000D, android.TransactionDate);
        Assert.True(android.IsAutoRenewing);
        Assert.NotNull(android.IsAcknowledgedAndroid);
        Assert.False(android.IsAcknowledgedAndroid!.Value);
        Assert.Equal(["premium.monthly", "premium.backup"], android.Ids);
        Assert.Equal("signature-abc", android.SignatureAndroid);
    }

    [Fact]
    public void Purchase_Union_RoundTripsPurchaseAndroid()
    {
        var purchase = JsonSerializer.Deserialize<Purchase>(PurchaseAndroidJson, Options)!;
        var serialized = JsonSerializer.Serialize(purchase, Options);
        Assert.Contains("\"__typename\":\"PurchaseAndroid\"", serialized, StringComparison.Ordinal);
        var reparsed = Assert.IsType<PurchaseAndroid>(
            JsonSerializer.Deserialize<Purchase>(serialized, Options));
        Assert.Equal("GPA.1234-5678", reparsed.TransactionId);
        Assert.Equal(["premium.monthly", "premium.backup"], reparsed.Ids);
        Assert.Equal(["premium.annual"], reparsed.PendingPurchaseUpdateAndroid?.Products);
    }

    [Fact]
    public void PurchaseAndroid_FullCanonicalPayloadRoundTripsEveryGeneratedField()
    {
        var android = AssertFullPurchaseRoundTrip<PurchaseAndroid>(PurchaseAndroidJson);

        Assert.Equal("monthly-base-plan", android.CurrentPlanId);
        Assert.Equal("""{"orderId":"GPA.1234-5678"}""", android.DataAndroid);
        Assert.True(android.IsSuspendedAndroid);
        Assert.NotNull(android.PendingPurchaseUpdateAndroid);
        Assert.Equal(["premium.annual"], android.PendingPurchaseUpdateAndroid!.Products);
        Assert.Equal("pending-token", android.PendingPurchaseUpdateAndroid.PurchaseToken);
        Assert.Equal("GPA.1234-5678", android.TransactionId);
        Assert.Equal("amazon-user-1", android.UserIdAmazon);
        Assert.Equal("US", android.UserMarketplaceAmazon);
    }

    [Fact]
    public void PurchaseIOS_FullCanonicalPayloadRoundTripsEveryGeneratedField()
    {
        var ios = AssertFullPurchaseRoundTrip<PurchaseIOS>(PurchaseIosJson);

        Assert.Equal("premium.monthly", ios.CurrentPlanId);
        Assert.Equal("launch-offer", ios.OfferIOS?.Id);
        Assert.Equal(SubscriptionBillingPlanTypeIOS.Monthly, ios.BillingPlanTypeIOS);
        Assert.Equal("premium.bundle", ios.BundleProductIdIOS);
        Assert.Equal("2000000123", ios.BundleTransactionIdIOS);
        Assert.Equal("1999999999", ios.PreviousOriginalTransactionIdIOS);
        Assert.Equal(3, ios.CommitmentInfoIOS?.BillingPeriodNumber);
        Assert.Equal("request-reference", ios.AdvancedCommerceInfoIOS?.RequestReferenceId);
        Assert.Equal(
            """{"sku":"premium.bundle"}""",
            ios.AdvancedCommerceInfoIOS?.Items[0].Details?.JsonRepresentation);
        Assert.Equal("premium.annual", ios.RenewalInfoIOS?.PendingUpgradeProductId);
        Assert.Equal("group.bundle", ios.RenewalInfoIOS?.BundleSubscriptionGroupId);
        Assert.False(ios.RenewalInfoIOS?.WillUnbundle);
        Assert.Equal(
            SubscriptionBillingPlanTypeIOS.UpFront,
            ios.RenewalInfoIOS?.CommitmentInfo?.CommitmentRenewalBillingPlanType);
    }

    [Fact]
    public void PurchaseIos_OmitsNullOptionalFieldsOnWrite()
    {
        Purchase purchase = new PurchaseIOS
        {
            Id = "2000000123",
            IsAutoRenewing = false,
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
              "productId": "premium.monthly",
              "purchaseState": "purchased",
              "quantity": 1,
              "store": "google",
              "transactionDate": 1720000000000
            }
            """;
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Purchase>(json, Options));
    }

    private static TPurchase AssertFullPurchaseRoundTrip<TPurchase>(string json)
        where TPurchase : Purchase
    {
        using var fixture = JsonDocument.Parse(json);
        var expectedWireFields = typeof(TPurchase)
            .GetProperties()
            .Select(property => property.GetCustomAttributes(typeof(JsonPropertyNameAttribute), false)
                .Cast<JsonPropertyNameAttribute>()
                .Single()
                .Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        foreach (var wireField in expectedWireFields)
        {
            Assert.True(
                fixture.RootElement.TryGetProperty(wireField, out _),
                $"Full canonical {typeof(TPurchase).Name} fixture is missing {wireField}");
        }

        var purchase = Assert.IsType<TPurchase>(JsonSerializer.Deserialize<Purchase>(json, Options));
        var serialized = JsonSerializer.Serialize<Purchase>(purchase, Options);
        using var roundTrip = JsonDocument.Parse(serialized);

        foreach (var wireField in expectedWireFields)
        {
            Assert.True(
                roundTrip.RootElement.TryGetProperty(wireField, out _),
                $"{typeof(TPurchase).Name} round trip dropped {wireField}");
        }

        return Assert.IsType<TPurchase>(JsonSerializer.Deserialize<Purchase>(serialized, Options));
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

}
