// Purchase flow shared by every OpenIAP SDK, ported from
// specs/client/src/purchase-flow.ts. The app's backend, or IAPKit directly with
// a publishable key, confirms each purchase; this class decides when the app
// may finish a transaction, and makes no network calls of its own. The shared
// vectors run in tests/OpenIap.Maui.Tests.
// Guide: https://kit.openiap.dev/docs/purchase-flow

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>Body the app sends its backend, which takes the user from its own session.</summary>
/// <param name="Store">Apple or Google.</param>
/// <param name="PurchaseToken">Apple JWS or Google Play purchase token, forwarded to IAPKit as is.</param>
/// <param name="ProductId">The product the app expected; IAPKit rejects a store mismatch.</param>
public sealed record PurchaseConfirmationRequest(
    [property: JsonPropertyName("store")] IapStore Store,
    [property: JsonPropertyName("purchaseToken")] string PurchaseToken,
    [property: JsonPropertyName("productId")] string ProductId)
{
    /// <summary>Builds the backend request body; throws for a purchase without Apple or Google evidence.</summary>
    public static PurchaseConfirmationRequest FromPurchase(Purchase purchase)
    {
        ArgumentNullException.ThrowIfNull(purchase);
        if (purchase.Store is not (IapStore.Apple or IapStore.Google) || string.IsNullOrEmpty(purchase.PurchaseToken))
        {
            throw new InvalidOperationException(
                $"Purchase {purchase.ProductId} has no Apple or Google purchase token to confirm");
        }
        PurchaseFlow.AssertSupportedPurchase(purchase);
        return new PurchaseConfirmationRequest(purchase.Store, purchase.PurchaseToken, purchase.ProductId);
    }
}

/// <summary>
/// The app backend's verdict on one purchase. Only <see cref="Entitled"/> grants
/// access; <see cref="Verified"/> and <see cref="Linked"/> mean the purchase is
/// valid but access is not granted yet. <see cref="Invalid"/> and
/// <see cref="TestAccountRestricted"/> are settled rejections: answer
/// <see cref="VerificationDelayed"/> for anything that may still change.
/// </summary>
public abstract record PurchaseConfirmation
{
    private PurchaseConfirmation() { }

    public sealed record StorePending : PurchaseConfirmation;
    public sealed record VerificationDelayed(double RetryAfterMs) : PurchaseConfirmation;
    /// <summary><paramref name="AlreadyGranted"/>: another account already got access, which lets the app finish it.</summary>
    public sealed record OwnershipConflict(bool AlreadyGranted) : PurchaseConfirmation;
    public sealed record TestAccountRestricted : PurchaseConfirmation;
    public sealed record Invalid(string? Reason = null) : PurchaseConfirmation;
    public sealed record Verified(double? RetryAfterMs = null) : PurchaseConfirmation;
    public sealed record Linked(double? RetryAfterMs = null) : PurchaseConfirmation;
    public sealed record Entitled(bool AlreadyGranted) : PurchaseConfirmation;

