// Minimal hot-stream Subject — keeps OpenIap.Maui free of System.Reactive.
// Mirrors the behaviour kmp-iap gets from MutableSharedFlow (drop-oldest, fan-out
// to multiple observers). Thread-safe writes; subscribers never block emission.

#nullable enable

using System;
using System.Collections.Generic;
using System.Threading;

namespace OpenIap.Maui;

internal sealed class Subject<T> : IObservable<T>
{
    private readonly List<IObserver<T>> _observers = new();
    private readonly object _lock = new();
    private volatile bool _completed;

    public IDisposable Subscribe(IObserver<T> observer)
    {
        if (observer is null) throw new ArgumentNullException(nameof(observer));
        bool completed;
        lock (_lock)
        {
            completed = _completed;
            if (!completed) _observers.Add(observer);
        }
        if (completed) observer.OnCompleted();
        return new Subscription(this, observer);
    }

    public void OnNext(T value) => Emit(o => o.OnNext(value));

    public void OnError(Exception error) => Emit(o => o.OnError(error));

    /// <summary>
    /// Fans out over a snapshot, so an observer that unsubscribes mid-emission
    /// can't invalidate the iterator, and stops as soon as the stream completes.
    /// </summary>
    private void Emit(Action<IObserver<T>> deliver)
    {
        IObserver<T>[] snapshot;
        lock (_lock) snapshot = _observers.ToArray();
        foreach (var o in snapshot)
        {
            if (_completed) return;
            try { deliver(o); } catch { /* swallow; one bad observer mustn't kill the stream */ }
        }
    }

    /// <summary>Ends the stream: current observers complete and are released; later ones complete at once.</summary>
    public void OnCompleted()
    {
        IObserver<T>[] snapshot;
        lock (_lock)
        {
            _completed = true;
            snapshot = _observers.ToArray();
            _observers.Clear();
        }
        foreach (var o in snapshot)
        {
            try { o.OnCompleted(); } catch { }
        }
    }

    private void Unsubscribe(IObserver<T> observer)
    {
        lock (_lock) _observers.Remove(observer);
    }

    private sealed class Subscription : IDisposable
    {
        private Subject<T>? _subject;
        private IObserver<T>? _observer;

        public Subscription(Subject<T> subject, IObserver<T> observer)
        {
            _subject = subject;
            _observer = observer;
        }

        public void Dispose()
        {
            var subj = Interlocked.Exchange(ref _subject, null);
            var obs = Interlocked.Exchange(ref _observer, null);
            if (subj is not null && obs is not null) subj.Unsubscribe(obs);
        }
    }
}

internal sealed class DelegateObservable<T> : IObservable<T>
{
    private readonly Func<IObserver<T>, IDisposable> _subscribe;

    public DelegateObservable(Func<IObserver<T>, IDisposable> subscribe)
    {
        _subscribe = subscribe ?? throw new ArgumentNullException(nameof(subscribe));
    }

    public IDisposable Subscribe(IObserver<T> observer) => _subscribe(observer);
}

internal sealed class DisposableAction : IDisposable
{
    private Action? _dispose;

    public DisposableAction(Action dispose)
    {
        _dispose = dispose ?? throw new ArgumentNullException(nameof(dispose));
    }

    public void Dispose()
    {
        Interlocked.Exchange(ref _dispose, null)?.Invoke();
    }
}
