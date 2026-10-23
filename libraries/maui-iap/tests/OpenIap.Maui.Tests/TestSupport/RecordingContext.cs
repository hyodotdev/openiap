namespace OpenIap.Maui.Tests.TestSupport;

/// <summary>A synchronization context that holds posted work until <see cref="RunPosted"/>.</summary>
internal sealed class RecordingContext : SynchronizationContext
{
    private readonly List<(SendOrPostCallback Callback, object? State)> _posted = new();

    public override void Post(SendOrPostCallback d, object? state)
    {
        lock (_posted) _posted.Add((d, state));
    }

    public void RunPosted()
    {
        List<(SendOrPostCallback Callback, object? State)> posted;
        lock (_posted)
        {
            posted = _posted.ToList();
            _posted.Clear();
        }
        foreach (var (callback, state) in posted) callback(state);
    }
}
