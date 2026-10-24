// On-device App Store confirmation, ported from
// specs/client/src/purchase-flow-confirmers.ts.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

internal static class DeviceConfirmationIOS
{
    /// <summary>
    /// <see cref="OpenIapClient.ConfirmOnDeviceIOS"/>, given a
    /// <c>GetPendingTransactionsIOSAsync</c>. StoreKit verified the transaction
    /// if it is still unfinished, unrevoked, not upgraded, unexpired, and from
    /// the purchase's environment; <paramref name="grant"/> then runs before
    /// the flow finishes it. Tests pass their own <paramref name="clock"/>, in Unix ms.
    /// </summary>
    public static PurchaseConfirmer Create(
        Func<Task<IReadOnlyList<PurchaseIOS>>> getPendingTransactionsIOS,
        PurchaseGranter? grant = null,
        Func<long>? clock = null)
    {
        ArgumentNullException.ThrowIfNull(getPendingTransactionsIOS);
        clock ??= () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return async (purchase, isConsumable) =>
        {
            IapkitConfirmation.RequireGrant("ConfirmOnDeviceIOS", purchase, isConsumable, grant);
            // A community provider may report the App Store under its own store id.
            if (purchase.Store != IapStore.Apple || purchase.StoreId != "apple")
            {
                throw new InvalidOperationException(
                    $"Device confirmation covers App Store purchases, not {purchase.StoreId}");
            }
            var environment = (purchase as PurchaseIOS)?.EnvironmentIOS;
            var pending = await getPendingTransactionsIOS().ConfigureAwait(false);
            // After the query: a transaction can expire while StoreKit answers.
            var now = clock();
            var verified = !string.IsNullOrEmpty(purchase.Id) && pending.Any(candidate =>
                candidate.Store == IapStore.Apple &&
                candidate.Id == purchase.Id &&
                candidate.ProductId == purchase.ProductId &&
                candidate.RevocationDateIOS is null &&
                candidate.IsUpgradedIOS != true &&
                (candidate.ExpirationDateIOS is null || candidate.ExpirationDateIOS > now) &&
                (environment is null || candidate.EnvironmentIOS == environment));
            if (!verified)
            {
                throw new InvalidOperationException(
                    $"StoreKit lists no valid unfinished transaction for {purchase.ProductId}");
            }
            if (grant is not null) await grant(purchase, isConsumable).ConfigureAwait(false);
            return new PurchaseConfirmation.Entitled(AlreadyGranted: false);
        };
    }
}
