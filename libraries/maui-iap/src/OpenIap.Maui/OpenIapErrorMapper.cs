// Convert native error payloads into the typed `PurchaseError` record so the
// C# resolver layer can re-throw a uniform exception (`OpenIapException`)
// regardless of which platform fired the error.

#nullable enable

using System;
using System.Text.Json;
using Hyo.OpenIap;

namespace Hyo.OpenIap.Maui;

/// <summary>
/// Exception type thrown by every resolver method. Carries the typed
/// <see cref="Hyo.OpenIap.PurchaseError"/> as <see cref="Error"/>.
/// </summary>
public sealed class OpenIapException : Exception
{
    public PurchaseError Error { get; }

    public OpenIapException(PurchaseError error) : base(error.Message)
    {
        Error = error;
    }
}

internal static class OpenIapErrorMapper
{
    /// <summary>
    /// Build a typed <see cref="PurchaseError"/> from the JSON payload that
    /// the OpenIapMauiShim's purchase-error listener emits.
    /// </summary>
    public static PurchaseError FromJson(string json)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<PurchaseError>(json, JsonOptions.Default);
            if (parsed is not null) return parsed;
        }
        catch (JsonException) { /* fall through to fallback */ }

        return new PurchaseError
        {
            Code = ErrorCode.Unknown,
            Message = string.IsNullOrEmpty(json) ? "Unknown error" : json,
        };
    }

    public static PurchaseError FromCodeMessage(string code, string message, string? productId = null)
    {
        var ec = TryParseErrorCode(code);
        return new PurchaseError
        {
            Code = ec,
            Message = message,
            ProductId = productId,
        };
    }

    public static OpenIapException Wrap(string code, string message, string? productId = null)
        => new(FromCodeMessage(code, message, productId));

    public static OpenIapException Wrap(ErrorCode code, string message, string? productId = null)
        => new(new PurchaseError { Code = code, Message = message, ProductId = productId });

    private static ErrorCode TryParseErrorCode(string raw)
    {
        try { return ErrorCodeExtensions.FromJson(raw); }
        catch { return ErrorCode.Unknown; }
    }
}
