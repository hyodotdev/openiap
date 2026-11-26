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
    // Each request marks a distinct time, so an undo never takes another's mark.
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
        double now;
        var previous = new Dictionary<string, double?>(StringComparer.Ordinal);
        lock (Requested)
        {
            now = Math.Max(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), lastMarkedAt + 1);
            lastMarkedAt = now;
            foreach (var sku in skus)
            {
                if (string.IsNullOrEmpty(sku)) continue;
                if (!previous.ContainsKey(sku)) previous[sku] = Requested.TryGetValue(sku, out var askedAt) ? askedAt : null;
                Requested[sku] = now;
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
                foreach (var (sku, askedAt) in previous)
                {
                    if (!Requested.TryGetValue(sku, out var current) || current != now) continue;
                    if (askedAt is { } earlier) Requested[sku] = earlier;
                    else Requested.Remove(sku);
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
            var bought = Requested.TryGetValue(purchase.ProductId, out var askedAt)
                && purchase.TransactionDate >= askedAt - ClockSkewMs
                && Requested.Remove(purchase.ProductId);
            return changes.Count(Requested.Remove) > 0 || bought;
        }
    }
}
