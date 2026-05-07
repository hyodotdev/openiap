// Fallback implementation for non-platform targets (shared MAUI code that is
// compiled before TFM resolution). Returns empty observables so consumers can
// subscribe in cross-platform initializers without crashing — actual purchase
// flow only runs on the iOS / Android targets.

#nullable enable

using System;
using OpenIap;

namespace OpenIap.Maui;

internal sealed class UnsupportedOpenIap : IOpenIap
{
    public IObservable<Purchase> PurchaseUpdated => EmptyObservable<Purchase>.Instance;
    public IObservable<PurchaseError> PurchaseError => EmptyObservable<PurchaseError>.Instance;
    public IObservable<string> PromotedProductIOS => EmptyObservable<string>.Instance;
    public IObservable<Purchase> SubscriptionBillingIssue => EmptyObservable<Purchase>.Instance;
    public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid => EmptyObservable<UserChoiceBillingDetails>.Instance;
    public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid => EmptyObservable<DeveloperProvidedBillingDetailsAndroid>.Instance;
}

internal sealed class EmptyObservable<T> : IObservable<T>
{
    public static readonly EmptyObservable<T> Instance = new();
    public IDisposable Subscribe(IObserver<T> observer) => NoopDisposable.Instance;
}

internal sealed class NoopDisposable : IDisposable
{
    public static readonly NoopDisposable Instance = new();
    public void Dispose() { }
}
