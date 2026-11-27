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

    // When each live request asked for each SKU, oldest first.
    private static readonly Dictionary<string, List<double>> Requested = new(StringComparer.Ordinal);
    // Each request marks a distinct time, so an undo removes only its own mark.
    private static double lastMarkedAt;

    /// <summary>Marks the request's SKUs, a plan change's target included; a failed request undoes only its own marks.</summary>
    public static async Task<T> Track<T>(RequestPurchaseProps request, Func<Task<T>> send)
    {
        string?[] skus =
        [
            request.RequestPurchase?.Apple?.Sku,
            request.RequestSubscription?.Apple?.Sku,
            .. request.RequestPurchase?.Google?.Skus ?? [],
            .. request.RequestSubscription?.Google?.Skus ?? [],
        ];
        var marked = skus.OfType<string>().Where(sku => sku.Length > 0).ToHashSet(StringComparer.Ordinal);
        double now;
        lock (Requested)
        {
            now = Math.Max(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), lastMarkedAt + 1);
            lastMarkedAt = now;
            foreach (var sku in marked)
            {
                if (!Requested.TryGetValue(sku, out var live)) Requested[sku] = live = [];
                live.Add(now);
            }
        }
        try
        {
            return await send().ConfigureAwait(false);
        }
        catch
        {
            lock (Requested)
            {
                foreach (var sku in marked)
                {
                    if (Requested.TryGetValue(sku, out var live) && live.Remove(now) && live.Count == 0) Requested.Remove(sku);
                }
            }
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
            var bought = Requested.TryGetValue(purchase.ProductId, out var live)
                && purchase.TransactionDate >= live[0] - ClockSkewMs
                && TakeMark(purchase.ProductId);
            // A plan change within the same product answers one request, not two.
            return changes.Distinct().Where(sku => !bought || sku != purchase.ProductId).Count(TakeMark) > 0 || bought;
        }
    }

    // Removes the oldest live mark for the SKU, which the matching purchase answers. Caller holds the lock.
    private static bool TakeMark(string sku)
    {
        if (!Requested.TryGetValue(sku, out var live)) return false;
        live.RemoveAt(0);
        if (live.Count == 0) Requested.Remove(sku);
        return true;
    }
}
