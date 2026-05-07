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

    public IDisposable Subscribe(IObserver<T> observer)
    {
        if (observer is null) throw new ArgumentNullException(nameof(observer));
        lock (_lock) _observers.Add(observer);
        return new Subscription(this, observer);
    }

    /// <summary>
    /// Emit a value to every current observer. Snapshot first to avoid mutation
    /// during fan-out (an observer that unsubscribes during OnNext mustn't
    /// invalidate the iterator).
    /// </summary>
    public void OnNext(T value)
    {
        IObserver<T>[] snapshot;
        lock (_lock) snapshot = _observers.ToArray();
        foreach (var o in snapshot)
        {
            try { o.OnNext(value); } catch { /* swallow; one bad observer mustn't kill the stream */ }
        }
    }

    public void OnError(Exception error)
    {
        IObserver<T>[] snapshot;
        lock (_lock) snapshot = _observers.ToArray();
        foreach (var o in snapshot)
        {
            try { o.OnError(error); } catch { }
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