    /// <summary>
    /// Reads the backend's JSON answer. Returns null for anything off-contract,
    /// which the flow reports as <see cref="PurchaseFlowStatus.Failed"/>, so a
    /// malformed body can never finish a transaction.
    /// </summary>
    public static PurchaseConfirmation? FromJson(string? json)
    {
        JsonElement body;
        try
        {
            using var document = JsonDocument.Parse(json ?? "null");
            body = document.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
        if (body.ValueKind != JsonValueKind.Object) return null;

        string? Text(string name) =>
            body.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        double? retry = body.TryGetProperty("retryAfterMs", out var hint)
            && hint.ValueKind == JsonValueKind.Number
            && hint.TryGetDouble(out var delay)
                ? delay
                : null;
        bool? alreadyGranted = body.TryGetProperty("alreadyGranted", out var granted)
            && granted.ValueKind is JsonValueKind.True or JsonValueKind.False
                ? granted.GetBoolean()
                : null;

        return Read(Text("status") switch
        {
            "store_pending" => new StorePending(),
            "test_account_restricted" => new TestAccountRestricted(),
            "invalid" => new Invalid(Text("reason")),
            "verification_delayed" when retry is { } retryMs => new VerificationDelayed(retryMs),
            "verified" => new Verified(retry),
            "linked" => new Linked(retry),
            "ownership_conflict" when alreadyGranted is { } value => new OwnershipConflict(value),
            "entitled" when alreadyGranted is { } value => new Entitled(value),
            _ => null,
        });
    }

    // A retry hint must be a finite, non-negative delay, whether it came from JSON or from code.
    internal static PurchaseConfirmation? Read(PurchaseConfirmation? confirmation) => confirmation switch
    {
        VerificationDelayed delayed => IsDelay(delayed.RetryAfterMs) ? delayed : null,
        Verified { RetryAfterMs: { } ms } verified when !IsDelay(ms) => verified with { RetryAfterMs = null },
        Linked { RetryAfterMs: { } ms } linked when !IsDelay(ms) => linked with { RetryAfterMs = null },
        _ => confirmation,
    };

    private static bool IsDelay(double ms) => double.IsFinite(ms) && ms >= 0;
}

/// <summary>
/// Where a purchase stands after the flow ran. A <c>FinishError</c> means
/// finishing failed and recovery retries it; an <see cref="Entitled"/> status
/// still grants access.
/// </summary>
public abstract record PurchaseFlowStatus
{
    private PurchaseFlowStatus() { }

    public sealed record StorePending : PurchaseFlowStatus;
    public sealed record VerificationDelayed(double RetryAfterMs) : PurchaseFlowStatus;
    public sealed record OwnershipConflict(bool AlreadyGranted, Exception? FinishError = null) : PurchaseFlowStatus;
    public sealed record TestAccountRestricted(Exception? FinishError = null) : PurchaseFlowStatus;
    /// <summary><paramref name="Recovered"/>: recovery found this purchase; the user did not just buy it.</summary>
    public sealed record Invalid(string? Reason = null, Exception? FinishError = null, bool Recovered = false) : PurchaseFlowStatus;
    public sealed record Verified(double? RetryAfterMs = null) : PurchaseFlowStatus;
    public sealed record Linked(double? RetryAfterMs = null) : PurchaseFlowStatus;
    /// <summary>
    /// <paramref name="ChangePending"/>: a requested upgrade, downgrade, or prepaid
    /// top-up has not applied yet (Google Play waits for its payment, Amazon
    /// applies it at the next renewal), so access stays on the current plan.
    /// </summary>
    public sealed record Entitled(bool AlreadyGranted, Exception? FinishError = null, bool ChangePending = false) : PurchaseFlowStatus;
    public sealed record Failed(Exception Error) : PurchaseFlowStatus;

