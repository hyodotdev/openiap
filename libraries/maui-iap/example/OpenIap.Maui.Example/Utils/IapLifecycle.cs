using Hyo.OpenIap;
using OpenIap.Maui;

namespace OpenIap.Maui.Example.Utils;

internal static class IapLifecycle
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static async Task<bool> InitConnectionAsync(InitConnectionConfig? config = null)
    {
        await Gate.WaitAsync();
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            return await mutate.InitConnectionAsync(config).WaitAsync(TimeSpan.FromSeconds(15));
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task EndConnectionQuietlyAsync(string owner)
    {
        await Gate.WaitAsync();
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.EndConnectionAsync().WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{owner}] endConnection failed: {ErrorUtils.ExtractErrorMessage(ex)}");
        }
        finally
        {
            Gate.Release();
        }
    }
}
