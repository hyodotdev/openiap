using System.Runtime.CompilerServices;

namespace OpenIap.Maui.Tests.TestSupport;

/// <summary>
/// A single-threaded loop like JavaScript's: work queued with <see cref="Yield"/>
/// runs in order on the calling thread, and <see cref="Run"/> returns once none
/// is left. It runs without a synchronization context, so the flow's
/// ConfigureAwait(false) continuations run inline on this thread.
/// </summary>
internal sealed class EventLoop
{
    private readonly Queue<Action> _queue = new();

    /// <summary>Resumes the awaiting method on a later turn of the loop.</summary>
    public YieldAwaitable Yield() => new(this);

    /// <summary>Runs <paramref name="body"/> and everything it queues until the loop is idle.</summary>
    public void Run(Func<Task> body)
    {
        var previous = SynchronizationContext.Current;
        SynchronizationContext.SetSynchronizationContext(null);
        try
        {
            var task = body();
            Drain();
            // A TaskCompletionSource that runs continuations asynchronously finishes the body on the thread pool.
            if (!task.Wait(TimeSpan.FromSeconds(10))) throw new TimeoutException("The step did not finish.");
            Drain();
        }
        finally
        {
            SynchronizationContext.SetSynchronizationContext(previous);
        }
    }

    private void Drain()
    {
        while (true)
        {
            Action next;
            lock (_queue)
            {
                if (!_queue.TryDequeue(out next!)) return;
            }
            next();
        }
    }

    internal readonly struct YieldAwaitable(EventLoop loop) : INotifyCompletion
    {
        public YieldAwaitable GetAwaiter() => this;
        public bool IsCompleted => false;
        public void OnCompleted(Action continuation)
        {
            lock (loop._queue) loop._queue.Enqueue(continuation);
        }
        public void GetResult() { }
    }
}