    /// <summary>Neutral guidance the app maps to its own copy.</summary>
    public PurchaseFlowGuidance Describe() => this switch
    {
        StorePending => new(PurchaseFlowGuidanceKey.PaymentPending, false),
        VerificationDelayed delayed => new(PurchaseFlowGuidanceKey.VerificationDelayed, false, delayed.RetryAfterMs),
        OwnershipConflict => new(PurchaseFlowGuidanceKey.OwnedByAnotherAccount, false),
        TestAccountRestricted => new(PurchaseFlowGuidanceKey.TestPurchaseNotAccepted, false),
        Invalid invalid => new(PurchaseFlowGuidanceKey.PurchaseNotValid, !invalid.Recovered),
        Verified verified => new(PurchaseFlowGuidanceKey.AccessPending, false, verified.RetryAfterMs),
        Linked linked => new(PurchaseFlowGuidanceKey.AccessPending, false, linked.RetryAfterMs),
        Entitled entitled => new(
            entitled.ChangePending ? PurchaseFlowGuidanceKey.ChangePending : PurchaseFlowGuidanceKey.AccessGranted,
            false),
        _ => new(PurchaseFlowGuidanceKey.TryAgainLater, false),
    };
}

public enum PurchaseFlowGuidanceKey
{
    PaymentPending,
    ChangePending,
    VerificationDelayed,
    OwnedByAnotherAccount,
    TestPurchaseNotAccepted,
    PurchaseNotValid,
    AccessPending,
    AccessGranted,
    TryAgainLater,
}

/// <param name="OfferPurchase">
/// True only for an invalid purchase the user just made. False whenever the
/// user may already have paid: never ask them to buy again.
/// </param>
/// <param name="RetryAfterMs">Earliest time to run the purchase through the flow again.</param>
public sealed record PurchaseFlowGuidance(PurchaseFlowGuidanceKey Key, bool OfferPurchase, double? RetryAfterMs = null);

public sealed record PurchaseFlowOutcome(Purchase Purchase, PurchaseFlowStatus Status);

/// <summary>Confirms one purchase; see <see cref="PurchaseFlowOptions.ConfirmWithBackend"/>.</summary>
public delegate Task<PurchaseConfirmation?> PurchaseConfirmer(Purchase purchase, bool isConsumable);

/// <summary>Finishes one purchase, consuming it when <paramref name="isConsumable"/> is true.</summary>
public delegate Task PurchaseFinisher(Purchase purchase, bool isConsumable);

/// <summary>Gives the user what they bought; see <see cref="IapkitConfirmationOptions.Grant"/>.</summary>
public delegate Task PurchaseGranter(Purchase purchase, bool isConsumable);

/// <summary>
/// What a <see cref="PurchaseFlow"/> calls. <see cref="OpenIapClient.CreatePurchaseFlow"/>
/// fills every store function left null with this library's; <c>new PurchaseFlow(...)</c>
/// uses only what is set and requires <see cref="FinishTransaction"/> and
/// <see cref="GetAvailablePurchases"/>.
/// </summary>
public sealed record PurchaseFlowOptions
{
    /// <summary>
    /// Confirms the purchase and grants access before it answers
    /// <see cref="PurchaseConfirmation.Entitled"/>: the flow finishes, and so
    /// consumes, the purchase right after. Usually a call to the app backend,
    /// which holds the IAPKit secret key; an app without one passes
    /// <see cref="OpenIapClient.ConfirmWithIapkit"/>. Read a JSON answer with
    /// <see cref="PurchaseConfirmation.FromJson"/>; null fails the purchase.
    /// </summary>
    public required PurchaseConfirmer ConfirmWithBackend { get; init; }

    /// <summary>How long <see cref="ConfirmWithBackend"/> may take before the purchase ends as failed, so a hung call cannot hold it for the session.</summary>
    public TimeSpan ConfirmTimeout { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>From the app's product config. On Android a wrong answer consumes a non-consumable or blocks rebuying a consumable.</summary>
    public required Func<string, bool> IsConsumable { get; init; }

    public PurchaseFinisher? FinishTransaction { get; init; }

    public Func<Task<IReadOnlyList<Purchase>>>? GetAvailablePurchases { get; init; }

    /// <summary>
    /// The SDK's <c>GetPendingTransactionsIOSAsync</c> on iOS, null elsewhere:
    /// off iOS an SDK may answer an empty list, which would hide unacknowledged
    /// Android purchases. Recovery reads unfinished StoreKit transactions,
    /// consumables included, from it. If it throws, recovery confirms every
    /// Apple purchase <see cref="GetAvailablePurchases"/> lists instead.
    /// </summary>
    public Func<Task<IReadOnlyList<Purchase>>>? GetPendingTransactionsIOS { get; init; }

    /// <summary>Registers for the store's purchase deliveries; the flow processes each one until disposed.</summary>
    public Func<Action<Purchase>, IDisposable>? ListenForPurchases { get; init; }

    /// <summary>
    /// Whether the user's own request produced a delivered purchase. Only then
    /// may an invalid delivery offer buying again; without this, no delivery
    /// the flow listened for does.
    /// </summary>
    public Func<Purchase, bool>? WasRequested { get; init; }

    /// <summary>
    /// Where <see cref="PurchaseFlow.OutcomePublished"/> runs. Null raises it on
    /// the thread that settled the purchase; then dispose the flow on that
    /// thread too, or an outcome being raised as it is disposed still arrives.
    /// </summary>
    public SynchronizationContext? OutcomeContext { get; init; }
}

/// <summary>
/// Confirms and finishes purchases. Single-product, single-unit purchases only.
/// Create one flow per authenticated app account, capture that session in
/// <see cref="PurchaseFlowOptions.ConfirmWithBackend"/>, and dispose the flow
/// after switching accounts.
/// </summary>
public sealed class PurchaseFlow : IDisposable
{
    // Task.WaitAsync accepts at most 0xFFFFFFFE ms; a longer timeout waits that long.
    private static readonly TimeSpan MaxConfirmTimeout = TimeSpan.FromMilliseconds(uint.MaxValue - 1);

