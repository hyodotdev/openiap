// SKUs the app asked to buy, so the purchase flow can tell the user's own
// purchase from one the store redelivers.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

internal static class PurchaseRequests
{
    private static readonly HashSet<string> Requested = new(StringComparer.Ordinal);

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
        lock (Requested)
        {
            foreach (var sku in skus)
            {
                if (!string.IsNullOrEmpty(sku)) Requested.Add(sku);
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

    /// <summary>Whether the app asked for this purchase or the plan it changes to; clears the mark.</summary>
    public static bool Take(Purchase purchase)
    {
        string[] ids = [purchase.ProductId, .. (purchase as PurchaseAndroid)?.PendingPurchaseUpdateAndroid?.Products ?? []];
        lock (Requested) return ids.Count(Requested.Remove) > 0;
    }
}
