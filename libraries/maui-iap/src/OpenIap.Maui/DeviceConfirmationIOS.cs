// On-device App Store confirmation, ported from
// specs/client/src/purchase-flow-confirmers.ts.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

internal static class DeviceConfirmationIOSImplementation
{
    /// <summary>
    /// <see cref="OpenIapClient.ConfirmOnDeviceIOS"/>, given a
    /// <c>GetPendingTransactionsIOSAsync</c>. StoreKit verified the transaction
    /// if it lists it as unfinished, or, for a purchase the flow already
    /// finished, in <paramref name="getTransactionHistoryIOS"/>, from the
    /// purchase's environment. A revoked or upgraded one is invalid, and an
    /// expired one delayed, since billing grace can still cover it;
    /// <paramref name="grant"/> runs before an unfinished one is finished, and
    /// again for a finished non-consumable a restore reads. Tests pass their
    /// own <paramref name="clock"/>, in Unix ms.
    /// </summary>
    internal static PurchaseConfirmer Create(
        Func<Task<IReadOnlyList<PurchaseIOS>>> getPendingTransactionsIOS,
        PurchaseGranter? grant = null,
        Func<long>? clock = null,
        Func<Task<IReadOnlyList<Purchase>>>? getTransactionHistoryIOS = null)
    {
        ArgumentNullException.ThrowIfNull(getPendingTransactionsIOS);
        clock ??= () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return async (purchase, isConsumable) =>
        {
            IapkitConfirmationImplementation.RequireGrant("ConfirmOnDeviceIOS", purchase, isConsumable, grant);
            // A community provider may report the App Store under its own store id.
            if (purchase.Store != IapStore.Apple || purchase.StoreId != "apple")
            {
                throw new InvalidOperationException(
                    $"Device confirmation covers App Store purchases, not {purchase.StoreId}");
            }
            var environment = (purchase as PurchaseIOS)?.EnvironmentIOS;
            bool IsSame(PurchaseIOS candidate) =>
                !string.IsNullOrEmpty(purchase.Id) &&
                candidate.Store == IapStore.Apple &&
                candidate.Id == purchase.Id &&
                candidate.ProductId == purchase.ProductId &&
                (environment is null || candidate.EnvironmentIOS == environment);
            var pending = (await getPendingTransactionsIOS().ConfigureAwait(false)).FirstOrDefault(IsSame);
            var transaction = pending;
            if (transaction is null && getTransactionHistoryIOS is not null)
            {
                var history = await getTransactionHistoryIOS().ConfigureAwait(false);
                transaction = history.OfType<PurchaseIOS>().FirstOrDefault(IsSame);
            }
            if (transaction is null)
            {
                throw new InvalidOperationException(
                    $"StoreKit lists no transaction for {purchase.ProductId}");
            }
            if (transaction.RevocationDateIOS is not null) return new PurchaseConfirmation.Invalid("revoked");
            if (transaction.IsUpgradedIOS == true) return new PurchaseConfirmation.Invalid("upgraded");
            // After the reads: a transaction can expire while StoreKit answers.
            if (transaction.ExpirationDateIOS is { } expiration && expiration <= clock())
            {
                return new PurchaseConfirmation.VerificationDelayed(ExpiredRetryMs);
            }
            // A finished consumable was credited before it was consumed.
            if ((pending is not null || !isConsumable) && grant is not null)
            {
                await grant(purchase, isConsumable).ConfigureAwait(false);
            }
            return new PurchaseConfirmation.Entitled(AlreadyGranted: pending is null);
        };
    }

    // An expired App Store receipt may still be in billing grace; check it again.
    private const double ExpiredRetryMs = 30_000;
}


[Obsolete("Use OpenIapClient.ConfirmOnDeviceIOS. Removed in the next major release.")]
public static class DeviceConfirmationIOS
{
    public static PurchaseConfirmer Create(
        Func<Task<IReadOnlyList<PurchaseIOS>>> getPendingTransactionsIOS,
        PurchaseGranter? grant = null) =>
        DeviceConfirmationIOSImplementation.Create(getPendingTransactionsIOS, grant);
}