    private readonly PurchaseFlowOptions _options;
    private readonly PurchaseFinisher _finishTransaction;
    private readonly Func<Task<IReadOnlyList<Purchase>>> _getAvailablePurchases;
    private readonly TimeSpan _confirmTimeout;
    private readonly object _gate = new();
    // A listener and a recovery pass can deliver the same transaction at once.
    private readonly Dictionary<string, Run> _runs = new(StringComparer.Ordinal);
    // Finished purchases, and rejections the store settles on its own. A
    // recovery pass can hold a store list read before the listener settled one.
    private readonly Dictionary<string, PurchaseFlowStatus> _settled = new(StringComparer.Ordinal);
    private readonly Dictionary<bool, Task<IReadOnlyList<PurchaseFlowOutcome>>> _recoveries = new();
    private readonly IDisposable? _subscription;
    private volatile bool _disposed;

    public PurchaseFlow(PurchaseFlowOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _options = options;
        _finishTransaction = options.FinishTransaction
            ?? throw new ArgumentException("FinishTransaction is required; OpenIapClient.CreatePurchaseFlow supplies the library's.", nameof(options));
        _getAvailablePurchases = options.GetAvailablePurchases
            ?? throw new ArgumentException("GetAvailablePurchases is required; OpenIapClient.CreatePurchaseFlow supplies the library's.", nameof(options));
        _confirmTimeout = options.ConfirmTimeout > MaxConfirmTimeout ? MaxConfirmTimeout : options.ConfirmTimeout;
        _subscription = options.ListenForPurchases?.Invoke(purchase =>
            _ = Deliver(purchase, options.WasRequested?.Invoke(purchase) ?? false, reconfirm: false));
    }

    /// <summary>
    /// Every outcome: once per confirmation, however many deliveries shared it,
    /// and once per delivery of an already settled purchase.
    /// </summary>
    public event EventHandler<PurchaseFlowOutcome>? OutcomePublished;

    /// <summary>
    /// Confirms one purchase the user just bought. Finishes it once access is
    /// granted to this or another account, and a settled rejection on iOS only:
    /// Google Play refunds a rejected purchase left unacknowledged, while iOS
    /// would redeliver it forever.
    /// </summary>
    public Task<PurchaseFlowStatus> ProcessPurchaseAsync(Purchase purchase)
    {
        ArgumentNullException.ThrowIfNull(purchase);
        return Deliver(purchase, requested: true, reconfirm: false);
    }

    /// <summary>
    /// Runs unfinished purchases, or every owned one with
    /// <paramref name="includeFinished"/> for a restore button, through the
    /// flow one at a time; a call made while a pass runs shares it. Throws if
    /// it meets an Apple purchase without
    /// <see cref="PurchaseFlowOptions.GetPendingTransactionsIOS"/>.
    /// </summary>
    public Task<IReadOnlyList<PurchaseFlowOutcome>> RecoverPurchasesAsync(bool includeFinished = false)
    {
        var pass = new TaskCompletionSource<IReadOnlyList<PurchaseFlowOutcome>>(TaskCreationOptions.RunContinuationsAsynchronously);
        lock (_gate)
        {
            if (_recoveries.TryGetValue(includeFinished, out var running)) return running;
            _recoveries[includeFinished] = pass.Task;
        }
        _ = CompleteRecoveryAsync(includeFinished, pass);
        return pass.Task;
    }

    /// <summary>
    /// Stops listening, publishing, and any recovery pass; confirmations already
    /// running still finish. Call it when the signed-in account changes, then
    /// create the next account's flow. Without an
    /// <see cref="PurchaseFlowOptions.OutcomeContext"/>, call it on the thread
    /// that raises outcomes, or one being raised elsewhere still arrives.
    /// </summary>
    public void Dispose()
    {
        _disposed = true;
        OutcomePublished = null;
        _subscription?.Dispose();
    }

