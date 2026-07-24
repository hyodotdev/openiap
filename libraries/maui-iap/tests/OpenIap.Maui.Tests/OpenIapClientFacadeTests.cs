// OpenIapClient / Iap facade behaviour on the shared (non-platform) TFM:
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
    public void InstanceLifecycle_FallsBackToUnsupportedAndHonorsOverrides()
    {
        try
        {
            // On net9.0 (no platform identifier) the factory resolves the
            // UnsupportedOpenIap fallback and caches it. No other test in
            // this assembly touches Instance, so this is the first access.
            var initial = OpenIapClient.Instance;
            Assert.IsType<UnsupportedOpenIap>(initial);
            Assert.Same(initial, OpenIapClient.Instance);
#pragma warning disable CS0618 // Exercise the legacy facade until its 2.0.0 removal.
            Assert.Same(initial, Iap.Instance);
#pragma warning restore CS0618

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
#pragma warning disable CS0618 // Exercise the legacy facade until its 2.0.0 removal.
            Assert.Same(fakeA, Iap.Instance);
#pragma warning restore CS0618

            // …disposing the replaced instance when it is IDisposable…
            var fakeB = new DisposableFakeIap();
#pragma warning disable CS0618 // Exercise the legacy facade until its 2.0.0 removal.
            Iap.OverrideInstance(fakeB);
#pragma warning restore CS0618
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
