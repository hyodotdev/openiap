#nullable enable

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>
/// Writes <see cref="Text"/> once per install, after a debug build of the host
/// app finishes its first purchase. Internal to OpenIap.Maui; not app API.
/// </summary>
internal sealed class FirstPurchaseNotice
{
    // Must match "consoleNotice" in packages/docs/community-touchpoints.json.
    internal static readonly string Text = string.Join('\n',
        "[OpenIAP] First purchase finished in this app 🎉",
        "If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap",
        "When your app ships, list it for free: https://openiap.dev/showcase",
        "(Shown once, debug builds only.)");

    private static readonly string[] TestFrameworkAssemblies = ["xunit", "nunit", "testhost"];

    private readonly Func<bool> _isHostDebuggable;
    private readonly Func<bool> _claim;
    private readonly Func<bool> _isTestRunner;
    private readonly Action<string> _write;
    private readonly Action<Action> _runInBackground;
    private int _claimAttempted;

    internal FirstPurchaseNotice(
        Func<bool> isHostDebuggable,
        Func<bool> claim,
        Func<bool>? isTestRunner = null,
        Action<string>? write = null,
        Action<Action>? runInBackground = null)
    {
        _isHostDebuggable = isHostDebuggable;
        _claim = claim;
        _isTestRunner = isTestRunner ?? IsTestFrameworkLoaded;
        _write = write ?? Console.WriteLine;
        _runInBackground = runInBackground ?? (work => Task.Run(work));
    }

    /// <summary>
    /// Awaits the finish, then starts the notice without waiting for it. A
    /// failed finish throws before the notice is considered.
    /// </summary>
    internal async Task<T> AfterFinish<T>(Purchase purchase, Func<Task<T>> finish)
    {
        var result = await finish();
        try
        {
            if (purchase.PurchaseState == PurchaseState.Purchased
                && !_isTestRunner()
                && _isHostDebuggable()
                && Interlocked.Exchange(ref _claimAttempted, 1) == 0)
            {
                _runInBackground(ClaimAndWrite);
            }
        }
        catch (Exception)
        {
            // The notice never changes the finish result.
        }
        return result;
    }

    internal static bool IsTestFrameworkLoaded() =>
        AppDomain.CurrentDomain.GetAssemblies().Any(assembly =>
            assembly.GetName().Name is { } name
            && TestFrameworkAssemblies.Any(prefix => name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)));

    private void ClaimAndWrite()
    {
        try
        {
            if (_claim()) _write(Text);
        }
        catch (Exception)
        {
            // A missing or failing flag store only skips the notice.
        }
    }
}