    // Registers the run before anything awaits, so deliveries that arrive together share it.
    private Task<PurchaseFlowStatus> Deliver(Purchase purchase, bool requested, bool reconfirm)
    {
        PurchaseFlowStatus? immediate;
        Run? run = null;
        var started = false;
        lock (_gate)
        {
            immediate = ImmediateStatus(purchase, reconfirm);
            if (immediate is null)
            {
                if (_runs.TryGetValue(purchase.Id, out run))
                {
                    run.Latest = purchase;
                    run.Requested |= requested;
                }
                else
                {
                    run = new Run(purchase, requested);
                    _runs[purchase.Id] = run;
                    started = true;
                }
            }
        }
        if (immediate is not null)
        {
            var status = ForDelivery(purchase, immediate, requested);
            Publish(new PurchaseFlowOutcome(purchase, status));
            return Task.FromResult(status);
        }
        if (started) _ = RunAsync(purchase, run!);
        return ForDeliveryAsync(purchase, run!.Completion.Task, requested);
    }

    private static async Task<PurchaseFlowStatus> ForDeliveryAsync(
        Purchase purchase,
        Task<PurchaseFlowStatus> run,
        bool requested) => ForDelivery(purchase, await run.ConfigureAwait(false), requested);

    private PurchaseFlowStatus? ImmediateStatus(Purchase purchase, bool reconfirm)
    {
        try
        {
            AssertSupportedPurchase(purchase);
        }
        catch (InvalidOperationException error)
        {
            return new PurchaseFlowStatus.Failed(error);
        }
        // Payment is not complete; the store delivers the purchase again once it is.
        if (purchase.PurchaseState == PurchaseState.Pending) return new PurchaseFlowStatus.StorePending();
        return reconfirm || _runs.ContainsKey(purchase.Id) ? null : _settled.GetValueOrDefault(purchase.Id);
    }

    private async Task RunAsync(Purchase purchase, Run run)
    {
        var status = await ConfirmAndFinishAsync(purchase).ConfigureAwait(false);
        PurchaseFlowOutcome outcome;
        lock (_gate)
        {
            _runs.Remove(purchase.Id);
            if (IsSettled(status)) _settled[purchase.Id] = status;
            outcome = new PurchaseFlowOutcome(run.Latest, ForDelivery(run.Latest, status, run.Requested));
        }
        try
        {
            Publish(outcome);
        }
        finally
        {
            // A throwing OutcomeContext must not leave the waiters hanging.
            run.Completion.SetResult(status);
        }
    }

