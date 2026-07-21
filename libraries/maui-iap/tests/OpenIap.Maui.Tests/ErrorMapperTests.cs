// OpenIapErrorMapper turns native error payloads (JSON or code/message pairs)
// into the typed PurchaseError carried by OpenIapException. The mapper is
// internal (used by the platform resolvers) and reached via InternalsVisibleTo.

using Xunit;

namespace OpenIap.Maui.Tests;

public class ErrorMapperTests
{
    [Fact]
    public void FromJson_ParsesTypedPurchaseErrorPayload()
    {
        const string json = """
            {
              "code": "sku-not-found",
              "message": "SKU missing from store",
              "productId": "coins.100",
              "responseCode": 4
            }
            """;

        var error = OpenIapErrorMapper.FromJson(json);

        Assert.Equal(ErrorCode.SkuNotFound, error.Code);
        Assert.Equal("SKU missing from store", error.Message);
        Assert.Equal("coins.100", error.ProductId);
        Assert.Equal(4, error.ResponseCode);
    }

    [Fact]
    public void FromJson_AcceptsScreamingSnakeCodes()
    {
        const string json = """{"code":"USER_CANCELLED","message":"cancelled"}""";
        Assert.Equal(ErrorCode.UserCancelled, OpenIapErrorMapper.FromJson(json).Code);
    }

    [Fact]
    public void FromJson_FallsBackToUnknownForMalformedJson()
    {
        var error = OpenIapErrorMapper.FromJson("{not json at all");

        Assert.Equal(ErrorCode.Unknown, error.Code);
        // The raw payload is preserved as the message for debugging.
        Assert.Equal("{not json at all", error.Message);
    }

    [Fact]
    public void FromJson_FallsBackToUnknownErrorForEmptyPayload()
    {
        var error = OpenIapErrorMapper.FromJson(string.Empty);

        Assert.Equal(ErrorCode.Unknown, error.Code);
        Assert.Equal("Unknown error", error.Message);
    }

    [Fact]
    public void FromJson_FallsBackWhenPayloadIsJsonNull()
    {
        var error = OpenIapErrorMapper.FromJson("null");

        Assert.Equal(ErrorCode.Unknown, error.Code);
        Assert.Equal("null", error.Message);
    }

    [Fact]
    public void FromCodeMessage_MapsKnownCodeAndCarriesDetails()
    {
        var error = OpenIapErrorMapper.FromCodeMessage(
            "already-owned",
            "Item already owned",
            productId: "premium.monthly",
            debugMessage: "billing response 7");

        Assert.Equal(ErrorCode.AlreadyOwned, error.Code);
        Assert.Equal("Item already owned", error.Message);
        Assert.Equal("premium.monthly", error.ProductId);
        Assert.Equal("billing response 7", error.DebugMessage);
    }

    [Fact]
    public void FromCodeMessage_FallsBackToUnknownForUnmappedCode()
    {
        var error = OpenIapErrorMapper.FromCodeMessage("totally-new-code", "boom");

        Assert.Equal(ErrorCode.Unknown, error.Code);
        Assert.Equal("boom", error.Message);
    }

    [Fact]
    public void Wrap_StringCode_BuildsExceptionWithTypedError()
    {
        var exception = OpenIapErrorMapper.Wrap("network-error", "offline", productId: "coins.100");

        Assert.Equal(ErrorCode.NetworkError, exception.Error.Code);
        Assert.Equal("coins.100", exception.Error.ProductId);
        // Exception.Message mirrors the typed error's message.
        Assert.Equal("offline", exception.Message);
    }

    [Fact]
    public void Wrap_EnumCode_BuildsExceptionWithTypedError()
    {
        var exception = OpenIapErrorMapper.Wrap(
            ErrorCode.DeferredPayment,
            "pending approval",
            debugMessage: "ask-to-buy");

        Assert.Equal(ErrorCode.DeferredPayment, exception.Error.Code);
        Assert.Equal("pending approval", exception.Message);
        Assert.Equal("ask-to-buy", exception.Error.DebugMessage);
    }

    [Fact]
    public void OpenIapException_ExposesErrorAndMessage()
    {
        // Public-surface contract: any PurchaseError can be wrapped directly.
        var error = new PurchaseError
        {
            Code = ErrorCode.ServiceError,
            Message = "store unavailable",
        };

        var exception = new OpenIapException(error);

        Assert.Same(error, exception.Error);
        Assert.Equal("store unavailable", exception.Message);
    }
}
