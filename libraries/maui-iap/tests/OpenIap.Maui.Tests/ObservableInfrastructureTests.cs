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
    public void Subject_CompletionReachesObserversAndReleasesThem()
    {
        var subject = new Subject<int>();
        var observer = new RecordingObserver();

        using var subscription = subject.Subscribe(observer);
        subject.OnCompleted();
        subject.OnNext(1);

        Assert.Equal(1, observer.Completions);
        Assert.Empty(observer.Values);
    }

    [Fact]
    public void Subject_CompletionDuringFanOutStopsDeliveryAndCompletesLateSubscribers()
    {
        var subject = new Subject<int>();
        // The first observer ends the stream from its callback, as disposing the client does.
        var completing = new RecordingObserver(onNext: subject.OnCompleted);
        var second = new RecordingObserver();
        using var first = subject.Subscribe(completing);
        using var other = subject.Subscribe(second);

        subject.OnNext(1);
        var late = new RecordingObserver();
        using var lateSubscription = subject.Subscribe(late);

        Assert.Equal(1, second.Completions);
        Assert.Empty(second.Values);
        Assert.Equal(1, late.Completions);
    }

    private sealed class RecordingObserver(Action? onNext = null) : IObserver<int>
    {
        public List<int> Values { get; } = new();
        public int Completions { get; private set; }
        public void OnNext(int value)
        {
            Values.Add(value);
            onNext?.Invoke();
        }
        public void OnError(Exception error) { }
        public void OnCompleted() => Completions++;
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

    [Fact]
    public void ObserveOnCurrentContext_PostsToTheCallersContextUntilDisposed()
    {
        var subject = new Subject<int>();
        var seen = new List<int>();
        var context = new TestSupport.RecordingContext();
        var previous = SynchronizationContext.Current;
        SynchronizationContext.SetSynchronizationContext(context);
        IObservable<int> observed;
        try
        {
            observed = subject.ObserveOnCurrentContext();
        }
        finally
        {
            SynchronizationContext.SetSynchronizationContext(previous);
        }
        var subscription = observed.Subscribe(seen.Add);

        // Emitted off the context; delivered only when the context runs it.
        subject.OnNext(1);
        Assert.Empty(seen);
        context.RunPosted();
        Assert.Equal([1], seen);

        subject.OnNext(2);
        subscription.Dispose();
        context.RunPosted();
        Assert.Equal([1], seen);
    }

    [Fact]
    public void ObserveOnCurrentContext_PassesThroughWithoutAContext()
    {
        var subject = new Subject<int>();
        IObservable<int>? observed = null;
        var thread = new Thread(() => observed = subject.ObserveOnCurrentContext());
        thread.Start();
        thread.Join();

        Assert.Same(subject, observed);
    }
}
