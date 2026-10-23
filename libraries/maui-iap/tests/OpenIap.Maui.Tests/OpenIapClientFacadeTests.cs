// OpenIapClient facade behaviour on the shared (non-platform) TFM:
// factory fallback to UnsupportedOpenIap, instance caching, the
// OverrideInstance test-injection hook, and the purchase-flow binding.
//
// NOTE: OpenIapClient.Instance and the requested-SKU marks are process-global
// state, so everything that touches them lives in this single test class
// (xUnit runs the methods of one class sequentially) and restores a fresh
// fallback instance afterwards.

using OpenIap.Maui.Tests.TestSupport;
using Xunit;

namespace OpenIap.Maui.Tests;

public class OpenIapClientFacadeTests
{
    [Fact]
    public void OverrideInstance_RejectsNull()
        => Assert.Throws<ArgumentNullException>(() => OpenIapClient.OverrideInstance(null!));

    [Fact]
    public async Task UnsupportedTarget_ResolversRejectEveryCallAsFeatureNotSupported()
    {
        var fallback = new UnsupportedOpenIap();
        var operations = typeof(QueryResolver).GetMethods().Concat(typeof(MutationResolver).GetMethods()).ToList();
        Assert.True(operations.Count > 40, $"Expected every resolver operation, found {operations.Count}");

        foreach (var operation in operations)
        {
            var arguments = operation.GetParameters()
                .Select(parameter => parameter.ParameterType.IsValueType ? Activator.CreateInstance(parameter.ParameterType) : null)
                .ToArray();
            var task = Assert.IsAssignableFrom<Task>(operation.Invoke(fallback, arguments));
            var error = await Assert.ThrowsAsync<OpenIapException>(() => task);
            Assert.Equal(ErrorCode.FeatureNotSupported, error.Error.Code);
            Assert.Contains(operation.Name, error.Message, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task InstanceLifecycle_FallsBackToUnsupportedAndHonorsOverrides()
    {
        try
        {
            // On net10.0 (no platform identifier) the factory resolves the
            // UnsupportedOpenIap fallback once, even when first reads race.
            // No other test in this assembly touches Instance.
            var first = await Task.WhenAll(Enumerable.Range(0, 32).Select(_ => Task.Run(() => OpenIapClient.Instance)));
            var initial = first[0];
            Assert.All(first, instance => Assert.Same(initial, instance));
            Assert.IsType<UnsupportedOpenIap>(initial);
            Assert.IsAssignableFrom<QueryResolver>(initial);

            // Listener contract defaults: every stream is a non-null empty
            // observable that accepts subscriptions and never emits.
            Assert.NotNull(initial.PurchaseError);
            Assert.NotNull(initial.PromotedProductIOS);
            Assert.NotNull(initial.SubscriptionBillingIssue);
            Assert.NotNull(initial.UserChoiceBillingAndroid);
            Assert.NotNull(initial.DeveloperProvidedBillingAndroid);
            Assert.Same(initial.PurchaseUpdated, initial.PurchaseUpdatedWithOptions());
            Assert.Same(
                initial.PurchaseUpdated,
                initial.PurchaseUpdatedWithOptions(new PurchaseUpdatedListenerOptions
                {
                    DedupeTransactionIOS = false,
                }));

            var received = new List<Purchase>();
            using (var subscription = initial.PurchaseUpdated.Subscribe(received.Add))
            {
                Assert.NotNull(subscription);
            }
            Assert.Empty(received);

            // OverrideInstance swaps the resolved instance…
            var fakeA = new DisposableFakeIap();
            OpenIapClient.OverrideInstance(fakeA);
            Assert.Same(fakeA, OpenIapClient.Instance);

            // …disposing the replaced instance when it is IDisposable…
            var fakeB = new DisposableFakeIap();
            OpenIapClient.OverrideInstance(fakeB);
            Assert.True(fakeA.Disposed);
            Assert.Same(fakeB, OpenIapClient.Instance);

            // …but never disposing an instance replaced by itself.
            OpenIapClient.OverrideInstance(fakeB);
            Assert.False(fakeB.Disposed);
        }
        finally
        {
            OpenIapClient.OverrideInstance(new UnsupportedOpenIap());
        }
    }

    [Fact]
    public void QueryAndMutation_ExposeTheInstanceResolvers()
    {
        try
        {
            var fallback = new UnsupportedOpenIap();
            OpenIapClient.OverrideInstance(fallback);
            Assert.Same(fallback, OpenIapClient.Query);
            Assert.Same(fallback, OpenIapClient.Mutation);

            OpenIapClient.OverrideInstance(new DisposableFakeIap());
            Assert.Throws<InvalidOperationException>(() => OpenIapClient.Query);
            Assert.Throws<InvalidOperationException>(() => OpenIapClient.Mutation);
        }
        finally
        {
            OpenIapClient.OverrideInstance(new UnsupportedOpenIap());
        }
    }

    [Fact]
    public async Task PurchaseRequests_MarkEveryRequestedSkuAndClearWhenARequestFails()
    {
        try
        {
            await PurchaseRequests.Track(
                new RequestPurchaseProps
                {
                    Type = ProductQueryType.InApp,
                    RequestPurchase = new() { Apple = new() { Sku = "coins" }, Google = new() { Skus = ["coins"] } },
                },
                () => Task.FromResult(0));
            Assert.True(PurchaseRequests.Take(PurchaseFlowTests.Play("GPA.1", "coins")));
            Assert.False(PurchaseRequests.Take(PurchaseFlowTests.Play("GPA.1", "coins")));

            await Assert.ThrowsAsync<InvalidOperationException>(() => PurchaseRequests.Track(
                SubscriptionRequest("premium"),
                () => Task.FromException<int>(new InvalidOperationException("cancelled"))));
            Assert.False(PurchaseRequests.Take(PurchaseFlowTests.Play("GPA.2", "premium")));
        }
        finally
        {
            PurchaseRequests.Clear();
        }
    }

    [Fact]
    public async Task CreatePurchaseFlow_ListensToTheInstanceAndKnowsWhatTheUserRequested()
    {
        var store = new StreamingFakeIap();
        var confirmed = new List<string>();
        var published = new List<PurchaseFlowOutcome>();
        var context = new RecordingContext();
        var previous = SynchronizationContext.Current;
        try
        {
            OpenIapClient.OverrideInstance(store);
            SynchronizationContext.SetSynchronizationContext(context);
            var flow = OpenIapClient.CreatePurchaseFlow(new PurchaseFlowOptions
            {
                ConfirmWithBackend = (purchase, _) =>
                {
                    confirmed.Add(purchase.Id);
                    return Task.FromResult<PurchaseConfirmation?>(new PurchaseConfirmation.Invalid("expired"));
                },
                IsConsumable = _ => false,
            });
            SynchronizationContext.SetSynchronizationContext(previous);
            flow.OutcomePublished += (_, outcome) => published.Add(outcome);

            // A plan change delivers the current plan with the requested one pending.
            await PurchaseRequests.Track(SubscriptionRequest("premium_yearly"), () => Task.FromResult(0));
            store.Updates.OnNext(PurchaseFlowTests.Play("GPA.1", "premium_monthly") with
            {
                PendingPurchaseUpdateAndroid = new() { Products = ["premium_yearly"], PurchaseToken = "token" },
            });
            store.Updates.OnNext(PurchaseFlowTests.Play("GPA.2", "premium_yearly"));
            await PurchaseRequests.Track(SubscriptionRequest("premium_yearly"), () => Task.FromResult(0));
            store.Errors.OnNext(new PurchaseError { Code = ErrorCode.UserCancelled, Message = "cancelled" });
            store.Updates.OnNext(PurchaseFlowTests.Play("GPA.3", "premium_yearly"));

            // Outcomes arrive on the context current when the flow was created.
            Assert.Empty(published);
            context.RunPosted();
            Assert.Equal(
                [("GPA.1", false), ("GPA.2", true), ("GPA.3", true)],
                published.Select(outcome =>
                    (outcome.Purchase.Id, Assert.IsType<PurchaseFlowStatus.Invalid>(outcome.Status).Recovered)));

            flow.Dispose();
            store.Updates.OnNext(PurchaseFlowTests.Play("GPA.4"));
            Assert.Equal(["GPA.1", "GPA.2", "GPA.3"], confirmed);
        }
        finally
        {
            SynchronizationContext.SetSynchronizationContext(previous);
            PurchaseRequests.Clear();
            OpenIapClient.OverrideInstance(new UnsupportedOpenIap());
        }
    }

    [Fact]
    public async Task CreatePurchaseFlow_FinishesAndRecoversThroughTheInstance()
    {
        try
        {
            OpenIapClient.OverrideInstance(new UnsupportedOpenIap());
            using var flow = OpenIapClient.CreatePurchaseFlow(new PurchaseFlowOptions
            {
                ConfirmWithBackend = PurchaseFlowTests.Answer(new PurchaseConfirmation.Entitled(false)),
                IsConsumable = _ => false,
            });

            var status = Assert.IsType<PurchaseFlowStatus.Entitled>(await flow.ProcessPurchaseAsync(PurchaseFlowTests.Play()));

            var finishError = Assert.IsType<OpenIapException>(status.FinishError);
            Assert.Contains(nameof(MutationResolver.FinishTransactionAsync), finishError.Message, StringComparison.Ordinal);
            var readError = await Assert.ThrowsAsync<OpenIapException>(() => flow.RecoverPurchasesAsync());
            Assert.Contains(nameof(QueryResolver.GetAvailablePurchasesAsync), readError.Message, StringComparison.Ordinal);
        }
        finally
        {
            OpenIapClient.OverrideInstance(new UnsupportedOpenIap());
        }
    }

    private static RequestPurchaseProps SubscriptionRequest(string sku) => new()
    {
        Type = ProductQueryType.Subs,
        RequestSubscription = new() { Apple = new() { Sku = sku }, Google = new() { Skus = [sku] } },
    };

    private sealed class StreamingFakeIap : IOpenIap
    {
        public Subject<Purchase> Updates { get; } = new();
        public Subject<PurchaseError> Errors { get; } = new();

        public IObservable<Purchase> PurchaseUpdated => Updates;

        public IObservable<Purchase> PurchaseUpdatedWithOptions(PurchaseUpdatedListenerOptions? options = null) => Updates;

        public IObservable<PurchaseError> PurchaseError => Errors;

        public IObservable<string> PromotedProductIOS => EmptyObservable<string>.Instance;

        public IObservable<Purchase> SubscriptionBillingIssue => EmptyObservable<Purchase>.Instance;

        public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid
            => EmptyObservable<UserChoiceBillingDetails>.Instance;

        public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid
            => EmptyObservable<DeveloperProvidedBillingDetailsAndroid>.Instance;
    }

    private sealed class DisposableFakeIap : IOpenIap, IDisposable
    {
        public bool Disposed { get; private set; }

        public IObservable<Purchase> PurchaseUpdated => EmptyObservable<Purchase>.Instance;

        public IObservable<Purchase> PurchaseUpdatedWithOptions(PurchaseUpdatedListenerOptions? options = null)
            => PurchaseUpdated;

        public IObservable<PurchaseError> PurchaseError => EmptyObservable<PurchaseError>.Instance;

        public IObservable<string> PromotedProductIOS => EmptyObservable<string>.Instance;

        public IObservable<Purchase> SubscriptionBillingIssue => EmptyObservable<Purchase>.Instance;

        public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid
            => EmptyObservable<UserChoiceBillingDetails>.Instance;

        public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid
            => EmptyObservable<DeveloperProvidedBillingDetailsAndroid>.Instance;

        public void Dispose() => Disposed = true;
    }
}
