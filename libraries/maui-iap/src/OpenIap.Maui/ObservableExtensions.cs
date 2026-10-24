// Lightweight `Subscribe(Action<T>)` overload so consumers can use the
// listener streams without pulling in `System.Reactive`. Mirrors the
// minimum-useful subset of Rx's IObservable<T>.Subscribe extension.

#nullable enable

using System;
using System.Threading;

namespace OpenIap.Maui;

public static class ObservableExtensions
{
    public static IDisposable Subscribe<T>(this IObservable<T> source, Action<T> onNext)
    {
        if (source is null) throw new ArgumentNullException(nameof(source));
        if (onNext is null) throw new ArgumentNullException(nameof(onNext));
        return source.Subscribe(new DelegateObserver<T>(onNext, _ => { }, () => { }));
    }

    public static IDisposable Subscribe<T>(this IObservable<T> source, Action<T> onNext, Action<Exception> onError)
    {
        if (source is null) throw new ArgumentNullException(nameof(source));
        if (onNext is null) throw new ArgumentNullException(nameof(onNext));
        if (onError is null) throw new ArgumentNullException(nameof(onError));
        return source.Subscribe(new DelegateObserver<T>(onNext, onError, () => { }));
    }

    /// <summary>
    /// Delivers the stream through the synchronization context current at this
    /// call, the UI thread's when called from UI code; nothing arrives once the
    /// subscription is disposed. Without a context, values arrive on the thread
    /// that produced them.
    /// </summary>
    public static IObservable<T> ObserveOnCurrentContext<T>(this IObservable<T> source)
    {
        if (source is null) throw new ArgumentNullException(nameof(source));
        var context = SynchronizationContext.Current;
        if (context is null) return source;
        return new DelegateObservable<T>(observer =>
        {
            var posting = new ContextObserver<T>(observer, context);
            var subscription = source.Subscribe(posting);
            return new DisposableAction(() =>
            {
                posting.Stop();
                subscription.Dispose();
            });
        });
    }

    private sealed class ContextObserver<T>(IObserver<T> observer, SynchronizationContext context) : IObserver<T>
    {
        private volatile bool _stopped;

        public void Stop() => _stopped = true;
        public void OnNext(T value) => Post(() => observer.OnNext(value));
        public void OnError(Exception error) => Post(() => observer.OnError(error));
        public void OnCompleted() => Post(observer.OnCompleted);

        private void Post(Action deliver) => context.Post(_ =>
        {
            if (!_stopped) deliver();
        }, null);
    }

    private sealed class DelegateObserver<T> : IObserver<T>
    {
        private readonly Action<T> _onNext;
        private readonly Action<Exception> _onError;
        private readonly Action _onCompleted;

        public DelegateObserver(Action<T> onNext, Action<Exception> onError, Action onCompleted)
        {
            _onNext = onNext;
            _onError = onError;
            _onCompleted = onCompleted;
        }

        public void OnNext(T value) => _onNext(value);
        public void OnError(Exception error) => _onError(error);
        public void OnCompleted() => _onCompleted();
    }
}