    private async Task<PurchaseFlowStatus> ConfirmAndFinishAsync(Purchase purchase)
    {
        PurchaseConfirmation? confirmation;
        Task<PurchaseConfirmation?>? answer = null;
        try
        {
            var isConsumable = _options.IsConsumable(purchase.ProductId);
            answer = _options.ConfirmWithBackend(purchase, isConsumable);
            confirmation = PurchaseConfirmation.Read(await answer.WaitAsync(_confirmTimeout).ConfigureAwait(false));
        }
        catch (TimeoutException) when (answer is { IsCompleted: false })
        {
            // The abandoned call may still fail; observe it so the failure is not reported as unobserved.
            _ = answer.ContinueWith(
                static task => _ = task.Exception,
                CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
            return new PurchaseFlowStatus.Failed(new TimeoutException(
                $"ConfirmWithBackend did not answer within {_confirmTimeout.TotalMilliseconds} ms"));
        }
        catch (Exception error)
        {
            return new PurchaseFlowStatus.Failed(error);
        }
        if (confirmation is null)
        {
            return new PurchaseFlowStatus.Failed(new InvalidOperationException("Unrecognized purchase confirmation from the backend"));
        }
        // Finishing settles a purchase for good, so only a settled verdict does.
        return confirmation switch
        {
            PurchaseConfirmation.Entitled => await FinishAsync(purchase, confirmation).ConfigureAwait(false),
            PurchaseConfirmation.OwnershipConflict { AlreadyGranted: true }
                => await FinishAsync(purchase, confirmation).ConfigureAwait(false),
            PurchaseConfirmation.Invalid or PurchaseConfirmation.TestAccountRestricted when purchase.Store == IapStore.Apple
                => await FinishAsync(purchase, confirmation).ConfigureAwait(false),
            _ => ToStatus(confirmation, finishError: null),
        };
    }

    private async Task<PurchaseFlowStatus> FinishAsync(Purchase purchase, PurchaseConfirmation confirmation)
    {
        try
        {
            var isConsumable = _options.IsConsumable(purchase.ProductId);
            // Play keeps an acknowledged purchase finished; a restore need not redo it.
            if (purchase is PurchaseAndroid { IsAcknowledgedAndroid: true } && !isConsumable)
            {
                return ToStatus(confirmation, finishError: null);
            }
            await _finishTransaction(purchase, isConsumable).ConfigureAwait(false);
            return ToStatus(confirmation, finishError: null);
        }
        catch (Exception finishError)
        {
            return ToStatus(confirmation, finishError);
        }
    }

    private static PurchaseFlowStatus ToStatus(PurchaseConfirmation confirmation, Exception? finishError) => confirmation switch
    {
        PurchaseConfirmation.StorePending => new PurchaseFlowStatus.StorePending(),
        PurchaseConfirmation.VerificationDelayed delayed => new PurchaseFlowStatus.VerificationDelayed(delayed.RetryAfterMs),
        PurchaseConfirmation.OwnershipConflict conflict => new PurchaseFlowStatus.OwnershipConflict(conflict.AlreadyGranted, finishError),
        PurchaseConfirmation.TestAccountRestricted => new PurchaseFlowStatus.TestAccountRestricted(finishError),
        PurchaseConfirmation.Invalid invalid => new PurchaseFlowStatus.Invalid(invalid.Reason, finishError),
        PurchaseConfirmation.Verified verified => new PurchaseFlowStatus.Verified(verified.RetryAfterMs),
        PurchaseConfirmation.Linked linked => new PurchaseFlowStatus.Linked(linked.RetryAfterMs),
        PurchaseConfirmation.Entitled entitled => new PurchaseFlowStatus.Entitled(entitled.AlreadyGranted, finishError),
        _ => throw new ArgumentOutOfRangeException(nameof(confirmation)),
    };

    // Marked per delivery: a shared run may have started from an older copy of
    // the purchase, before Play attached the pending change.
    private static PurchaseFlowStatus ForDelivery(Purchase purchase, PurchaseFlowStatus status, bool requested) => status switch
    {
        PurchaseFlowStatus.Entitled entitled when purchase is PurchaseAndroid { PendingPurchaseUpdateAndroid: not null }
            => entitled with { ChangePending = true },
        // An old expired renewal must not ask a subscriber to buy again.
        PurchaseFlowStatus.Invalid invalid when !requested => invalid with { Recovered = true },
        _ => status,
    };

    // A settled purchase is finished, or rejected for good where the store
    // settles it, so the same delivery need not be confirmed again.
    private static bool IsSettled(PurchaseFlowStatus status) => status switch
    {
        PurchaseFlowStatus.Entitled { FinishError: null } => true,
        PurchaseFlowStatus.Invalid { FinishError: null } => true,
        PurchaseFlowStatus.TestAccountRestricted { FinishError: null } => true,
        PurchaseFlowStatus.OwnershipConflict { AlreadyGranted: true, FinishError: null } => true,
        _ => false,
    };

    private void Publish(PurchaseFlowOutcome outcome)
    {
        if (_options.OutcomeContext is { } context) context.Post(_ => Raise(outcome), null);
        else Raise(outcome);
    }

    private void Raise(PurchaseFlowOutcome outcome)
    {
        if (_disposed) return;
        foreach (var handler in OutcomePublished?.GetInvocationList() ?? Array.Empty<Delegate>())
        {
            try
            {
                ((EventHandler<PurchaseFlowOutcome>)handler)(this, outcome);
            }
            catch
            {
                // One subscriber's error must not keep the outcome from the others.
            }
        }
    }

    // The pass leaves _recoveries before its callers resume, so a later call starts a new one.
    private async Task CompleteRecoveryAsync(bool includeFinished, TaskCompletionSource<IReadOnlyList<PurchaseFlowOutcome>> pass)
    {
        IReadOnlyList<PurchaseFlowOutcome>? outcomes = null;
        Exception? failure = null;
        try
        {
            outcomes = await RecoverAsync(includeFinished).ConfigureAwait(false);
        }
        catch (Exception error)
        {
            failure = error;
        }
        lock (_gate) _recoveries.Remove(includeFinished);
        if (failure is null) pass.SetResult(outcomes!);
        else pass.SetException(failure);
    }

    private async Task<IReadOnlyList<PurchaseFlowOutcome>> RecoverAsync(bool includeFinished)
    {
        var getPendingTransactionsIOS = _options.GetPendingTransactionsIOS;
        // iOS lists unfinished transactions directly; other stores list owned
        // purchases, and IsUnfinished picks the ones still to settle.
        IReadOnlyList<Purchase>? pendingIOS = null;
        var pendingIOSFailed = false;
        if (getPendingTransactionsIOS is not null)
        {
            try
            {
                pendingIOS = await getPendingTransactionsIOS().ConfigureAwait(false);
            }
            catch (Exception)
            {
                // One unverified transaction fails the whole list. Re-confirming a
                // finished purchase is safe, so every owned Apple purchase stands in.
                pendingIOSFailed = true;
            }
        }
        IReadOnlyList<Purchase> available = includeFinished || pendingIOS is null
            ? await _getAvailablePurchases().ConfigureAwait(false)
            : Array.Empty<Purchase>();
        if (getPendingTransactionsIOS is null && available.Any(purchase => purchase.Store == IapStore.Apple))
        {
            throw new InvalidOperationException(
                "RecoverPurchasesAsync needs GetPendingTransactionsIOS on iOS to find unfinished transactions");
        }
        var unfinished = available.Where(purchase =>
            includeFinished || (purchase.Store == IapStore.Apple ? pendingIOSFailed : IsUnfinished(purchase)));
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var outcomes = new List<PurchaseFlowOutcome>();
        foreach (var purchase in (pendingIOS ?? Array.Empty<Purchase>()).Concat(unfinished).Where(p => seen.Add(p.Id)).ToList())
        {
            // The next account's flow confirms the rest with its own session.
            if (_disposed) break;
            bool skip;
            lock (_gate) skip = !includeFinished && _settled.ContainsKey(purchase.Id);
            if (skip) continue;
            var status = await Deliver(purchase, requested: false, reconfirm: includeFinished).ConfigureAwait(false);
            outcomes.Add(new PurchaseFlowOutcome(purchase, status));
        }
        return outcomes;
    }

    private bool IsUnfinished(Purchase purchase) => purchase.Store switch
    {
        // Amazon reports no acknowledgment, and approves a Kids purchase later,
        // so every listed purchase is confirmed again.
        IapStore.Amazon => true,
        // Horizon's acknowledgment does nothing; a listed consumable is unconsumed.
        IapStore.Horizon => purchase is PurchaseAndroid { IsAcknowledgedAndroid: false }
            || _options.IsConsumable(purchase.ProductId),
        _ => purchase is PurchaseAndroid { IsAcknowledgedAndroid: false },
    };

    internal static void AssertSupportedPurchase(Purchase purchase)
    {
        if (purchase.Quantity != 1)
        {
            throw new InvalidOperationException("Purchase flow supports only single-unit purchases");
        }
        if ((purchase.Ids ?? Array.Empty<string>()).Distinct(StringComparer.Ordinal).Count() > 1)
        {
            throw new InvalidOperationException(
                "Purchase flow cannot finish a multi-product purchase before every product is granted");
        }
    }

    private sealed class Run(Purchase latest, bool requested)
    {
        public Purchase Latest { get; set; } = latest;
        public bool Requested { get; set; } = requested;
        public TaskCompletionSource<PurchaseFlowStatus> Completion { get; } = new();
    }
}
