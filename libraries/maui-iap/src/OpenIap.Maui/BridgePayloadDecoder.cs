#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>Strict decoders for authoritative native bridge results.</summary>
internal static class BridgePayloadDecoder
{
    internal static List<T> DecodeRequiredItems<T>(string json, string operation)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw Malformed(operation, "returned an empty envelope");

        JsonNode? node;
        try { node = JsonNode.Parse(json); }
        catch (JsonException) { throw Malformed(operation, "returned invalid JSON"); }

        if (node is not JsonObject envelope || envelope["items"] is not JsonArray items)
            throw Malformed(operation, "returned an envelope without an items array");

        return DecodeRequiredArray<T>(items, operation);
    }

    internal static List<T> DecodeRequiredArray<T>(JsonArray? array, string operation)
    {
        if (array is null)
            throw Malformed(operation, "returned no array payload");

        var result = new List<T>(array.Count);
        for (var index = 0; index < array.Count; index++)
        {
            var item = array[index];
            if (item is null)
                throw Malformed(operation, $"returned a null item at index {index}");

            try
            {
                var decoded = item.Deserialize<T>(JsonOptions.Default);
                if (decoded is null)
                    throw Malformed(operation, $"returned an undecodable item at index {index}");
                ValidatePurchase(decoded, operation, index);
                ValidateActiveSubscription(decoded, operation, index);
                result.Add(decoded);
            }
            catch (OpenIapException) { throw; }
            catch (Exception) when (item is not null)
            {
                throw Malformed(operation, $"returned a malformed item at index {index}");
            }
        }
        return result;
    }

    private static void ValidateActiveSubscription<T>(T decoded, string operation, int index)
    {
        if (decoded is not ActiveSubscription subscription)
            return;

        if (string.IsNullOrWhiteSpace(subscription.ProductId) ||
            string.IsNullOrWhiteSpace(subscription.TransactionId) ||
            !double.IsFinite(subscription.TransactionDate))
        {
            throw Malformed(operation, $"returned an active subscription with invalid identity at index {index}");
        }
    }

    private static void ValidatePurchase<T>(T decoded, string operation, int index)
    {
        if (decoded is not PurchaseCommon purchase)
            return;

        if (string.IsNullOrWhiteSpace(purchase.Id) ||
            string.IsNullOrWhiteSpace(purchase.ProductId) ||
            !double.IsFinite(purchase.TransactionDate) ||
            purchase.Ids?.Any(string.IsNullOrWhiteSpace) == true ||
            decoded is PurchaseIOS ios &&
                (string.IsNullOrWhiteSpace(ios.TransactionId) ||
                 ios.Store is not IapStore.Apple) ||
            decoded is PurchaseAndroid android &&
                android.Store != IapStore.Google &&
                android.Store != IapStore.Amazon &&
                android.Store != IapStore.Horizon)
        {
            throw Malformed(operation, $"returned a purchase with invalid identity at index {index}");
        }
    }

    private static OpenIapException Malformed(string operation, string reason)
        => OpenIapErrorMapper.Wrap(
            ErrorCode.BillingResponseJsonParseError,
            $"{operation} {reason}");
}
