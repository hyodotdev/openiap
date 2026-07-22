// The System.Reactive-free listener plumbing: the public
// ObservableExtensions.Subscribe overloads and the internal Subject<T>
// hot stream every platform resolver emits through.

using Xunit;

namespace OpenIap.Maui.Tests;

public class ObservableInfrastructureTests
{
    [Fact]
    public void Subscribe_RejectsNullArguments()
    {
        var subject = new Subject<int>();

        Assert.Throws<ArgumentNullException>(
            () => ObservableExtensions.Subscribe<int>(null!, _ => { }));
        Assert.Throws<ArgumentNullException>(
            () => subject.Subscribe((Action<int>)null!));
        Assert.Throws<ArgumentNullException>(
            () => subject.Subscribe(_ => { }, null!));
    }

    [Fact]
    public void Subject_FansOutToEveryObserver()
    {
        var subject = new Subject<int>();
        var first = new List<int>();
        var second = new List<int>();

        var firstSubscription = subject.Subscribe(first.Add);
        using var secondSubscription = subject.Subscribe(second.Add);

        subject.OnNext(1);
        firstSubscription.Dispose();
        subject.OnNext(2);

        Assert.Equal(new[] { 1 }, first);
        Assert.Equal(new[] { 1, 2 }, second);
    }

    [Fact]
    public void Subject_ThrowingObserverDoesNotBreakOthers()
    {
        var subject = new Subject<int>();
        var seen = new List<int>();

        using var bad = subject.Subscribe(_ => throw new InvalidOperationException("bad observer"));
        using var good = subject.Subscribe(seen.Add);

        subject.OnNext(7);

        Assert.Equal(new[] { 7 }, seen);
    }

    [Fact]
    public void Subject_OnErrorReachesErrorCallback()
    {
        var subject = new Subject<int>();
        Exception? captured = null;

        using var subscription = subject.Subscribe(_ => { }, error => captured = error);
        subject.OnError(new InvalidOperationException("boom"));

        var invalidOperation = Assert.IsType<InvalidOperationException>(captured);
        Assert.Equal("boom", invalidOperation.Message);
    }

    [Fact]
    public void Subject_DisposeIsIdempotent()
    {
        var subject = new Subject<int>();
        var seen = new List<int>();

        var subscription = subject.Subscribe(seen.Add);
        subscription.Dispose();
        subscription.Dispose(); // second dispose must be a no-op

        subject.OnNext(5);
        Assert.Empty(seen);
    }
}
