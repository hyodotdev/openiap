// Lightweight `Subscribe(Action<T>)` overload so consumers can use the
// listener streams without pulling in `System.Reactive`. Mirrors the
// minimum-useful subset of Rx's IObservable<T>.Subscribe extension.

#nullable enable

using System;

namespace Hyo.OpenIap.Maui;

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
