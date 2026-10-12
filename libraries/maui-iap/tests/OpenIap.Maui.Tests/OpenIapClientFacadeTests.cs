// OpenIapClient facade behaviour on the shared (non-platform) TFM:
// factory fallback to UnsupportedOpenIap, instance caching, and the
// OverrideInstance test-injection hook.
//
// NOTE: OpenIapClient.Instance is process-global state, so everything that
// touches it lives in this single test class (xUnit runs the methods of one
// class sequentially) and restores a fresh fallback instance afterwards.

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
