// Convert native error payloads into the typed `PurchaseError` record so the
// C# resolver layer can re-throw a uniform exception (`OpenIapException`)
// regardless of which platform fired the error.

#nullable enable

using System;
using System.Text.Json;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>
/// Exception type thrown by every resolver method. Carries the typed
/// <see cref="OpenIap.PurchaseError"/> as <see cref="Error"/>.
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
    /// the OpenIapMauiModule's purchase-error listener emits.
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

    public static PurchaseError FromCodeMessage(
        string code,
        string message,
        string? productId = null,
        string? debugMessage = null)
    {
        var ec = TryParseErrorCode(code);
        return new PurchaseError
        {
            Code = ec,
            Message = message,
            ProductId = productId,
            DebugMessage = debugMessage,
        };
    }

    public static OpenIapException Wrap(
        string code,
        string message,
        string? productId = null,
        string? debugMessage = null)
        => new(FromCodeMessage(code, message, productId, debugMessage));

    public static OpenIapException Wrap(
        ErrorCode code,
        string message,
        string? productId = null,
        string? debugMessage = null)
        => new(new PurchaseError
        {
            Code = code,
            Message = message,
            ProductId = productId,
            DebugMessage = debugMessage,
        });

    private static ErrorCode TryParseErrorCode(string raw)
    {
        try { return ErrorCodeExtensions.FromJson(raw); }
        catch { return ErrorCode.Unknown; }
    }
}
