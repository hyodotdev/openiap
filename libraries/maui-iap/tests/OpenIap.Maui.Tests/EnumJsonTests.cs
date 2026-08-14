// Serialization contract for the generated enums in Types.cs. Every enum
// carries a hand-rolled JsonConverter emitting kebab-case and accepting
// kebab-case / SCREAMING_SNAKE / PascalCase. The ToJson/FromJson extension
// methods expose the same tables.

using System.Text.Json;
using Xunit;

namespace OpenIap.Maui.Tests;

public class EnumJsonTests
{
    private static void AssertRoundTripsAllValues<TEnum>(
        Func<TEnum, string> toJson,
        Func<string, TEnum> fromJson)
        where TEnum : struct, Enum
    {
        var values = Enum.GetValues<TEnum>();
        Assert.NotEmpty(values);
        foreach (var value in values)
        {
            // Extension-method mapping tables cover every member, both ways.
            var raw = toJson(value);
            Assert.False(string.IsNullOrEmpty(raw), $"{value} produced an empty raw string");
            Assert.Equal(value, fromJson(raw));

            // The attribute-attached JsonConverter agrees with the tables.
            var json = JsonSerializer.Serialize(value);
            Assert.Equal($"\"{raw}\"", json);
            Assert.Equal(value, JsonSerializer.Deserialize<TEnum>(json));
        }
    }

    [Fact]
    public void IapPlatform_RoundTripsAllValues()
        => AssertRoundTripsAllValues<IapPlatform>(IapPlatformExtensions.ToJson, IapPlatformExtensions.FromJson);

    [Fact]
    public void ErrorCode_RoundTripsAllValues()
        => AssertRoundTripsAllValues<ErrorCode>(ErrorCodeExtensions.ToJson, ErrorCodeExtensions.FromJson);

    [Fact]
    public void IapStore_RoundTripsAllValues()
        => AssertRoundTripsAllValues<IapStore>(IapStoreExtensions.ToJson, IapStoreExtensions.FromJson);

    [Fact]
    public void ProductType_RoundTripsAllValues()
        => AssertRoundTripsAllValues<ProductType>(ProductTypeExtensions.ToJson, ProductTypeExtensions.FromJson);

    [Fact]
    public void ProductQueryType_RoundTripsAllValues()
        => AssertRoundTripsAllValues<ProductQueryType>(ProductQueryTypeExtensions.ToJson, ProductQueryTypeExtensions.FromJson);

    [Fact]
    public void PurchaseState_RoundTripsAllValues()
        => AssertRoundTripsAllValues<PurchaseState>(PurchaseStateExtensions.ToJson, PurchaseStateExtensions.FromJson);

    [Fact]
    public void IapkitPurchaseState_RoundTripsAllValues()
        => AssertRoundTripsAllValues<IapkitPurchaseState>(IapkitPurchaseStateExtensions.ToJson, IapkitPurchaseStateExtensions.FromJson);

    [Fact]
    public void IapkitClientPayloadFormat_RoundTripsAllValues()
        => AssertRoundTripsAllValues<IapkitClientPayloadFormat>(IapkitClientPayloadFormatExtensions.ToJson, IapkitClientPayloadFormatExtensions.FromJson);

    [Theory]
    [InlineData(IapPlatform.IOS, "ios")]
    [InlineData(IapPlatform.Android, "android")]
    public void IapPlatform_SerializesToLowercase(IapPlatform value, string expected)
    {
        Assert.Equal(expected, value.ToJson());
        Assert.Equal($"\"{expected}\"", JsonSerializer.Serialize(value));
    }

    [Theory]
    [InlineData("ios", IapPlatform.IOS)]
    [InlineData("IOS", IapPlatform.IOS)]
    [InlineData("android", IapPlatform.Android)]
    [InlineData("ANDROID", IapPlatform.Android)]
    [InlineData("Android", IapPlatform.Android)]
    public void IapPlatform_AcceptsAllDocumentedCasings(string raw, IapPlatform expected)
        => Assert.Equal(expected, JsonSerializer.Deserialize<IapPlatform>($"\"{raw}\""));

    [Fact]
    public void IapPlatform_RejectsUnknownRawValue()
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<IapPlatform>("\"windows\""));
        // Mixed-case "Ios" is deliberately not in the generated table.
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<IapPlatform>("\"Ios\""));
    }

    [Theory]
    [InlineData("user-cancelled", ErrorCode.UserCancelled)]
    [InlineData("USER_CANCELLED", ErrorCode.UserCancelled)]
    [InlineData("UserCancelled", ErrorCode.UserCancelled)]
    [InlineData("sku-offer-mismatch", ErrorCode.SkuOfferMismatch)]
    [InlineData("SKU_OFFER_MISMATCH", ErrorCode.SkuOfferMismatch)]
    [InlineData("purchase-verification-finish-failed", ErrorCode.PurchaseVerificationFinishFailed)]
    public void ErrorCode_AcceptsAllDocumentedCasings(string raw, ErrorCode expected)
    {
        Assert.Equal(expected, ErrorCodeExtensions.FromJson(raw));
        Assert.Equal(expected, JsonSerializer.Deserialize<ErrorCode>($"\"{raw}\""));
    }

    [Fact]
    public void ErrorCode_SerializesToKebabCase()
    {
        Assert.Equal("user-cancelled", ErrorCode.UserCancelled.ToJson());
        Assert.Equal("\"billing-response-json-parse-error\"", JsonSerializer.Serialize(ErrorCode.BillingResponseJsonParseError));
    }

    [Fact]
    public void ErrorCode_DegradesUnknownRawValue()
    {
        Assert.Equal(ErrorCode.Unknown, ErrorCodeExtensions.FromJson("no-such-code"));
        Assert.Equal(ErrorCode.Unknown, JsonSerializer.Deserialize<ErrorCode>("\"no-such-code\""));
    }

    [Fact]
    public void InAppMessageInput_RejectsUnknownAndMalformedCategories()
    {
        var known = JsonSerializer.Deserialize<InAppMessageParamsAndroid>(
            """{"categories":["unknown-in-app-message-category-id"]}""");
        Assert.Equal(InAppMessageCategoryAndroid.UnknownInAppMessageCategoryId, Assert.Single(known!.Categories!));

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<InAppMessageParamsAndroid>(
            """{"categories":["future-category"]}"""));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<InAppMessageParamsAndroid>(
            """{"categories":[999]}"""));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<InAppMessageParamsAndroid>(
            """{"categories":"transactional"}"""));
    }

    [Fact]
    public void RequestEnumInputs_RejectNonStringTokensAsJsonErrors()
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<DeveloperBillingOptionParamsAndroid>(
            """{"billingProgram":7}"""));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<InitConnectionConfig>(
            """{"enableBillingProgramAndroid":true}"""));
    }

    [Theory]
    [InlineData(ProductType.InApp, "in-app")]
    [InlineData(ProductType.Subs, "subs")]
    public void ProductType_SerializesToKebabCase(ProductType value, string expected)
        => Assert.Equal(expected, value.ToJson());

    [Fact]
    public void ProductTypeIOS_MapsStoreKitNames()
    {
        Assert.Equal(ProductTypeIOS.AutoRenewableSubscription, ProductTypeIOSExtensions.FromJson("auto-renewable-subscription"));
        Assert.Equal(ProductTypeIOS.AutoRenewableSubscription, ProductTypeIOSExtensions.FromJson("AUTO_RENEWABLE_SUBSCRIPTION"));
        Assert.Equal("non-consumable", ProductTypeIOS.NonConsumable.ToJson());
    }
}
