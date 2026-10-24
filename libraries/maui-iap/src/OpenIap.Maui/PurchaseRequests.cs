// When the app asked for each SKU, so the flow can tell the user's purchase from a store redelivery.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

internal static class PurchaseRequests
{
    // PURCHASE_REQUEST_CLOCK_SKEW_MS in specs/client/src/purchase-flow.ts: device clocks run ahead.
    private const double ClockSkewMs = 600_000;

    private static readonly Dictionary<string, double> Requested = new(StringComparer.Ordinal);

    /// <summary>Marks the request's SKUs, the target of a plan change included, and clears every mark if it fails.</summary>
    public static async Task<T> Track<T>(RequestPurchaseProps request, Func<Task<T>> send)
    {
        string?[] skus =
        [
            request.RequestPurchase?.Apple?.Sku,
            request.RequestSubscription?.Apple?.Sku,
            .. request.RequestPurchase?.Google?.Skus ?? [],
            .. request.RequestSubscription?.Google?.Skus ?? [],
        ];
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (Requested)
        {
            foreach (var sku in skus)
            {
                if (!string.IsNullOrEmpty(sku)) Requested[sku] = now;
            }
        }
        try
        {
            return await send().ConfigureAwait(false);
        }
        catch
        {
            Clear();
            throw;
        }
    }

    public static void Clear()
    {
        lock (Requested) Requested.Clear();
    }

    /// <summary>A purchase made after the app asked for it, or a plan change to what it asked for; clears the mark.</summary>
    public static bool Take(Purchase purchase)
    {
        var changes = (purchase as PurchaseAndroid)?.PendingPurchaseUpdateAndroid?.Products ?? [];
        lock (Requested)
        {
            // A receipt older than the request is a store redelivery.
            var bought = Requested.TryGetValue(purchase.ProductId, out var askedAt)
                && purchase.TransactionDate >= askedAt - ClockSkewMs
                && Requested.Remove(purchase.ProductId);
            return changes.Count(Requested.Remove) > 0 || bought;
        }
    }
}
