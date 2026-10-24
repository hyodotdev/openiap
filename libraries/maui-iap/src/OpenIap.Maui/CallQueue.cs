// Runs calls one at a time in call order; the platforms connect and disconnect through it.

#nullable enable

using System;
using System.Threading.Tasks;

namespace OpenIap.Maui;

internal sealed class CallQueue
{
    private readonly object _lock = new();
    private Task _tail = Task.CompletedTask;

    public async Task<T> RunAsync<T>(Func<Task<T>> call)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Task previous;
        lock (_lock)
        {
            previous = _tail;
            _tail = done.Task;
        }
        try
        {
            // Resumes on the caller's context: a store call may need the UI thread.
            await previous;
            return await call().ConfigureAwait(false);
        }
        finally
        {
            done.SetResult();
        }
    }
}
